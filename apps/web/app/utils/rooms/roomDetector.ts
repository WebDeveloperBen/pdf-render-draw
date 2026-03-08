/**
 * Room Detector
 *
 * Finds enclosed rooms (minimal faces) in a planar graph built from
 * PDF vector line segments.
 *
 * Critical insight: building plan walls form T-junctions and crossings
 * where segments pass through each other. We must SPLIT segments at
 * intersection points to create graph nodes there. Without this, the
 * graph can't trace room boundaries.
 *
 * Pipeline:
 * 1. Extract straight-line segments (skip curves)
 * 2. Filter by length and border margin
 * 3. Split segments at all intersection points → planar subdivision
 * 4. Build adjacency graph with angle-sorted neighbors
 * 5. Extract minimal faces via "always turn right" traversal
 * 6. Filter faces by area, compactness, edge count
 */

import { ROOMS } from "@/constants/rooms"
import type { Segment } from "@/types/snap"
import type { DetectedRoom, RoomDetectionResult } from "@/types/rooms"

// --- Graph types ---

interface GraphNode {
  id: number
  x: number
  y: number
  neighbors: number[]
  angles: number[]
}

function computeComponentMetrics(nodes: GraphNode[]) {
  const componentByNode = new Array<number>(nodes.length).fill(-1)
  const edgeCountByComponent: number[] = []
  let componentId = 0

  for (const node of nodes) {
    if (componentByNode[node.id] !== -1) continue
    if (node.neighbors.length === 0) {
      componentByNode[node.id] = componentId++
      edgeCountByComponent.push(0)
      continue
    }

    const stack = [node.id]
    componentByNode[node.id] = componentId
    const componentNodes: number[] = []

    while (stack.length > 0) {
      const id = stack.pop()!
      componentNodes.push(id)
      for (const neighbor of nodes[id]!.neighbors) {
        if (componentByNode[neighbor] !== -1) continue
        componentByNode[neighbor] = componentId
        stack.push(neighbor)
      }
    }

    let degreeSum = 0
    for (const id of componentNodes) {
      degreeSum += nodes[id]!.neighbors.length
    }
    edgeCountByComponent.push(degreeSum / 2)
    componentId++
  }

  return { componentByNode, edgeCountByComponent }
}

// --- Segment-segment intersection ---

/**
 * Find the intersection point of two segments, if any.
 * Returns the parametric t values (0-1) for each segment and the point.
 */
function segmentIntersection(
  a: Segment,
  b: Segment
): { t: number; u: number; point: Point } | null {
  const dx1 = a.end.x - a.start.x
  const dy1 = a.end.y - a.start.y
  const dx2 = b.end.x - b.start.x
  const dy2 = b.end.y - b.start.y

  const denom = dx1 * dy2 - dy1 * dx2
  if (Math.abs(denom) < 1e-10) return null // parallel

  const dx3 = b.start.x - a.start.x
  const dy3 = b.start.y - a.start.y

  const rawT = (dx3 * dy2 - dy3 * dx2) / denom
  const rawU = (dx3 * dy1 - dy3 * dx1) / denom
  const RANGE_EPS = 0.001
  if (rawT < -RANGE_EPS || rawT > 1 + RANGE_EPS || rawU < -RANGE_EPS || rawU > 1 + RANGE_EPS) {
    return null
  }

  // Keep endpoint-to-interior intersections (T-junctions), but skip pure endpoint-endpoint touches.
  const t = Math.min(1, Math.max(0, rawT))
  const u = Math.min(1, Math.max(0, rawU))
  const INTERIOR_EPS = 0.001
  const tInterior = t > INTERIOR_EPS && t < 1 - INTERIOR_EPS
  const uInterior = u > INTERIOR_EPS && u < 1 - INTERIOR_EPS
  if (!tInterior && !uInterior) return null

  return {
    t,
    u,
    point: {
      x: a.start.x + t * dx1,
      y: a.start.y + t * dy1
    }
  }
}

// --- Intersection splitting with spatial grid ---

/**
 * Split all segments at their mutual intersection points.
 * This converts a set of possibly-crossing segments into a proper
 * planar subdivision where segments only meet at endpoints.
 *
 * Uses a spatial grid to avoid O(n²) pair testing.
 */
function splitAtIntersections(segments: Segment[]): Segment[] {
  if (segments.length === 0) return []

  // Build spatial grid for acceleration
  const CELL = 50
  const grid = new Map<string, number[]>()

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!
    const minCX = Math.floor(Math.min(s.start.x, s.end.x) / CELL)
    const maxCX = Math.floor(Math.max(s.start.x, s.end.x) / CELL)
    const minCY = Math.floor(Math.min(s.start.y, s.end.y) / CELL)
    const maxCY = Math.floor(Math.max(s.start.y, s.end.y) / CELL)

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
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

  // For each segment, collect all t-values where it gets split
  const splitTs: number[][] = segments.map(() => [])

  const testedPairs = new Set<number>()
  const maxIdx = segments.length

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

        const ix = segmentIntersection(segments[idxA]!, segments[idxB]!)
        if (ix) {
          splitTs[idxA]!.push(ix.t)
          splitTs[idxB]!.push(ix.u)
        }
      }
    }
  }

  // Split each segment at its collected t-values
  const result: Segment[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const ts = splitTs[i]!

    if (ts.length === 0) {
      result.push(seg)
      continue
    }

    // Sort t-values and add endpoints
    ts.push(0, 1)
    ts.sort((a, b) => a - b)

    // Deduplicate close t-values
    const uniqueTs: number[] = [ts[0]!]
    for (let j = 1; j < ts.length; j++) {
      if (ts[j]! - uniqueTs[uniqueTs.length - 1]! > 0.0001) {
        uniqueTs.push(ts[j]!)
      }
    }

    // Create sub-segments
    const dx = seg.end.x - seg.start.x
    const dy = seg.end.y - seg.start.y

    for (let j = 0; j < uniqueTs.length - 1; j++) {
      const t0 = uniqueTs[j]!
      const t1 = uniqueTs[j + 1]!
      result.push({
        start: { x: seg.start.x + t0 * dx, y: seg.start.y + t0 * dy },
        end: { x: seg.start.x + t1 * dx, y: seg.start.y + t1 * dy }
      })
    }
  }

  return result
}

// --- Segment filtering ---

/**
 * Detect the main drawing area using segment density.
 *
 * Grids the page into large cells, counts segment midpoints per cell,
 * then finds the bounding box of all "dense" cells (above median density).
 * This automatically excludes title blocks, borders, and isolated details.
 */
function detectDrawingArea(
  segments: Segment[],
  pageWidth: number,
  pageHeight: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  const GRID_CELLS = 10 // 10×10 grid
  const cellW = pageWidth / GRID_CELLS
  const cellH = pageHeight / GRID_CELLS
  const density = new Array(GRID_CELLS * GRID_CELLS).fill(0)

  // Count segment midpoints per cell
  for (const seg of segments) {
    const mx = (seg.start.x + seg.end.x) / 2
    const my = (seg.start.y + seg.end.y) / 2
    const cx = Math.min(Math.floor(mx / cellW), GRID_CELLS - 1)
    const cy = Math.min(Math.floor(my / cellH), GRID_CELLS - 1)
    density[cy * GRID_CELLS + cx]++
  }

  // Find median density (only counting non-zero cells)
  const nonZero = density.filter((d: number) => d > 0).sort((a: number, b: number) => a - b)
  if (nonZero.length === 0) {
    return { minX: 0, minY: 0, maxX: pageWidth, maxY: pageHeight }
  }
  const median = nonZero[Math.floor(nonZero.length / 2)]!

  // Dense cells threshold: at least median density
  // Find bounding box of all dense cells
  let minCX = GRID_CELLS
  let minCY = GRID_CELLS
  let maxCX = -1
  let maxCY = -1

  for (let cy = 0; cy < GRID_CELLS; cy++) {
    for (let cx = 0; cx < GRID_CELLS; cx++) {
      if (density[cy * GRID_CELLS + cx]! >= median) {
        if (cx < minCX) minCX = cx
        if (cy < minCY) minCY = cy
        if (cx > maxCX) maxCX = cx
        if (cy > maxCY) maxCY = cy
      }
    }
  }

  if (maxCX < 0) {
    return { minX: 0, minY: 0, maxX: pageWidth, maxY: pageHeight }
  }

  const coveredCells = (maxCX - minCX + 1) * (maxCY - minCY + 1)
  const coverageRatio = coveredCells / (GRID_CELLS * GRID_CELLS)
  // If dense-cell coverage is too small, the detector likely locked onto
  // an annotation cluster (title/details) rather than the main plan.
  if (coverageRatio < 0.3) {
    return { minX: 0, minY: 0, maxX: pageWidth, maxY: pageHeight }
  }

  // Convert cell bounds back to page coordinates (with small padding)
  return {
    minX: Math.max(0, minCX * cellW - cellW * 0.5),
    minY: Math.max(0, minCY * cellH - cellH * 0.5),
    maxX: Math.min(pageWidth, (maxCX + 1) * cellW + cellW * 0.5),
    maxY: Math.min(pageHeight, (maxCY + 1) * cellH + cellH * 0.5)
  }
}

function filterWallSegments(
  segments: Segment[],
  pageWidth: number,
  pageHeight: number
): Segment[] {
  const orthogonalTolerance = (ROOMS.WALL_ORTHOGONAL_TOLERANCE_DEG * Math.PI) / 180

  function isNearOrthogonal(seg: Segment): boolean {
    const dx = seg.end.x - seg.start.x
    const dy = seg.end.y - seg.start.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDx < 1e-6 || absDy < 1e-6) return true

    const angle = Math.atan2(absDy, absDx) // 0..π/2
    const distToHorizontal = Math.abs(angle)
    const distToVertical = Math.abs(Math.PI / 2 - angle)
    return distToHorizontal <= orthogonalTolerance || distToVertical <= orthogonalTolerance
  }

  // First pass: basic length filter
  const longSegments = segments.filter((seg) => {
    const len = Math.hypot(seg.end.x - seg.start.x, seg.end.y - seg.start.y)
    return len >= ROOMS.MIN_WALL_LENGTH
  })

  // Detect drawing area from density
  const bounds = detectDrawingArea(longSegments, pageWidth, pageHeight)

  console.log(`[RoomDetector] Drawing area detected: (${Math.round(bounds.minX)},${Math.round(bounds.minY)}) → (${Math.round(bounds.maxX)},${Math.round(bounds.maxY)}) on ${Math.round(pageWidth)}×${Math.round(pageHeight)} page`)

  // Second pass: only keep segments with at least one endpoint in the drawing area
  return longSegments.filter((seg) => {
    const startIn =
      seg.start.x >= bounds.minX && seg.start.x <= bounds.maxX &&
      seg.start.y >= bounds.minY && seg.start.y <= bounds.maxY
    const endIn =
      seg.end.x >= bounds.minX && seg.end.x <= bounds.maxX &&
      seg.end.y >= bounds.minY && seg.end.y <= bounds.maxY
    if (!(startIn || endIn)) return false
    return isNearOrthogonal(seg)
  })
}

// --- Node merging ---

function buildNodes(segments: Segment[], tolerance: number): {
  nodes: GraphNode[]
  pointToNode: (p: Point) => number
} {
  const cellSize = Math.max(tolerance, 1)
  // Allow multiple nodes per cell for dense areas
  const grid = new Map<string, number[]>()
  const nodes: GraphNode[] = []

  function key(x: number, y: number): string {
    return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`
  }

  function findOrCreate(p: Point): number {
    const cx = Math.floor(p.x / cellSize)
    const cy = Math.floor(p.y / cellSize)

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const k = `${cx + dx},${cy + dy}`
        const bucket = grid.get(k)
        if (!bucket) continue
        for (const existing of bucket) {
          const node = nodes[existing]!
          if (Math.hypot(p.x - node.x, p.y - node.y) <= tolerance) {
            return existing
          }
        }
      }
    }

    const id = nodes.length
    nodes.push({ id, x: p.x, y: p.y, neighbors: [], angles: [] })
    const k = key(p.x, p.y)
    let bucket = grid.get(k)
    if (!bucket) {
      bucket = []
      grid.set(k, bucket)
    }
    bucket.push(id)
    return id
  }

  for (const seg of segments) {
    findOrCreate(seg.start)
    findOrCreate(seg.end)
  }

  return { nodes, pointToNode: (p: Point) => findOrCreate(p) }
}

// --- Graph construction ---

function buildGraph(segments: Segment[], tolerance: number): GraphNode[] {
  const { nodes, pointToNode } = buildNodes(segments, tolerance)

  const edgeSet = new Set<string>()

  for (const seg of segments) {
    const a = pointToNode(seg.start)
    const b = pointToNode(seg.end)
    if (a === b) continue

    const edgeKey = a < b ? `${a},${b}` : `${b},${a}`
    if (edgeSet.has(edgeKey)) continue
    edgeSet.add(edgeKey)

    nodes[a]!.neighbors.push(b)
    nodes[b]!.neighbors.push(a)
  }

  // Sort neighbors by outgoing angle (CCW)
  for (const node of nodes) {
    const anglesAndNeighbors = node.neighbors.map((nb) => {
      const nbNode = nodes[nb]!
      const angle = Math.atan2(nbNode.y - node.y, nbNode.x - node.x)
      return { nb, angle }
    })
    anglesAndNeighbors.sort((a, b) => a.angle - b.angle)
    node.neighbors = anglesAndNeighbors.map((e) => e.nb)
    node.angles = anglesAndNeighbors.map((e) => e.angle)
  }

  return nodes
}

// --- Minimal face extraction ---

function nextEdge(nodes: GraphNode[], from: number, to: number): number {
  const toNode = nodes[to]!
  const { neighbors } = toNode

  if (neighbors.length === 0) return -1
  if (neighbors.length === 1) return neighbors[0]!

  let idx = -1
  for (let i = 0; i < neighbors.length; i++) {
    if (neighbors[i] === from) {
      idx = i
      break
    }
  }

  if (idx === -1) return neighbors[0]!

  const prevIdx = (idx - 1 + neighbors.length) % neighbors.length
  return neighbors[prevIdx]!
}

function extractFaces(nodes: GraphNode[]): number[][] {
  const visited = new Set<string>()
  const canonicalKeys = new Set<string>()
  const faces: number[][] = []

  for (const node of nodes) {
    for (const nb of node.neighbors) {
      const startKey = `${node.id}->${nb}`
      if (visited.has(startKey)) continue

      const face: number[] = [node.id]
      let curr = node.id
      let next = nb
      let steps = 0
      const maxSteps = nodes.length + 1

      while (steps < maxSteps) {
        const dk = `${curr}->${next}`
        if (visited.has(dk)) break
        visited.add(dk)

        face.push(next)

        if (next === node.id) break

        const afterNext = nextEdge(nodes, curr, next)
        if (afterNext === -1) break

        curr = next
        next = afterNext
        steps++
      }

      if (face.length >= ROOMS.MIN_EDGES + 1 && face[face.length - 1] === face[0]) {
        const closedFace = face.slice(0, -1)
        const key = canonicalFaceKey(closedFace)
        if (!canonicalKeys.has(key)) {
          canonicalKeys.add(key)
          faces.push(closedFace)
        }
      }
    }
  }

  return faces
}

function canonicalFaceKey(face: number[]): string {
  if (face.length === 0) return ""
  const reversed = [...face].reverse()
  return [canonicalCycleKey(face), canonicalCycleKey(reversed)].sort()[0]!
}

function canonicalCycleKey(face: number[]): string {
  const n = face.length
  let best = ""
  for (let start = 0; start < n; start++) {
    let key = ""
    for (let i = 0; i < n; i++) {
      if (i > 0) key += ","
      key += face[(start + i) % n]
    }
    if (best === "" || key < best) best = key
  }
  return best
}

// --- Polygon metrics ---

function signedArea(polygon: Point[]): number {
  let area = 0
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += polygon[i]!.x * polygon[j]!.y
    area -= polygon[j]!.x * polygon[i]!.y
  }
  return area / 2
}

function polygonCentroid(polygon: Point[]): Point {
  let cx = 0
  let cy = 0
  for (const p of polygon) {
    cx += p.x
    cy += p.y
  }
  return { x: cx / polygon.length, y: cy / polygon.length }
}

function polygonBounds(polygon: Point[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of polygon) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

function compactness(polygon: Point[]): number {
  const area = Math.abs(signedArea(polygon))
  let perimeter = 0
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length
    perimeter += Math.hypot(polygon[j]!.x - polygon[i]!.x, polygon[j]!.y - polygon[i]!.y)
  }
  if (perimeter === 0) return 0
  return (4 * Math.PI * area) / (perimeter * perimeter)
}

function angleDistance(a: number, b: number): number {
  let d = Math.abs(a - b) % Math.PI
  if (d > Math.PI / 2) d = Math.PI - d
  return d
}

function orthogonalEdgeRatio(polygon: Point[]): number {
  if (polygon.length < 3) return 0

  const edges: { angle: number; len: number }[] = []
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length
    const dx = polygon[j]!.x - polygon[i]!.x
    const dy = polygon[j]!.y - polygon[i]!.y
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    const angle = (Math.atan2(dy, dx) + Math.PI) % Math.PI
    edges.push({ angle, len })
  }

  if (edges.length < 3) return 0

  // Use the longest edge as the dominant axis.
  let dominant = edges[0]!
  for (const edge of edges) {
    if (edge.len > dominant.len) dominant = edge
  }
  const axisA = dominant.angle
  const axisB = (axisA + Math.PI / 2) % Math.PI
  const tolerance = (ROOMS.ORTHOGONAL_TOLERANCE_DEG * Math.PI) / 180

  let aligned = 0
  for (const edge of edges) {
    const d = Math.min(angleDistance(edge.angle, axisA), angleDistance(edge.angle, axisB))
    if (d <= tolerance) aligned++
  }
  return aligned / edges.length
}

type Interval = { start: number; end: number }
type AxisLine = { coord: number; intervals: Interval[]; totalCoverage: number }
type RectCandidate = { minX: number; minY: number; maxX: number; maxY: number; area: number }

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: Interval[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!
    const last = merged[merged.length - 1]!
    if (current.start <= last.end + 1e-6) {
      last.end = Math.max(last.end, current.end)
    } else {
      merged.push({ ...current })
    }
  }
  return merged
}

function intervalCoverageRatio(intervals: Interval[], start: number, end: number): number {
  const span = end - start
  if (span <= 0) return 0
  let covered = 0
  for (const interval of intervals) {
    const overlap = Math.min(end, interval.end) - Math.max(start, interval.start)
    if (overlap > 0) covered += overlap
  }
  return covered / span
}

function rectIou(a: RectCandidate, b: RectCandidate): number {
  const ix = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX))
  const iy = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY))
  const intersection = ix * iy
  if (intersection <= 0) return 0
  const union = a.area + b.area - intersection
  if (union <= 0) return 0
  return intersection / union
}

function collectAxisLines(segments: Segment[]) {
  const tolerance = ROOMS.RECT_LINE_ALIGN_TOLERANCE
  const horizontalBuckets = new Map<number, Interval[]>()
  const verticalBuckets = new Map<number, Interval[]>()

  for (const seg of segments) {
    const dx = seg.end.x - seg.start.x
    const dy = seg.end.y - seg.start.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDy <= tolerance && absDx >= ROOMS.RECT_MIN_SIDE) {
      const y = Math.round((seg.start.y + seg.end.y) / 2 / tolerance) * tolerance
      const start = Math.min(seg.start.x, seg.end.x)
      const end = Math.max(seg.start.x, seg.end.x)
      const intervals = horizontalBuckets.get(y) ?? []
      intervals.push({ start, end })
      horizontalBuckets.set(y, intervals)
    }

    if (absDx <= tolerance && absDy >= ROOMS.RECT_MIN_SIDE) {
      const x = Math.round((seg.start.x + seg.end.x) / 2 / tolerance) * tolerance
      const start = Math.min(seg.start.y, seg.end.y)
      const end = Math.max(seg.start.y, seg.end.y)
      const intervals = verticalBuckets.get(x) ?? []
      intervals.push({ start, end })
      verticalBuckets.set(x, intervals)
    }
  }

  function toLines(bucket: Map<number, Interval[]>): AxisLine[] {
    const lines: AxisLine[] = []
    for (const [coord, intervals] of bucket) {
      const merged = mergeIntervals(intervals)
      let totalCoverage = 0
      for (const interval of merged) totalCoverage += interval.end - interval.start
      lines.push({ coord, intervals: merged, totalCoverage })
    }
    lines.sort((a, b) => b.totalCoverage - a.totalCoverage)
    return lines.slice(0, ROOMS.RECT_MAX_CANDIDATE_LINES)
  }

  return {
    horizontal: toLines(horizontalBuckets),
    vertical: toLines(verticalBuckets)
  }
}

function detectRectangularRoomsFromLines(
  segments: Segment[],
  pageWidth: number,
  pageHeight: number,
  minArea: number,
  maxArea: number,
  edgeMargin: number
): DetectedRoom[] {
  const { horizontal, vertical } = collectAxisLines(segments)
  if (horizontal.length < 2 || vertical.length < 2) return []

  const candidates: RectCandidate[] = []
  for (let yi = 0; yi < horizontal.length; yi++) {
    for (let yj = yi + 1; yj < horizontal.length; yj++) {
      const top = horizontal[yi]!
      const bottom = horizontal[yj]!
      const minY = Math.min(top.coord, bottom.coord)
      const maxY = Math.max(top.coord, bottom.coord)
      const height = maxY - minY
      if (height < ROOMS.RECT_MIN_SIDE) continue

      for (let xi = 0; xi < vertical.length; xi++) {
        for (let xj = xi + 1; xj < vertical.length; xj++) {
          const left = vertical[xi]!
          const right = vertical[xj]!
          const minX = Math.min(left.coord, right.coord)
          const maxX = Math.max(left.coord, right.coord)
          const width = maxX - minX
          if (width < ROOMS.RECT_MIN_SIDE) continue

          if (
            minX <= edgeMargin ||
            minY <= edgeMargin ||
            maxX >= pageWidth - edgeMargin ||
            maxY >= pageHeight - edgeMargin
          ) continue

          const area = width * height
          if (area < minArea || area > maxArea) continue

          const topCoverage = intervalCoverageRatio(top.intervals, minX, maxX)
          const bottomCoverage = intervalCoverageRatio(bottom.intervals, minX, maxX)
          const leftCoverage = intervalCoverageRatio(left.intervals, minY, maxY)
          const rightCoverage = intervalCoverageRatio(right.intervals, minY, maxY)

          if (
            topCoverage < ROOMS.RECT_SIDE_COVERAGE_RATIO ||
            bottomCoverage < ROOMS.RECT_SIDE_COVERAGE_RATIO ||
            leftCoverage < ROOMS.RECT_SIDE_COVERAGE_RATIO ||
            rightCoverage < ROOMS.RECT_SIDE_COVERAGE_RATIO
          ) continue

          candidates.push({ minX, minY, maxX, maxY, area })
        }
      }
    }
  }

  candidates.sort((a, b) => b.area - a.area)
  const deduped: RectCandidate[] = []
  for (const candidate of candidates) {
    if (deduped.some((existing) => rectIou(existing, candidate) >= ROOMS.RECT_DEDUP_IOU)) {
      continue
    }
    deduped.push(candidate)
  }

  return deduped.map((rect) => ({
    id: `room-${++nextRoomId}`,
    polygon: [
      { x: rect.minX, y: rect.minY },
      { x: rect.maxX, y: rect.minY },
      { x: rect.maxX, y: rect.maxY },
      { x: rect.minX, y: rect.maxY }
    ],
    area: rect.area,
    centroid: { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 },
    bounds: {
      minX: rect.minX,
      minY: rect.minY,
      maxX: rect.maxX,
      maxY: rect.maxY
    }
  }))
}

// --- Segment extraction (walls-only, no curves) ---

const DRAW_OPS = {
  moveTo: 0,
  lineTo: 1,
  curveTo: 2,
  quadraticCurveTo: 3,
  closePath: 4
} as const

type Matrix2D = [number, number, number, number, number, number]
const IDENTITY_MATRIX: Matrix2D = [1, 0, 0, 1, 0, 0]

function multiplyMatrix2D(left: Matrix2D, right: Matrix2D): Matrix2D {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5]
  ]
}

function applyMatrix2D(matrix: Matrix2D, x: number, y: number): Point {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5]
  }
}

/**
 * Parse path buffer extracting ONLY straight line segments.
 * Skips entire subpaths that contain curves (arcs, circles, etc.)
 */
function parseWallSegments(
  buffer: Float32Array,
  viewport: { convertToViewportPoint: (x: number, y: number) => [number, number] },
  transform: Matrix2D
): Segment[] {
  const segments: Segment[] = []
  let currentPos: Point | null = null
  let subpathStart: Point | null = null
  let i = 0
  // Collect segments per subpath, discard if subpath has curves
  let subpathSegments: Segment[] = []

  function toViewport(x: number, y: number): Point {
    const transformed = applyMatrix2D(transform, x, y)
    const [vx, vy] = viewport.convertToViewportPoint(transformed.x, transformed.y)
    return { x: vx, y: vy }
  }

  function flushSubpath() {
    // Only keep subpath segments if no curves were found
    segments.push(...subpathSegments)
    subpathSegments = []
  }

  function discardSubpath() {
    subpathSegments = []
  }

  while (i < buffer.length) {
    const cmd = buffer[i]!

    if (cmd === DRAW_OPS.moveTo) {
      flushSubpath()
      currentPos = toViewport(buffer[i + 1]!, buffer[i + 2]!)
      subpathStart = currentPos
      i += 3
    } else if (cmd === DRAW_OPS.lineTo) {
      const endPt = toViewport(buffer[i + 1]!, buffer[i + 2]!)
      if (currentPos) {
        subpathSegments.push({ start: { ...currentPos }, end: { ...endPt } })
      }
      currentPos = endPt
      i += 3
    } else if (cmd === DRAW_OPS.curveTo) {
      currentPos = toViewport(buffer[i + 5]!, buffer[i + 6]!)
      discardSubpath() // Discard all segments in this subpath
      i += 7
    } else if (cmd === DRAW_OPS.quadraticCurveTo) {
      currentPos = toViewport(buffer[i + 3]!, buffer[i + 4]!)
      discardSubpath()
      i += 5
    } else if (cmd === DRAW_OPS.closePath) {
      if (currentPos && subpathStart) {
        const dx = currentPos.x - subpathStart.x
        const dy = currentPos.y - subpathStart.y
        if (dx * dx + dy * dy > 0.01) {
          subpathSegments.push({ start: { ...currentPos }, end: { ...subpathStart } })
        }
      }
      currentPos = subpathStart
      i += 1
    } else {
      i += 1
    }
  }

  flushSubpath()
  return segments
}

let _OPS: Record<string, number> | null = null
async function getOPS(): Promise<Record<string, number>> {
  if (!_OPS) {
    const pdfjs = await import("pdfjs-dist")
    _OPS = pdfjs.OPS as unknown as Record<string, number>
  }
  return _OPS
}

function buildStrokeRenderOps(OPS: Record<string, number>): Set<number> {
  const ops = [
    OPS.stroke,
    OPS.closeStroke,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke
  ].filter((v): v is number => typeof v === "number")

  return new Set<number>(ops)
}

/**
 * Extract wall-like segments from a PDF page.
 * Skips curves entirely — walls are drawn with lineTo.
 */
export async function extractWallSegments(
  page: { getOperatorList: () => Promise<{ fnArray: number[]; argsArray: any[] }>; getViewport: (opts: { scale: number }) => any; pageNumber: number },
  signal?: AbortSignal
): Promise<Segment[]> {
  const OPS = await getOPS()
  const strokeRenderOps = buildStrokeRenderOps(OPS)
  const opList = await page.getOperatorList()

  if (signal?.aborted) return []

  const viewport = page.getViewport({ scale: 1 }) as unknown as {
    convertToViewportPoint: (x: number, y: number) => [number, number]
  }

  const segments: Segment[] = []
  const matrixStack: Matrix2D[] = []
  let currentMatrix: Matrix2D = [...IDENTITY_MATRIX]

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i]
    const args = opList.argsArray[i]

    if (fn === OPS.save) {
      matrixStack.push([...currentMatrix])
      continue
    }

    if (fn === OPS.restore) {
      currentMatrix = matrixStack.pop() ?? [...IDENTITY_MATRIX]
      continue
    }

    if (fn === OPS.transform) {
      if (Array.isArray(args) && args.length === 6) {
        const transformMatrix: Matrix2D = [
          args[0] as number,
          args[1] as number,
          args[2] as number,
          args[3] as number,
          args[4] as number,
          args[5] as number
        ]
        currentMatrix = multiplyMatrix2D(currentMatrix, transformMatrix)
      }
      continue
    }

    if (fn === OPS.constructPath) {
      const renderOp = args[0] as number | undefined
      if (typeof renderOp === "number" && !strokeRenderOps.has(renderOp)) {
        continue
      }

      const pathDataWrapper = args[1] as Array<Float32Array | null> | undefined
      const pathData = pathDataWrapper?.[0]

      if (pathData && pathData.length > 0) {
        const parsed = parseWallSegments(pathData, viewport, currentMatrix)
        segments.push(...parsed)
      }
    }
  }

  return segments
}

// --- Public API ---

let nextRoomId = 0

interface DetectRoomsOptions {
  includeDebug?: boolean
}

function extractGraphEdges(nodes: GraphNode[]): Segment[] {
  const edges: Segment[] = []
  const seen = new Set<string>()

  for (const node of nodes) {
    for (const neighborId of node.neighbors) {
      const a = node.id < neighborId ? node.id : neighborId
      const b = node.id < neighborId ? neighborId : node.id
      const key = `${a},${b}`
      if (seen.has(key)) continue
      seen.add(key)

      const neighbor = nodes[neighborId]!
      edges.push({
        start: { x: node.x, y: node.y },
        end: { x: neighbor.x, y: neighbor.y }
      })
    }
  }

  return edges
}

export async function detectRooms(
  segments: Segment[],
  pageWidth: number,
  pageHeight: number,
  signal?: AbortSignal,
  options: DetectRoomsOptions = {}
): Promise<RoomDetectionResult> {
  const includeDebug = options.includeDebug === true
  const empty: RoomDetectionResult = {
    rooms: [],
    nodeCount: 0,
    edgeCount: 0,
    debug: includeDebug
      ? {
          rawSegments: [...segments],
          wallSegments: [],
          graphSegments: [],
          nodes: [],
          edges: [],
          faceCount: 0
        }
      : null
  }

  if (segments.length === 0) return empty

  // Step 1: Filter to wall-like segments (long enough, inside drawing area)
  const wallSegments = filterWallSegments(segments, pageWidth, pageHeight)

  console.log(`[RoomDetector] ${segments.length} input → ${wallSegments.length} wall segments after length/bounds filter`)

  if (wallSegments.length === 0) {
    if (includeDebug && empty.debug) {
      empty.debug.wallSegments = [...wallSegments]
    }
    return empty
  }

  // Step 2: Split segments at all intersection points
  // This is the critical step — creates graph nodes at T-junctions and crossings
  const splitSegments = splitAtIntersections(wallSegments)

  console.log(`[RoomDetector] ${wallSegments.length} → ${splitSegments.length} after intersection splitting`)

  // Filter out tiny sub-segments created by splitting
  const validSegments = splitSegments.filter(
    (s) => Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y) >= 2
  )

  if (signal?.aborted) return empty

  // Step 3: Build planar graph
  const nodes = buildGraph(validSegments, ROOMS.NODE_MERGE_TOLERANCE)

  // Prune dead-end nodes (degree 1) — they can't form rooms
  // Repeat until stable (cascading dead ends)
  let pruned = true
  while (pruned) {
    pruned = false
    for (const node of nodes) {
      if (node.neighbors.length === 1) {
        const nb = node.neighbors[0]!
        const nbNode = nodes[nb]!
        nbNode.neighbors = nbNode.neighbors.filter((n) => n !== node.id)
        nbNode.angles = []
        // Re-sort remaining neighbors
        const anglesAndNeighbors = nbNode.neighbors.map((n) => {
          const nNode = nodes[n]!
          return { nb: n, angle: Math.atan2(nNode.y - nbNode.y, nNode.x - nbNode.x) }
        })
        anglesAndNeighbors.sort((a, b) => a.angle - b.angle)
        nbNode.neighbors = anglesAndNeighbors.map((e) => e.nb)
        nbNode.angles = anglesAndNeighbors.map((e) => e.angle)

        node.neighbors = []
        node.angles = []
        pruned = true
      }
    }
  }

  if (signal?.aborted) return empty

  let edgeCount = 0
  for (const node of nodes) edgeCount += node.neighbors.length
  edgeCount /= 2

  console.log(`[RoomDetector] Graph: ${nodes.length} nodes, ${edgeCount} edges (after dead-end pruning)`)

  // Yield before face extraction
  await new Promise<void>((r) => setTimeout(r, 0))
  if (signal?.aborted) return empty

  // Step 4: Extract minimal faces
  const faces = extractFaces(nodes)

  console.log(`[RoomDetector] Found ${faces.length} raw faces`)

  if (signal?.aborted) return empty

  // Step 5: Filter faces to rooms
  const pageArea = pageWidth * pageHeight
  const minArea = Math.max(ROOMS.MIN_AREA, pageArea * ROOMS.MIN_AREA_RATIO)
  const relaxedMinArea = Math.max(ROOMS.MIN_AREA, minArea * 0.5)
  const maxArea = pageArea * ROOMS.MAX_AREA_RATIO
  const edgeMargin = Math.max(
    ROOMS.PAGE_EDGE_MARGIN,
    Math.min(pageWidth, pageHeight) * ROOMS.PAGE_EDGE_MARGIN_RATIO
  )
  const rooms: DetectedRoom[] = []
  const componentMetrics = computeComponentMetrics(nodes)
  const useComponentFilter = nodes.length >= ROOMS.COMPONENT_FILTER_MIN_NODES
  const faceFilterStats = {
    total: faces.length,
    rejectedByEdgeCount: 0,
    rejectedByArea: 0,
    rejectedByCompactness: 0,
    rejectedByOrthogonality: 0,
    rejectedByMinDimension: 0,
    rejectedByPageEdge: 0,
    rejectedByComponent: 0,
    accepted: 0
  }

  for (const face of faces) {
    if (face.length < ROOMS.MIN_EDGES || face.length > ROOMS.MAX_EDGES) {
      faceFilterStats.rejectedByEdgeCount++
      continue
    }

    const polygon = face.map((id) => ({ x: nodes[id]!.x, y: nodes[id]!.y }))
    const area = Math.abs(signedArea(polygon))

    if (area < minArea || area > maxArea) {
      faceFilterStats.rejectedByArea++
      continue
    }

    const c = compactness(polygon)
    if (c < ROOMS.MIN_COMPACTNESS) {
      faceFilterStats.rejectedByCompactness++
      continue
    }
    if (orthogonalEdgeRatio(polygon) < ROOMS.MIN_ORTHOGONAL_EDGE_RATIO) {
      faceFilterStats.rejectedByOrthogonality++
      continue
    }

    const centroid = polygonCentroid(polygon)
    const bounds = polygonBounds(polygon)

    // Minimum dimension filter — both width and height must exceed threshold.
    // This rejects title block cells (narrow rows/columns) and thin slivers.
    const roomWidth = bounds.maxX - bounds.minX
    const roomHeight = bounds.maxY - bounds.minY
    if (roomWidth < ROOMS.MIN_ROOM_DIMENSION || roomHeight < ROOMS.MIN_ROOM_DIMENSION) {
      faceFilterStats.rejectedByMinDimension++
      continue
    }
    if (
      bounds.minX <= edgeMargin ||
      bounds.minY <= edgeMargin ||
      bounds.maxX >= pageWidth - edgeMargin ||
      bounds.maxY >= pageHeight - edgeMargin
    ) {
      faceFilterStats.rejectedByPageEdge++
      continue
    }
    if (useComponentFilter) {
      const seedNodeId = face[0]
      if (seedNodeId === undefined) {
        faceFilterStats.rejectedByComponent++
        continue
      }
      const componentId = componentMetrics.componentByNode[seedNodeId]
      if (componentId === undefined || componentId < 0) {
        faceFilterStats.rejectedByComponent++
        continue
      }
      const componentEdges = componentMetrics.edgeCountByComponent[componentId] ?? 0
      if (componentEdges < ROOMS.COMPONENT_MIN_EDGES) {
        faceFilterStats.rejectedByComponent++
        continue
      }
    }

    rooms.push({
      id: `room-${++nextRoomId}`,
      polygon,
      area,
      centroid,
      bounds
    })
    faceFilterStats.accepted++
  }

  if (rooms.length === 0 && faces.length > 0) {
    const relaxedCompactness = Math.max(ROOMS.MIN_COMPACTNESS * 0.4, 0.02)
    const relaxedOrthogonality = Math.max(ROOMS.MIN_ORTHOGONAL_EDGE_RATIO * 0.75, 0.45)
    const relaxedRooms: DetectedRoom[] = []

    for (const face of faces) {
      if (face.length < 4 || face.length > Math.max(ROOMS.MAX_EDGES, 60)) continue

      const polygon = face.map((id) => ({ x: nodes[id]!.x, y: nodes[id]!.y }))
      const area = Math.abs(signedArea(polygon))
      if (area < relaxedMinArea || area > maxArea) continue

      const c = compactness(polygon)
      if (c < relaxedCompactness) continue
      if (orthogonalEdgeRatio(polygon) < relaxedOrthogonality) continue

      const bounds = polygonBounds(polygon)
      const roomWidth = bounds.maxX - bounds.minX
      const roomHeight = bounds.maxY - bounds.minY
      if (roomWidth < ROOMS.MIN_ROOM_DIMENSION || roomHeight < ROOMS.MIN_ROOM_DIMENSION) continue
      if (
        bounds.minX <= edgeMargin ||
        bounds.minY <= edgeMargin ||
        bounds.maxX >= pageWidth - edgeMargin ||
        bounds.maxY >= pageHeight - edgeMargin
      ) continue
      if (useComponentFilter) {
        const seedNodeId = face[0]
        if (seedNodeId === undefined) continue
        const componentId = componentMetrics.componentByNode[seedNodeId]
        if (componentId === undefined || componentId < 0) continue
        const componentEdges = componentMetrics.edgeCountByComponent[componentId] ?? 0
        if (componentEdges < ROOMS.COMPONENT_MIN_EDGES) continue
      }

      relaxedRooms.push({
        id: `room-${++nextRoomId}`,
        polygon,
        area,
        centroid: polygonCentroid(polygon),
        bounds
      })
    }

    if (relaxedRooms.length > 0) {
      console.log(
        `[RoomDetector] Relaxed face filter recovered ${relaxedRooms.length} rooms (compactness>=${relaxedCompactness.toFixed(3)}, orthogonality>=${relaxedOrthogonality.toFixed(2)})`
      )
      rooms.push(...relaxedRooms)
    }
  }

  if (rooms.length === 0) {
    const fallbackEdgeMargin = Math.max(edgeMargin, Math.min(pageWidth, pageHeight) * 0.04)
    const fallbackRooms = detectRectangularRoomsFromLines(
      validSegments,
      pageWidth,
      pageHeight,
      relaxedMinArea,
      maxArea,
      fallbackEdgeMargin
    )
    rooms.push(...fallbackRooms)
    console.log("[RoomDetector] Face filters:", faceFilterStats)
    console.log(`[RoomDetector] Rectangle fallback found ${fallbackRooms.length} room candidates`)
  }

  rooms.sort((a, b) => a.area - b.area)

  console.log(`[RoomDetector] ${rooms.length} rooms after filtering (from ${faces.length} faces)`)

  return {
    rooms,
    nodeCount: nodes.length,
    edgeCount,
    debug: includeDebug
      ? {
          rawSegments: [...segments],
          wallSegments: [...wallSegments],
          graphSegments: [...validSegments],
          nodes: nodes.map((node) => ({ x: node.x, y: node.y })),
          edges: extractGraphEdges(nodes),
          faceCount: faces.length
        }
      : null
  }
}

// Exported for testing
export { buildGraph, extractFaces, signedArea, polygonCentroid, filterWallSegments, compactness, splitAtIntersections }
