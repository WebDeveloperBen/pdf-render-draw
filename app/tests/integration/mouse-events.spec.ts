import { describe, it, expect, beforeEach } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import type { Measurement } from "~/types/annotations"

describe("Mouse Events Integration", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe("Annotation Selection", () => {
    it("should select annotation on click", () => {
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: "measure-1",
        type: "measure",
        pageNum: 1,
        rotation: 0,
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0
      }

      annotationStore.addAnnotation(measurement)

      // Simulate clicking on the annotation
      annotationStore.selectAnnotation("measure-1")

      expect(annotationStore.selectedAnnotationId).toBe("measure-1")
    })

    it("should deselect on background click", () => {
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: "measure-1",
        type: "measure",
        pageNum: 1,
        rotation: 0,
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0
      }

      annotationStore.addAnnotation(measurement)
      annotationStore.selectAnnotation("measure-1")

      expect(annotationStore.selectedAnnotationId).toBe("measure-1")

      // Simulate clicking on background (no annotation)
      annotationStore.selectAnnotation(null)

      expect(annotationStore.selectedAnnotationId).toBeNull()
    })

    it("should add to multi-selection with modifier key", () => {
      const annotationStore = useAnnotationStore()

      const measure1: Measurement = {
        id: "measure-1",
        type: "measure",
        pageNum: 1,
        rotation: 0,
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0
      }

      const measure2: Measurement = {
        id: "measure-2",
        type: "measure",
        pageNum: 1,
        rotation: 0,
        points: [{ x: 300, y: 300 }, { x: 400, y: 400 }],
        distance: 141.42,
        midpoint: { x: 350, y: 350 },
        labelRotation: 0
      }

      annotationStore.addAnnotation(measure1)
      annotationStore.addAnnotation(measure2)

      // Select first annotation
      annotationStore.selectAnnotation("measure-1", { addToSelection: false })
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1"])

      // Add second annotation to selection
      annotationStore.selectAnnotation("measure-2", { addToSelection: true })
      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1", "measure-2"])
    })

    it("should clear multi-selection on background click", () => {
      const annotationStore = useAnnotationStore()

      const measure1: Measurement = {
        id: "measure-1",
        type: "measure",
        pageNum: 1,
        rotation: 0,
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0
      }

      const measure2: Measurement = {
        id: "measure-2",
        type: "measure",
        pageNum: 1,
        rotation: 0,
        points: [{ x: 300, y: 300 }, { x: 400, y: 400 }],
        distance: 141.42,
        midpoint: { x: 350, y: 350 },
        labelRotation: 0
      }

      annotationStore.addAnnotation(measure1)
      annotationStore.addAnnotation(measure2)

      // Select both annotations
      annotationStore.selectAnnotation("measure-1", { addToSelection: false })
      annotationStore.selectAnnotation("measure-2", { addToSelection: true })

      expect(annotationStore.selectedAnnotationIds).toEqual(["measure-1", "measure-2"])

      // Click on background should clear selection
      annotationStore.selectAnnotation(null)

      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })
  })

  describe("Selection State Management", () => {
    it("should maintain selection state across operations", () => {
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: "measure-1",
        type: "measure",
        pageNum: 1,
        rotation: 0,
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0
      }

      annotationStore.addAnnotation(measurement)

      // Select annotation
      annotationStore.selectAnnotation("measure-1")
      expect(annotationStore.selectedAnnotationId).toBe("measure-1")
      expect(annotationStore.selectedAnnotation).toEqual(measurement)

      // Update annotation (should maintain selection)
      annotationStore.updateAnnotation("measure-1", { rotation: 45 })
      expect(annotationStore.selectedAnnotationId).toBe("measure-1")
      expect(annotationStore.selectedAnnotation?.rotation).toBe(45)

      // Delete annotation (should clear selection)
      annotationStore.deleteAnnotation("measure-1")
      expect(annotationStore.selectedAnnotationId).toBeNull()
      expect(annotationStore.selectedAnnotation).toBeNull()
    })
  })
})