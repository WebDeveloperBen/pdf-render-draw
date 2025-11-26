import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { mount } from "@vue/test-utils"

// Helper to test composables within Vue setup context
function withSetup<T>(composable: () => T): T {
  let result: T
  const app = defineComponent({
    setup() {
      result = composable()
      return () => h("div")
    }
  })
  mount(app)
  return result!
}

describe("Tool Error Handling", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe("SVG Coordinate Conversion Errors", () => {
    it("should handle getSvgPoint with null currentTarget", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))

      const invalidEvent = {
        currentTarget: null,
        clientX: 100,
        clientY: 200
      } as unknown as MouseEvent

      // This will throw because currentTarget is null
      expect(() => base.getSvgPoint(invalidEvent)).toThrow()
    })

    it("should handle getSvgPoint with non-SVG element", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))

      const invalidEvent = {
        currentTarget: document.createElement("div"),
        clientX: 100,
        clientY: 200
      } as unknown as MouseEvent

      // This will throw because currentTarget is not an SVGSVGElement
      expect(() => base.getSvgPoint(invalidEvent)).toThrow()
    })

    it("should handle getScreenCTM returning null", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))

      const mockSvg = {
        createSVGPoint: () => ({ x: 0, y: 0 }),
        getScreenCTM: () => null
      } as unknown as SVGSVGElement

      const invalidEvent = {
        currentTarget: mockSvg,
        clientX: 100,
        clientY: 200
      } as unknown as MouseEvent

      // This will throw because getScreenCTM returns null and we call .inverse() on it
      expect(() => base.getSvgPoint(invalidEvent)).toThrow()
    })

    it("should handle createSVGPoint not available", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))

      const mockSvg = {
        getScreenCTM: () => ({ inverse: () => ({}) })
      } as unknown as SVGSVGElement

      const invalidEvent = {
        currentTarget: mockSvg,
        clientX: 100,
        clientY: 200
      } as unknown as MouseEvent

      // This will throw because createSVGPoint is not a function
      expect(() => base.getSvgPoint(invalidEvent)).toThrow()
    })

    it("should handle matrixTransform throwing error", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))

      const mockSvg = {
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform: () => {
            throw new Error("Matrix transform failed")
          }
        }),
        getScreenCTM: () => ({ inverse: () => ({}) })
      } as unknown as SVGSVGElement

      const invalidEvent = {
        currentTarget: mockSvg,
        clientX: 100,
        clientY: 200
      } as unknown as MouseEvent

      expect(() => base.getSvgPoint(invalidEvent)).toThrow("Matrix transform failed")
    })
  })

  describe("Invalid Mouse Coordinates", () => {
    function createMockSvg() {
      return {
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform: vi.fn(() => ({ x: 100, y: 200 }))
        }),
        getScreenCTM: () => ({ inverse: () => ({}) })
      } as unknown as SVGSVGElement
    }

    it("should handle mouse event with NaN clientX/clientY", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))

      const mockSvg = createMockSvg()
      const invalidEvent = {
        currentTarget: mockSvg,
        clientX: NaN,
        clientY: NaN
      } as unknown as MouseEvent

      // The function will run but produce invalid coordinates
      const result = base.getSvgPoint(invalidEvent)

      // The SVG point will have NaN values passed to it
      expect(result).toBeDefined()
      // Note: The current implementation doesn't validate coordinates
    })

    it("should handle mouse event with Infinity coordinates", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))

      const mockSvg = createMockSvg()
      const invalidEvent = {
        currentTarget: mockSvg,
        clientX: Infinity,
        clientY: -Infinity
      } as unknown as MouseEvent

      const result = base.getSvgPoint(invalidEvent)
      expect(result).toBeDefined()
      // Note: No validation exists for Infinity values
    })

    it("should handle mouse event with negative coordinates", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))

      const mockSvg = {
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform: () => ({ x: -100, y: -200 })
        }),
        getScreenCTM: () => ({ inverse: () => ({}) })
      } as unknown as SVGSVGElement

      const validEvent = {
        currentTarget: mockSvg,
        clientX: -50,
        clientY: -100
      } as unknown as MouseEvent

      const result = base.getSvgPoint(validEvent)
      expect(result).toEqual({ x: -100, y: -200 })
      // Negative coordinates are valid (e.g., panning)
    })

    it("should handle mouse event with no coordinate properties", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))

      const mockSvg = createMockSvg()
      const invalidEvent = {
        currentTarget: mockSvg
      } as unknown as MouseEvent

      // This will pass undefined to the SVG point
      const result = base.getSvgPoint(invalidEvent)
      expect(result).toBeDefined()
      // Note: No validation for missing properties
    })
  })

  describe("Drawing Outside Bounds", () => {
    function createMockMouseEvent(x: number, y: number): MouseEvent {
      const mockSvg = {
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform: () => ({ x, y })
        }),
        getScreenCTM: () => ({ inverse: () => ({}) })
      } as unknown as SVGSVGElement

      return {
        currentTarget: mockSvg,
        clientX: x,
        clientY: y,
        shiftKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      } as unknown as MouseEvent
    }

    it("should handle click at coordinates beyond canvas size (very large values)", () => {
      const annotationStore = useAnnotationStore()
      const tool = withSetup(() =>
        useDrawingTool<Measurement>({
          type: "measure",
          minPoints: 2,
          canClose: false,
          calculate: ((points: Point[]) => ({
            points,
            distance: 0,
            midpoint: { x: 0, y: 0 },
            labelRotation: 0
          })) as any,
          onCreate: () => {}
        })
      )

      const hugeEvent = createMockMouseEvent(999999999, 999999999)
      tool.handleClick(hugeEvent)

      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value[0]).toEqual({ x: 999999999, y: 999999999 })
      // Note: No bounds checking exists
    })

    it("should handle click at negative coordinates", () => {
      const annotationStore = useAnnotationStore()
      const tool = withSetup(() =>
        useDrawingTool<Measurement>({
          type: "measure",
          minPoints: 2,
          canClose: false,
          calculate: ((points: Point[]) => ({
            points,
            distance: 0,
            midpoint: { x: 0, y: 0 },
            labelRotation: 0
          })) as any,
          onCreate: () => {}
        })
      )

      const negativeEvent = createMockMouseEvent(-1000, -2000)
      tool.handleClick(negativeEvent)

      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value[0]).toEqual({ x: -1000, y: -2000 })
      // Negative coordinates are allowed
    })

    it("should handle drawing line from (0,0) to (Infinity, Infinity)", () => {
      const annotationStore = useAnnotationStore()
      const tool = withSetup(() =>
        useDrawingTool<Measurement>({
          type: "measure",
          minPoints: 2,
          canClose: false,
          calculate: ((points: Point[]) => ({
            points,
            distance: 0,
            midpoint: { x: 0, y: 0 },
            labelRotation: 0
          })) as any,
          onCreate: () => {}
        })
      )

      const event1 = createMockMouseEvent(0, 0)
      const event2 = createMockMouseEvent(Infinity, Infinity)

      tool.handleClick(event1)
      tool.handleClick(event2)

      expect(annotationStore.annotations).toHaveLength(1)
      expect(annotationStore.annotations[0]).toMatchObject({
        type: "measure",
        points: [
          { x: 0, y: 0 },
          { x: Infinity, y: Infinity }
        ]
      })
      // Note: Infinity values are not validated
    })
  })

  describe("Snap to 45° Edge Cases", () => {
    it("should handle snap with only one point placed (no previous point)", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))

      // Try to snap when no start point exists
      const start: Point = { x: 100, y: 100 }
      const end: Point = { x: 150, y: 130 }

      const snapped = base.snapTo45Degrees(start, end)

      // Should still produce a result
      expect(snapped).toBeDefined()
      expect(snapped.x).toBeDefined()
      expect(snapped.y).toBeDefined()
      expect(isFinite(snapped.x)).toBe(true)
      expect(isFinite(snapped.y)).toBe(true)
    })

    it("should handle snap with NaN start point", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))

      const start: Point = { x: NaN, y: NaN }
      const end: Point = { x: 150, y: 130 }

      const snapped = base.snapTo45Degrees(start, end)

      // Will produce NaN results
      expect(snapped).toBeDefined()
      expect(isNaN(snapped.x)).toBe(true)
      expect(isNaN(snapped.y)).toBe(true)
      // Note: No NaN validation in snapTo45Degrees
    })

    it("should handle snap with same start and end point", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))

      const start: Point = { x: 100, y: 100 }
      const end: Point = { x: 100, y: 100 }

      const snapped = base.snapTo45Degrees(start, end)

      // Distance is 0, angle is undefined/0
      expect(snapped).toBeDefined()
      expect(snapped.x).toBeCloseTo(100, 5)
      expect(snapped.y).toBeCloseTo(100, 5)
      // Same point returns same point
    })

    it("should handle snap with Infinity end point", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))

      const start: Point = { x: 0, y: 0 }
      const end: Point = { x: Infinity, y: Infinity }

      const snapped = base.snapTo45Degrees(start, end)

      // Will produce Infinity results
      expect(snapped).toBeDefined()
      expect(snapped.x).toBe(Infinity)
      expect(snapped.y).toBe(Infinity)
      // Note: No Infinity validation
    })
  })

  describe("Calculation Errors", () => {
    it("should handle calculateDistance with NaN coordinates", () => {
      const p1: Point = { x: NaN, y: NaN }
      const p2: Point = { x: 100, y: 100 }

      const distance = calculateDistance(p1, p2)

      expect(isNaN(distance)).toBe(true)
      // Note: No NaN validation in calculations
    })

    it("should handle calculateDistance with Infinity coordinates", () => {
      const p1: Point = { x: 0, y: 0 }
      const p2: Point = { x: Infinity, y: Infinity }

      const distance = calculateDistance(p1, p2)

      expect(distance).toBe(Infinity)
      // Math.sqrt(Infinity) = Infinity
    })

    it("should handle calculatePolygonArea with less than 3 points", () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ]

      const area = calculatePolygonArea(points)

      // Should return 0 (tested in calculations.spec.ts)
      expect(area).toBe(0)
    })

    it("should handle calculatePolygonArea with duplicate points", () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ]

      const area = calculatePolygonArea(points)

      // Should return 0 (no area)
      expect(area).toBe(0)
    })

    it("should handle calculatePolygonArea with NaN coordinates", () => {
      const points: Point[] = [
        { x: NaN, y: NaN },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
      ]

      const area = calculatePolygonArea(points)

      expect(isNaN(area)).toBe(true)
      // Note: No NaN validation
    })

    it("should handle calculateCentroid with empty points array", () => {
      const points: Point[] = []

      // This will cause division by zero
      const centroid = calculateCentroid(points)

      expect(isNaN(centroid.x)).toBe(true)
      expect(isNaN(centroid.y)).toBe(true)
      // Note: No empty array validation
    })

    it("should handle calculateCentroid with NaN points", () => {
      const points: Point[] = [
        { x: NaN, y: NaN },
        { x: 100, y: 100 }
      ]

      const centroid = calculateCentroid(points)

      expect(isNaN(centroid.x)).toBe(true)
      expect(isNaN(centroid.y)).toBe(true)
    })
  })

  describe("Tool State Errors", () => {
    function createMockMouseEvent(x: number, y: number): MouseEvent {
      const mockSvg = {
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform: () => ({ x, y })
        }),
        getScreenCTM: () => ({ inverse: () => ({}) })
      } as unknown as SVGSVGElement

      return {
        currentTarget: mockSvg,
        clientX: x,
        clientY: y,
        shiftKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      } as unknown as MouseEvent
    }

    it("should handle complete drawing with no points", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))
      const annotationStore = useAnnotationStore()

      // Try to complete without any points
      annotationStore.isDrawing = true
      const points = base.complete()

      expect(points).toEqual([])
      expect(annotationStore.isDrawing).toBe(false)
      // Returns empty array, doesn't throw
    })

    it("should handle complete drawing with insufficient points", () => {
      const annotationStore = useAnnotationStore()
      let onCreateCalled = false

      const tool = withSetup(() =>
        useDrawingTool<Measurement>({
          type: "measure",
          minPoints: 2,
          canClose: false,
          calculate: ((points: Point[]) => ({
            points,
            distance: 0,
            midpoint: { x: 0, y: 0 },
            labelRotation: 0
          })) as any,
          onCreate: () => {
            onCreateCalled = true
          }
        })
      )

      // Place only 1 point (need 2)
      const event1 = createMockMouseEvent(100, 100)
      tool.handleClick(event1)

      expect(tool.points.value).toHaveLength(1)

      // Try to manually trigger completion
      // The tool should prevent this via hasMinimumPoints check
      expect(annotationStore.annotations).toHaveLength(0)
      expect(onCreateCalled).toBe(false)
    })

    it("should handle cancel drawing when not drawing", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 2 }))
      const annotationStore = useAnnotationStore()

      // Reset when not drawing
      expect(annotationStore.isDrawing).toBe(false)

      base.reset()

      // Should not throw, just reset state
      expect(annotationStore.isDrawing).toBe(false)
      expect(base.points.value).toEqual([])
    })

    it("should handle click when isDrawing flag is corrupted", () => {
      const annotationStore = useAnnotationStore()
      const tool = withSetup(() =>
        useDrawingTool<Measurement>({
          type: "measure",
          minPoints: 2,
          canClose: false,
          calculate: ((points: Point[]) => ({
            points,
            distance: 0,
            midpoint: { x: 0, y: 0 },
            labelRotation: 0
          })) as any,
          onCreate: () => {}
        })
      )

      // Manually corrupt state
      annotationStore.isDrawing = true

      // Click should add point even though we didn't "start" properly
      const event = createMockMouseEvent(100, 100)
      tool.handleClick(event)

      // Should add point, not start new drawing
      expect(tool.points.value.length).toBeGreaterThanOrEqual(1)
    })

    it("should handle array mutation during drawing", () => {
      const base = withSetup(() => useBaseTool({ type: "test", minPoints: 3 }))
      const annotationStore = useAnnotationStore()

      // Start drawing
      annotationStore.isDrawing = true
      base.points.value = [{ x: 0, y: 0 }]

      // Manually corrupt the points array
      const corruptedPoint = { x: NaN, y: undefined as unknown as number }
      base.points.value.push(corruptedPoint)

      // System should still function
      expect(base.points.value).toHaveLength(2)
      expect(base.points.value[1]).toEqual(corruptedPoint)
      // Note: No validation on point structure
    })

    it("should handle missing pageNum when creating annotation", () => {
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      // Try to set invalid page number - this should be rejected by validation
      rendererStore.setCurrentPage(NaN as unknown as number)

      const tool = withSetup(() =>
        useDrawingTool<Measurement>({
          type: "measure",
          minPoints: 2,
          canClose: false,
          calculate: ((points: Point[]) => ({
            points,
            distance: 0,
            midpoint: { x: 0, y: 0 },
            labelRotation: 0
          })) as any,
          onCreate: () => {}
        })
      )

      const event1 = createMockMouseEvent(0, 0)
      const event2 = createMockMouseEvent(100, 100)

      tool.handleClick(event1)
      tool.handleClick(event2)

      // Annotation created with default page (1) because NaN was rejected
      expect(annotationStore.annotations).toHaveLength(1)
      expect(annotationStore.annotations[0]!.pageNum).toBe(1)
      // Note: Renderer store HAS page validation
    })

    it("should handle calculate function throwing error", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const tool = withSetup(() =>
        useDrawingTool<Measurement>({
          type: "measure",
          minPoints: 2,
          canClose: false,
          calculate: () => {
            throw new Error("Calculation failed")
          },
          onCreate: () => {}
        })
      )

      const event1 = createMockMouseEvent(0, 0)
      const event2 = createMockMouseEvent(100, 100)

      tool.handleClick(event1)

      // Second click will trigger calculate, which throws
      expect(() => tool.handleClick(event2)).toThrow("Calculation failed")

      consoleErrorSpy.mockRestore()
    })

    it("should handle onCreate callback throwing error", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const tool = withSetup(() =>
        useDrawingTool<Measurement>({
          type: "measure",
          minPoints: 2,
          canClose: false,
          calculate: ((points: Point[]) => ({
            points,
            distance: 0,
            midpoint: { x: 0, y: 0 },
            labelRotation: 0
          })) as any,
          onCreate: () => {
            throw new Error("onCreate failed")
          }
        })
      )

      const event1 = createMockMouseEvent(0, 0)
      const event2 = createMockMouseEvent(100, 100)

      tool.handleClick(event1)

      // Second click will trigger onCreate, which throws
      expect(() => tool.handleClick(event2)).toThrow("onCreate failed")

      consoleErrorSpy.mockRestore()
    })
  })

  describe("Edge Cases with canSnapToClose", () => {
    it("should handle canSnapToClose with null tempEndPoint", () => {
      const base = withSetup(() =>
        useBaseTool({
          type: "polygon",
          minPoints: 3,
          canClose: true,
          snapDistance: 25
        })
      )

      // Set up points but no tempEndPoint
      base.points.value = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
      ]
      base.tempEndPoint.value = null

      // Should return false
      expect(base.canSnapToClose.value).toBe(false)
    })

    it("should handle canSnapToClose with NaN firstPoint", () => {
      const base = withSetup(() =>
        useBaseTool({
          type: "polygon",
          minPoints: 3,
          canClose: true,
          snapDistance: 25
        })
      )

      base.points.value = [
        { x: NaN, y: NaN },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
      ]
      base.tempEndPoint.value = { x: 5, y: 5 }

      // Distance calculation will be NaN
      const result = base.canSnapToClose.value

      expect(result).toBe(false)
      // NaN < number is always false
    })

    it("should handle canSnapToClose with Infinity snapDistance", () => {
      const settingsStore = useSettingStore()
      // toolSnapDistance is a computed property (readonly), so update the underlying ref
      settingsStore.updateGeneralSettings({ toolSnapDistance: Infinity })

      const base = withSetup(() =>
        useBaseTool({
          type: "polygon",
          minPoints: 3,
          canClose: true
        })
      )

      base.points.value = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
      ]
      base.tempEndPoint.value = { x: 9999, y: 9999 }

      // Any distance < Infinity
      expect(base.canSnapToClose.value).toBe(true)
    })
  })
})
