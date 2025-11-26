import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"

// Mock debug utils
vi.mock("~/utils/debug", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn()
}))

describe("Drawing Workflow & Visual Feedback", () => {
  let annotationStore: ReturnType<typeof useAnnotationStore>
  let viewportStore: ReturnType<typeof useViewportStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    annotationStore = useAnnotationStore()
    viewportStore = useViewportStore()

    // Set up renderer store for current page
    viewportStore.currentPage = 1
    viewportStore.rotation = 0
  })

  describe("Tool Activation for Drawing", () => {
    it("should activate measure tool and prepare for drawing", () => {
      // Initially no active tool
      expect(annotationStore.activeTool).toBe("")

      // Activate measure tool
      annotationStore.setActiveTool("measure")

      // Should be ready for drawing
      expect(annotationStore.activeTool).toBe("measure")
      expect(annotationStore.isDrawing).toBe(false)
    })

    it("should activate area tool and prepare for drawing", () => {
      annotationStore.setActiveTool("area")
      expect(annotationStore.activeTool).toBe("area")
      expect(annotationStore.isDrawing).toBe(false)
    })

    it("should clear selection when activating drawing tools", () => {
      // Add and select an annotation
      const measurement: Measurement = {
        id: "test-measure",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: 0
      }
      annotationStore.addAnnotation(measurement)
      annotationStore.selectAnnotation("test-measure")
      expect(annotationStore.selectedAnnotationIds).toEqual(["test-measure"])

      // Activate measure tool
      annotationStore.setActiveTool("measure")

      // Selection should be cleared
      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })
  })

  describe("Drawing State Management", () => {
    it("should start drawing when tool becomes active and first point is added", () => {
      annotationStore.setActiveTool("measure")

      // Simulate what happens when user clicks first point
      annotationStore.isDrawing = true

      expect(annotationStore.isDrawing).toBe(true)
      expect(annotationStore.activeTool).toBe("measure")
    })

    it("should complete drawing and create annotation", () => {
      annotationStore.setActiveTool("measure")
      annotationStore.isDrawing = true

      // Simulate completing a measurement
      const measurement: Measurement = {
        id: "new-measure",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(measurement)

      // Drawing should complete
      annotationStore.isDrawing = false

      expect(annotationStore.isDrawing).toBe(false)

      // Annotation should be created
      const annotations = annotationStore.getAnnotationsByTypeAndPage("measure", 1)
      expect(annotations).toHaveLength(1)
      expect(annotations[0]).toEqual(measurement)
    })

    it("should cancel drawing when switching tools", () => {
      annotationStore.setActiveTool("measure")
      annotationStore.isDrawing = true

      // Switch to area tool
      annotationStore.setActiveTool("area")

      // Drawing should be cancelled
      expect(annotationStore.isDrawing).toBe(false)
      expect(annotationStore.activeTool).toBe("area")
    })

    it("should cancel drawing with escape", () => {
      annotationStore.setActiveTool("measure")
      annotationStore.isDrawing = true

      // Simulate escape key (this would be handled by composable)
      annotationStore.isDrawing = false

      expect(annotationStore.isDrawing).toBe(false)
      expect(annotationStore.activeTool).toBe("measure") // Tool stays active
    })
  })

  describe("Annotation Creation During Drawing", () => {
    it("should create measurement annotation with correct properties", () => {
      const measurement: Measurement = {
        id: "measure-1",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 50, y: 50 },
          { x: 150, y: 50 }
        ],
        distance: 100,
        midpoint: { x: 100, y: 50 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(measurement)

      const annotations = annotationStore.getAnnotationsByTypeAndPage("measure", 1)
      expect(annotations).toHaveLength(1)

      const created = annotations[0]! as Measurement
      expect(created.id).toBe("measure-1")
      expect(created.type).toBe("measure")
      expect(created.pageNum).toBe(1)
      expect(created.points).toEqual([
        { x: 50, y: 50 },
        { x: 150, y: 50 }
      ])
      expect(created.distance).toBe(100)
      expect(created.midpoint).toEqual({ x: 100, y: 50 })
      expect(created.labelRotation).toBe(0)
      expect(created.rotation).toBe(0)
    })

    it("should create area annotation with correct properties", () => {
      const area: Area = {
        id: "area-1",
        type: "area",
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 200, y: 200 },
          { x: 100, y: 200 }
        ],
        area: 10000,
        center: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(area)

      const annotations = annotationStore.getAnnotationsByTypeAndPage("area", 1)
      expect(annotations).toHaveLength(1)

      const created = annotations[0]! as Area
      expect(created.id).toBe("area-1")
      expect(created.type).toBe("area")
      expect(created.pageNum).toBe(1)
      expect(created.points).toHaveLength(4)
      expect(created.area).toBe(10000)
      expect(created.center).toEqual({ x: 150, y: 150 })
    })

    it("should filter annotations by page correctly", () => {
      // Add annotations to different pages
      const measurePage1: Measurement = {
        id: "measure-page1",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        distance: 100,
        midpoint: { x: 50, y: 0 },
        labelRotation: 0,
        rotation: 0
      }

      const measurePage2: Measurement = {
        id: "measure-page2",
        type: "measure",
        pageNum: 2,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        distance: 100,
        midpoint: { x: 50, y: 0 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(measurePage1)
      annotationStore.addAnnotation(measurePage2)

      // Should only show page 1 annotations
      const page1Annotations = annotationStore.getAnnotationsByTypeAndPage("measure", 1)
      expect(page1Annotations).toHaveLength(1)
      expect(page1Annotations[0]!.id).toBe("measure-page1")

      const page2Annotations = annotationStore.getAnnotationsByTypeAndPage("measure", 2)
      expect(page2Annotations).toHaveLength(1)
      expect(page2Annotations[0]!.id).toBe("measure-page2")
    })
  })

  describe("Drawing Workflow Integration", () => {
    it("should maintain tool state throughout drawing workflow", () => {
      // 1. Activate tool
      annotationStore.setActiveTool("measure")
      expect(annotationStore.activeTool).toBe("measure")
      expect(annotationStore.isDrawing).toBe(false)

      // 2. Start drawing (first click)
      annotationStore.isDrawing = true
      expect(annotationStore.isDrawing).toBe(true)

      // 3. Complete drawing (second click)
      const measurement: Measurement = {
        id: "workflow-measure",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 10, y: 10 },
          { x: 110, y: 10 }
        ],
        distance: 100,
        midpoint: { x: 60, y: 10 },
        labelRotation: 0,
        rotation: 0
      }
      annotationStore.addAnnotation(measurement)
      annotationStore.isDrawing = false

      // 4. Verify completion
      expect(annotationStore.isDrawing).toBe(false)
      expect(annotationStore.activeTool).toBe("measure") // Tool remains active

      const annotations = annotationStore.getAnnotationsByTypeAndPage("measure", 1)
      expect(annotations).toHaveLength(1)
    })

    it("should handle multiple annotations in sequence", () => {
      annotationStore.setActiveTool("measure")

      // First measurement
      const measure1: Measurement = {
        id: "measure-1",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        distance: 100,
        midpoint: { x: 50, y: 0 },
        labelRotation: 0,
        rotation: 0
      }
      annotationStore.addAnnotation(measure1)

      // Second measurement
      const measure2: Measurement = {
        id: "measure-2",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 0, y: 100 },
          { x: 0, y: 200 }
        ],
        distance: 100,
        midpoint: { x: 0, y: 150 },
        labelRotation: 0,
        rotation: 0
      }
      annotationStore.addAnnotation(measure2)

      const annotations = annotationStore.getAnnotationsByTypeAndPage("measure", 1)
      expect(annotations).toHaveLength(2)
      expect(annotations.map((a) => a.id)).toEqual(["measure-1", "measure-2"])
    })

    it("should handle tool switching during workflow", () => {
      // Start with measure tool
      annotationStore.setActiveTool("measure")
      annotationStore.isDrawing = true

      // Switch to area tool mid-drawing
      annotationStore.setActiveTool("area")

      // Drawing should be cancelled, new tool active
      expect(annotationStore.isDrawing).toBe(false)
      expect(annotationStore.activeTool).toBe("area")

      // Can start drawing with new tool
      annotationStore.isDrawing = true
      expect(annotationStore.isDrawing).toBe(true)
      expect(annotationStore.activeTool).toBe("area")
    })
  })
})

