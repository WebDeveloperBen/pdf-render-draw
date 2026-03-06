import { describe, it, expect } from "vitest"
import { detectRooms, buildGraph, extractFaces, signedArea, polygonCentroid, filterWallSegments, compactness, splitAtIntersections } from "./roomDetector"
import type { Segment } from "@/types/snap"

function seg(x1: number, y1: number, x2: number, y2: number): Segment {
  return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }
}

describe("signedArea", () => {
  it("returns positive area for CCW polygon", () => {
    const polygon = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }
    ]
    expect(signedArea(polygon)).toBe(10000)
  })

  it("returns negative area for CW polygon", () => {
    const polygon = [
      { x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 }
    ]
    expect(signedArea(polygon)).toBe(-10000)
  })
})

describe("polygonCentroid", () => {
  it("computes centroid of a square", () => {
    const c = polygonCentroid([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }
    ])
    expect(c.x).toBe(50)
    expect(c.y).toBe(50)
  })
})

describe("compactness", () => {
  it("returns ~0.785 for a square", () => {
    const polygon = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }
    ]
    expect(compactness(polygon)).toBeCloseTo(Math.PI / 4, 2)
  })

  it("returns low value for thin rectangle", () => {
    const polygon = [
      { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 5 }, { x: 0, y: 5 }
    ]
    expect(compactness(polygon)).toBeLessThan(0.1)
  })
})

describe("splitAtIntersections", () => {
  it("splits crossing segments into 4 sub-segments", () => {
    // A cross: horizontal and vertical segments crossing at (150, 150)
    const segments = [
      seg(100, 150, 200, 150), // horizontal
      seg(150, 100, 150, 200)  // vertical
    ]
    const result = splitAtIntersections(segments)

    // Each segment split into 2 → total 4
    expect(result.length).toBe(4)
  })

  it("does not split non-crossing segments", () => {
    const segments = [
      seg(0, 0, 100, 0),
      seg(0, 50, 100, 50)
    ]
    const result = splitAtIntersections(segments)
    expect(result.length).toBe(2)
  })

  it("splits T-junction correctly", () => {
    // Horizontal segment, vertical segment ending at the horizontal
    // The vertical goes through the horizontal's interior
    const segments = [
      seg(100, 100, 300, 100), // horizontal wall
      seg(200, 50, 200, 150)   // vertical wall crossing through at (200,100)
    ]
    const result = splitAtIntersections(segments)

    // Horizontal split into 2 at x=200, vertical split into 2 at y=100
    expect(result.length).toBe(4)
  })

  it("splits when one segment endpoint touches another segment interior", () => {
    const segments = [
      seg(100, 100, 300, 100), // horizontal
      seg(200, 40, 200, 100)   // vertical ends at horizontal interior
    ]
    const result = splitAtIntersections(segments)

    // Horizontal split into 2 at x=200, vertical remains one segment
    expect(result.length).toBe(3)
  })

  it("handles multiple intersections on one segment", () => {
    // One long horizontal, two verticals crossing it
    const segments = [
      seg(100, 100, 500, 100),
      seg(200, 50, 200, 150),
      seg(400, 50, 400, 150)
    ]
    const result = splitAtIntersections(segments)

    // Horizontal split into 3 (at x=200 and x=400)
    // Each vertical split into 2
    expect(result.length).toBe(7)
  })
})

describe("filterWallSegments", () => {
  // Create a realistic set: many segments in the center (floor plan area)
  // plus a few outliers (title block)
  const centerSegments = [
    seg(100, 100, 400, 100), seg(100, 200, 400, 200),
    seg(100, 300, 400, 300), seg(100, 100, 100, 300),
    seg(200, 100, 200, 300), seg(400, 100, 400, 300)
  ]

  it("keeps long segments in the dense drawing area", () => {
    const result = filterWallSegments(centerSegments, 600, 800)
    expect(result.length).toBe(6)
  })

  it("filters short segments", () => {
    const withShort = [...centerSegments, seg(150, 150, 155, 150)]
    const result = filterWallSegments(withShort, 600, 800)
    // Short segment filtered, center segments kept
    expect(result.length).toBe(6)
  })

  it("preserves all main segments even with outliers", () => {
    const withOutlier = [...centerSegments, seg(580, 780, 580, 600)]
    const result = filterWallSegments(withOutlier, 600, 800)
    // All center segments must be preserved
    expect(result.length).toBeGreaterThanOrEqual(6)
  })
})

describe("buildGraph", () => {
  it("merges nearby endpoints", () => {
    const segments = [
      seg(100, 100, 200, 100),
      seg(201, 101, 300, 100)
    ]
    const nodes = buildGraph(segments, 4)
    expect(nodes.length).toBe(3) // merged middle point
  })

  it("builds correct adjacency for a triangle", () => {
    const segments = [
      seg(100, 100, 200, 100),
      seg(200, 100, 150, 187),
      seg(150, 187, 100, 100)
    ]
    const nodes = buildGraph(segments, 4)
    expect(nodes.length).toBe(3)
    for (const node of nodes) {
      expect(node.neighbors.length).toBe(2)
    }
  })
})

describe("extractFaces", () => {
  it("finds faces for a square", () => {
    const segments = [
      seg(100, 100, 300, 100),
      seg(300, 100, 300, 300),
      seg(300, 300, 100, 300),
      seg(100, 300, 100, 100)
    ]
    const nodes = buildGraph(segments, 4)
    const faces = extractFaces(nodes)

    expect(faces.length).toBeGreaterThanOrEqual(1)
    expect(faces.some((f) => f.length === 4)).toBe(true)
  })

  it("finds two faces for adjacent rectangles sharing a wall", () => {
    const segments = [
      seg(100, 100, 250, 100),
      seg(250, 100, 400, 100),
      seg(400, 100, 400, 300),
      seg(400, 300, 250, 300),
      seg(250, 300, 100, 300),
      seg(100, 300, 100, 100),
      seg(250, 100, 250, 300)
    ]
    const nodes = buildGraph(segments, 4)
    const faces = extractFaces(nodes)

    expect(faces.filter((f) => f.length === 4).length).toBeGreaterThanOrEqual(2)
  })
})

describe("detectRooms", () => {
  const PAGE = 1000

  it("detects a rectangular room", async () => {
    const segments = [
      seg(100, 100, 400, 100),
      seg(400, 100, 400, 350),
      seg(400, 350, 100, 350),
      seg(100, 350, 100, 100)
    ]
    const result = await detectRooms(segments, PAGE, PAGE)

    expect(result.rooms.length).toBe(1)
    expect(result.rooms[0]!.polygon.length).toBe(4)
  })

  it("detects rooms from crossing segments (T-junctions)", async () => {
    // Two rooms created by crossing walls:
    //   ┌────────┬────────┐
    //   │  Room1 │  Room2 │
    //   └────────┴────────┘
    // Built from 3 horizontal + 4 vertical crossing segments
    const segments = [
      seg(100, 100, 500, 100), // top wall (continuous)
      seg(100, 300, 500, 300), // bottom wall (continuous)
      seg(100, 100, 100, 300), // left wall
      seg(300, 50, 300, 350),  // middle wall (extends past to ensure crossing)
      seg(500, 100, 500, 300)  // right wall
    ]
    const result = await detectRooms(segments, PAGE, PAGE)

    // Should find 2 rooms (left and right of middle wall)
    expect(result.rooms.length).toBeGreaterThanOrEqual(2)
  })

  it("filters too-small rooms", async () => {
    // 12x12 = 144 sq pts, well below MIN_AREA of 300
    const segments = [
      seg(100, 100, 112, 100),
      seg(112, 100, 112, 112),
      seg(112, 112, 100, 112),
      seg(100, 112, 100, 100)
    ]
    const result = await detectRooms(segments, PAGE, PAGE)
    expect(result.rooms.length).toBe(0)
  })

  it("returns empty for no segments", async () => {
    const result = await detectRooms([], PAGE, PAGE)
    expect(result.rooms).toHaveLength(0)
  })

  it("rejects a non-orthogonal wedge-like polygon", async () => {
    const segments = [
      seg(100, 100, 250, 100),
      seg(250, 100, 180, 220),
      seg(180, 220, 100, 100)
    ]
    const result = await detectRooms(segments, PAGE, PAGE)
    expect(result.rooms).toHaveLength(0)
  })

  it("rejects room candidates near the page edge margin", async () => {
    const segments = [
      seg(5, 700, 66, 700),
      seg(66, 700, 66, 761),
      seg(66, 761, 5, 761),
      seg(5, 761, 5, 700)
    ]
    const result = await detectRooms(segments, 1191, 842)
    expect(result.rooms).toHaveLength(0)
  })

  it("detects a rectangular room with a small wall gap via fallback", async () => {
    const segments = [
      seg(100, 100, 195, 100), // top-left (gap in top wall)
      seg(205, 100, 300, 100), // top-right
      seg(100, 300, 300, 300), // bottom
      seg(100, 100, 100, 300), // left
      seg(300, 100, 300, 300)  // right
    ]
    const result = await detectRooms(segments, PAGE, PAGE)
    expect(result.rooms.length).toBeGreaterThanOrEqual(1)
  })

  it("respects abort signal", async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await detectRooms(
      [seg(100, 100, 300, 100), seg(300, 100, 300, 300), seg(300, 300, 100, 300), seg(100, 300, 100, 100)],
      PAGE, PAGE, controller.signal
    )
    expect(result.rooms).toHaveLength(0)
  })

  it("detects 3 adjacent rooms in a row", async () => {
    // Three rooms side by side with shared walls:
    // Horizontal walls span full width, vertical walls create divisions
    const segments = [
      seg(100, 100, 700, 100), // top wall
      seg(100, 350, 700, 350), // bottom wall
      seg(100, 100, 100, 350), // left wall
      seg(300, 50, 300, 400),  // divider 1 (extends past to cross)
      seg(500, 50, 500, 400),  // divider 2 (extends past to cross)
      seg(700, 100, 700, 350)  // right wall
    ]
    const result = await detectRooms(segments, PAGE, PAGE)
    expect(result.rooms.length).toBeGreaterThanOrEqual(3)
  })
})
