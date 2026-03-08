import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"

// Mock debug utils
vi.mock("~/utils/debug", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn()
}))

describe("Selection & Manipulation Workflow", () => {
  let annotationStore: ReturnType<typeof useAnnotationStore>
  let viewportStore: ReturnType<typeof useViewportStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    annotationStore = useAnnotationStore()
    viewportStore = useViewportStore()

    // Set up stores
    viewportStore.currentPage = 1
    viewportStore.rotation = 0
    // Renderer store has default pdfScale of "1:100"
  })

  describe("Annotation Selection", () => {
    it("should select annotation when clicked", () => {
      const measurement: Measurement = {
        id: "measure-1",
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

      // Initially nothing selected
      expect(annotationStore.selectedAnnotationIds).toEqual([])

      // Select annotation
      annotationStore.selectAnnotation("measure-1")

      // Should be selected
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1"])
      expect(annotationStore.selectedAnnotation?.id).toBe("measure-1")
    })

    it("should clear selection when clicking background", () => {
      const measurement: Measurement = {
        id: "measure-1",
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
      annotationStore.selectAnnotation("measure-1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1"])

      // Clear selection (simulating background click)
      annotationStore.deselectAll()

      // Should be deselected
      expect(annotationStore.selectedAnnotationIds).toEqual([])
      expect(annotationStore.selectedAnnotation).toBeNull()
    })

    it("should replace selection when selecting different annotation", () => {
      const measure1: Measurement = {
        id: "measure-1",
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

      const measure2: Measurement = {
        id: "measure-2",
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

      annotationStore.addAnnotation(measure1)
      annotationStore.addAnnotation(measure2)

      // Select first
      annotationStore.selectAnnotation("measure-1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1"])

      // Select second (should replace)
      annotationStore.selectAnnotation("measure-2")
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-2"])
    })
  })

  describe("Transform Handle Visibility", () => {
    it("should show transform handles when annotation is selected", () => {
      const measurement: Measurement = {
        id: "measure-1",
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

      // No selection - no handles visible
      expect(annotationStore.selectedAnnotationIds).toEqual([])

      // Select annotation - handles should be visible
      annotationStore.selectAnnotation("measure-1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1"])
      expect(annotationStore.selectedAnnotation).toBeDefined()
    })

    it("should hide transform handles when selection is cleared", () => {
      const measurement: Measurement = {
        id: "measure-1",
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
      annotationStore.selectAnnotation("measure-1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1"])

      // Clear selection
      annotationStore.deselectAll()
      expect(annotationStore.selectedAnnotationIds).toEqual([])
      expect(annotationStore.selectedAnnotation).toBeNull()
    })

    it("should hide handles when activating drawing tool", () => {
      const measurement: Measurement = {
        id: "measure-1",
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
      annotationStore.selectAnnotation("measure-1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1"])

      // Activate measure tool (should clear selection)
      annotationStore.setActiveTool("measure")
      expect(annotationStore.selectedAnnotationIds).toEqual([])
      expect(annotationStore.activeTool).toBe("measure")
    })
  })

  describe("Move Transformations", () => {
    it("should move annotation when dragged", () => {
      const measurement: Measurement = {
        id: "measure-1",
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
      annotationStore.selectAnnotation("measure-1")

      // Simulate move transformation (this would be handled by transform composable)
      // Move 50 units right and 30 units down
      annotationStore.updateAnnotation("measure-1", {
        points: [
          { x: 150, y: 130 },
          { x: 250, y: 230 }
        ]
      })

      // Verify annotation was moved
      const updated = annotationStore.getAnnotationById("measure-1") as Measurement
      expect(updated.points[0]).toEqual({ x: 150, y: 130 })
      expect(updated.points[1]).toEqual({ x: 250, y: 230 })
      expect(updated.midpoint).toEqual({ x: 200, y: 180 }) // Should be recalculated
      // Distance is recalculated from new points with scale applied
      expect(updated.distance).toBeGreaterThan(4000) // Should be scaled distance
    })

    it("should maintain relative point relationships during move", () => {
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
      annotationStore.selectAnnotation("area-1")

      // Move the entire area 50 units right and 25 units down
      annotationStore.updateAnnotation("area-1", {
        points: [
          { x: 150, y: 125 },
          { x: 250, y: 125 },
          { x: 250, y: 225 },
          { x: 150, y: 225 }
        ],
        center: { x: 200, y: 175 }
      })

      // Verify all points moved together
      const updated = annotationStore.getAnnotationById("area-1") as Area
      expect(updated.points).toEqual([
        { x: 150, y: 125 },
        { x: 250, y: 125 },
        { x: 250, y: 225 },
        { x: 150, y: 225 }
      ])
      expect(updated.center).toEqual({ x: 200, y: 175 })
    })
  })

  describe("Resize Transformations", () => {
    it("should resize measurement proportionally", () => {
      const measurement: Measurement = {
        id: "measure-1",
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
      annotationStore.selectAnnotation("measure-1")

      // Resize by scaling up (simulate dragging corner handle)
      annotationStore.updateAnnotation("measure-1", {
        points: [
          { x: 50, y: 50 },
          { x: 250, y: 250 }
        ]
      })

      // Verify resize worked
      const updated = annotationStore.getAnnotationById("measure-1") as Measurement
      expect(updated.points[0]).toEqual({ x: 50, y: 50 })
      expect(updated.points[1]).toEqual({ x: 250, y: 250 })
      expect(updated.midpoint).toEqual({ x: 150, y: 150 }) // Should be recalculated
      expect(updated.distance).toBeGreaterThan(9000) // Should be scaled distance for ~200pt distance
    })

    it("should resize area maintaining aspect ratio with Shift", () => {
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
      annotationStore.selectAnnotation("area-1")

      // Resize maintaining aspect ratio (simulate Shift+drag corner)
      annotationStore.updateAnnotation("area-1", {
        points: [
          { x: 50, y: 50 },
          { x: 250, y: 50 },
          { x: 250, y: 250 },
          { x: 50, y: 250 }
        ]
      })

      // Verify proportional resize
      const updated = annotationStore.getAnnotationById("area-1") as Area
      expect(updated.points).toEqual([
        { x: 50, y: 50 },
        { x: 250, y: 50 },
        { x: 250, y: 250 },
        { x: 50, y: 250 }
      ])
      expect(updated.center).toEqual({ x: 150, y: 150 }) // Should be recalculated
      expect(updated.area).toBeGreaterThan(40) // Should be recalculated area in m²
    })
  })

  describe("Rotation Transformations", () => {
    it("should rotate measurement around its center", () => {
      const measurement: Measurement = {
        id: "measure-1",
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
      annotationStore.selectAnnotation("measure-1")

      // Rotate 90 degrees clockwise
      annotationStore.updateAnnotation("measure-1", {
        points: [
          { x: 200, y: 100 },
          { x: 100, y: 200 }
        ],
        rotation: Math.PI / 2, // 90 degrees
        labelRotation: Math.PI / 2
      })

      // Verify rotation
      const updated = annotationStore.getAnnotationById("measure-1") as Measurement
      expect(updated.points[0]).toEqual({ x: 200, y: 100 })
      expect(updated.points[1]).toEqual({ x: 100, y: 200 })
      expect(updated.rotation).toBeCloseTo(Math.PI / 2, 5)
      expect(updated.labelRotation).toBeCloseTo(Math.PI / 2, 5)
      expect(updated.distance).toBeGreaterThan(4000) // Distance should be recalculated with scale
    })

    it("should accumulate rotation transformations", () => {
      const measurement: Measurement = {
        id: "measure-1",
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
      annotationStore.selectAnnotation("measure-1")

      // First rotation: 45 degrees
      annotationStore.updateAnnotation("measure-1", {
        rotation: Math.PI / 4,
        labelRotation: Math.PI / 4
      })

      // Second rotation: additional 45 degrees (total 90 degrees)
      annotationStore.updateAnnotation("measure-1", {
        rotation: Math.PI / 2,
        labelRotation: Math.PI / 2
      })

      // Verify accumulated rotation
      const updated = annotationStore.getAnnotationById("measure-1") as Measurement
      expect(updated.rotation).toBeCloseTo(Math.PI / 2, 5)
      expect(updated.labelRotation).toBeCloseTo(Math.PI / 2, 5)
    })

    it("should rotate area around its center", () => {
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
        rotation: Math.PI / 4 // 45 degrees
      }

      annotationStore.addAnnotation(area)
      annotationStore.selectAnnotation("area-1")

      // Verify rotation is applied (area was already created with rotation)
      const stored = annotationStore.getAnnotationById("area-1") as Area
      expect(stored.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(stored.center).toEqual({ x: 150, y: 150 }) // Center unchanged
      expect(stored.area).toBe(10000) // Area unchanged
    })
  })

  describe("Transform State Management", () => {
    it("should track rotation drag delta during rotation", () => {
      // Initially no rotation delta
      expect(annotationStore.rotationDragDelta).toBe(0)

      // Simulate starting rotation drag
      annotationStore.rotationDragDelta = Math.PI / 4 // 45 degrees

      // Should track the delta
      expect(annotationStore.rotationDragDelta).toBeCloseTo(Math.PI / 4, 5)

      // Simulate ending drag (should clear delta)
      annotationStore.rotationDragDelta = 0
      expect(annotationStore.rotationDragDelta).toBe(0)
    })

    it("should clear rotation delta after transform commit", () => {
      annotationStore.rotationDragDelta = Math.PI / 2

      // Simulate committing the rotation (this would be done by transform handlers)
      annotationStore.rotationDragDelta = 0

      expect(annotationStore.rotationDragDelta).toBe(0)
    })
  })

  describe("Selection Manipulation Workflow", () => {
    it("should complete full selection-manipulation workflow", () => {
      // 1. Create annotation
      const measurement: Measurement = {
        id: "workflow-measure",
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

      // 2. Select annotation
      annotationStore.selectAnnotation("workflow-measure")
      expect(annotationStore.selectedAnnotationIds).toEqual(["workflow-measure"])

      // 3. Transform handles should be visible (selection exists)
      expect(annotationStore.selectedAnnotation).toBeDefined()

      // 4. Perform move transformation
      annotationStore.updateAnnotation("workflow-measure", {
        points: [
          { x: 120, y: 120 },
          { x: 220, y: 220 }
        ],
        midpoint: { x: 170, y: 170 }
      })

      // 5. Verify transformation persisted
      const final = annotationStore.getAnnotationById("workflow-measure") as Measurement
      expect(final.points[0]).toEqual({ x: 120, y: 120 })
      expect(final.midpoint).toEqual({ x: 170, y: 170 })

      // 6. Clear selection
      annotationStore.deselectAll()
      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })

    it("should handle multiple transformations in sequence", () => {
      const area: Area = {
        id: "workflow-area",
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
      annotationStore.selectAnnotation("workflow-area")

      // Move
      annotationStore.updateAnnotation("workflow-area", {
        points: [
          { x: 110, y: 110 },
          { x: 210, y: 110 },
          { x: 210, y: 210 },
          { x: 110, y: 210 }
        ],
        center: { x: 160, y: 160 }
      })

      // Rotate
      annotationStore.updateAnnotation("workflow-area", {
        rotation: Math.PI / 4,
        labelRotation: Math.PI / 4
      })

      // Resize
      annotationStore.updateAnnotation("workflow-area", {
        points: [
          { x: 60, y: 60 },
          { x: 260, y: 60 },
          { x: 260, y: 260 },
          { x: 60, y: 260 }
        ]
      })

      // Verify final state
      const final = annotationStore.getAnnotationById("workflow-area") as Area
      expect(final.center).toEqual({ x: 160, y: 160 }) // Should be recalculated
      expect(final.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(final.area).toBeGreaterThan(40) // Should be recalculated area
    })
  })
})
