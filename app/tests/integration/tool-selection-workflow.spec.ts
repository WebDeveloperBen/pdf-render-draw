import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useAnnotationStore } from "~/stores/annotations"

// Mock debug utils
vi.mock("~/utils/debug", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn()
}))

describe("Tool Selection & Visual Feedback Workflow", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe("Tool Activation", () => {
    it("should activate measure tool and update active tool state", () => {
      const annotationStore = useAnnotationStore()

      // Initially in select mode
      expect(annotationStore.activeTool).toBe("")

      // Activate measure tool
      annotationStore.setActiveTool("measure")

      // Verify tool activation
      expect(annotationStore.activeTool).toBe("measure")
    })

    it("should activate area tool and update active tool state", () => {
      const annotationStore = useAnnotationStore()

      // Activate area tool
      annotationStore.setActiveTool("area")

      // Verify tool activation
      expect(annotationStore.activeTool).toBe("area")
    })

    it("should switch between tools correctly", () => {
      const annotationStore = useAnnotationStore()

      // Start with measure tool
      annotationStore.setActiveTool("measure")
      expect(annotationStore.activeTool).toBe("measure")

      // Switch to area tool
      annotationStore.setActiveTool("area")
      expect(annotationStore.activeTool).toBe("area")
    })

    it("should deactivate tool when switching to select mode", () => {
      const annotationStore = useAnnotationStore()

      // Activate measure tool
      annotationStore.setActiveTool("measure")
      expect(annotationStore.activeTool).toBe("measure")

      // Switch to select mode
      annotationStore.setActiveTool("selection")
      expect(annotationStore.activeTool).toBe("selection")
    })

    it("should clear selection when activating a tool", () => {
      const annotationStore = useAnnotationStore()

      // Add and select an annotation
      annotationStore.addAnnotation({
        id: "test-1",
        type: "measure",
        pageNum: 1,
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: 0
      })
      annotationStore.selectAnnotation("test-1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["test-1"])

      // Activate measure tool - should clear selection
      annotationStore.setActiveTool("measure")
      expect(annotationStore.selectedAnnotationIds).toEqual([])
      expect(annotationStore.activeTool).toBe("measure")
    })
  })

  describe("Tool State Management", () => {
    it("should reset drawing state when activating a tool", () => {
      const annotationStore = useAnnotationStore()

      // Simulate drawing state
      annotationStore.isDrawing = true

      // Activate measure tool
      annotationStore.setActiveTool("measure")

      // Verify drawing state is reset
      expect(annotationStore.isDrawing).toBe(false)
      expect(annotationStore.activeTool).toBe("measure")
    })

    it("should handle invalid tool activation gracefully", () => {
      const annotationStore = useAnnotationStore()

      // Try to activate invalid tool
      annotationStore.setActiveTool("invalid-tool" as any)

      // Should not crash, but tool state may not change as expected
      // The store should handle this gracefully
      expect(() => {
        annotationStore.setActiveTool("invalid-tool" as any)
      }).not.toThrow()
    })
  })

  describe("Tool Persistence", () => {
    it("should remember active tool across operations", () => {
      const annotationStore = useAnnotationStore()

      // Activate measure tool
      annotationStore.setActiveTool("measure")
      expect(annotationStore.activeTool).toBe("measure")

      // Perform some operation (like creating an annotation)
      annotationStore.addAnnotation({
        id: "test-1",
        type: "measure",
        pageNum: 1,
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: 0
      })

      // Tool should still be active
      expect(annotationStore.activeTool).toBe("measure")
    })


  })
})