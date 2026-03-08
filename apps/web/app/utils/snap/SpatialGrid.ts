import { SNAP } from "@/constants/snap"
import type { SnapTarget, Segment } from "@/types/snap"

interface NearestResult extends SnapTarget {
  dist: number
}

/**
 * Spatial hash grid for fast nearest-snap-target lookup.
 *
 * Points are bucketed into grid cells. To find the nearest target to a cursor,
 * only cells within the search radius are checked — keeping lookups sub-linear
 * even with thousands of targets.
 */
export class SpatialGrid {
  private cells = new Map<string, SnapTarget[]>()
  private cellSize: number

  constructor(cellSize = SNAP.GRID_CELL_SIZE) {
    this.cellSize = cellSize
  }

  private key(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`
  }

  clear() {
    this.cells.clear()
  }

  insert(target: SnapTarget) {
    const k = this.key(target.point.x, target.point.y)
    let bucket = this.cells.get(k)
    if (!bucket) {
      bucket = []
      this.cells.set(k, bucket)
    }
    bucket.push(target)
  }

  /**
   * Find the nearest snap target within `threshold` PDF points of `cursor`.
   *
   * When two targets are equidistant, the one with the lower priority value wins.
   */
  findNearest(cursor: Point, threshold: number): NearestResult | null {
    const cx = Math.floor(cursor.x / this.cellSize)
    const cy = Math.floor(cursor.y / this.cellSize)
    const cellRadius = Math.ceil(threshold / this.cellSize)

    let best: NearestResult | null = null

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const bucket = this.cells.get(`${cx + dx},${cy + dy}`)
        if (!bucket) continue

        for (const target of bucket) {
          const d = Math.hypot(target.point.x - cursor.x, target.point.y - cursor.y)
          if (d > threshold) continue

          if (!best || d < best.dist || (d === best.dist && target.priority < best.priority)) {
            best = { ...target, dist: d }
          }
        }
      }
    }

    return best
  }

  get size(): number {
    let count = 0
    for (const bucket of this.cells.values()) {
      count += bucket.length
    }
    return count
  }
}

/**
 * Spatial hash grid for fast nearest-segment lookup.
 *
 * Each segment is inserted into all cells its bounding box overlaps.
 * Queries only check cells near the cursor, keeping edge snapping sub-linear.
 */
export class SegmentGrid {
  private cells = new Map<string, Segment[]>()
  private cellSize: number

  constructor(cellSize = SNAP.SEGMENT_GRID_CELL) {
    this.cellSize = cellSize
  }

  clear() {
    this.cells.clear()
  }

  insert(seg: Segment) {
    const minCX = Math.floor(Math.min(seg.start.x, seg.end.x) / this.cellSize)
    const maxCX = Math.floor(Math.max(seg.start.x, seg.end.x) / this.cellSize)
    const minCY = Math.floor(Math.min(seg.start.y, seg.end.y) / this.cellSize)
    const maxCY = Math.floor(Math.max(seg.start.y, seg.end.y) / this.cellSize)

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const key = `${cx},${cy}`
        let bucket = this.cells.get(key)
        if (!bucket) {
          bucket = []
          this.cells.set(key, bucket)
        }
        bucket.push(seg)
      }
    }
  }

  insertAll(segments: Segment[]) {
    for (const seg of segments) {
      this.insert(seg)
    }
  }

  /**
   * Find segments in cells near the cursor within threshold distance.
   * Returns only unique segments (a segment may span multiple cells).
   */
  findNear(cursor: Point, threshold: number): Segment[] {
    const cx = Math.floor(cursor.x / this.cellSize)
    const cy = Math.floor(cursor.y / this.cellSize)
    const cellRadius = Math.ceil(threshold / this.cellSize)

    const seen = new Set<Segment>()
    const result: Segment[] = []

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const bucket = this.cells.get(`${cx + dx},${cy + dy}`)
        if (!bucket) continue

        for (const seg of bucket) {
          if (!seen.has(seg)) {
            seen.add(seg)
            result.push(seg)
          }
        }
      }
    }

    return result
  }

  get size(): number {
    const seen = new Set<Segment>()
    for (const bucket of this.cells.values()) {
      for (const seg of bucket) {
        seen.add(seg)
      }
    }
    return seen.size
  }
}

/**
 * Deduplicate points using a spatial hash for O(n) performance.
 *
 * Points within `tolerance` of an already-accepted point are discarded.
 * Uses a grid with cell size = tolerance and checks the 9 surrounding cells
 * to guarantee no near-duplicates slip through.
 */
export function deduplicatePointsSpatial(points: Point[], tolerance: number): Point[] {
  const cellSize = Math.max(tolerance, SNAP.DEDUP_CELL_SIZE)
  const grid = new Map<string, Point[]>()
  const result: Point[] = []

  function key(x: number, y: number): string {
    return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`
  }

  for (const p of points) {
    const cx = Math.floor(p.x / cellSize)
    const cy = Math.floor(p.y / cellSize)

    let isDupe = false
    // Check 3x3 neighborhood
    outer:
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${cx + dx},${cy + dy}`)
        if (!bucket) continue
        for (const r of bucket) {
          if (Math.hypot(p.x - r.x, p.y - r.y) <= tolerance) {
            isDupe = true
            break outer
          }
        }
      }
    }

    if (!isDupe) {
      const k = key(p.x, p.y)
      let bucket = grid.get(k)
      if (!bucket) {
        bucket = []
        grid.set(k, bucket)
      }
      bucket.push(p)
      result.push(p)
    }
  }

  return result
}
