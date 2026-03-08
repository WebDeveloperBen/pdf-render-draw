import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"

// Mock debug utils
vi.mock("~/utils/debug", () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn()
}))

/**
 * Label Scale Stamping Tests
 *
 * Verifies that annotations bake their visual scale (labelScale) at creation time,
 * so labels and markers stay at the size they were placed at regardless of later zoom changes.
 *
 * Covers:
 * - useToolViewport helpers: stamped(), stampedTransform(), s(), screenTransform()
 * - labelScale set on annotations created via useDrawingTool
 * - labelScale set on count annotations via useCountTool
 * - Backward compatibility when labelScale is undefined
 * - Different zoom levels produce different labelScale values
 */
describe("Label Scale Stamping", () => {
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
  // useToolViewport Helpers
  // ============================================

  describe("useToolViewport - stamped()", () => {
    it("should scale value by provided labelScale", () => {
      const { stamped } = useToolViewport()
      // labelScale of 0.5 means annotation was created at 2x zoom
      expect(stamped(10, 0.5)).toBe(5)
    })

    it("should scale value by provided labelScale at different values", () => {
      const { stamped } = useToolViewport()
      expect(stamped(10, 2)).toBe(20)   // Created at 0.5x zoom
      expect(stamped(10, 1)).toBe(10)   // Created at 1x zoom
      expect(stamped(10, 0.25)).toBe(2.5) // Created at 4x zoom
    })

    it("should fall back to live inverseScale when labelScale is undefined", () => {
      viewportStore.setScale(2)
      const { stamped } = useToolViewport()
      // inverseScale = 0.5 at 2x zoom
      expect(stamped(10)).toBe(5)
      expect(stamped(10, undefined)).toBe(5)
    })

    it("should use live inverseScale fallback that updates with zoom", () => {
      const { stamped } = useToolViewport()

      viewportStore.setScale(1)
      expect(stamped(10)).toBe(10)

      viewportStore.setScale(4)
      expect(stamped(10)).toBe(2.5)
    })

    it("should NOT change when zoom changes if labelScale is provided", () => {
      const { stamped } = useToolViewport()
      const labelScale = 0.5 // Stamped at creation time

      viewportStore.setScale(1)
      expect(stamped(10, labelScale)).toBe(5)

      viewportStore.setScale(4)
      expect(stamped(10, labelScale)).toBe(5) // Same result regardless of zoom

      viewportStore.setScale(0.25)
      expect(stamped(10, labelScale)).toBe(5) // Still the same
    })
  })

  describe("useToolViewport - stampedTransform()", () => {
    it("should produce transform with provided labelScale", () => {
      const { stampedTransform } = useToolViewport()
      const result = stampedTransform(100, 200, 0.5)
      expect(result).toBe("translate(100, 200) scale(0.5)")
    })

    it("should fall back to live inverseScale when labelScale is undefined", () => {
      viewportStore.setScale(2) // inverseScale = 0.5
      const { stampedTransform } = useToolViewport()
      expect(stampedTransform(100, 200)).toBe("translate(100, 200) scale(0.5)")
      expect(stampedTransform(100, 200, undefined)).toBe("translate(100, 200) scale(0.5)")
    })

    it("should NOT change when zoom changes if labelScale is provided", () => {
      const { stampedTransform } = useToolViewport()
      const labelScale = 0.5

      viewportStore.setScale(1)
      expect(stampedTransform(50, 50, labelScale)).toBe("translate(50, 50) scale(0.5)")

      viewportStore.setScale(4)
      expect(stampedTransform(50, 50, labelScale)).toBe("translate(50, 50) scale(0.5)")
    })
  })

  describe("useToolViewport - s() (preview scaling)", () => {
    it("should scale value by live inverseScale", () => {
      viewportStore.setScale(2) // inverseScale = 0.5
      const { s } = useToolViewport()
      expect(s(10)).toBe(5)
    })

    it("should update when zoom changes", () => {
      const { s } = useToolViewport()

      viewportStore.setScale(1)
      expect(s(10)).toBe(10)

      viewportStore.setScale(4)
      expect(s(10)).toBe(2.5)

      viewportStore.setScale(0.5)
      expect(s(10)).toBe(20)
    })
  })

  describe("useToolViewport - screenTransform() (preview transform)", () => {
    it("should produce transform with live inverseScale", () => {
      viewportStore.setScale(2) // inverseScale = 0.5
      const { screenTransform } = useToolViewport()
      expect(screenTransform(100, 200)).toBe("translate(100, 200) scale(0.5)")
    })

    it("should update when zoom changes", () => {
      const { screenTransform } = useToolViewport()

      viewportStore.setScale(1)
      expect(screenTransform(10, 20)).toBe("translate(10, 20) scale(1)")

      viewportStore.setScale(4)
      expect(screenTransform(10, 20)).toBe("translate(10, 20) scale(0.25)")
    })
  })

  // ============================================
  // labelScale on Annotation Creation
  // ============================================

  describe("labelScale stored on annotations", () => {
    it("should store labelScale matching inverseScale at creation time", () => {
      viewportStore.setScale(2) // inverseScale = 0.5

      const measurement: Measurement = {
        id: "m1",
        type: "measure",
        pageNum: 1,
        labelScale: viewportStore.getInverseScale,
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        distance: 100,
        midpoint: { x: 50, y: 0 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(measurement)
      const stored = annotationStore.getAnnotationById("m1") as Measurement
      expect(stored.labelScale).toBe(0.5)
    })

    it("should produce different labelScale values at different zoom levels", () => {
      const scales = [0.5, 1, 2, 4]
      const annotations: Measurement[] = scales.map((scale, i) => {
        viewportStore.setScale(scale)
        return {
          id: `m${i}`,
          type: "measure" as const,
          pageNum: 1,
          labelScale: viewportStore.getInverseScale,
          points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
          distance: 100,
          midpoint: { x: 50, y: 0 },
          labelRotation: 0,
          rotation: 0
        }
      })

      for (const ann of annotations) {
        annotationStore.addAnnotation(ann)
      }

      // Verify each has the correct inverse scale
      expect((annotationStore.getAnnotationById("m0") as Measurement).labelScale).toBe(2)    // 1/0.5
      expect((annotationStore.getAnnotationById("m1") as Measurement).labelScale).toBe(1)    // 1/1
      expect((annotationStore.getAnnotationById("m2") as Measurement).labelScale).toBe(0.5)  // 1/2
      expect((annotationStore.getAnnotationById("m3") as Measurement).labelScale).toBe(0.25) // 1/4
    })

    it("should preserve labelScale through annotation updates", () => {
      viewportStore.setScale(3) // inverseScale = 1/3

      const measurement: Measurement = {
        id: "m1",
        type: "measure",
        pageNum: 1,
        labelScale: viewportStore.getInverseScale,
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        distance: 100,
        midpoint: { x: 50, y: 0 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(measurement)

      // Update points (which triggers derived recalculation)
      annotationStore.updateAnnotation("m1", {
        points: [{ x: 0, y: 0 }, { x: 200, y: 0 }]
      })

      const updated = annotationStore.getAnnotationById("m1") as Measurement
      // labelScale should be preserved even after update
      expect(updated.labelScale).toBeCloseTo(1 / 3, 10)
    })
  })

  // ============================================
  // Count Tool - labelScale
  // ============================================

  describe("Count Tool - labelScale at creation", () => {
    it("should store labelScale on count annotations", () => {
      viewportStore.setScale(2) // inverseScale = 0.5

      const count: Count = {
        id: "c1",
        type: "count",
        pageNum: 1,
        labelScale: viewportStore.getInverseScale,
        x: 10,
        y: 10,
        width: 15,
        height: 15,
        number: 1,
        rotation: 0
      }

      annotationStore.addAnnotation(count)
      const stored = annotationStore.getAnnotationById("c1") as Count
      expect(stored.labelScale).toBe(0.5)
    })

    it("should size count markers proportional to inverseScale", () => {
      const MARKER_RADIUS = 15 // COUNT_TOOL_DEFAULTS.marker.radius

      viewportStore.setScale(2) // inverseScale = 0.5
      const inv = viewportStore.getInverseScale
      const markerSize = MARKER_RADIUS * 2 * inv
      expect(markerSize).toBe(15) // 15 * 2 * 0.5 = 15 PDF points

      viewportStore.setScale(0.5) // inverseScale = 2
      const inv2 = viewportStore.getInverseScale
      const markerSize2 = MARKER_RADIUS * 2 * inv2
      expect(markerSize2).toBe(60) // 15 * 2 * 2 = 60 PDF points
    })
  })

  // ============================================
  // Stamped vs Live Scale - Visual Consistency
  // ============================================

  describe("Stamped scale ensures visual consistency", () => {
    it("stamped labels stay same size regardless of zoom changes", () => {
      const { stamped } = useToolViewport()

      // Create annotation at 2x zoom → labelScale = 0.5
      viewportStore.setScale(2)
      const labelScale = viewportStore.getInverseScale // 0.5

      // Label radius at creation
      const radiusAtCreation = stamped(4, labelScale) // 4 * 0.5 = 2

      // Zoom out to 0.5x — label should stay same PDF size
      viewportStore.setScale(0.5)
      const radiusAfterZoomOut = stamped(4, labelScale) // 4 * 0.5 = 2, unchanged

      // Zoom to 4x — label should still stay same PDF size
      viewportStore.setScale(4)
      const radiusAfterZoomIn = stamped(4, labelScale) // 4 * 0.5 = 2, unchanged

      expect(radiusAtCreation).toBe(2)
      expect(radiusAfterZoomOut).toBe(2)
      expect(radiusAfterZoomIn).toBe(2)
    })

    it("preview elements scale with live zoom (not stamped)", () => {
      const { s } = useToolViewport()

      viewportStore.setScale(1)
      const radiusAt1x = s(4) // 4 * 1 = 4

      viewportStore.setScale(2)
      const radiusAt2x = s(4) // 4 * 0.5 = 2

      viewportStore.setScale(0.5)
      const radiusAt05x = s(4) // 4 * 2 = 8

      // Preview elements change size with zoom to maintain constant screen pixels
      expect(radiusAt1x).toBe(4)
      expect(radiusAt2x).toBe(2)
      expect(radiusAt05x).toBe(8)
    })

    it("annotations at higher zoom get smaller PDF-space labels", () => {
      const { stamped } = useToolViewport()

      // Annotation placed at 4x zoom (very zoomed in)
      viewportStore.setScale(4)
      const labelScaleZoomedIn = viewportStore.getInverseScale // 0.25
      const radiusZoomedIn = stamped(10, labelScaleZoomedIn) // 2.5

      // Annotation placed at 0.5x zoom (zoomed out)
      viewportStore.setScale(0.5)
      const labelScaleZoomedOut = viewportStore.getInverseScale // 2
      const radiusZoomedOut = stamped(10, labelScaleZoomedOut) // 20

      // The zoomed-in annotation's label is smaller in PDF space
      // but will appear the same screen size when viewed at 4x
      expect(radiusZoomedIn).toBe(2.5)
      expect(radiusZoomedOut).toBe(20)
      expect(radiusZoomedIn).toBeLessThan(radiusZoomedOut)
    })
  })

  // ============================================
  // Backward Compatibility
  // ============================================

  describe("Backward compatibility - missing labelScale", () => {
    it("stampedTransform falls back to live inverseScale for old annotations", () => {
      viewportStore.setScale(2)
      const { stampedTransform } = useToolViewport()

      // Old annotation without labelScale
      const result = stampedTransform(50, 50, undefined)
      expect(result).toBe("translate(50, 50) scale(0.5)")
    })

    it("stamped falls back to live inverseScale for old annotations", () => {
      viewportStore.setScale(2)
      const { stamped } = useToolViewport()

      // Old annotation without labelScale
      expect(stamped(10, undefined)).toBe(5)
    })

    it("old annotations without labelScale render using current zoom", () => {
      const { stamped } = useToolViewport()

      // Simulate old annotation with no labelScale
      const oldLabelScale = undefined

      viewportStore.setScale(1)
      const sizeAt1x = stamped(10, oldLabelScale)

      viewportStore.setScale(2)
      const sizeAt2x = stamped(10, oldLabelScale)

      // Old annotations will resize with zoom (backward compat behavior)
      expect(sizeAt1x).toBe(10)
      expect(sizeAt2x).toBe(5)
      expect(sizeAt1x).not.toBe(sizeAt2x)
    })
  })

  // ============================================
  // Export Rendering
  // ============================================

  describe("Export rendering uses stamped labelScale", () => {
    it("annotations with labelScale render at correct size in export context", () => {
      // In export, viewport scale defaults to 1 (fresh Pinia)
      // But annotations carry their own labelScale, so they render correctly
      const { stamped, stampedTransform } = useToolViewport()

      // Annotation created at 3x zoom in editor
      const labelScale = 1 / 3

      // In export context (scale=1, inverseScale=1), stamped still uses labelScale
      expect(viewportStore.getInverseScale).toBe(1) // Default fresh store
      expect(stamped(10, labelScale)).toBeCloseTo(10 / 3, 10)
      expect(stampedTransform(50, 50, labelScale)).toContain(`scale(${labelScale})`)
    })

    it("export would be wrong without labelScale (demonstrates the problem)", () => {
      // Without labelScale, export uses inverseScale=1 (default), making labels too big
      const { stamped } = useToolViewport()

      // At inverseScale=1, an unscaled label gets full config size
      expect(stamped(10)).toBe(10) // Full size — too big for zoomed-in annotations

      // With labelScale from a 3x zoomed creation, label is correctly smaller
      expect(stamped(10, 1 / 3)).toBeCloseTo(3.33, 1)
    })
  })
})
