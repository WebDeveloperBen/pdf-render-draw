/**
 * Text + Wall Room Detector
 *
 * Detects rooms by combining PDF text extraction (exact room label positions)
 * with PDF path extraction (exact wall segment positions).
 *
 * Algorithm:
 * 1. Extract text items, filter for room-like labels
 * 2. Extract wall segments from PDF paths
 * 3. For each label, ray-cast in 4 cardinal directions to find nearest walls
 * 4. Construct room rectangle from wall boundaries
 *
 * No vision model needed — all data comes from PDF geometry.
 */

import type { PDFPageProxy } from "pdfjs-dist"
import type { Segment } from "@/types/snap"
import type { DetectedRoom, RoomDetectionResult } from "@/types/rooms"
import { extractWallSegments } from "./roomDetector"

// Room label patterns — common residential/commercial room names
const ROOM_LABEL_PATTERN =
  /^(bed\s*\d*|bath|ensuite|en-?suite|kitchen|living|family|dining|meals?|garage|hallway|hall|entry|foyer|laundry|l['']?dry|study|robe|wir|w\.?i\.?r|pantry|p['']?try|wc|w\.?c|toilet|store|linen|lounge|rumpus|theatre|media|office|nook|dressing|alfresco|patio|carport|porch|verandah|balcony|deck|mud\s*r?m?|butler|powder|p['']?dr|scullery|cellar|workshop|games?|sitting|retreat|master|walk.?in|brm?|ldry)/i

// Area label pattern — plans that use area measurements instead of names (e.g. "16.39m²", "73.50m²")
const AREA_LABEL_PATTERN = /^\d+\.?\d*\s*m[²2]$/i

// Labels to exclude — dimension-like or note text that matches patterns
const EXCLUDE_PATTERN = /^\d+$|^[A-Z]\d+$|^\d+\s*x\s*\d+|F\.?F\.?L|comply|BCA|NCC|clause|Australian|standard/i

// Minimum wall segment length to consider (in PDF points)
const MIN_WALL_LENGTH = 30

// Minimum room dimension (in PDF points) — ~10mm at 72dpi
const MIN_ROOM_DIM = 25

// Maximum ray-cast distance from label (in PDF points)
const MAX_RAY_DISTANCE = 400

interface TextLabel {
  text: string
  /** X in viewport coordinates */
  x: number
  /** Y in viewport coordinates */
  y: number
}

interface WallSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  isHorizontal: boolean
  isVertical: boolean
  length: number
}

/**
 * Extract room-like text labels from a PDF page with their viewport positions.
 */
export async function extractRoomLabels(page: PDFPageProxy): Promise<TextLabel[]> {
  const viewport = page.getViewport({ scale: 1 })
  const textContent = await page.getTextContent()
  const labels: TextLabel[] = []

  for (const item of textContent.items) {
    if (!("str" in item) || !item.str.trim()) continue
    const text = item.str.trim()
    if (text.length > 25 || text.length < 2) continue
    if (EXCLUDE_PATTERN.test(text)) continue
    if (!ROOM_LABEL_PATTERN.test(text) && !AREA_LABEL_PATTERN.test(text)) continue

    // transform[4]=x, transform[5]=y in PDF default space
    const pdfX = item.transform[4] as number
    const pdfY = item.transform[5] as number

    // Convert to viewport coordinates (top-left origin)
    const [vpX, vpY] = viewport.convertToViewportPoint(pdfX, pdfY)

    labels.push({ text, x: vpX, y: vpY })
  }

  return labels
}

/**
 * Prepare wall segments for ray-casting.
 * Filters by minimum length, classifies as horizontal/vertical,
 * then merges collinear segments (walls interrupted by doors/windows).
 */
function prepareWallSegments(segments: Segment[]): WallSegment[] {
  const raw: WallSegment[] = []

  for (const seg of segments) {
    const dx = seg.end.x - seg.start.x
    const dy = seg.end.y - seg.start.y
    const length = Math.sqrt(dx * dx + dy * dy)
    if (length < 10) continue // keep shorter segments for merging

    const angle = Math.abs(Math.atan2(dy, dx))
    const isHorizontal = angle < 0.25 || angle > Math.PI - 0.25
    const isVertical = Math.abs(angle - Math.PI / 2) < 0.25

    if (!isHorizontal && !isVertical) continue

    raw.push({
      x1: seg.start.x,
      y1: seg.start.y,
      x2: seg.end.x,
      y2: seg.end.y,
      isHorizontal,
      isVertical,
      length
    })
  }

  // Merge collinear segments — walls are often split by doors/windows
  const merged = mergeCollinearSegments(raw)
  return merged.filter((w) => w.length >= MIN_WALL_LENGTH)
}

/**
 * Merge wall segments that are collinear (same orientation, same position,
 * overlapping or close spans). Door gaps up to ~50pt are bridged.
 */
function mergeCollinearSegments(walls: WallSegment[]): WallSegment[] {
  const POSITION_TOLERANCE = 8 // how close parallel walls must be to merge
  const GAP_TOLERANCE = 50 // max gap between segments to bridge (door ~36pt)

  // Separate horizontal and vertical
  const horizontal = walls.filter((w) => w.isHorizontal)
  const vertical = walls.filter((w) => w.isVertical)

  function mergeGroup(group: WallSegment[], isHoriz: boolean): WallSegment[] {
    if (group.length === 0) return []

    // Sort by fixed-axis position, then by span start
    const sorted = [...group].sort((a, b) => {
      const posA = isHoriz ? (a.y1 + a.y2) / 2 : (a.x1 + a.x2) / 2
      const posB = isHoriz ? (b.y1 + b.y2) / 2 : (b.x1 + b.x2) / 2
      if (Math.abs(posA - posB) > POSITION_TOLERANCE) return posA - posB
      const spanStartA = isHoriz ? Math.min(a.x1, a.x2) : Math.min(a.y1, a.y2)
      const spanStartB = isHoriz ? Math.min(b.x1, b.x2) : Math.min(b.y1, b.y2)
      return spanStartA - spanStartB
    })

    const result: WallSegment[] = []
    let current = { ...sorted[0]! }

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]!
      const currentPos = isHoriz ? (current.y1 + current.y2) / 2 : (current.x1 + current.x2) / 2
      const nextPos = isHoriz ? (next.y1 + next.y2) / 2 : (next.x1 + next.x2) / 2

      // Check if on the same line (same fixed-axis position)
      if (Math.abs(currentPos - nextPos) > POSITION_TOLERANCE) {
        result.push(current)
        current = { ...next }
        continue
      }

      // Check if spans overlap or are close enough to merge
      const currentEnd = isHoriz ? Math.max(current.x1, current.x2) : Math.max(current.y1, current.y2)
      const nextStart = isHoriz ? Math.min(next.x1, next.x2) : Math.min(next.y1, next.y2)

      if (nextStart - currentEnd <= GAP_TOLERANCE) {
        // Merge: extend current to cover both
        const nextEnd = isHoriz ? Math.max(next.x1, next.x2) : Math.max(next.y1, next.y2)
        if (isHoriz) {
          current.x1 = Math.min(current.x1, current.x2, next.x1, next.x2)
          current.x2 = Math.max(currentEnd, nextEnd)
          current.y1 = (currentPos + nextPos) / 2
          current.y2 = current.y1
        } else {
          current.y1 = Math.min(current.y1, current.y2, next.y1, next.y2)
          current.y2 = Math.max(currentEnd, nextEnd)
          current.x1 = (currentPos + nextPos) / 2
          current.x2 = current.x1
        }
        const dx = current.x2 - current.x1
        const dy = current.y2 - current.y1
        current.length = Math.sqrt(dx * dx + dy * dy)
      } else {
        result.push(current)
        current = { ...next }
      }
    }
    result.push(current)
    return result
  }

  return [...mergeGroup(horizontal, true), ...mergeGroup(vertical, false)]
}

/**
 * Ray-cast from a point in 4 cardinal directions to find nearest wall segments.
 * Uses merged wall segments so door/window gaps are bridged.
 * Returns a bounding rectangle { left, right, top, bottom } or null.
 */
function rayCastFromPoint(
  cx: number,
  cy: number,
  walls: WallSegment[]
): { left: number; right: number; top: number; bottom: number } | null {
  let nearestLeft = cx - MAX_RAY_DISTANCE
  let nearestRight = cx + MAX_RAY_DISTANCE
  let nearestTop = cy - MAX_RAY_DISTANCE
  let nearestBottom = cy + MAX_RAY_DISTANCE

  let foundLeft = false
  let foundRight = false
  let foundTop = false
  let foundBottom = false

  // Tolerance for wall span check — walls don't need to fully span across our position
  // after merging, most walls should span sufficiently
  const SPAN_TOLERANCE = 40

  for (const wall of walls) {
    if (wall.isVertical) {
      const wallX = (wall.x1 + wall.x2) / 2
      const minY = Math.min(wall.y1, wall.y2)
      const maxY = Math.max(wall.y1, wall.y2)

      // Wall must span across our Y position (with tolerance)
      if (cy < minY - SPAN_TOLERANCE || cy > maxY + SPAN_TOLERANCE) continue

      const dist = wallX - cx
      if (dist < -2 && wallX > nearestLeft) {
        nearestLeft = wallX
        foundLeft = true
      }
      if (dist > 2 && wallX < nearestRight) {
        nearestRight = wallX
        foundRight = true
      }
    }

    if (wall.isHorizontal) {
      const wallY = (wall.y1 + wall.y2) / 2
      const minX = Math.min(wall.x1, wall.x2)
      const maxX = Math.max(wall.x1, wall.x2)

      if (cx < minX - SPAN_TOLERANCE || cx > maxX + SPAN_TOLERANCE) continue

      const dist = wallY - cy
      if (dist < -2 && wallY > nearestTop) {
        nearestTop = wallY
        foundTop = true
      }
      if (dist > 2 && wallY < nearestBottom) {
        nearestBottom = wallY
        foundBottom = true
      }
    }
  }

  // Need at least 3 walls found to form a reasonable room
  const wallsFound = [foundLeft, foundRight, foundTop, foundBottom].filter(Boolean).length
  if (wallsFound < 3) return null

  const width = nearestRight - nearestLeft
  const height = nearestBottom - nearestTop

  if (width < MIN_ROOM_DIM || height < MIN_ROOM_DIM) return null

  return {
    left: nearestLeft,
    right: nearestRight,
    top: nearestTop,
    bottom: nearestBottom
  }
}

function polygonArea(points: Point[]): number {
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const p = points[i]!
    const q = points[(i + 1) % n]!
    area += p.x * q.y - q.x * p.y
  }
  return Math.abs(area / 2)
}

function polygonCentroid(points: Point[]): Point {
  const n = points.length
  let cx = 0,
    cy = 0
  for (const p of points) {
    cx += p.x
    cy += p.y
  }
  return { x: cx / n, y: cy / n }
}

/**
 * Deduplicate labels that are very close to each other (e.g. multi-line room names).
 * Merges labels within proximity into one, concatenating text.
 */
function dedupeLabels(labels: TextLabel[]): TextLabel[] {
  const merged: TextLabel[] = []
  const used = new Set<number>()

  for (let i = 0; i < labels.length; i++) {
    if (used.has(i)) continue
    let text = labels[i]!.text
    let x = labels[i]!.x
    let y = labels[i]!.y
    let count = 1

    for (let j = i + 1; j < labels.length; j++) {
      if (used.has(j)) continue
      const dist = Math.sqrt((labels[j]!.x - x) ** 2 + (labels[j]!.y - y) ** 2)
      if (dist < 30) {
        // Merge: concatenate text, average position
        // Skip if same text (e.g. duplicate "Bed 3")
        if (labels[j]!.text.toLowerCase() !== text.toLowerCase()) {
          text = `${text} ${labels[j]!.text}`
        }
        x = (x * count + labels[j]!.x) / (count + 1)
        y = (y * count + labels[j]!.y) / (count + 1)
        count++
        used.add(j)
      }
    }

    merged.push({ text, x, y })
    used.add(i)
  }

  return merged
}

/**
 * Detect rooms using text labels + wall segments. No vision model needed.
 */
export async function detectRoomsFromTextAndWalls(
  page: PDFPageProxy,
  signal?: AbortSignal
): Promise<RoomDetectionResult> {
  // 1. Extract room labels with exact viewport positions
  const rawLabels = await extractRoomLabels(page)
  if (signal?.aborted) return { rooms: [], nodeCount: 0, edgeCount: 0 }

  const labels = dedupeLabels(rawLabels)
  console.log(
    `[TextWallDetect] Found ${labels.length} room labels:`,
    labels.map((l) => `"${l.text}" @(${l.x.toFixed(0)},${l.y.toFixed(0)})`)
  )

  // 2. Extract wall segments
  const rawSegments = await extractWallSegments(page, signal)
  if (signal?.aborted) return { rooms: [], nodeCount: 0, edgeCount: 0 }

  const allWalls = prepareWallSegments(rawSegments)

  // 3. Compute floor plan region from label positions — filter out dimension lines
  // The floor plan is where the room labels are. Walls outside this region are likely dimensions.
  const PLAN_PADDING = 60 // pt padding around label bbox
  let planMinX = Infinity,
    planMinY = Infinity,
    planMaxX = -Infinity,
    planMaxY = -Infinity
  for (const l of labels) {
    planMinX = Math.min(planMinX, l.x)
    planMinY = Math.min(planMinY, l.y)
    planMaxX = Math.max(planMaxX, l.x)
    planMaxY = Math.max(planMaxY, l.y)
  }
  planMinX -= PLAN_PADDING
  planMinY -= PLAN_PADDING
  planMaxX += PLAN_PADDING
  planMaxY += PLAN_PADDING

  // Filter walls to those within the floor plan region
  const walls = allWalls.filter((w) => {
    const midX = (w.x1 + w.x2) / 2
    const midY = (w.y1 + w.y2) / 2
    return midX >= planMinX && midX <= planMaxX && midY >= planMinY && midY <= planMaxY
  })

  console.log(
    `[TextWallDetect] ${rawSegments.length} raw → ${allWalls.length} merged → ${walls.length} in plan region (${Math.round(planMinX)},${Math.round(planMinY)})-(${Math.round(planMaxX)},${Math.round(planMaxY)})`
  )

  // 4. For each label, ray-cast to find enclosing walls
  const rooms: DetectedRoom[] = []

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]!
    const bounds = rayCastFromPoint(label.x, label.y, walls)

    if (!bounds) {
      console.log(`[TextWallDetect] "${label.text}": no enclosing walls found`)
      continue
    }

    const polygon: Point[] = [
      { x: bounds.left, y: bounds.top },
      { x: bounds.right, y: bounds.top },
      { x: bounds.right, y: bounds.bottom },
      { x: bounds.left, y: bounds.bottom }
    ]

    const area = polygonArea(polygon)
    const centroid = polygonCentroid(polygon)

    console.log(
      `[TextWallDetect] "${label.text}": ${Math.round(bounds.right - bounds.left)}×${Math.round(bounds.bottom - bounds.top)}pt, area=${Math.round(area)}pt²`
    )

    rooms.push({
      id: `tw-${page.pageNumber}-${i + 1}`,
      polygon,
      area,
      centroid,
      bounds: {
        minX: bounds.left,
        minY: bounds.top,
        maxX: bounds.right,
        maxY: bounds.bottom
      },
      label: label.text,
      confidence: 1.0
    })
  }

  console.log(`[TextWallDetect] Detected ${rooms.length}/${labels.length} rooms`)

  return {
    rooms,
    nodeCount: walls.length,
    edgeCount: rawSegments.length
  }
}
