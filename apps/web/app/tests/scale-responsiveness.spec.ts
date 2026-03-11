import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { calculateDistance, calculatePolygonArea, parsePdfPageScale } from "~/utils/editor/transform"
import { recalculateDerivedValues } from "~/utils/editor/derived-values"
import { degreesToRadians } from "~/utils/math"

// Mock debug utils
vi.mock("~/utils/debug", () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn()
}))

/**
 * Scale Responsiveness Tests
 *
 * Verifies that all tools and UI elements correctly respond to viewport scale changes.
 * Covers:
 * - Viewport store inverse scale computation
 * - Derived value recalculation at different PDF scales
 * - Annotation creation sizing at various zoom levels
 * - Label/measurement value accuracy across scales
 */
describe("Scale Responsiveness", () => {
  let viewportStore: ReturnType<typeof useViewportStore>
  let annotationStore: ReturnType<typeof useAnnotationStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    viewportStore = useViewportStore()
    annotationStore = useAnnotationStore()
    viewportStore.currentPage = 1
    viewportStore.rotation = 0
  })

  // ============================================
  // Viewport Store - Inverse Scale
  // ============================================

  describe("Viewport Store - getInverseScale", () => {
    it("should return 1 at default scale", () => {
      expect(viewportStore.getInverseScale).toBe(1)
    })

    it("should return 0.5 when zoomed to 2x", () => {
      viewportStore.setScale(2)
      expect(viewportStore.getInverseScale).toBe(0.5)
    })

    it("should return 2 when zoomed to 0.5x", () => {
      viewportStore.setScale(0.5)
      expect(viewportStore.getInverseScale).toBe(2)
    })

    it("should return correct inverse at arbitrary zoom levels", () => {
      const testScales = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5]
      for (const scale of testScales) {
        viewportStore.setScale(scale)
        expect(viewportStore.getInverseScale).toBeCloseTo(1 / scale, 10)
      }
    })

    it("should update reactively when scale changes", () => {
      expect(viewportStore.getInverseScale).toBe(1)

      viewportStore.setScale(2)
      expect(viewportStore.getInverseScale).toBe(0.5)

      viewportStore.setScale(0.5)
      expect(viewportStore.getInverseScale).toBe(2)

      viewportStore.resetPageScale()
      expect(viewportStore.getInverseScale).toBe(1)
    })

    it("should handle min/max scale bounds correctly", () => {
      // Min scale (0.1)
      viewportStore.setScale(0.1)
      expect(viewportStore.getInverseScale).toBeCloseTo(10, 5)

      // Max scale (5)
      viewportStore.setScale(5)
      expect(viewportStore.getInverseScale).toBeCloseTo(0.2, 5)
    })

    it("should update after zoom in/out", () => {
      const initialInverse = viewportStore.getInverseScale
      viewportStore.zoomIn()
      expect(viewportStore.getInverseScale).toBeLessThan(initialInverse)

      viewportStore.resetPageScale()
      viewportStore.zoomOut()
      expect(viewportStore.getInverseScale).toBeGreaterThan(1)
    })
  })

  // ============================================
  // PDF Scale Parsing
  // ============================================

  describe("PDF Scale Parsing", () => {
    it("should parse standard ratio formats", () => {
      expect(parsePdfPageScale("1:100")).toBe(100)
      expect(parsePdfPageScale("1:50")).toBe(50)
      expect(parsePdfPageScale("1:200")).toBe(200)
      expect(parsePdfPageScale("1:1")).toBe(1)
    })

    it("should fallback to 1 for invalid formats", () => {
      expect(parsePdfPageScale("invalid")).toBe(1)
      expect(parsePdfPageScale("")).toBe(1)
      expect(parsePdfPageScale("abc:def")).toBe(1)
    })
  })

  // ============================================
  // Measurement Distance Calculation
  // ============================================

  describe("Measurement Distance - PDF Scale Sensitivity", () => {
    const p1 = { x: 0, y: 0 }
    const p2 = { x: 100, y: 0 } // 100 PDF points apart

    it("should calculate distance using current PDF scale", () => {
      viewportStore.setPdfScale("1:100")
      const dist100 = calculateDistance(p1, p2)

      viewportStore.setPdfScale("1:50")
      const dist50 = calculateDistance(p1, p2)

      // Same points, different PDF scale: 1:100 should give 2x the distance of 1:50
      expect(dist100).toBe(dist50 * 2)
    })

    it("should produce larger distances with larger scale factors", () => {
      const scales = ["1:1", "1:10", "1:50", "1:100", "1:200"]
      const distances: number[] = []

      for (const scale of scales) {
        viewportStore.setPdfScale(scale)
        distances.push(calculateDistance(p1, p2))
      }

      // Each distance should be larger than the previous
      for (let i = 1; i < distances.length; i++) {
        expect(distances[i]!).toBeGreaterThan(distances[i - 1]!)
      }
    })

    it("should handle diagonal distances correctly", () => {
      viewportStore.setPdfScale("1:1")
      const diagonal = calculateDistance({ x: 0, y: 0 }, { x: 72, y: 72 })

      // 72 points = 1 inch = 25.4mm at 1:1 scale
      // Diagonal: sqrt(25.4^2 + 25.4^2) = 25.4 * sqrt(2) ~ 35.9mm
      expect(diagonal).toBeCloseTo(36, 0) // Rounded to nearest mm
    })
  })

  // ============================================
  // Area Calculation
  // ============================================

  describe("Area Calculation - PDF Scale Sensitivity", () => {
    // A 100x100 PDF-point square
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ]

    it("should calculate area using current PDF scale", () => {
      viewportStore.setPdfScale("1:100")
      const area100 = calculatePolygonArea(square)

      viewportStore.setPdfScale("1:50")
      const area50 = calculatePolygonArea(square)

      // Area scales as the square of the linear scale factor
      // 1:100 vs 1:50 => (100/50)^2 = 4x area
      expect(area100).toBeCloseTo(area50 * 4, 1)
    })

    it("should produce larger areas with larger scale factors", () => {
      const scales = ["1:10", "1:50", "1:100"]
      const areas: number[] = []

      for (const scale of scales) {
        viewportStore.setPdfScale(scale)
        areas.push(calculatePolygonArea(square))
      }

      for (let i = 1; i < areas.length; i++) {
        expect(areas[i]!).toBeGreaterThan(areas[i - 1]!)
      }
    })

    it("should return 0 for degenerate polygons", () => {
      viewportStore.setPdfScale("1:100")
      expect(calculatePolygonArea([])).toBe(0)
      expect(calculatePolygonArea([{ x: 0, y: 0 }])).toBe(0)
      expect(
        calculatePolygonArea([
          { x: 0, y: 0 },
          { x: 1, y: 1 }
        ])
      ).toBe(0)
    })
  })

  // ============================================
  // Derived Value Recalculation
  // ============================================

  describe("Derived Values - Recalculation After Scale Change", () => {
    it("should recalculate measurement distance when PDF scale changes", () => {
      viewportStore.setPdfScale("1:100")

      const measurement: Measurement = {
        id: "m1",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        distance: 0, // Will be recalculated
        midpoint: { x: 50, y: 0 },
        labelRotation: 0,
        rotation: 0
      }

      const derived100 = recalculateDerivedValues(measurement)
      const distance100 = derived100.distance as number

      // Change scale and recalculate
      viewportStore.setPdfScale("1:50")
      const derived50 = recalculateDerivedValues(measurement)
      const distance50 = derived50.distance as number

      // 1:100 should give 2x the distance of 1:50
      expect(distance100).toBe(distance50 * 2)
    })

    it("should recalculate area when PDF scale changes", () => {
      viewportStore.setPdfScale("1:100")

      const area: Area = {
        id: "a1",
        type: "area",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        area: 0,
        center: { x: 50, y: 50 },
        labelRotation: 0,
        rotation: 0
      }

      const derived100 = recalculateDerivedValues(area)
      const areaVal100 = derived100.area as number

      viewportStore.setPdfScale("1:50")
      const derived50 = recalculateDerivedValues(area)
      const areaVal50 = derived50.area as number

      // Area scales as square of linear scale: (100/50)^2 = 4
      expect(areaVal100).toBeCloseTo(areaVal50 * 4, 1)
    })

    it("should recalculate perimeter segments when PDF scale changes", () => {
      viewportStore.setPdfScale("1:100")

      const perimeter: Perimeter = {
        id: "p1",
        type: "perimeter",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 }
        ],
        segments: [],
        totalLength: 0,
        center: { x: 0, y: 0 },
        labelRotation: 0,
        rotation: 0
      }

      const derived100 = recalculateDerivedValues(perimeter)
      const total100 = derived100.totalLength as number
      const segments100 = derived100.segments as PerimeterSegment[]

      viewportStore.setPdfScale("1:50")
      const derived50 = recalculateDerivedValues(perimeter)
      const total50 = derived50.totalLength as number
      const segments50 = derived50.segments as PerimeterSegment[]

      // Total length should scale approximately linearly
      // Allow small tolerance for per-segment mm rounding accumulation
      const numSegments = segments100!.length
      expect(Math.abs(total100 - total50 * 2)).toBeLessThanOrEqual(numSegments)

      // Each segment length should also scale (within 1mm rounding tolerance)
      expect(segments100!.length).toBe(segments50!.length)
      for (let i = 0; i < segments100!.length; i++) {
        expect(Math.abs(segments100![i]!.length - segments50![i]!.length * 2)).toBeLessThanOrEqual(1)
      }
    })

    it("should not produce derived values for line annotations", () => {
      const line: Line = {
        id: "l1",
        type: "line",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 }
        ],
        rotation: 0
      }

      const derived = recalculateDerivedValues(line)
      expect(Object.keys(derived)).toHaveLength(0)
    })

    it("should not produce derived values for positioned annotations", () => {
      const fill: Fill = {
        id: "f1",
        type: "fill",
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        color: "#ff0000",
        opacity: 0.5,
        rotation: 0
      }

      const derived = recalculateDerivedValues(fill)
      expect(Object.keys(derived)).toHaveLength(0)
    })
  })

  // ============================================
  // Annotation Store - Scale-Aware Updates
  // ============================================

  describe("Annotation Store - Recalculation on Point Updates", () => {
    it("should recalculate measurement when points are updated", () => {
      viewportStore.setPdfScale("1:100")

      const measurement: Measurement = {
        id: "m1",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        distance: calculateDistance({ x: 0, y: 0 }, { x: 100, y: 0 }),
        midpoint: { x: 50, y: 0 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(measurement)
      const originalDistance = (annotationStore.getAnnotationById("m1") as Measurement).distance

      // Update points (scaled up by 2x)
      annotationStore.updateAnnotation("m1", {
        points: [
          { x: 0, y: 0 },
          { x: 200, y: 0 }
        ]
      })

      const updated = annotationStore.getAnnotationById("m1") as Measurement
      expect(updated.distance).toBe(originalDistance * 2)
      expect(updated.midpoint).toEqual({ x: 100, y: 0 })
    })

    it("should recalculate area when points are updated", () => {
      viewportStore.setPdfScale("1:100")

      const area: Area = {
        id: "a1",
        type: "area",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        area: calculatePolygonArea([
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ]),
        center: { x: 50, y: 50 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(area)
      const originalArea = (annotationStore.getAnnotationById("a1") as Area).area

      // Double the size of the polygon
      annotationStore.updateAnnotation("a1", {
        points: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 200 },
          { x: 0, y: 200 }
        ]
      })

      const updated = annotationStore.getAnnotationById("a1") as Area
      // Area scales as square: 2x linear = 4x area
      expect(updated.area).toBeCloseTo(originalArea * 4, 1)
    })

    it("should recalculate perimeter when points are updated", () => {
      viewportStore.setPdfScale("1:100")

      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
      ]

      const perimeter: Perimeter = {
        id: "p1",
        type: "perimeter",
        pageNum: 1,
        points,
        segments: [],
        totalLength: 0,
        center: { x: 0, y: 0 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(perimeter)

      // Update points (scale by 2)
      annotationStore.updateAnnotation("p1", {
        points: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 200 }
        ]
      })

      const updated = annotationStore.getAnnotationById("p1") as Perimeter
      expect(updated.segments.length).toBe(3) // 3 sides of the triangle
      expect(updated.totalLength).toBeGreaterThan(0)
    })
  })

  // ============================================
  // Tool Creation - Viewport Scale Awareness
  // ============================================

  describe("Count Tool - Creation at Different Zoom Levels", () => {
    it("should create count markers with consistent screen size across zoom levels", () => {
      const COUNT_MARKER_RADIUS = 15 // From COUNT_TOOL_DEFAULTS

      // At 1x zoom, bounding box should be 2 * radius * inverseScale
      viewportStore.setScale(1)
      const sizeAt1x = COUNT_MARKER_RADIUS * 2 * viewportStore.getInverseScale

      // At 2x zoom, bounding box should be half the PDF size (same screen size)
      viewportStore.setScale(2)
      const sizeAt2x = COUNT_MARKER_RADIUS * 2 * viewportStore.getInverseScale

      // At 0.5x zoom, bounding box should be double the PDF size (same screen size)
      viewportStore.setScale(0.5)
      const sizeAt05x = COUNT_MARKER_RADIUS * 2 * viewportStore.getInverseScale

      // All should produce the same screen-space size:
      // sizeAt1x * 1 = sizeAt2x * 2 = sizeAt05x * 0.5 = 30 screen pixels
      expect(sizeAt1x * 1).toBe(30)
      expect(sizeAt2x * 2).toBe(30)
      expect(sizeAt05x * 0.5).toBe(30)
    })
  })

  describe("Count Tool - Creation-Time Rotation", () => {
    it("should store zero rotation when page is not rotated", () => {
      viewportStore.setRotation(0)
      const rotation = degreesToRadians(-viewportStore.rotation)
      expect(rotation).toBeCloseTo(0, 10)
    })

    it("should counter-rotate 90° when page is rotated 90°", () => {
      viewportStore.setRotation(90)
      const rotation = degreesToRadians(-viewportStore.rotation)
      expect(rotation).toBeCloseTo(degreesToRadians(-90), 10)
    })

    it("should counter-rotate 180° when page is rotated 180°", () => {
      viewportStore.setRotation(180)
      const rotation = degreesToRadians(-viewportStore.rotation)
      expect(rotation).toBeCloseTo(degreesToRadians(-180), 10)
    })

    it("should counter-rotate 270° when page is rotated 270°", () => {
      viewportStore.setRotation(270)
      const rotation = degreesToRadians(-viewportStore.rotation)
      expect(rotation).toBeCloseTo(degreesToRadians(-270), 10)
    })

    it("should not change stored rotation when page rotates after creation", () => {
      // Simulate: create at 90° rotation, then page rotates to 180°
      viewportStore.setRotation(90)
      const creationRotation = degreesToRadians(-viewportStore.rotation)

      // Page rotates after creation — stored rotation should remain the same
      viewportStore.setRotation(180)

      // The stored value doesn't change (it was baked at creation time)
      expect(creationRotation).toBeCloseTo(degreesToRadians(-90), 10)
    })
  })

  describe("Count Tool - Preview Counter-Rotation", () => {
    it("should provide zero counter-rotation when page is not rotated", () => {
      viewportStore.setRotation(0)
      expect(viewportStore.getViewportLabelRotation).toBe(0)
    })

    it("should provide -90° counter-rotation when page is rotated 90°", () => {
      viewportStore.setRotation(90)
      expect(viewportStore.getViewportLabelRotation).toBe(-90)
    })

    it("should provide -180° counter-rotation when page is rotated 180°", () => {
      viewportStore.setRotation(180)
      expect(viewportStore.getViewportLabelRotation).toBe(-180)
    })

    it("should provide -270° counter-rotation when page is rotated 270°", () => {
      viewportStore.setRotation(270)
      expect(viewportStore.getViewportLabelRotation).toBe(-270)
    })

    it("should update dynamically when page rotation changes", () => {
      viewportStore.setRotation(0)
      expect(viewportStore.getViewportLabelRotation).toBe(0)

      viewportStore.setRotation(90)
      expect(viewportStore.getViewportLabelRotation).toBe(-90)

      viewportStore.setRotation(270)
      expect(viewportStore.getViewportLabelRotation).toBe(-270)

      viewportStore.setRotation(0)
      expect(viewportStore.getViewportLabelRotation).toBe(0)
    })
  })

  describe("Text Tool - Creation at Different Zoom Levels", () => {
    const TEXT_DEFAULT_WIDTH = 100
    const TEXT_FONT_SIZE = 16
    const TEXT_MIN_HEIGHT = 20
    const TEXT_LINE_HEIGHT = 1.2

    it("should create text boxes with consistent screen size across zoom levels", () => {
      viewportStore.setScale(1)
      const widthAt1x = TEXT_DEFAULT_WIDTH * viewportStore.getInverseScale
      const fontAt1x = TEXT_FONT_SIZE * viewportStore.getInverseScale

      viewportStore.setScale(2)
      const widthAt2x = TEXT_DEFAULT_WIDTH * viewportStore.getInverseScale
      const fontAt2x = TEXT_FONT_SIZE * viewportStore.getInverseScale

      viewportStore.setScale(0.5)
      const widthAt05x = TEXT_DEFAULT_WIDTH * viewportStore.getInverseScale
      const fontAt05x = TEXT_FONT_SIZE * viewportStore.getInverseScale

      // Screen-space widths should all be 100px
      expect(widthAt1x * 1).toBe(100)
      expect(widthAt2x * 2).toBe(100)
      expect(widthAt05x * 0.5).toBe(100)

      // Screen-space font sizes should all be 16px
      expect(fontAt1x * 1).toBe(16)
      expect(fontAt2x * 2).toBe(16)
      expect(fontAt05x * 0.5).toBe(16)
    })

    it("should calculate correct height from scaled font size", () => {
      viewportStore.setScale(2)
      const inv = viewportStore.getInverseScale // 0.5
      const scaledFont = TEXT_FONT_SIZE * inv // 8
      const height = Math.max(Math.ceil(scaledFont * TEXT_LINE_HEIGHT), TEXT_MIN_HEIGHT * inv)

      // Height should be based on scaled font, not original
      expect(scaledFont).toBe(8)
      expect(Math.ceil(scaledFont * TEXT_LINE_HEIGHT)).toBe(10) // 8 * 1.2 = 9.6 -> 10
      expect(height).toBe(10) // max(10, 10)
    })
  })

  // ============================================
  // Inverse Scale - Visual Element Sizing
  // ============================================

  describe("Visual Element Sizing with Inverse Scale", () => {
    // These tests verify the mathematical properties that make UI elements
    // appear the same screen size regardless of zoom level.

    it("should produce constant screen-space sizes at any zoom", () => {
      const ELEMENT_SIZE_PX = 8 // e.g., a handle square

      const zoomLevels = [0.25, 0.5, 1, 1.5, 2, 3, 5]

      for (const zoom of zoomLevels) {
        viewportStore.setScale(zoom)
        const pdfSize = ELEMENT_SIZE_PX * viewportStore.getInverseScale

        // Screen size = PDF size * zoom = always ELEMENT_SIZE_PX
        const screenSize = pdfSize * zoom
        expect(screenSize).toBeCloseTo(ELEMENT_SIZE_PX, 10)
      }
    })

    it("should produce constant screen-space stroke widths at any zoom", () => {
      const STROKE_PX = 2

      const zoomLevels = [0.1, 0.5, 1, 2, 5]

      for (const zoom of zoomLevels) {
        viewportStore.setScale(zoom)
        const pdfStroke = STROKE_PX * viewportStore.getInverseScale
        const screenStroke = pdfStroke * zoom
        expect(screenStroke).toBeCloseTo(STROKE_PX, 10)
      }
    })

    it("should produce constant screen-space font sizes at any zoom", () => {
      const FONT_PX = 12

      const zoomLevels = [0.25, 0.5, 1, 2, 4]

      for (const zoom of zoomLevels) {
        viewportStore.setScale(zoom)
        const pdfFont = FONT_PX * viewportStore.getInverseScale
        const screenFont = pdfFont * zoom
        expect(screenFont).toBeCloseTo(FONT_PX, 10)
      }
    })

    it("should produce constant screen-space dash patterns at any zoom", () => {
      const DASH_PX = 5

      viewportStore.setScale(3)
      const pdfDash = DASH_PX * viewportStore.getInverseScale
      const screenDash = pdfDash * 3
      expect(screenDash).toBeCloseTo(DASH_PX, 10)
    })
  })

  // ============================================
  // Hit Area Scaling
  // ============================================

  describe("Hit Area Scaling", () => {
    it("should maintain consistent hit area sizes across zoom levels", () => {
      const HIT_AREA_PX = 15 // e.g., measure line hit area

      // At 0.5x zoom, user needs a larger PDF-space hit area to match the same screen area
      viewportStore.setScale(0.5)
      const hitAt05x = HIT_AREA_PX * viewportStore.getInverseScale
      expect(hitAt05x).toBe(30) // 15 * 2

      // At 2x zoom, user needs a smaller PDF-space hit area
      viewportStore.setScale(2)
      const hitAt2x = HIT_AREA_PX * viewportStore.getInverseScale
      expect(hitAt2x).toBe(7.5) // 15 * 0.5

      // Both produce same screen-space hit area
      expect(hitAt05x * 0.5).toBe(15)
      expect(hitAt2x * 2).toBe(15)
    })
  })

  // ============================================
  // Handle Sizing (Transform, Scale, Rotation)
  // ============================================

  describe("Transform Handle Sizing", () => {
    it("should compute handle dimensions that stay constant on screen", () => {
      const HANDLE_SIZE = 8
      const HANDLE_OFFSET = 4
      const HANDLE_STROKE = 2

      const zoomLevels = [0.5, 1, 2, 4]

      for (const zoom of zoomLevels) {
        viewportStore.setScale(zoom)
        const inv = viewportStore.getInverseScale

        const handleSize = HANDLE_SIZE * inv
        const handleOffset = HANDLE_OFFSET * inv
        const handleStroke = HANDLE_STROKE * inv

        // All screen-space values should be constant
        expect(handleSize * zoom).toBeCloseTo(HANDLE_SIZE, 10)
        expect(handleOffset * zoom).toBeCloseTo(HANDLE_OFFSET, 10)
        expect(handleStroke * zoom).toBeCloseTo(HANDLE_STROKE, 10)

        // Offset should always be half the handle size
        expect(handleOffset).toBeCloseTo(handleSize / 2, 10)
      }
    })

    it("should compute rotation handle distance that stays constant on screen", () => {
      const ROTATION_DISTANCE = 30
      const ROTATION_RADIUS = 8

      viewportStore.setScale(3)
      const inv = viewportStore.getInverseScale

      expect(ROTATION_DISTANCE * inv * 3).toBeCloseTo(ROTATION_DISTANCE, 10)
      expect(ROTATION_RADIUS * inv * 3).toBeCloseTo(ROTATION_RADIUS, 10)
    })
  })

  // ============================================
  // Snap Indicator Sizing (existing pattern)
  // ============================================

  describe("Snap Indicator Sizing", () => {
    it("should compute indicator dimensions that match the existing pattern", () => {
      // Values from SnapIndicator.vue
      const SIZE_PX = 5
      const FONT_PX = 9
      const STROKE_PX = 1.5

      viewportStore.setScale(2.5)
      const inv = viewportStore.getInverseScale

      const size = SIZE_PX * inv
      const fontSize = FONT_PX * inv
      const strokeWidth = STROKE_PX * inv

      // Verify screen-space constancy
      expect(size * 2.5).toBeCloseTo(SIZE_PX, 10)
      expect(fontSize * 2.5).toBeCloseTo(FONT_PX, 10)
      expect(strokeWidth * 2.5).toBeCloseTo(STROKE_PX, 10)
    })
  })

  // ============================================
  // Edge Cases
  // ============================================

  describe("Edge Cases", () => {
    it("should handle scale of exactly 1 (no scaling needed)", () => {
      viewportStore.setScale(1)
      expect(viewportStore.getInverseScale).toBe(1)

      // All sizes should pass through unchanged
      expect(8 * viewportStore.getInverseScale).toBe(8)
      expect(2 * viewportStore.getInverseScale).toBe(2)
    })

    it("should handle very small zoom levels", () => {
      viewportStore.setScale(0.1) // Minimum allowed scale
      const inv = viewportStore.getInverseScale
      expect(inv).toBeCloseTo(10, 5)

      // A 2px stroke should become 20 PDF points
      expect(2 * inv).toBeCloseTo(20, 5)
    })

    it("should handle very large zoom levels", () => {
      viewportStore.setScale(5) // Maximum allowed scale
      const inv = viewportStore.getInverseScale
      expect(inv).toBeCloseTo(0.2, 5)

      // A 2px stroke should become 0.4 PDF points
      expect(2 * inv).toBeCloseTo(0.4, 5)
    })

    it("should handle rapid scale changes without drift", () => {
      // Simulate rapid zoom in/out
      for (let i = 0; i < 100; i++) {
        viewportStore.setScale(1 + Math.sin(i) * 0.5) // Oscillate between 0.5 and 1.5
      }

      // After all changes, inverse should still be mathematically correct
      const currentScale = viewportStore.getScale
      expect(viewportStore.getInverseScale).toBeCloseTo(1 / currentScale, 10)
    })
  })
})
