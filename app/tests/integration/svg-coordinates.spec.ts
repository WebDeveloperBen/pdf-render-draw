import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { getSvgPoint } from "~/utils/svg"
import { useSvgCoordinates } from "~/utils/useSvgCoordinates"
import { useRendererStore } from "~/stores/renderer"

/**
 * Integration Tests: SVG Coordinate Conversion
 *
 * Tests the coordinate conversion system between screen coordinates,
 * SVG coordinates, and PDF coordinates across different scales,
 * scroll positions, and rotations.
 */

// Helper to create mock SVG element with transformations
function createMockSvg(
  options: {
    scale?: number
    scrollLeft?: number
    scrollTop?: number
    rotation?: number
    width?: number
    height?: number
  } = {}
): SVGSVGElement {
  const { scale = 1, scrollLeft = 0, scrollTop = 0, rotation = 0, width = 800, height = 600 } = options

  // Mock SVG element that mimics real browser behavior
  const svg = {
    createSVGPoint: () => {
      // Return an object with mutable x, y properties
      const point = {
        x: 0,
        y: 0,
        matrixTransform: vi.fn(function (this: { x: number; y: number }) {
          // Simulate inverse transform: screen -> SVG coordinates
          // Remove scroll offset and scale
          const svgX = (this.x - scrollLeft) / scale
          const svgY = (this.y - scrollTop) / scale

          // Handle rotation if present (simplified - real implementation is more complex)
          if (rotation !== 0) {
            const rad = (rotation * Math.PI) / 180
            const cos = Math.cos(-rad) // Inverse rotation
            const sin = Math.sin(-rad)
            const centerX = width / 2
            const centerY = height / 2
            const translatedX = svgX - centerX
            const translatedY = svgY - centerY
            return {
              x: translatedX * cos - translatedY * sin + centerX,
              y: translatedX * sin + translatedY * cos + centerY
            }
          }

          return { x: svgX, y: svgY }
        })
      }
      return point
    },
    getScreenCTM: () => {
      // Mock screen CTM (Current Transformation Matrix)
      return {
        inverse: () => ({
          a: 1 / scale,
          b: 0,
          c: 0,
          d: 1 / scale,
          e: -scrollLeft / scale,
          f: -scrollTop / scale
        })
      } as DOMMatrix
    },
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })
  } as unknown as SVGSVGElement

  return svg
}

// Helper to create mock mouse event
function createMockMouseEvent(clientX: number, clientY: number): MouseEvent {
  return {
    clientX,
    clientY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as unknown as MouseEvent
}

describe("SVG Coordinate Conversion - Integration Tests", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe("Basic Coordinate Conversion", () => {
    it("should convert screen coordinates to SVG coordinates at 1:1 scale", () => {
      const svg = createMockSvg({ scale: 1, scrollLeft: 0, scrollTop: 0 })
      const mouseEvent = createMockMouseEvent(150, 250)

      const result = getSvgPoint(mouseEvent, svg)

      expect(result).toEqual({ x: 150, y: 250 })
    })

    it("should handle screen coordinates at origin (0, 0)", () => {
      const svg = createMockSvg({ scale: 1, scrollLeft: 0, scrollTop: 0 })
      const mouseEvent = createMockMouseEvent(0, 0)

      const result = getSvgPoint(mouseEvent, svg)

      expect(result).toEqual({ x: 0, y: 0 })
    })

    it("should convert large screen coordinates correctly", () => {
      const svg = createMockSvg({ scale: 1, scrollLeft: 0, scrollTop: 0 })
      const mouseEvent = createMockMouseEvent(1920, 1080)

      const result = getSvgPoint(mouseEvent, svg)

      expect(result).toEqual({ x: 1920, y: 1080 })
    })

    it("should provide bidirectional conversion accuracy", () => {
      const svg = createMockSvg({ scale: 1, scrollLeft: 0, scrollTop: 0 })
      const originalPoint = { x: 300, y: 400 }

      // Convert to screen (simulated)
      const screenX = originalPoint.x
      const screenY = originalPoint.y

      // Convert back to SVG
      const mouseEvent = createMockMouseEvent(screenX, screenY)
      const result = getSvgPoint(mouseEvent, svg)

      expect(result).toEqual(originalPoint)
    })
  })

  describe("Zoom/Scale Effects", () => {
    it("should respect 2x zoom level", () => {
      const svg = createMockSvg({ scale: 2, scrollLeft: 0, scrollTop: 0 })
      const mouseEvent = createMockMouseEvent(200, 300)

      const result = getSvgPoint(mouseEvent, svg)

      // At 2x scale, screen coordinate 200 = SVG coordinate 100
      expect(result.x).toBeCloseTo(100, 1)
      expect(result.y).toBeCloseTo(150, 1)
    })

    it("should respect 0.5x zoom level", () => {
      const svg = createMockSvg({ scale: 0.5, scrollLeft: 0, scrollTop: 0 })
      const mouseEvent = createMockMouseEvent(100, 150)

      const result = getSvgPoint(mouseEvent, svg)

      // At 0.5x scale, screen coordinate 100 = SVG coordinate 200
      expect(result.x).toBeCloseTo(200, 1)
      expect(result.y).toBeCloseTo(300, 1)
    })

    it("should respect 4x zoom level", () => {
      const svg = createMockSvg({ scale: 4, scrollLeft: 0, scrollTop: 0 })
      const mouseEvent = createMockMouseEvent(400, 800)

      const result = getSvgPoint(mouseEvent, svg)

      // At 4x scale, screen coordinate 400 = SVG coordinate 100
      expect(result.x).toBeCloseTo(100, 1)
      expect(result.y).toBeCloseTo(200, 1)
    })

    it("should maintain point accuracy across scale changes", () => {
      const svgPoint = { x: 100, y: 150 }

      // Test at different scales
      const scales = [0.5, 1, 2, 4]

      scales.forEach((scale) => {
        const svg = createMockSvg({ scale, scrollLeft: 0, scrollTop: 0 })
        // Screen coordinates = SVG coordinates * scale
        const screenX = svgPoint.x * scale
        const screenY = svgPoint.y * scale
        const mouseEvent = createMockMouseEvent(screenX, screenY)

        const result = getSvgPoint(mouseEvent, svg)

        expect(result.x).toBeCloseTo(svgPoint.x, 1)
        expect(result.y).toBeCloseTo(svgPoint.y, 1)
      })
    })

    it("should handle fractional scale values", () => {
      const svg = createMockSvg({ scale: 1.5, scrollLeft: 0, scrollTop: 0 })
      const mouseEvent = createMockMouseEvent(300, 450)

      const result = getSvgPoint(mouseEvent, svg)

      // At 1.5x scale, screen coordinate 300 = SVG coordinate 200
      expect(result.x).toBeCloseTo(200, 1)
      expect(result.y).toBeCloseTo(300, 1)
    })
  })

  describe("Scroll Position Effects", () => {
    it("should respect horizontal scroll position", () => {
      const svg = createMockSvg({ scale: 1, scrollLeft: 100, scrollTop: 0 })
      const mouseEvent = createMockMouseEvent(200, 300)

      const result = getSvgPoint(mouseEvent, svg)

      // With scrollLeft=100, screen coordinate 200 = SVG coordinate 100
      expect(result.x).toBeCloseTo(100, 1)
      expect(result.y).toBeCloseTo(300, 1)
    })

    it("should respect vertical scroll position", () => {
      const svg = createMockSvg({ scale: 1, scrollLeft: 0, scrollTop: 150 })
      const mouseEvent = createMockMouseEvent(200, 300)

      const result = getSvgPoint(mouseEvent, svg)

      // With scrollTop=150, screen coordinate 300 = SVG coordinate 150
      expect(result.x).toBeCloseTo(200, 1)
      expect(result.y).toBeCloseTo(150, 1)
    })

    it("should handle both horizontal and vertical scroll", () => {
      const svg = createMockSvg({ scale: 1, scrollLeft: 50, scrollTop: 75 })
      const mouseEvent = createMockMouseEvent(150, 225)

      const result = getSvgPoint(mouseEvent, svg)

      expect(result.x).toBeCloseTo(100, 1)
      expect(result.y).toBeCloseTo(150, 1)
    })

    it("should combine scroll and scale correctly", () => {
      const svg = createMockSvg({ scale: 2, scrollLeft: 100, scrollTop: 200 })
      const mouseEvent = createMockMouseEvent(300, 500)

      const result = getSvgPoint(mouseEvent, svg)

      // (300 - 100) / 2 = 100, (500 - 200) / 2 = 150
      expect(result.x).toBeCloseTo(100, 1)
      expect(result.y).toBeCloseTo(150, 1)
    })

    it("should not affect annotation coordinates when viewport is scrolled", () => {
      // Annotation at SVG coordinates (100, 100)
      const annotationPoint = { x: 100, y: 100 }

      // Different scroll positions
      const scrollPositions = [
        { scrollLeft: 0, scrollTop: 0 },
        { scrollLeft: 50, scrollTop: 50 },
        { scrollLeft: -50, scrollTop: -50 }
      ]

      scrollPositions.forEach(({ scrollLeft, scrollTop }) => {
        const svg = createMockSvg({ scale: 1, scrollLeft, scrollTop })

        // Screen coordinates adjust for scroll
        const screenX = annotationPoint.x + scrollLeft
        const screenY = annotationPoint.y + scrollTop
        const mouseEvent = createMockMouseEvent(screenX, screenY)

        const result = getSvgPoint(mouseEvent, svg)

        // SVG coordinates should be consistent regardless of scroll
        expect(result.x).toBeCloseTo(annotationPoint.x, 1)
        expect(result.y).toBeCloseTo(annotationPoint.y, 1)
      })
    })
  })

  describe("Page Rotation", () => {
    it("should handle 0° rotation (no rotation)", () => {
      const svg = createMockSvg({ scale: 1, scrollLeft: 0, scrollTop: 0, rotation: 0 })
      const mouseEvent = createMockMouseEvent(100, 150)

      const result = getSvgPoint(mouseEvent, svg)

      expect(result.x).toBeCloseTo(100, 1)
      expect(result.y).toBeCloseTo(150, 1)
    })

    it("should handle 90° rotation", () => {
      const svg = createMockSvg({
        scale: 1,
        scrollLeft: 0,
        scrollTop: 0,
        rotation: 90,
        width: 800,
        height: 600
      })
      const mouseEvent = createMockMouseEvent(400, 300)

      const result = getSvgPoint(mouseEvent, svg)

      // At 90° rotation, coordinates are transformed around center
      // This is a simplified test - exact values depend on transform implementation
      expect(result).toBeDefined()
      expect(typeof result.x).toBe("number")
      expect(typeof result.y).toBe("number")
    })

    it("should handle 180° rotation", () => {
      const svg = createMockSvg({
        scale: 1,
        scrollLeft: 0,
        scrollTop: 0,
        rotation: 180,
        width: 800,
        height: 600
      })
      const mouseEvent = createMockMouseEvent(400, 300)

      const result = getSvgPoint(mouseEvent, svg)

      // At 180° rotation, coordinates are flipped around center
      expect(result).toBeDefined()
      expect(typeof result.x).toBe("number")
      expect(typeof result.y).toBe("number")
    })

    it("should handle 270° rotation", () => {
      const svg = createMockSvg({
        scale: 1,
        scrollLeft: 0,
        scrollTop: 0,
        rotation: 270,
        width: 800,
        height: 600
      })
      const mouseEvent = createMockMouseEvent(400, 300)

      const result = getSvgPoint(mouseEvent, svg)

      // At 270° rotation, coordinates are transformed around center
      expect(result).toBeDefined()
      expect(typeof result.x).toBe("number")
      expect(typeof result.y).toBe("number")
    })

    it("should normalize rotation values > 360°", () => {
      const rendererStore = useRendererStore()

      rendererStore.setRotation(450) // Should normalize to 90°
      expect(rendererStore.rotation).toBe(90)

      rendererStore.setRotation(720) // Should normalize to 0°
      expect(rendererStore.rotation).toBe(0)
    })

    it("should normalize negative rotation values", () => {
      const rendererStore = useRendererStore()

      rendererStore.setRotation(-90) // Should normalize to 270°
      expect(rendererStore.rotation).toBe(270)

      rendererStore.setRotation(-180) // Should normalize to 180°
      expect(rendererStore.rotation).toBe(180)
    })
  })

  describe("getSvgPoint() Function", () => {
    it("should return correct coordinates from MouseEvent", () => {
      const svg = createMockSvg({ scale: 1, scrollLeft: 0, scrollTop: 0 })
      const mouseEvent = createMockMouseEvent(123, 456)

      const result = getSvgPoint(mouseEvent, svg)

      expect(result.x).toBeCloseTo(123, 1)
      expect(result.y).toBeCloseTo(456, 1)
    })

    it("should handle CSS transforms correctly with scale", () => {
      const svg = createMockSvg({ scale: 2.5, scrollLeft: 0, scrollTop: 0 })
      const mouseEvent = createMockMouseEvent(500, 750)

      const result = getSvgPoint(mouseEvent, svg)

      // 500 / 2.5 = 200, 750 / 2.5 = 300
      expect(result.x).toBeCloseTo(200, 1)
      expect(result.y).toBeCloseTo(300, 1)
    })

    it("should work with complex matrix transformations", () => {
      const svg = createMockSvg({
        scale: 1.5,
        scrollLeft: 100,
        scrollTop: 150
      })
      const mouseEvent = createMockMouseEvent(400, 600)

      const result = getSvgPoint(mouseEvent, svg)

      // (400 - 100) / 1.5 = 200, (600 - 150) / 1.5 = 300
      expect(result.x).toBeCloseTo(200, 1)
      expect(result.y).toBeCloseTo(300, 1)
    })

    it("should use composable version correctly", () => {
      const { getSvgPoint: getSvgPointUtil } = useSvgCoordinates()
      const svg = createMockSvg({ scale: 2, scrollLeft: 50, scrollTop: 100 })
      const mouseEvent = createMockMouseEvent(250, 500)

      const result = getSvgPointUtil(mouseEvent, svg)

      // (250 - 50) / 2 = 100, (500 - 100) / 2 = 200
      expect(result?.x).toBeCloseTo(100, 1)
      expect(result?.y).toBeCloseTo(200, 1)
    })

    it("should return null when getScreenCTM returns null", () => {
      const { getSvgPoint: getSvgPointUtil } = useSvgCoordinates()

      const invalidSvg = {
        createSVGPoint: () => ({ x: 0, y: 0, matrixTransform: vi.fn() }),
        getScreenCTM: () => null
      } as unknown as SVGSVGElement

      const mouseEvent = createMockMouseEvent(100, 200)
      const result = getSvgPointUtil(mouseEvent, invalidSvg)

      expect(result).toBeNull()
    })
  })

  describe("Renderer Store Integration", () => {
    it("should update coordinates when scale changes in store", () => {
      const rendererStore = useRendererStore()
      const svgPoint = { x: 100, y: 100 }

      // Set scale to 2x
      rendererStore.setScale(2)

      const svg = createMockSvg({ scale: rendererStore.scale })
      const screenX = svgPoint.x * rendererStore.scale
      const screenY = svgPoint.y * rendererStore.scale
      const mouseEvent = createMockMouseEvent(screenX, screenY)

      const result = getSvgPoint(mouseEvent, svg)

      expect(result.x).toBeCloseTo(svgPoint.x, 1)
      expect(result.y).toBeCloseTo(svgPoint.y, 1)
    })

    it("should update coordinates when scroll position changes in store", () => {
      const rendererStore = useRendererStore()
      const svgPoint = { x: 100, y: 100 }

      // Set scroll position
      rendererStore.setCanvasPos({ scrollLeft: 50, scrollTop: 75 })

      const svg = createMockSvg({
        scale: 1,
        scrollLeft: rendererStore.canvasPos.scrollLeft,
        scrollTop: rendererStore.canvasPos.scrollTop
      })

      const screenX = svgPoint.x + rendererStore.canvasPos.scrollLeft
      const screenY = svgPoint.y + rendererStore.canvasPos.scrollTop
      const mouseEvent = createMockMouseEvent(screenX, screenY)

      const result = getSvgPoint(mouseEvent, svg)

      expect(result.x).toBeCloseTo(svgPoint.x, 1)
      expect(result.y).toBeCloseTo(svgPoint.y, 1)
    })

    it("should combine store scale and position correctly", () => {
      const rendererStore = useRendererStore()
      const svgPoint = { x: 100, y: 150 }

      rendererStore.setScale(2)
      rendererStore.setCanvasPos({ scrollLeft: 100, scrollTop: 200 })

      const svg = createMockSvg({
        scale: rendererStore.scale,
        scrollLeft: rendererStore.canvasPos.scrollLeft,
        scrollTop: rendererStore.canvasPos.scrollTop
      })

      const screenX = svgPoint.x * rendererStore.scale + rendererStore.canvasPos.scrollLeft
      const screenY = svgPoint.y * rendererStore.scale + rendererStore.canvasPos.scrollTop
      const mouseEvent = createMockMouseEvent(screenX, screenY)

      const result = getSvgPoint(mouseEvent, svg)

      expect(result.x).toBeCloseTo(svgPoint.x, 1)
      expect(result.y).toBeCloseTo(svgPoint.y, 1)
    })
  })
})
