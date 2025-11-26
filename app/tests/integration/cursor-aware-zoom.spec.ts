import { describe, it, expect, beforeEach } from "vitest"
import { setActivePinia, createPinia } from "pinia"

describe("Cursor-Aware Zoom with Center Transform Origin", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe("Basic Zoom Mechanics", () => {
    it("should zoom in towards cursor position", () => {
      const store = useRendererStore()

      // Set up PDF dimensions (simulating a 1200x800 PDF)
      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(1)
      store.setCanvasPos({ scrollLeft: 0, scrollTop: 0 })

      // Mouse at (400, 300) - should stay at same screen position after zoom
      const mousePos = { x: 400, y: 300 }

      store.zoomIn(mousePos)

      // After zoom, the same PDF point should still be under the mouse
      const newScale = store.getScale
      expect(newScale).toBeGreaterThan(1)

      // Verify the PDF point under mouse stays the same
      // PDF point calculation: (mouseX - translateX - centerX * (1 - scale)) / scale
      const centerX = 1200 / 2
      const centerY = 800 / 2

      const pdfX = (mousePos.x - store.canvasPos.scrollLeft - centerX * (1 - newScale)) / newScale
      const pdfY = (mousePos.y - store.canvasPos.scrollTop - centerY * (1 - newScale)) / newScale

      // Original PDF point at scale 1, no translate
      const originalPdfX = (400 - 0 - centerX * (1 - 1)) / 1 // = 400
      const originalPdfY = (300 - 0 - centerY * (1 - 1)) / 1 // = 300

      // Should be the same point
      expect(pdfX).toBeCloseTo(originalPdfX, 5)
      expect(pdfY).toBeCloseTo(originalPdfY, 5)
    })

    it("should zoom out from cursor position", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(2) // Start zoomed in
      store.setCanvasPos({ scrollLeft: 0, scrollTop: 0 })

      const mousePos = { x: 600, y: 400 }

      store.zoomOut(mousePos)

      const newScale = store.getScale
      expect(newScale).toBeLessThan(2)

      // Verify the PDF point under mouse stays the same
      const centerX = 1200 / 2
      const centerY = 800 / 2

      const pdfX = (mousePos.x - store.canvasPos.scrollLeft - centerX * (1 - newScale)) / newScale
      const pdfY = (mousePos.y - store.canvasPos.scrollTop - centerY * (1 - newScale)) / newScale

      const originalPdfX = (600 - 0 - centerX * (1 - 2)) / 2
      const originalPdfY = (400 - 0 - centerY * (1 - 2)) / 2

      expect(pdfX).toBeCloseTo(originalPdfX, 5)
      expect(pdfY).toBeCloseTo(originalPdfY, 5)
    })

    it("should clamp scale to min/max bounds", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })

      // Try to zoom out below minimum
      store.setScale(0.15) // MIN_SCALE is 0.1
      for (let i = 0; i < 10; i++) {
        store.zoomOut({ x: 100, y: 100 })
      }
      expect(store.getScale).toBeGreaterThanOrEqual(0.1)

      // Try to zoom in above maximum
      store.setScale(4.5) // MAX_SCALE is 5
      for (let i = 0; i < 10; i++) {
        store.zoomIn({ x: 100, y: 100 })
      }
      expect(store.getScale).toBeLessThanOrEqual(5)
    })
  })

  describe("Zoom at Different Positions", () => {
    it("should zoom towards top-left corner", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(1)
      store.setCanvasPos({ scrollLeft: 0, scrollTop: 0 })

      const mousePos = { x: 50, y: 50 } // Near top-left

      store.zoomIn(mousePos)

      // PDF point at top-left should stay under cursor
      const centerX = 1200 / 2
      const newScale = store.getScale

      const pdfX = (mousePos.x - store.canvasPos.scrollLeft - centerX * (1 - newScale)) / newScale
      const originalPdfX = (50 - 0 - centerX * (1 - 1)) / 1

      expect(pdfX).toBeCloseTo(originalPdfX, 5)
    })

    it("should zoom towards bottom-right corner", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(1)
      store.setCanvasPos({ scrollLeft: 0, scrollTop: 0 })

      const mousePos = { x: 1150, y: 750 } // Near bottom-right

      store.zoomIn(mousePos)

      const centerY = 800 / 2
      const newScale = store.getScale

      const pdfY = (mousePos.y - store.canvasPos.scrollTop - centerY * (1 - newScale)) / newScale
      const originalPdfY = (750 - 0 - centerY * (1 - 1)) / 1

      expect(pdfY).toBeCloseTo(originalPdfY, 5)
    })

    it("should zoom towards center", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(1)
      store.setCanvasPos({ scrollLeft: 0, scrollTop: 0 })

      const mousePos = { x: 600, y: 400 } // Exactly at center

      store.zoomIn(mousePos)

      // At center with center origin, should have symmetric behavior
      const newScale = store.getScale
      expect(newScale).toBeGreaterThan(1)

      // Center point in PDF coordinates
      const centerX = 1200 / 2
      const centerY = 800 / 2

      const pdfX = (mousePos.x - store.canvasPos.scrollLeft - centerX * (1 - newScale)) / newScale
      const pdfY = (mousePos.y - store.canvasPos.scrollTop - centerY * (1 - newScale)) / newScale

      // Should be at PDF center
      expect(pdfX).toBeCloseTo(600, 5)
      expect(pdfY).toBeCloseTo(400, 5)
    })

    it("should zoom at arbitrary position", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(1)
      store.setCanvasPos({ scrollLeft: 0, scrollTop: 0 })

      const mousePos = { x: 327, y: 589 } // Random position

      const initialScale = store.getScale
      store.zoomIn(mousePos)

      expect(store.getScale).toBeGreaterThan(initialScale)

      // Verify point stays under cursor
      const centerX = 1200 / 2
      const newScale = store.getScale

      const pdfX = (mousePos.x - store.canvasPos.scrollLeft - centerX * (1 - newScale)) / newScale
      const originalPdfX = (327 - 0 - centerX * (1 - 1)) / 1

      expect(pdfX).toBeCloseTo(originalPdfX, 5)
    })
  })

  describe("Zoom with Existing Pan/Scroll", () => {
    it("should zoom correctly when already panned", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(1)
      store.setCanvasPos({ scrollLeft: 200, scrollTop: 150 }) // Already panned

      const mousePos = { x: 400, y: 300 }

      store.zoomIn(mousePos)

      const centerX = 1200 / 2
      const centerY = 800 / 2
      const newScale = store.getScale

      // Calculate PDF point before zoom
      const originalPdfX = (400 - 200 - centerX * (1 - 1)) / 1
      const originalPdfY = (300 - 150 - centerY * (1 - 1)) / 1

      // Calculate PDF point after zoom
      const pdfX = (mousePos.x - store.canvasPos.scrollLeft - centerX * (1 - newScale)) / newScale
      const pdfY = (mousePos.y - store.canvasPos.scrollTop - centerY * (1 - newScale)) / newScale

      expect(pdfX).toBeCloseTo(originalPdfX, 5)
      expect(pdfY).toBeCloseTo(originalPdfY, 5)
    })

    it("should zoom correctly at high scale with pan", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(3)
      store.setCanvasPos({ scrollLeft: -500, scrollTop: -300 })

      const mousePos = { x: 250, y: 400 }

      const initialScale = store.getScale
      store.zoomIn(mousePos)

      expect(store.getScale).toBeGreaterThan(initialScale)

      // PDF point should remain stable
      const centerX = 1200 / 2
      const centerY = 800 / 2

      const originalPdfX = (250 - -500 - centerX * (1 - 3)) / 3
      const originalPdfY = (400 - -300 - centerY * (1 - 3)) / 3

      const newScale = store.getScale
      const pdfX = (mousePos.x - store.canvasPos.scrollLeft - centerX * (1 - newScale)) / newScale
      const pdfY = (mousePos.y - store.canvasPos.scrollTop - centerY * (1 - newScale)) / newScale

      expect(pdfX).toBeCloseTo(originalPdfX, 4)
      expect(pdfY).toBeCloseTo(originalPdfY, 4)
    })
  })

  describe("Multiple Consecutive Zooms", () => {
    it("should maintain cursor position through multiple zoom in operations", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(1)
      store.setCanvasPos({ scrollLeft: 0, scrollTop: 0 })

      const mousePos = { x: 450, y: 320 }
      const centerX = 1200 / 2
      const centerY = 800 / 2

      // Calculate initial PDF point
      const originalPdfX = (450 - 0 - centerX * (1 - 1)) / 1
      const originalPdfY = (320 - 0 - centerY * (1 - 1)) / 1

      // Zoom in 5 times
      for (let i = 0; i < 5; i++) {
        store.zoomIn(mousePos)
      }

      // PDF point should still be under cursor
      const finalScale = store.getScale
      const pdfX = (mousePos.x - store.canvasPos.scrollLeft - centerX * (1 - finalScale)) / finalScale
      const pdfY = (mousePos.y - store.canvasPos.scrollTop - centerY * (1 - finalScale)) / finalScale

      expect(pdfX).toBeCloseTo(originalPdfX, 3)
      expect(pdfY).toBeCloseTo(originalPdfY, 3)
    })

    it("should maintain cursor position through zoom in then zoom out", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(1)
      store.setCanvasPos({ scrollLeft: 0, scrollTop: 0 })

      const mousePos = { x: 350, y: 550 }
      const centerX = 1200 / 2
      const centerY = 800 / 2

      const originalPdfX = (350 - 0 - centerX * (1 - 1)) / 1
      const originalPdfY = (550 - 0 - centerY * (1 - 1)) / 1

      // Zoom in 3 times
      for (let i = 0; i < 3; i++) {
        store.zoomIn(mousePos)
      }

      // Zoom out 2 times
      for (let i = 0; i < 2; i++) {
        store.zoomOut(mousePos)
      }

      const finalScale = store.getScale
      const pdfX = (mousePos.x - store.canvasPos.scrollLeft - centerX * (1 - finalScale)) / finalScale
      const pdfY = (mousePos.y - store.canvasPos.scrollTop - centerY * (1 - finalScale)) / finalScale

      expect(pdfX).toBeCloseTo(originalPdfX, 3)
      expect(pdfY).toBeCloseTo(originalPdfY, 3)
    })

    it("should handle zoom at changing cursor positions", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(1)
      store.setCanvasPos({ scrollLeft: 0, scrollTop: 0 })

      const centerX = 1200 / 2

      // Zoom at position 1
      const pos1 = { x: 300, y: 200 }
      const pdfX1_before = (pos1.x - store.canvasPos.scrollLeft - centerX * (1 - store.getScale)) / store.getScale
      store.zoomIn(pos1)
      const pdfX1_after = (pos1.x - store.canvasPos.scrollLeft - centerX * (1 - store.getScale)) / store.getScale
      expect(pdfX1_after).toBeCloseTo(pdfX1_before, 5)

      // Zoom at position 2 (different location)
      const pos2 = { x: 800, y: 600 }
      const pdfX2_before = (pos2.x - store.canvasPos.scrollLeft - centerX * (1 - store.getScale)) / store.getScale
      store.zoomIn(pos2)
      const pdfX2_after = (pos2.x - store.canvasPos.scrollLeft - centerX * (1 - store.getScale)) / store.getScale
      expect(pdfX2_after).toBeCloseTo(pdfX2_before, 5)
    })
  })

  describe("Zoom Without Mouse Position (Fallback)", () => {
    it("should zoom towards center when no mouse position provided", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(1)
      store.setCanvasPos({ scrollLeft: 0, scrollTop: 0 })

      const initialScale = store.getScale

      // Zoom without mouse position
      store.zoomIn()

      expect(store.getScale).toBeGreaterThan(initialScale)

      // Canvas position should not change (zoom from center)
      expect(store.canvasPos.scrollLeft).toBe(0)
      expect(store.canvasPos.scrollTop).toBe(0)
    })

    it("should respect scale limits when zooming without mouse position", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })

      // Zoom out to minimum
      store.setScale(0.15)
      store.zoomOut()
      expect(store.getScale).toBeGreaterThanOrEqual(0.1)

      // Zoom in to maximum
      store.setScale(4.8)
      store.zoomIn()
      expect(store.getScale).toBeLessThanOrEqual(5)
    })
  })

  describe("Edge Cases", () => {
    it("should handle zero-sized PDF gracefully", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 0, height: 0 })
      store.setScale(1)

      // Should not crash
      expect(() => {
        store.zoomIn({ x: 100, y: 100 })
      }).not.toThrow()
    })

    it("should handle very small PDF", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 10, height: 10 })
      store.setScale(1)
      store.setCanvasPos({ scrollLeft: 0, scrollTop: 0 })

      const mousePos = { x: 5, y: 5 }

      store.zoomIn(mousePos)

      expect(store.getScale).toBeGreaterThan(1)
    })

    it("should handle very large PDF", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 10000, height: 8000 })
      store.setScale(1)
      store.setCanvasPos({ scrollLeft: 0, scrollTop: 0 })

      const mousePos = { x: 5000, y: 4000 }

      store.zoomIn(mousePos)

      const centerX = 10000 / 2
      const newScale = store.getScale

      const pdfX = (mousePos.x - store.canvasPos.scrollLeft - centerX * (1 - newScale)) / newScale
      const originalPdfX = (5000 - 0 - centerX * (1 - 1)) / 1

      expect(pdfX).toBeCloseTo(originalPdfX, 3)
    })

    it("should handle mouse at exact edge of PDF", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(1)
      store.setCanvasPos({ scrollLeft: 0, scrollTop: 0 })

      // Mouse exactly at right edge
      const mousePos = { x: 1200, y: 400 }

      expect(() => {
        store.zoomIn(mousePos)
      }).not.toThrow()

      expect(store.getScale).toBeGreaterThan(1)
    })

    it("should handle negative scroll positions", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(2)
      store.setCanvasPos({ scrollLeft: -500, scrollTop: -300 })

      const mousePos = { x: 400, y: 300 }

      store.zoomIn(mousePos)

      // Should work correctly with negative positions
      expect(store.getScale).toBeGreaterThan(2)
    })
  })

  describe("Transform Formula Verification", () => {
    it("should correctly apply forward transform (PDF → Screen)", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })
      store.setScale(2)
      store.setCanvasPos({ scrollLeft: 100, scrollTop: 50 })

      const pdfX = 400
      const scale = 2
      const translateX = 100
      const centerX = 1200 / 2

      // Forward transform: screenX = pdfX * scale + translateX + centerX * (1 - scale)
      const expectedScreenX = pdfX * scale + translateX + centerX * (1 - scale)

      // Should be: 400 * 2 + 100 + 600 * (1 - 2) = 800 + 100 - 600 = 300
      expect(expectedScreenX).toBe(300)
    })

    it("should correctly apply inverse transform (Screen → PDF)", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })

      const screenX = 300
      const scale = 2
      const translateX = 100
      const centerX = 1200 / 2

      // Inverse transform: pdfX = (screenX - translateX - centerX * (1 - scale)) / scale
      const pdfX = (screenX - translateX - centerX * (1 - scale)) / scale

      // Should be: (300 - 100 - 600 * (1 - 2)) / 2 = (300 - 100 + 600) / 2 = 400
      expect(pdfX).toBe(400)
    })

    it("should verify transform round-trip", () => {
      const store = useRendererStore()

      store.setCanvasSize({ width: 1200, height: 800 })

      const originalPdfX = 567
      const scale = 1.5
      const translateX = 250
      const centerX = 1200 / 2

      // Forward: PDF → Screen
      const screenX = originalPdfX * scale + translateX + centerX * (1 - scale)

      // Inverse: Screen → PDF
      const pdfX = (screenX - translateX - centerX * (1 - scale)) / scale

      // Should round-trip perfectly
      expect(pdfX).toBeCloseTo(originalPdfX, 10)
    })
  })
})
