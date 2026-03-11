import type { PDFPageProxy } from "pdfjs-dist"
import { SNAP } from "@/constants/snap"
import type { Segment } from "@/types/snap"
import { deduplicatePointsSpatial } from "@/utils/snap/SpatialGrid"
import { extractWallSegments } from "@/utils/rooms/roomDetector"

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
 * Clamps to segment endpoints when the projection falls outside bounds.
 */
export function nearestPointOnSegment(cursor: Point, seg: Segment): Point {
  const dx = seg.end.x - seg.start.x
  const dy = seg.end.y - seg.start.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return { x: seg.start.x, y: seg.start.y }

  // Clamp t to [0, 1] — nearest point is always on the segment
  const t = Math.max(0, Math.min(1, ((cursor.x - seg.start.x) * dx + (cursor.y - seg.start.y) * dy) / lenSq))

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
export async function extractPdfContent(page: PDFPageProxy, signal?: AbortSignal): Promise<PdfContentData> {
  const allSegments = await extractWallSegments(page, signal)
  if (signal?.aborted) return { segments: [], endpoints: [], midpoints: [], intersections: [] }

  // All segments above minimum length — used for edge snapping
  const segments = allSegments.filter((s) => segmentLength(s) >= SNAP.MIN_SEGMENT_LENGTH)

  // Structural segments only — filters out font glyphs, hatching, decorative noise
  const structuralSegments = segments.filter((s) => segmentLength(s) >= SNAP.MIN_SEGMENT_LENGTH_POINTS)

  // Yield to main thread between heavy operations
  const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0))

  // Collect endpoints (structural segments only — avoids flooding with text glyph points)
  await yieldToMain()
  if (signal?.aborted) return { segments, endpoints: [], midpoints: [], intersections: [] }

  const rawEndpoints: Point[] = []
  for (const s of structuralSegments) {
    rawEndpoints.push(s.start, s.end)
  }
  const endpoints = deduplicatePointsSpatial(rawEndpoints, SNAP.ENDPOINT_DEDUP_TOLERANCE)

  // Compute midpoints (structural segments only)
  const rawMidpoints: Point[] = []
  for (const s of structuralSegments) {
    rawMidpoints.push({
      x: (s.start.x + s.end.x) / 2,
      y: (s.start.y + s.end.y) / 2
    })
  }
  const midpoints = deduplicatePointsSpatial(rawMidpoints, SNAP.ENDPOINT_DEDUP_TOLERANCE)

  // Compute intersections (structural segments only)
  await yieldToMain()
  if (signal?.aborted) return { segments, endpoints, midpoints, intersections: [] }

  const intersections = await computeIntersections(structuralSegments, signal)

  return { segments, endpoints, midpoints, intersections }
}
