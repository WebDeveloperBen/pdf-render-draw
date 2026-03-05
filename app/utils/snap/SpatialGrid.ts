import { SNAP } from "@/constants/snap"
import type { SnapTarget } from "@/types/snap"

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
