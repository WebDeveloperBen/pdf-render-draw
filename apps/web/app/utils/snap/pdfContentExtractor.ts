import type { PDFPageProxy } from "pdfjs-dist"
import { SNAP } from "@/constants/snap"
import type { Segment } from "@/types/snap"
import { deduplicatePointsSpatial } from "@/utils/snap/SpatialGrid"

/**
 * PDF Content Extractor (pdfjs v5)
 *
 * Reads the PDF's internal vector drawing commands and extracts line segments.
 * This gives us the structural geometry of the drawing — walls, edges,
 * dimension lines — without any OCR.
 *
 * In pdfjs v5, path data is stored in `constructPath` operators where:
 *   args[0] = rendering op (stroke, fill, clip, etc.)
 *   args[1] = [Float32Array] containing path commands encoded with DrawOPS
 *   args[2] = Float32Array(4) bounding box [minX, minY, maxX, maxY]
 *
 * The Float32Array path buffer uses DrawOPS encoding:
 *   0 (moveTo):  followed by x, y
 *   1 (lineTo):  followed by x, y
 *   2 (curveTo): followed by x1, y1, x2, y2, x, y
 *   3 (quadraticCurveTo): followed by xa, ya, x, y
 *   4 (closePath): no args
 *
 * Coordinates in the buffer are ALREADY CTM-transformed by the worker,
 * so we only need to convert from PDF space (Y-up) to viewport space (Y-down).
 */

// DrawOPS values from pdfjs v5 (these are NOT the same as OPS)
const DRAW_OPS = {
  moveTo: 0,
  lineTo: 1,
  curveTo: 2,
  quadraticCurveTo: 3,
  closePath: 4
} as const

// Lazy-load OPS enum from pdfjs
let _OPS: Record<string, number> | null = null
async function getOPS(): Promise<Record<string, number>> {
  if (!_OPS) {
    const pdfjs = await import("pdfjs-dist")
    _OPS = pdfjs.OPS as unknown as Record<string, number>
  }
  return _OPS
}

// --- Segment extraction ---

/**
 * Parse a DrawOPS-encoded Float32Array path buffer into segments.
 *
 * The buffer contains interleaved command codes and coordinates:
 *   [0, x, y, 1, x, y, 1, x, y, 4, ...]
 *    ^moveTo  ^lineTo  ^lineTo  ^close
 */
function parsePathBuffer(
  buffer: Float32Array,
  viewport: { convertToViewportPoint: (x: number, y: number) => [number, number] }
): Segment[] {
  const segments: Segment[] = []
  let currentPos: Point | null = null
  let subpathStart: Point | null = null
  let i = 0

  function toViewport(x: number, y: number): Point {
    const [vx, vy] = viewport.convertToViewportPoint(x, y)
    return { x: vx, y: vy }
  }

  while (i < buffer.length) {
    const cmd = buffer[i]!

    if (cmd === DRAW_OPS.moveTo) {
      currentPos = toViewport(buffer[i + 1]!, buffer[i + 2]!)
      subpathStart = currentPos
      i += 3
    } else if (cmd === DRAW_OPS.lineTo) {
      const endPt = toViewport(buffer[i + 1]!, buffer[i + 2]!)
      if (currentPos) {
        segments.push({ start: { ...currentPos }, end: { ...endPt } })
      }
      currentPos = endPt
      i += 3
    } else if (cmd === DRAW_OPS.curveTo) {
      // Cubic bezier: snap to start/end only (skip control points)
      const endPt = toViewport(buffer[i + 5]!, buffer[i + 6]!)
      if (currentPos) {
        segments.push({ start: { ...currentPos }, end: { ...endPt } })
      }
      currentPos = endPt
      i += 7
    } else if (cmd === DRAW_OPS.quadraticCurveTo) {
      // Quadratic bezier: snap to start/end only
      const endPt = toViewport(buffer[i + 3]!, buffer[i + 4]!)
      if (currentPos) {
        segments.push({ start: { ...currentPos }, end: { ...endPt } })
      }
      currentPos = endPt
      i += 5
    } else if (cmd === DRAW_OPS.closePath) {
      // closePath draws a line back to the subpath start
      if (currentPos && subpathStart) {
        const dx = currentPos.x - subpathStart.x
        const dy = currentPos.y - subpathStart.y
        // Only emit if not already at the start point
        if (dx * dx + dy * dy > 0.01) {
          segments.push({ start: { ...currentPos }, end: { ...subpathStart } })
        }
      }
      currentPos = subpathStart
      i += 1
    } else {
      // Unknown command — skip to avoid infinite loop
      i += 1
    }
  }

  return segments
}

export async function extractSegments(
  page: PDFPageProxy,
  signal?: AbortSignal
): Promise<Segment[]> {
  const OPS = await getOPS()
  const opList = await page.getOperatorList()

  if (signal?.aborted) return []

  // scale=1 viewport for Y-axis flip only (PDF is Y-up, SVG is Y-down)
  const viewport = page.getViewport({ scale: 1 }) as unknown as { convertToViewportPoint: (x: number, y: number) => [number, number] }

  const segments: Segment[] = []

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i]
    const args = opList.argsArray[i]

    if (fn === OPS.constructPath) {
      // pdfjs v5: args = [renderingOp, [Float32Array | null], minMax]
      const pathDataWrapper = args[1] as Array<Float32Array | null> | undefined
      const pathData = pathDataWrapper?.[0]

      if (pathData && pathData.length > 0) {
        const parsed = parsePathBuffer(pathData, viewport)
        segments.push(...parsed)
      }
    }
  }

  return segments
}

// --- Geometry helpers ---

function segmentLength(s: Segment): number {
  return Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y)
}

function segmentAngle(s: Segment): number {
  return Math.atan2(s.end.y - s.start.y, s.end.x - s.start.x)
}

function segmentSegmentIntersection(a: Segment, b: Segment): Point | null {
  const dx1 = a.end.x - a.start.x
  const dy1 = a.end.y - a.start.y
  const dx2 = b.end.x - b.start.x
  const dy2 = b.end.y - b.start.y

  const denom = dx1 * dy2 - dy1 * dx2
  if (Math.abs(denom) < 1e-10) return null

  const dx3 = b.start.x - a.start.x
  const dy3 = b.start.y - a.start.y

  const t = (dx3 * dy2 - dy3 * dx2) / denom
  const u = (dx3 * dy1 - dy3 * dx1) / denom

  // Exclude very-near-endpoint intersections
  if (t < 0.001 || t > 0.999 || u < 0.001 || u > 0.999) return null

  return {
    x: a.start.x + t * dx1,
    y: a.start.y + t * dy1
  }
}

/**
 * Project cursor onto the nearest point on a segment.
 * Returns null if the projection falls outside the segment bounds.
 */
export function nearestPointOnSegment(cursor: Point, seg: Segment): Point | null {
  const dx = seg.end.x - seg.start.x
  const dy = seg.end.y - seg.start.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return null

  const t = ((cursor.x - seg.start.x) * dx + (cursor.y - seg.start.y) * dy) / lenSq

  // Clamp to interior (exclude endpoints — handled by endpoint snapping)
  if (t <= 0.01 || t >= 0.99) return null

  return {
    x: seg.start.x + t * dx,
    y: seg.start.y + t * dy
  }
}

// --- Intersection computation with spatial acceleration ---

/** How many grid buckets to process before yielding to the main thread */
const INTERSECTION_YIELD_INTERVAL = 200

async function computeIntersections(segments: Segment[], signal?: AbortSignal): Promise<Point[]> {
  if (segments.length === 0) return []

  const nearParallelRad = (SNAP.NEAR_PARALLEL_DEG * Math.PI) / 180
  const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0))

  // Build spatial grid for acceleration
  const grid = new Map<string, number[]>()
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!
    const minX = Math.min(s.start.x, s.end.x)
    const maxX = Math.max(s.start.x, s.end.x)
    const minY = Math.min(s.start.y, s.end.y)
    const maxY = Math.max(s.start.y, s.end.y)

    const cellMinX = Math.floor(minX / SNAP.INTERSECTION_GRID_CELL)
    const cellMaxX = Math.floor(maxX / SNAP.INTERSECTION_GRID_CELL)
    const cellMinY = Math.floor(minY / SNAP.INTERSECTION_GRID_CELL)
    const cellMaxY = Math.floor(maxY / SNAP.INTERSECTION_GRID_CELL)

    for (let cx = cellMinX; cx <= cellMaxX; cx++) {
      for (let cy = cellMinY; cy <= cellMaxY; cy++) {
        const key = `${cx},${cy}`
        let bucket = grid.get(key)
        if (!bucket) {
          bucket = []
          grid.set(key, bucket)
        }
        bucket.push(i)
      }
    }
  }

  // Use numeric pair encoding instead of string keys for performance
  const maxIdx = segments.length
  const testedPairs = new Set<number>()
  const rawIntersections: Point[] = []

  let bucketsProcessed = 0
  for (const bucket of grid.values()) {
    for (let ai = 0; ai < bucket.length; ai++) {
      for (let bi = ai + 1; bi < bucket.length; bi++) {
        const idxA = bucket[ai]!
        const idxB = bucket[bi]!
        const lo = idxA < idxB ? idxA : idxB
        const hi = idxA < idxB ? idxB : idxA
        const pairKey = lo * maxIdx + hi
        if (testedPairs.has(pairKey)) continue
        testedPairs.add(pairKey)

        const segA = segments[idxA]!
        const segB = segments[idxB]!

        // Reject near-parallel pairs
        let angleDiff = Math.abs(segmentAngle(segA) - segmentAngle(segB))
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff
        if (angleDiff < nearParallelRad || angleDiff > Math.PI - nearParallelRad) {
          continue
        }

        const pt = segmentSegmentIntersection(segA, segB)
        if (pt) rawIntersections.push(pt)
      }
    }

    // Yield periodically to keep the UI responsive
    if (++bucketsProcessed % INTERSECTION_YIELD_INTERVAL === 0) {
      if (signal?.aborted) return []
      await yieldToMain()
    }
  }

  // Density cap: discard cells with too many intersections (hatching filter)
  const densityGrid = new Map<string, Point[]>()
  for (const pt of rawIntersections) {
    const cx = Math.floor(pt.x / SNAP.DENSITY_CELL_SIZE)
    const cy = Math.floor(pt.y / SNAP.DENSITY_CELL_SIZE)
    const key = `${cx},${cy}`
    let bucket = densityGrid.get(key)
    if (!bucket) {
      bucket = []
      densityGrid.set(key, bucket)
    }
    bucket.push(pt)
  }

  const filtered: Point[] = []
  for (const bucket of densityGrid.values()) {
    if (bucket.length <= SNAP.DENSITY_CAP) {
      filtered.push(...bucket)
    }
  }

  return deduplicatePointsSpatial(filtered, SNAP.INTERSECTION_DEDUP_TOLERANCE)
}

// --- Public API ---

export interface PdfContentData {
  segments: Segment[]
  endpoints: Point[]
  midpoints: Point[]
  intersections: Point[]
}

/**
 * Extract all snap-relevant geometry from a PDF page.
 *
 * Coordinates are in viewport space (matching the SVG viewBox) so they are
 * zoom-independent and only need to be extracted once per page.
 */
export async function extractPdfContent(
  page: PDFPageProxy,
  signal?: AbortSignal
): Promise<PdfContentData> {
  const allSegments = await extractSegments(page, signal)
  if (signal?.aborted) return { segments: [], endpoints: [], midpoints: [], intersections: [] }

  // Filter tiny segments (font glyphs, decorative elements)
  const segments = allSegments.filter((s) => segmentLength(s) >= SNAP.MIN_SEGMENT_LENGTH)

  // Yield to main thread between heavy operations
  const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0))

  // Collect endpoints
  await yieldToMain()
  if (signal?.aborted) return { segments, endpoints: [], midpoints: [], intersections: [] }

  const rawEndpoints: Point[] = []
  for (const s of segments) {
    rawEndpoints.push(s.start, s.end)
  }
  const endpoints = deduplicatePointsSpatial(rawEndpoints, SNAP.ENDPOINT_DEDUP_TOLERANCE)

  // Compute midpoints
  const rawMidpoints: Point[] = []
  for (const s of segments) {
    rawMidpoints.push({
      x: (s.start.x + s.end.x) / 2,
      y: (s.start.y + s.end.y) / 2
    })
  }
  const midpoints = deduplicatePointsSpatial(rawMidpoints, SNAP.ENDPOINT_DEDUP_TOLERANCE)

  // Compute intersections
  await yieldToMain()
  if (signal?.aborted) return { segments, endpoints, midpoints, intersections: [] }

  const intersections = await computeIntersections(segments, signal)

  return { segments, endpoints, midpoints, intersections }
}
