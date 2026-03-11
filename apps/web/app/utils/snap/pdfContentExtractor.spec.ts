import { nearestPointOnSegment, extractPdfContent } from "./pdfContentExtractor"
import type { Segment } from "@/types/snap"

// Mock pdfjs-dist
vi.mock("pdfjs-dist", () => ({
  OPS: {
    constructPath: 91,
    save: 10,
    restore: 11,
    transform: 12,
    stroke: 50,
    closeStroke: 51,
    fillStroke: 52,
    eoFillStroke: 53,
    closeFillStroke: 54,
    closeEOFillStroke: 55
  }
}))

// Mock debug utils
vi.mock("~/utils/debug", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn()
}))

describe("nearestPointOnSegment", () => {
  function makeSeg(x1: number, y1: number, x2: number, y2: number): Segment {
    return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }
  }

  it("should project cursor onto a horizontal segment", () => {
    const seg = makeSeg(0, 0, 100, 0)
    const result = nearestPointOnSegment({ x: 50, y: 10 }, seg)

    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(50, 1)
    expect(result!.y).toBeCloseTo(0, 1)
  })

  it("should project cursor onto a vertical segment", () => {
    const seg = makeSeg(0, 0, 0, 100)
    const result = nearestPointOnSegment({ x: 10, y: 50 }, seg)

    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(0, 1)
    expect(result!.y).toBeCloseTo(50, 1)
  })

  it("should project cursor onto a diagonal segment", () => {
    const seg = makeSeg(0, 0, 100, 100)
    // Point perpendicular to midpoint: (60, 40) projects to ~(50, 50)
    const result = nearestPointOnSegment({ x: 60, y: 40 }, seg)

    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(50, 1)
    expect(result!.y).toBeCloseTo(50, 1)
  })

  it("should clamp to start endpoint when projection falls before start (t <= 0)", () => {
    const seg = makeSeg(0, 0, 100, 0)
    const result = nearestPointOnSegment({ x: -10, y: 5 }, seg)

    expect(result.x).toBeCloseTo(0, 1)
    expect(result.y).toBeCloseTo(0, 1)
  })

  it("should clamp to end endpoint when projection falls past end (t >= 1)", () => {
    const seg = makeSeg(0, 0, 100, 0)
    const result = nearestPointOnSegment({ x: 110, y: 5 }, seg)

    expect(result.x).toBeCloseTo(100, 1)
    expect(result.y).toBeCloseTo(0, 1)
  })

  it("should return start point for zero-length segment", () => {
    const seg = makeSeg(50, 50, 50, 50)
    const result = nearestPointOnSegment({ x: 50, y: 55 }, seg)

    expect(result.x).toBeCloseTo(50, 1)
    expect(result.y).toBeCloseTo(50, 1)
  })

  it("should return interior projection for cursor far from segment", () => {
    const seg = makeSeg(0, 0, 100, 0)
    // Cursor far above the midpoint — still projects to midpoint
    const result = nearestPointOnSegment({ x: 50, y: 1000 }, seg)

    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(50, 1)
    expect(result!.y).toBeCloseTo(0, 1)
  })
})

describe("extractPdfContent", () => {
  function createMockPage(pathBuffers: Float32Array[], pageNumber = 1) {
    const fnArray = pathBuffers.map(() => 91) // OPS.constructPath
    const argsArray = pathBuffers.map((buf) => [
      50, // rendering op = OPS.stroke
      [buf], // [Float32Array]
      new Float32Array([0, 0, 1000, 1000]) // bounding box
    ])

    return {
      pageNumber,
      getOperatorList: vi.fn().mockResolvedValue({ fnArray, argsArray }),
      getViewport: vi.fn().mockReturnValue({
        convertToViewportPoint: (x: number, y: number) => [x, 800 - y] as [number, number]
      })
    } as any
  }

  it("should extract segments from a simple path (moveTo + lineTo)", async () => {
    // DrawOPS: moveTo(0,0), lineTo(100,0)
    const buffer = new Float32Array([0, 0, 0, 1, 100, 0])
    const page = createMockPage([buffer])

    const result = await extractPdfContent(page)

    // Should have 1 segment (100 units long, passes MIN_SEGMENT_LENGTH filter)
    expect(result.segments.length).toBeGreaterThanOrEqual(1)
    expect(result.endpoints.length).toBeGreaterThanOrEqual(2)
  })

  it("should filter out tiny segments (below MIN_SEGMENT_LENGTH)", async () => {
    // moveTo(0,0), lineTo(1,0) — only 1 unit long, below threshold of 3
    const buffer = new Float32Array([0, 0, 0, 1, 1, 0])
    const page = createMockPage([buffer])

    const result = await extractPdfContent(page)

    expect(result.segments).toHaveLength(0)
    expect(result.endpoints).toHaveLength(0)
  })

  it("should emit closing segment on closePath", async () => {
    // Triangle: moveTo(0,0), lineTo(100,0), lineTo(50,100), closePath
    const buffer = new Float32Array([
      0,
      0,
      0, // moveTo(0, 0)
      1,
      100,
      0, // lineTo(100, 0)
      1,
      50,
      100, // lineTo(50, 100)
      4 // closePath → segment from (50,100) back to (0,0)
    ])
    const page = createMockPage([buffer])

    const result = await extractPdfContent(page)

    // 3 segments: (0,0)→(100,0), (100,0)→(50,100), (50,100)→(0,0)
    expect(result.segments).toHaveLength(3)
  })

  it("should compute midpoints for each segment", async () => {
    // Horizontal line: moveTo(0,0), lineTo(200,0)
    const buffer = new Float32Array([0, 0, 0, 1, 200, 0])
    const page = createMockPage([buffer])

    const result = await extractPdfContent(page)

    expect(result.midpoints.length).toBeGreaterThanOrEqual(1)
    // Midpoint of (0, 800) to (200, 800) should be near (100, 800)
    // (Y is flipped: viewport converts y → 800-y)
    const mid = result.midpoints[0]!
    expect(mid.x).toBeCloseTo(100, 0)
  })

  it("should deduplicate nearby endpoints", async () => {
    // Two segments sharing an endpoint
    // moveTo(0,0), lineTo(100,0), moveTo(100,0.1), lineTo(200,0)
    const buffer = new Float32Array([
      0,
      0,
      0,
      1,
      100,
      0,
      0,
      100,
      0.1, // near-duplicate of (100, 0)
      1,
      200,
      0
    ])
    const page = createMockPage([buffer])

    const result = await extractPdfContent(page)

    // Should have 3 unique endpoints (not 4), since (100,0) and (100,0.1) are within tolerance
    expect(result.endpoints.length).toBeLessThanOrEqual(3)
  })

  it("should compute intersections for crossing segments", async () => {
    // Two crossing segments: horizontal (0,50)→(100,50) and vertical (50,0)→(50,100)
    const buffer = new Float32Array([
      0,
      0,
      50, // moveTo(0, 50)
      1,
      100,
      50, // lineTo(100, 50) — horizontal
      0,
      50,
      0, // moveTo(50, 0)
      1,
      50,
      100 // lineTo(50, 100) — vertical
    ])
    const page = createMockPage([buffer])

    const result = await extractPdfContent(page)

    // Should find the intersection at (50, 750) in viewport coords (800-50=750)
    expect(result.intersections.length).toBeGreaterThanOrEqual(1)
  })

  it("should abort extraction when signal is aborted", async () => {
    const buffer = new Float32Array([0, 0, 0, 1, 100, 0])
    const page = createMockPage([buffer])
    const controller = new AbortController()

    // Abort immediately
    controller.abort()

    const result = await extractPdfContent(page, controller.signal)

    expect(result.segments).toHaveLength(0)
    expect(result.endpoints).toHaveLength(0)
  })

  it("should discard subpaths containing cubic bezier curves", async () => {
    // parseWallSegments skips entire subpaths with curves — walls are straight lines
    const buffer = new Float32Array([
      0,
      0,
      0, // moveTo(0, 0)
      2,
      25,
      50,
      75,
      50,
      100,
      0 // curveTo → discards this subpath
    ])
    const page = createMockPage([buffer])

    const result = await extractPdfContent(page)

    // Curves are not wall segments — entire subpath is discarded
    expect(result.segments).toHaveLength(0)
  })

  it("should discard subpaths containing quadratic bezier curves", async () => {
    // parseWallSegments skips entire subpaths with curves
    const buffer = new Float32Array([
      0,
      0,
      0, // moveTo(0, 0)
      3,
      50,
      50,
      100,
      0 // quadraticCurveTo → discards this subpath
    ])
    const page = createMockPage([buffer])

    const result = await extractPdfContent(page)

    // Curves are not wall segments — entire subpath is discarded
    expect(result.segments).toHaveLength(0)
  })

  it("should handle empty operator list", async () => {
    const page = {
      pageNumber: 1,
      getOperatorList: vi.fn().mockResolvedValue({ fnArray: [], argsArray: [] }),
      getViewport: vi.fn().mockReturnValue({
        convertToViewportPoint: (x: number, y: number) => [x, y] as [number, number]
      })
    } as any

    const result = await extractPdfContent(page)

    expect(result.segments).toHaveLength(0)
    expect(result.endpoints).toHaveLength(0)
    expect(result.midpoints).toHaveLength(0)
    expect(result.intersections).toHaveLength(0)
  })

  it("should skip null pathData in constructPath args", async () => {
    // args[1] is [null] — pathData is null
    const page = {
      pageNumber: 1,
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [91], // OPS.constructPath
        argsArray: [[0, [null], new Float32Array([0, 0, 100, 100])]]
      }),
      getViewport: vi.fn().mockReturnValue({
        convertToViewportPoint: (x: number, y: number) => [x, 800 - y] as [number, number]
      })
    } as any

    const result = await extractPdfContent(page)

    expect(result.segments).toHaveLength(0)
    expect(result.endpoints).toHaveLength(0)
  })

  it("should handle multiple constructPath operators in one page", async () => {
    // Two separate constructPath ops, each with a segment
    const buf1 = new Float32Array([0, 0, 0, 1, 100, 0]) // horizontal line
    const buf2 = new Float32Array([0, 0, 0, 1, 0, 100]) // vertical line

    const page = {
      pageNumber: 1,
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [91, 91],
        argsArray: [
          [50, [buf1], new Float32Array([0, 0, 100, 100])],
          [50, [buf2], new Float32Array([0, 0, 100, 100])]
        ]
      }),
      getViewport: vi.fn().mockReturnValue({
        convertToViewportPoint: (x: number, y: number) => [x, 800 - y] as [number, number]
      })
    } as any

    const result = await extractPdfContent(page)

    expect(result.segments).toHaveLength(2)
  })

  it("should reject near-parallel segments when computing intersections", async () => {
    // Two nearly parallel horizontal segments — should NOT produce an intersection
    const buf = new Float32Array([
      0,
      0,
      0, // moveTo(0, 0)
      1,
      200,
      0, // lineTo(200, 0) — horizontal
      0,
      0,
      10, // moveTo(0, 10)
      1,
      200,
      10.5 // lineTo(200, 10.5) — nearly horizontal (0.14° off)
    ])
    const page = createMockPage([buf])

    const result = await extractPdfContent(page)

    // The two segments are nearly parallel (within NEAR_PARALLEL_DEG = 3°)
    // so no intersection should be detected
    expect(result.intersections).toHaveLength(0)
  })

  it("should apply density cap to filter hatching patterns", async () => {
    // Create a grid pattern that produces many intersections in one density cell
    // Many horizontal + many vertical lines in a small area
    const paths: Float32Array[] = []
    for (let i = 0; i < 20; i++) {
      // Horizontal lines at y = i*2
      paths.push(new Float32Array([0, 0, i * 2, 1, 40, i * 2]))
      // Vertical lines at x = i*2
      paths.push(new Float32Array([0, i * 2, 0, 1, i * 2, 40]))
    }
    const page = createMockPage(paths)

    const result = await extractPdfContent(page)

    // The density cap (DENSITY_CAP = 15) should filter out cells with too many intersections
    // With 20x20 = 400 potential intersections in a small area, many cells will exceed the cap
    // The exact count depends on geometry, but it should be significantly less than 400
    expect(result.intersections.length).toBeLessThan(400)
  })

  it("should skip unknown DrawOPS commands without infinite loop", async () => {
    // Buffer with unknown command code 99 followed by valid data
    const buffer = new Float32Array([
      0,
      0,
      0, // moveTo(0, 0)
      99, // unknown command — should skip 1 element
      1,
      100,
      0 // lineTo(100, 0)
    ])
    const page = createMockPage([buffer])

    const result = await extractPdfContent(page)

    // Should still extract the segment despite the unknown command
    expect(result.segments.length).toBeGreaterThanOrEqual(1)
  })

  it("should skip non-constructPath operators", async () => {
    // fnArray has ops that are NOT constructPath (91)
    const page = {
      pageNumber: 1,
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [10, 20, 30], // random non-constructPath ops
        argsArray: [
          [new Float32Array([0, 0, 0, 1, 100, 0])],
          [new Float32Array([0, 0, 0, 1, 100, 0])],
          [new Float32Array([0, 0, 0, 1, 100, 0])]
        ]
      }),
      getViewport: vi.fn().mockReturnValue({
        convertToViewportPoint: (x: number, y: number) => [x, 800 - y] as [number, number]
      })
    } as any

    const result = await extractPdfContent(page)

    expect(result.segments).toHaveLength(0)
  })
})
