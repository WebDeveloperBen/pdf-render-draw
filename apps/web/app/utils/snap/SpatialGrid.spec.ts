import { SpatialGrid, SegmentGrid, deduplicatePointsSpatial } from "./SpatialGrid"
import type { SnapTarget, Segment } from "@/types/snap"

// --- SpatialGrid ---

describe("SpatialGrid", () => {
  let grid: SpatialGrid

  beforeEach(() => {
    grid = new SpatialGrid(40)
  })

  function makeTarget(x: number, y: number, priority = 0, type: SnapTarget["type"] = "endpoint"): SnapTarget {
    return { point: { x, y }, type, source: "content", priority }
  }

  describe("insert and findNearest", () => {
    it("should find the nearest target within threshold", () => {
      grid.insert(makeTarget(100, 100))
      grid.insert(makeTarget(200, 200))

      const result = grid.findNearest({ x: 105, y: 105 }, 15)
      expect(result).not.toBeNull()
      expect(result!.point).toEqual({ x: 100, y: 100 })
    })

    it("should return null when no target is within threshold", () => {
      grid.insert(makeTarget(100, 100))

      const result = grid.findNearest({ x: 200, y: 200 }, 10)
      expect(result).toBeNull()
    })

    it("should prefer closer target over farther one", () => {
      grid.insert(makeTarget(100, 100))
      grid.insert(makeTarget(110, 110))

      const result = grid.findNearest({ x: 108, y: 108 }, 20)
      expect(result).not.toBeNull()
      expect(result!.point).toEqual({ x: 110, y: 110 })
    })

    it("should prefer lower priority when equidistant", () => {
      // Two targets at the same distance from cursor
      grid.insert(makeTarget(105, 100, 3, "midpoint"))
      grid.insert(makeTarget(95, 100, 1, "endpoint"))

      const result = grid.findNearest({ x: 100, y: 100 }, 20)
      expect(result).not.toBeNull()
      expect(result!.priority).toBe(1)
      expect(result!.type).toBe("endpoint")
    })

    it("should find targets across cell boundaries", () => {
      // Grid cell size is 40, so target at (39,39) is in cell (0,0)
      // Cursor at (41,41) is in cell (1,1) — different cell
      grid.insert(makeTarget(39, 39))

      const result = grid.findNearest({ x: 41, y: 41 }, 10)
      expect(result).not.toBeNull()
      expect(result!.point).toEqual({ x: 39, y: 39 })
    })
  })

  describe("clear", () => {
    it("should remove all targets", () => {
      grid.insert(makeTarget(100, 100))
      grid.insert(makeTarget(200, 200))
      expect(grid.size).toBe(2)

      grid.clear()
      expect(grid.size).toBe(0)
      expect(grid.findNearest({ x: 100, y: 100 }, 50)).toBeNull()
    })
  })

  describe("size", () => {
    it("should count all inserted targets", () => {
      expect(grid.size).toBe(0)
      grid.insert(makeTarget(10, 10))
      grid.insert(makeTarget(20, 20))
      grid.insert(makeTarget(30, 30))
      expect(grid.size).toBe(3)
    })
  })

  describe("negative coordinates", () => {
    it("should handle targets with negative coordinates", () => {
      grid.insert(makeTarget(-100, -100))
      grid.insert(makeTarget(-50, -50))

      const result = grid.findNearest({ x: -99, y: -99 }, 10)
      expect(result).not.toBeNull()
      expect(result!.point).toEqual({ x: -100, y: -100 })
    })

    it("should find targets across negative/positive boundary", () => {
      grid.insert(makeTarget(-5, -5))

      const result = grid.findNearest({ x: 5, y: 5 }, 20)
      expect(result).not.toBeNull()
      expect(result!.point).toEqual({ x: -5, y: -5 })
    })
  })

  describe("large threshold", () => {
    it("should find target when threshold spans many cells", () => {
      // Cell size is 40, target is 150px away — spans ~4 cells
      grid.insert(makeTarget(200, 200))

      const result = grid.findNearest({ x: 50, y: 200 }, 200)
      expect(result).not.toBeNull()
      expect(result!.point).toEqual({ x: 200, y: 200 })
    })
  })

  describe("dist field", () => {
    it("should include dist field in findNearest result", () => {
      grid.insert(makeTarget(100, 100))

      const result = grid.findNearest({ x: 103, y: 104 }, 15)
      expect(result).not.toBeNull()
      expect(result!.dist).toBeCloseTo(5, 0) // sqrt(9+16) = 5
    })

    it("should return exact 0 dist when cursor is on target", () => {
      grid.insert(makeTarget(50, 50))

      const result = grid.findNearest({ x: 50, y: 50 }, 10)
      expect(result).not.toBeNull()
      expect(result!.dist).toBe(0)
    })
  })
})

// --- SegmentGrid ---

describe("SegmentGrid", () => {
  let grid: SegmentGrid

  beforeEach(() => {
    grid = new SegmentGrid(50)
  })

  function makeSeg(x1: number, y1: number, x2: number, y2: number): Segment {
    return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }
  }

  describe("findNear", () => {
    it("should find segments near the cursor", () => {
      const seg = makeSeg(100, 100, 200, 100)
      grid.insert(seg)

      const result = grid.findNear({ x: 150, y: 105 }, 20)
      expect(result).toHaveLength(1)
      expect(result[0]).toBe(seg)
    })

    it("should return empty when no segments are near", () => {
      grid.insert(makeSeg(100, 100, 200, 100))

      const result = grid.findNear({ x: 500, y: 500 }, 10)
      expect(result).toHaveLength(0)
    })

    it("should not return duplicate segments spanning multiple cells", () => {
      // This segment spans multiple grid cells (50px cell size)
      const seg = makeSeg(0, 0, 200, 0)
      grid.insert(seg)

      // Search near the middle — segment appears in multiple cells
      const result = grid.findNear({ x: 100, y: 0 }, 60)
      expect(result).toHaveLength(1)
    })

    it("should find multiple distinct segments", () => {
      const seg1 = makeSeg(100, 100, 200, 100)
      const seg2 = makeSeg(100, 110, 200, 110)
      grid.insertAll([seg1, seg2])

      const result = grid.findNear({ x: 150, y: 105 }, 20)
      expect(result).toHaveLength(2)
    })
  })

  describe("insertAll", () => {
    it("should insert all segments", () => {
      const segs = [makeSeg(0, 0, 10, 0), makeSeg(50, 50, 60, 50), makeSeg(100, 100, 110, 100)]
      grid.insertAll(segs)
      expect(grid.size).toBe(3)
    })
  })

  describe("clear", () => {
    it("should remove all segments", () => {
      grid.insertAll([makeSeg(0, 0, 10, 0), makeSeg(50, 50, 60, 50)])
      grid.clear()
      expect(grid.size).toBe(0)
    })
  })
})

// --- deduplicatePointsSpatial ---

describe("deduplicatePointsSpatial", () => {
  it("should remove points within tolerance of each other", () => {
    const points: Point[] = [
      { x: 100, y: 100 },
      { x: 100.3, y: 100.3 }, // within 0.5 tolerance
      { x: 200, y: 200 }
    ]

    const result = deduplicatePointsSpatial(points, 0.5)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ x: 100, y: 100 })
    expect(result[1]).toEqual({ x: 200, y: 200 })
  })

  it("should keep points outside tolerance", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 }
    ]

    const result = deduplicatePointsSpatial(points, 1)
    expect(result).toHaveLength(3)
  })

  it("should handle empty input", () => {
    expect(deduplicatePointsSpatial([], 1)).toEqual([])
  })

  it("should handle single point", () => {
    const result = deduplicatePointsSpatial([{ x: 5, y: 5 }], 1)
    expect(result).toHaveLength(1)
  })

  it("should correctly dedup points on cell boundaries", () => {
    // Two points that are close but fall in different grid cells
    const tolerance = 2
    const points: Point[] = [
      { x: 1.9, y: 0 },
      { x: 2.1, y: 0 } // different cell, but within tolerance
    ]

    const result = deduplicatePointsSpatial(points, tolerance)
    expect(result).toHaveLength(1)
  })

  it("should handle large numbers of points efficiently", () => {
    // Generate a grid of points with duplicates
    const points: Point[] = []
    for (let i = 0; i < 1000; i++) {
      points.push({ x: i * 10, y: 0 })
      points.push({ x: i * 10 + 0.1, y: 0.1 }) // near-duplicate
    }

    const result = deduplicatePointsSpatial(points, 0.5)
    expect(result).toHaveLength(1000) // half should be deduped
  })
})
