import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { RENDERING } from "../../constants/rendering"

describe("Renderer Store - Validation & Error Handling", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Suppress console warnings during tests
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  describe("Scale Validation", () => {
    it("should reject NaN scale value", () => {
      const store = useRendererStore()
      const originalScale = store.getScale

      store.setScale(NaN)

      expect(store.getScale).toBe(originalScale)
      expect(console.warn).toHaveBeenCalledWith("Invalid scale value:", NaN)
    })

    it("should reject Infinity scale value", () => {
      const store = useRendererStore()
      const originalScale = store.getScale

      store.setScale(Infinity)

      expect(store.getScale).toBe(originalScale)
      expect(console.warn).toHaveBeenCalledWith("Invalid scale value:", Infinity)
    })

    it("should reject negative Infinity scale value", () => {
      const store = useRendererStore()
      const originalScale = store.getScale

      store.setScale(-Infinity)

      expect(store.getScale).toBe(originalScale)
      expect(console.warn).toHaveBeenCalledWith("Invalid scale value:", -Infinity)
    })

    it("should clamp negative scale to minimum", () => {
      const store = useRendererStore()

      store.setScale(-2)

      expect(store.getScale).toBe(RENDERING.MIN_SCALE)
      expect(console.warn).not.toHaveBeenCalled()
    })

    it("should clamp zero scale to minimum", () => {
      const store = useRendererStore()

      store.setScale(0)

      expect(store.getScale).toBe(RENDERING.MIN_SCALE)
      expect(console.warn).not.toHaveBeenCalled()
    })

    it("should not zoom in beyond MAX_SCALE", () => {
      const store = useRendererStore()
      store.setScale(RENDERING.MAX_SCALE)

      store.zoomIn()

      expect(store.getScale).toBe(RENDERING.MAX_SCALE)
    })

    it("should not zoom out below MIN_SCALE", () => {
      const store = useRendererStore()
      store.setScale(RENDERING.MIN_SCALE)

      store.zoomOut()

      expect(store.getScale).toBe(RENDERING.MIN_SCALE)
    })

    it("should handle repeated zoom in at max scale", () => {
      const store = useRendererStore()
      store.setScale(RENDERING.MAX_SCALE)

      store.zoomIn()
      store.zoomIn()
      store.zoomIn()

      expect(store.getScale).toBe(RENDERING.MAX_SCALE)
    })

    it("should handle repeated zoom out at min scale", () => {
      const store = useRendererStore()
      store.setScale(RENDERING.MIN_SCALE)

      store.zoomOut()
      store.zoomOut()
      store.zoomOut()

      expect(store.getScale).toBe(RENDERING.MIN_SCALE)
    })
  })

  describe("Rotation Validation", () => {
    it("should reject NaN rotation value", () => {
      const store = useRendererStore()
      const originalRotation = store.getRotation

      store.setRotation(NaN)

      expect(store.getRotation).toBe(originalRotation)
      expect(console.warn).toHaveBeenCalledWith("Invalid rotation value:", NaN)
    })

    it("should reject Infinity rotation value", () => {
      const store = useRendererStore()
      const originalRotation = store.getRotation

      store.setRotation(Infinity)

      expect(store.getRotation).toBe(originalRotation)
      expect(console.warn).toHaveBeenCalledWith("Invalid rotation value:", Infinity)
    })

    it("should reject negative Infinity rotation value", () => {
      const store = useRendererStore()
      const originalRotation = store.getRotation

      store.setRotation(-Infinity)

      expect(store.getRotation).toBe(originalRotation)
      expect(console.warn).toHaveBeenCalledWith("Invalid rotation value:", -Infinity)
    })

    it("should normalize very large positive rotation (> 10000)", () => {
      const store = useRendererStore()

      store.setRotation(10450)

      // 10450 % 360 = 10
      expect(store.getRotation).toBe(10)
      expect(console.warn).not.toHaveBeenCalled()
    })

    it("should normalize very large negative rotation", () => {
      const store = useRendererStore()

      store.setRotation(-10450)

      // ((-10450 % 360) + 360) % 360 = 350
      expect(store.getRotation).toBe(350)
      expect(console.warn).not.toHaveBeenCalled()
    })

    it("should handle rotation edge case: exactly 360", () => {
      const store = useRendererStore()

      store.setRotation(360)

      expect(store.getRotation).toBe(0)
    })

    it("should handle rotation edge case: exactly -360", () => {
      const store = useRendererStore()

      store.setRotation(-360)

      expect(store.getRotation).toBe(0)
    })

    it("should handle rotation edge case: 720", () => {
      const store = useRendererStore()

      store.setRotation(720)

      expect(store.getRotation).toBe(0)
    })

    it("should preserve rotation after multiple normalize operations", () => {
      const store = useRendererStore()

      store.setRotation(450) // Should be 90
      expect(store.getRotation).toBe(90)

      store.setRotation(-270) // Should be 90
      expect(store.getRotation).toBe(90)

      store.setRotation(810) // Should be 90
      expect(store.getRotation).toBe(90)
    })
  })

  describe("Page Number Validation", () => {
    it("should reject page number 0", () => {
      const store = useRendererStore()
      const originalPage = store.getCurrentPage

      store.setCurrentPage(0)

      expect(store.getCurrentPage).toBe(originalPage)
      expect(console.warn).toHaveBeenCalledWith("Invalid page number:", 0)
    })

    it("should reject negative page number", () => {
      const store = useRendererStore()
      const originalPage = store.getCurrentPage

      store.setCurrentPage(-5)

      expect(store.getCurrentPage).toBe(originalPage)
      expect(console.warn).toHaveBeenCalledWith("Invalid page number:", -5)
    })

    it("should reject non-integer page number", () => {
      const store = useRendererStore()
      const originalPage = store.getCurrentPage

      store.setCurrentPage(1.5)

      expect(store.getCurrentPage).toBe(originalPage)
      expect(console.warn).toHaveBeenCalledWith("Invalid page number:", 1.5)
    })

    it("should reject NaN page number", () => {
      const store = useRendererStore()
      const originalPage = store.getCurrentPage

      store.setCurrentPage(NaN)

      expect(store.getCurrentPage).toBe(originalPage)
      expect(console.warn).toHaveBeenCalledWith("Invalid page number:", NaN)
    })

    it("should reject Infinity page number", () => {
      const store = useRendererStore()
      const originalPage = store.getCurrentPage

      store.setCurrentPage(Infinity)

      expect(store.getCurrentPage).toBe(originalPage)
      expect(console.warn).toHaveBeenCalledWith("Invalid page number:", Infinity)
    })

    it("should reject page beyond total pages when totalPages is known", () => {
      const store = useRendererStore()
      store.setTotalPages(10)

      store.setCurrentPage(15)

      expect(store.getCurrentPage).toBe(1) // Should remain at default
      expect(console.warn).toHaveBeenCalledWith("Page 15 exceeds total pages 10")
    })

    it("should accept valid page within total pages range", () => {
      const store = useRendererStore()
      store.setTotalPages(10)

      store.setCurrentPage(7)

      expect(store.getCurrentPage).toBe(7)
      expect(console.warn).not.toHaveBeenCalled()
    })

    it("should accept page at upper boundary (equals totalPages)", () => {
      const store = useRendererStore()
      store.setTotalPages(10)

      store.setCurrentPage(10)

      expect(store.getCurrentPage).toBe(10)
      expect(console.warn).not.toHaveBeenCalled()
    })
  })

  describe("Canvas Position Validation", () => {
    it("should reject position with NaN scrollLeft", () => {
      const store = useRendererStore()
      const originalPos = { ...store.getCanvasPos }

      store.setCanvasPos({ scrollLeft: NaN, scrollTop: 100 })

      expect(store.getCanvasPos).toEqual(originalPos)
      expect(console.warn).toHaveBeenCalledWith("Invalid canvas position:", { scrollLeft: NaN, scrollTop: 100 })
    })

    it("should reject position with NaN scrollTop", () => {
      const store = useRendererStore()
      const originalPos = { ...store.getCanvasPos }

      store.setCanvasPos({ scrollLeft: 100, scrollTop: NaN })

      expect(store.getCanvasPos).toEqual(originalPos)
      expect(console.warn).toHaveBeenCalledWith("Invalid canvas position:", { scrollLeft: 100, scrollTop: NaN })
    })

    it("should reject position with Infinity scrollTop", () => {
      const store = useRendererStore()
      const originalPos = { ...store.getCanvasPos }

      store.setCanvasPos({ scrollLeft: 100, scrollTop: Infinity })

      expect(store.getCanvasPos).toEqual(originalPos)
      expect(console.warn).toHaveBeenCalledWith("Invalid canvas position:", { scrollLeft: 100, scrollTop: Infinity })
    })

    it("should reject position with Infinity scrollLeft", () => {
      const store = useRendererStore()
      const originalPos = { ...store.getCanvasPos }

      store.setCanvasPos({ scrollLeft: Infinity, scrollTop: 100 })

      expect(store.getCanvasPos).toEqual(originalPos)
      expect(console.warn).toHaveBeenCalledWith("Invalid canvas position:", { scrollLeft: Infinity, scrollTop: 100 })
    })

    it("should accept negative canvas position values", () => {
      const store = useRendererStore()

      store.setCanvasPos({ scrollLeft: -50, scrollTop: -100 })

      expect(store.getCanvasPos.scrollLeft).toBe(-50)
      expect(store.getCanvasPos.scrollTop).toBe(-100)
      expect(console.warn).not.toHaveBeenCalled()
    })

    it("should reject position with both values as NaN", () => {
      const store = useRendererStore()
      const originalPos = { ...store.getCanvasPos }

      store.setCanvasPos({ scrollLeft: NaN, scrollTop: NaN })

      expect(store.getCanvasPos).toEqual(originalPos)
      expect(console.warn).toHaveBeenCalledWith("Invalid canvas position:", { scrollLeft: NaN, scrollTop: NaN })
    })
  })

  describe("Canvas Size Validation", () => {
    it("should reject size with NaN width", () => {
      const store = useRendererStore()
      const originalSize = { ...store.getCanvasSize }

      store.setCanvasSize({ width: NaN, height: 100 })

      expect(store.getCanvasSize).toEqual(originalSize)
      expect(console.warn).toHaveBeenCalledWith("Invalid canvas size:", { width: NaN, height: 100 })
    })

    it("should reject size with NaN height", () => {
      const store = useRendererStore()
      const originalSize = { ...store.getCanvasSize }

      store.setCanvasSize({ width: 100, height: NaN })

      expect(store.getCanvasSize).toEqual(originalSize)
      expect(console.warn).toHaveBeenCalledWith("Invalid canvas size:", { width: 100, height: NaN })
    })

    it("should reject size with negative width", () => {
      const store = useRendererStore()
      const originalSize = { ...store.getCanvasSize }

      store.setCanvasSize({ width: -100, height: 100 })

      expect(store.getCanvasSize).toEqual(originalSize)
      expect(console.warn).toHaveBeenCalledWith("Invalid canvas size:", { width: -100, height: 100 })
    })

    it("should reject size with negative height", () => {
      const store = useRendererStore()
      const originalSize = { ...store.getCanvasSize }

      store.setCanvasSize({ width: 100, height: -100 })

      expect(store.getCanvasSize).toEqual(originalSize)
      expect(console.warn).toHaveBeenCalledWith("Invalid canvas size:", { width: 100, height: -100 })
    })

    it("should reject size with Infinity dimensions", () => {
      const store = useRendererStore()
      const originalSize = { ...store.getCanvasSize }

      store.setCanvasSize({ width: Infinity, height: Infinity })

      expect(store.getCanvasSize).toEqual(originalSize)
      expect(console.warn).toHaveBeenCalledWith("Invalid canvas size:", { width: Infinity, height: Infinity })
    })

    it("should accept zero dimensions", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 0, height: 0 })

      expect(store.getCanvasSize.width).toBe(0)
      expect(store.getCanvasSize.height).toBe(0)
      expect(console.warn).not.toHaveBeenCalled()
    })

    it("should accept valid positive dimensions", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 800, height: 600 })

      expect(store.getCanvasSize.width).toBe(800)
      expect(store.getCanvasSize.height).toBe(600)
      expect(console.warn).not.toHaveBeenCalled()
    })
  })

  describe("Transform String Edge Cases", () => {
    it("should handle canvas transform with NaN scale gracefully", () => {
      const store = useRendererStore()
      store.setScale(NaN) // Should be rejected
      store.setCanvasPos({ scrollLeft: 100, scrollTop: 50 })
      store.setRotation(45)

      const transform = store.getCanvasTransform

      // Scale should remain at default value (1)
      expect(transform).toContain("scale(1)")
      expect(transform).toContain("translate(100px, 50px)")
      expect(transform).toContain("rotate(45deg)")
    })

    it("should handle canvas transform with NaN rotation gracefully", () => {
      const store = useRendererStore()
      store.setScale(2)
      store.setCanvasPos({ scrollLeft: 100, scrollTop: 50 })
      store.setRotation(NaN) // Should be rejected

      const transform = store.getCanvasTransform

      // Rotation should remain at default value (0)
      expect(transform).toContain("scale(2)")
      expect(transform).toContain("translate(100px, 50px)")
      expect(transform).toContain("rotate(0deg)")
    })

    it("should handle canvas transform with NaN position gracefully", () => {
      const store = useRendererStore()
      store.setScale(2)
      store.setRotation(45)
      store.setCanvasPos({ scrollLeft: NaN, scrollTop: NaN }) // Should be rejected

      const transform = store.getCanvasTransform

      // Position should remain at default value (0, 0)
      expect(transform).toContain("translate(0px, 0px)")
      expect(transform).toContain("scale(2)")
      expect(transform).toContain("rotate(45deg)")
    })

    it("should handle SVG transform with valid offset", () => {
      const store = useRendererStore()
      store.setCanvasPos({ scrollLeft: 100, scrollTop: 50 })
      store.setRotation(90)

      const transform = store.getSvgTransform(10, 5)

      expect(transform).toContain("translate(90px, 45px)")
      expect(transform).toContain("rotate(90deg)")
    })

    it("should handle SVG transform with NaN offset", () => {
      const store = useRendererStore()
      store.setCanvasPos({ scrollLeft: 100, scrollTop: 50 })
      store.setRotation(90)

      const transform = store.getSvgTransform(NaN, NaN)

      // NaN - NaN = NaN, which will appear in string
      expect(transform).toContain("translate(NaNpx, NaNpx)")
      expect(transform).toContain("rotate(90deg)")
    })

    it("should handle SVG transform with Infinity offset", () => {
      const store = useRendererStore()
      store.setCanvasPos({ scrollLeft: 100, scrollTop: 50 })
      store.setRotation(0)

      const transform = store.getSvgTransform(Infinity, Infinity)

      // 100 - Infinity = -Infinity
      expect(transform).toContain("translate(-Infinitypx, -Infinitypx)")
      expect(transform).toContain("rotate(0deg)")
    })
  })

  describe("State Reset Validation", () => {
    it("should reset all state to defaults", () => {
      const store = useRendererStore()

      // Set non-default values
      store.setScale(3.5)
      store.setRotation(270)
      store.setCanvasPos({ scrollLeft: 100, scrollTop: 200 })
      store.setTotalPages(25)
      store.setCanvasSize({ width: 800, height: 600 })
      store.setCurrentPage(15)
      store.setPdfInitialised(true)

      // Reset
      store.resetState()

      // Verify all defaults
      expect(store.getScale).toBe(1)
      expect(store.getRotation).toBe(0)
      expect(store.getCanvasPos).toEqual({ scrollLeft: 0, scrollTop: 0 })
      expect(store.getTotalPages).toBe(0)
      expect(store.getCanvasSize).toEqual({ width: 0, height: 0 })
      expect(store.getCurrentPage).toBe(1)
      expect(store.getPdfInitialised).toBe(false)
    })

    it("should handle reset after invalid values attempted", () => {
      const store = useRendererStore()

      // Attempt invalid values
      store.setScale(NaN)
      store.setRotation(Infinity)
      store.setCanvasPos({ scrollLeft: NaN, scrollTop: NaN })
      store.setCurrentPage(-5)

      // Values should still be at defaults
      expect(store.getScale).toBe(1)
      expect(store.getRotation).toBe(0)
      expect(store.getCanvasPos).toEqual({ scrollLeft: 0, scrollTop: 0 })
      expect(store.getCurrentPage).toBe(1)

      // Reset should work fine
      store.resetState()

      expect(store.getScale).toBe(1)
      expect(store.getRotation).toBe(0)
    })
  })

  describe("getPdfPosition Calculation with Invalid Values", () => {
    it("should handle PDF position calculation with zero scale", () => {
      const store = useRendererStore()
      store.setScale(0) // Will clamp to MIN_SCALE
      store.setCanvasPos({ scrollLeft: 100, scrollTop: 50 })

      const pdfPos = store.getPdfPosition

      // Should use MIN_SCALE (0.1) for division
      expect(pdfPos.left).toBe(100 / RENDERING.MIN_SCALE)
      expect(pdfPos.top).toBe(50 / RENDERING.MIN_SCALE)
    })

    it("should handle PDF position calculation at max scale", () => {
      const store = useRendererStore()
      store.setScale(RENDERING.MAX_SCALE)
      store.setCanvasPos({ scrollLeft: 500, scrollTop: 250 })

      const pdfPos = store.getPdfPosition

      expect(pdfPos.left).toBe(500 / RENDERING.MAX_SCALE)
      expect(pdfPos.top).toBe(250 / RENDERING.MAX_SCALE)
    })

    it("should handle PDF position calculation with negative canvas position", () => {
      const store = useRendererStore()
      store.setScale(2)
      store.setCanvasPos({ scrollLeft: -100, scrollTop: -50 })

      const pdfPos = store.getPdfPosition

      expect(pdfPos.left).toBe(-100 / 2)
      expect(pdfPos.top).toBe(-50 / 2)
    })
  })

  describe("Viewport Label Rotation", () => {
    it("should calculate viewport label rotation correctly", () => {
      const store = useRendererStore()
      store.setRotation(90)

      expect(store.getViewportLabelRotation).toBe(-90)
    })

    it("should handle viewport label rotation at 0 degrees", () => {
      const store = useRendererStore()
      store.setRotation(0)

      expect(store.getViewportLabelRotation).toBe(0)
    })

    it("should handle viewport label rotation at 360 degrees (normalized to 0)", () => {
      const store = useRendererStore()
      store.setRotation(360)

      expect(store.getViewportLabelRotation).toBe(0)
    })

    it("should handle viewport label rotation with invalid rotation (NaN)", () => {
      const store = useRendererStore()
      store.setRotation(NaN) // Should be rejected

      // Should remain at default (0)
      expect(store.getViewportLabelRotation).toBe(0)
    })
  })
})
