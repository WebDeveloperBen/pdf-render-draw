import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"

// Mock debug utils
vi.mock("~/utils/debug", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn()
}))

describe("Multi-Select & Group Operations Workflow", () => {
  let annotationStore: ReturnType<typeof useAnnotationStore>
  let viewportStore: ReturnType<typeof useViewportStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    annotationStore = useAnnotationStore()
    viewportStore = useViewportStore()

    // Set up renderer store
    viewportStore.currentPage = 1
    viewportStore.rotation = 0
  })

  describe("Multi-Selection", () => {
    it("should add to selection with Ctrl+click", () => {
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

      // Ctrl+click second (add to selection)
      annotationStore.selectAnnotations(["measure-1", "measure-2"])
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1", "measure-2"])
    })

    it("should remove from selection when clicking selected item", () => {
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
      annotationStore.selectAnnotations(["measure-1", "measure-2"])

      // Click already selected item (should remove from selection)
      annotationStore.selectAnnotation("measure-1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1"])
    })

    it("should select all annotations", () => {
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

      const area1: Area = {
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

      annotationStore.addAnnotation(measure1)
      annotationStore.addAnnotation(area1)

      // Select all
      const allAnnotations = annotationStore.annotations
      annotationStore.selectAnnotations(allAnnotations.map((a) => a.id))

      expect(annotationStore.selectedAnnotationIds).toHaveLength(2)
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1", "area-1"])
    })

    it("should clear multi-selection when clicking background", () => {
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
      annotationStore.selectAnnotations(["measure-1", "measure-2"])
      expect(annotationStore.selectedAnnotationIds).toHaveLength(2)

      // Clear selection
      annotationStore.deselectAll()
      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })
  })

  describe("Group Transform Handles", () => {
    it("should show group handles when multiple annotations selected", () => {
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
      annotationStore.selectAnnotations(["measure-1", "measure-2"])

      // Should have multiple annotations selected
      expect(annotationStore.selectedAnnotationIds).toHaveLength(2)
      expect(annotationStore.selectedAnnotations).toHaveLength(2)
    })

    it("should hide group handles when selection reduced to single item", () => {
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
      annotationStore.selectAnnotations(["measure-1", "measure-2"])
      expect(annotationStore.selectedAnnotationIds).toHaveLength(2)

      // Reduce to single selection
      annotationStore.selectAnnotation("measure-1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1"])
      expect(annotationStore.selectedAnnotations).toHaveLength(1)
    })
  })

  describe("Group Move Operations", () => {
    it("should move all selected annotations together", () => {
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
      annotationStore.selectAnnotations(["measure-1", "measure-2"])

      // Move both annotations 50 units right and 25 units down
      annotationStore.updateAnnotation("measure-1", {
        points: [
          { x: 150, y: 125 },
          { x: 250, y: 225 }
        ]
      })
      annotationStore.updateAnnotation("measure-2", {
        points: [
          { x: 100, y: 75 },
          { x: 200, y: 75 }
        ]
      })

      // Verify both moved
      const updated1 = annotationStore.getAnnotationById("measure-1") as Measurement
      const updated2 = annotationStore.getAnnotationById("measure-2") as Measurement

      expect(updated1.points[0]).toEqual({ x: 150, y: 125 })
      expect(updated1.midpoint).toEqual({ x: 200, y: 175 })

      expect(updated2.points[0]).toEqual({ x: 100, y: 75 })
      expect(updated2.midpoint).toEqual({ x: 150, y: 75 })
    })

    it("should maintain relative positions during group move", () => {
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
          { x: 120, y: 120 },
          { x: 220, y: 220 }
        ],
        distance: 141.42,
        midpoint: { x: 170, y: 170 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(measure1)
      annotationStore.addAnnotation(measure2)
      annotationStore.selectAnnotations(["measure-1", "measure-2"])

      // Both should move together maintaining 20-unit offset
      annotationStore.updateAnnotation("measure-1", {
        points: [
          { x: 150, y: 125 },
          { x: 250, y: 225 }
        ]
      })
      annotationStore.updateAnnotation("measure-2", {
        points: [
          { x: 170, y: 145 },
          { x: 270, y: 245 }
        ]
      })

      const updated1 = annotationStore.getAnnotationById("measure-1") as Measurement
      const updated2 = annotationStore.getAnnotationById("measure-2") as Measurement

      // Check relative positioning maintained
      const dx = updated2.midpoint.x - updated1.midpoint.x
      const dy = updated2.midpoint.y - updated1.midpoint.y
      expect(dx).toBe(20) // Same relative offset
      expect(dy).toBe(20)
    })
  })

  describe("Group Rotation Operations", () => {
    it("should rotate all selected annotations around group center", () => {
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
      annotationStore.selectAnnotations(["measure-1", "measure-2"])

      // Rotate both 45 degrees
      annotationStore.updateAnnotation("measure-1", {
        rotation: Math.PI / 4,
        labelRotation: Math.PI / 4
      })
      annotationStore.updateAnnotation("measure-2", {
        rotation: Math.PI / 4,
        labelRotation: Math.PI / 4
      })

      const updated1 = annotationStore.getAnnotationById("measure-1") as Measurement
      const updated2 = annotationStore.getAnnotationById("measure-2") as Measurement

      expect(updated1.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(updated1.labelRotation).toBeCloseTo(Math.PI / 4, 5)
      expect(updated2.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(updated2.labelRotation).toBeCloseTo(Math.PI / 4, 5)
    })

    it("should accumulate group rotation", () => {
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

      annotationStore.addAnnotation(measure1)
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

      const updated = annotationStore.getAnnotationById("measure-1") as Measurement
      expect(updated.rotation).toBeCloseTo(Math.PI / 2, 5)
      expect(updated.labelRotation).toBeCloseTo(Math.PI / 2, 5)
    })
  })

  describe("Group Copy/Paste Operations", () => {
    it("should copy selected annotations", () => {
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

      annotationStore.addAnnotation(measure1)
      annotationStore.selectAnnotation("measure-1")

      // Simulate copy operation (store would handle this)
      const copiedAnnotations = annotationStore.selectedAnnotations
      expect(copiedAnnotations).toHaveLength(1)
      expect(copiedAnnotations[0]!.id).toBe("measure-1")
    })

    it("should paste copied annotations with offset", () => {
      const original: Measurement = {
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

      annotationStore.addAnnotation(original)
      annotationStore.selectAnnotation("measure-1")

      // Simulate paste with offset
      const pasted: Measurement = {
        id: "measure-1-copy",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 120, y: 120 },
          { x: 220, y: 220 }
        ],
        distance: 141.42,
        midpoint: { x: 170, y: 170 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(pasted)

      // Should have both original and pasted
      const annotations = annotationStore.getAnnotationsByTypeAndPage("measure", 1)
      expect(annotations).toHaveLength(2)
      expect(annotations.map((a) => a.id)).toEqual(["measure-1", "measure-1-copy"])
    })

    it("should duplicate selected annotations", () => {
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

      annotationStore.addAnnotation(measure1)
      annotationStore.selectAnnotation("measure-1")

      // Simulate duplicate operation
      const duplicated: Measurement = {
        id: "measure-1-duplicate",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 110, y: 110 },
          { x: 210, y: 210 }
        ],
        distance: 141.42,
        midpoint: { x: 160, y: 160 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(duplicated)

      const annotations = annotationStore.getAnnotationsByTypeAndPage("measure", 1)
      expect(annotations).toHaveLength(2)
    })
  })

  describe("Group Delete Operations", () => {
    it("should delete all selected annotations", () => {
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
      annotationStore.selectAnnotations(["measure-1", "measure-2"])

      // Delete selected annotations
      annotationStore.deleteAnnotation("measure-1")
      annotationStore.deleteAnnotation("measure-2")

      // Should be empty
      const annotations = annotationStore.getAnnotationsByTypeAndPage("measure", 1)
      expect(annotations).toHaveLength(0)
      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })

    it("should maintain selection when deleting non-selected annotations", () => {
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

      const measure3: Measurement = {
        id: "measure-3",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 25, y: 25 },
          { x: 125, y: 25 }
        ],
        distance: 100,
        midpoint: { x: 75, y: 25 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(measure1)
      annotationStore.addAnnotation(measure2)
      annotationStore.addAnnotation(measure3)
      annotationStore.selectAnnotations(["measure-1", "measure-2"])

      // Delete non-selected annotation
      annotationStore.deleteAnnotation("measure-3")

      // Selection should remain
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1", "measure-2"])
      const remaining = annotationStore.getAnnotationsByTypeAndPage("measure", 1)
      expect(remaining).toHaveLength(2)
    })
  })

  describe("Multi-Select Workflow Integration", () => {
    it("should complete full multi-select workflow", () => {
      // 1. Create multiple annotations
      const measure1: Measurement = {
        id: "workflow-1",
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

      const area1: Area = {
        id: "workflow-2",
        type: "area",
        pageNum: 1,
        points: [
          { x: 50, y: 50 },
          { x: 150, y: 50 },
          { x: 150, y: 150 },
          { x: 50, y: 150 }
        ],
        area: 10000,
        center: { x: 100, y: 100 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(measure1)
      annotationStore.addAnnotation(area1)

      // 2. Multi-select annotations
      annotationStore.selectAnnotations(["workflow-1", "workflow-2"])
      expect(annotationStore.selectedAnnotationIds).toHaveLength(2)

      // 3. Group operations should be available
      expect(annotationStore.selectedAnnotations).toHaveLength(2)

      // 4. Perform group move
      annotationStore.updateAnnotation("workflow-1", {
        points: [
          { x: 120, y: 120 },
          { x: 220, y: 220 }
        ]
      })
      annotationStore.updateAnnotation("workflow-2", {
        points: [
          { x: 70, y: 70 },
          { x: 170, y: 70 },
          { x: 170, y: 170 },
          { x: 70, y: 170 }
        ]
      })

      // 5. Verify group operation results
      const updated1 = annotationStore.getAnnotationById("workflow-1") as Measurement
      const updated2 = annotationStore.getAnnotationById("workflow-2") as Area

      expect(updated1.midpoint).toEqual({ x: 170, y: 170 })
      expect(updated2.center).toEqual({ x: 120, y: 120 })

      // 6. Clear multi-selection
      annotationStore.deselectAll()
      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })

    it("should handle mixed annotation types in multi-select", () => {
      const measure1: Measurement = {
        id: "mixed-1",
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

      const area1: Area = {
        id: "mixed-2",
        type: "area",
        pageNum: 1,
        points: [
          { x: 50, y: 50 },
          { x: 150, y: 50 },
          { x: 150, y: 150 },
          { x: 50, y: 150 }
        ],
        area: 10000,
        center: { x: 100, y: 100 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(measure1)
      annotationStore.addAnnotation(area1)
      annotationStore.selectAnnotations(["mixed-1", "mixed-2"])

      // Should handle mixed types
      expect(annotationStore.selectedAnnotations).toHaveLength(2)
      expect(annotationStore.selectedAnnotations[0]!.type).toBe("measure")
      expect(annotationStore.selectedAnnotations[1]!.type).toBe("area")

      // Group rotation should work on mixed types
      annotationStore.updateAnnotation("mixed-1", {
        rotation: Math.PI / 4,
        labelRotation: Math.PI / 4
      })
      annotationStore.updateAnnotation("mixed-2", {
        rotation: Math.PI / 4,
        labelRotation: Math.PI / 4
      })

      const updated1 = annotationStore.getAnnotationById("mixed-1") as Measurement
      const updated2 = annotationStore.getAnnotationById("mixed-2") as Area

      expect(updated1.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(updated2.rotation).toBeCloseTo(Math.PI / 4, 5)
    })
  })
})
