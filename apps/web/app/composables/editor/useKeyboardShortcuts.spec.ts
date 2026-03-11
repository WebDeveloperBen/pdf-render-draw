import { describe, it, expect, beforeEach } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useKeyboardShortcuts } from "./useKeyboardShortcuts"
import { useAnnotationStore } from "~/stores/annotations"
import { useViewportStore } from "~/stores/viewport"

describe("Keyboard Shortcuts", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe("Paste at Cursor", () => {
    it("should paste annotation at cursor position when cursor position is available", () => {
      const annotationStore = useAnnotationStore()
      const viewportStore = useViewportStore()
      const shortcuts = useKeyboardShortcuts()

      // Create an annotation at position (100, 100) to (200, 200)
      const originalAnnotation: Measurement = {
        id: "test-1",
        type: "measure",
        rotation: 0,
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0
      }

      annotationStore.addAnnotation(originalAnnotation)
      annotationStore.selectAnnotation("test-1")

      // Copy annotation to clipboard
      shortcuts.clipboard.value = JSON.parse(JSON.stringify(annotationStore.selectedAnnotation))

      // Set cursor position to (400, 400)
      viewportStore.setLastCursorPosition({ x: 400, y: 400 })

      // Paste annotation
      shortcuts.pasteAnnotation()

      // Get the pasted annotation (should be the second one)
      expect(annotationStore.annotations.length).toBe(2)
      const pastedAnnotation = annotationStore.annotations[1] as Measurement

      // Calculate the center of the pasted annotation
      const pastedCenterX = (pastedAnnotation.points[0].x + pastedAnnotation.points[1].x) / 2
      const pastedCenterY = (pastedAnnotation.points[0].y + pastedAnnotation.points[1].y) / 2

      // The center should be at the cursor position (400, 400)
      expect(pastedCenterX).toBeCloseTo(400, 1)
      expect(pastedCenterY).toBeCloseTo(400, 1)

      // Verify it has a new ID
      expect(pastedAnnotation.id).not.toBe("test-1")

      // Verify it's selected
      expect(annotationStore.selectedAnnotationId).toBe(pastedAnnotation.id)
    })

    it("should paste annotation with default offset when no cursor position", () => {
      const annotationStore = useAnnotationStore()
      const shortcuts = useKeyboardShortcuts()

      // Create an annotation
      const originalAnnotation: Measurement = {
        id: "test-2",
        rotation: 0,
        type: "measure",
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0
      }

      annotationStore.addAnnotation(originalAnnotation)
      annotationStore.selectAnnotation("test-2")

      // Copy annotation
      shortcuts.clipboard.value = JSON.parse(JSON.stringify(annotationStore.selectedAnnotation))

      // Don't set cursor position (defaults to null)

      // Paste annotation
      shortcuts.pasteAnnotation()

      // Get the pasted annotation
      expect(annotationStore.annotations.length).toBe(2)
      const pastedAnnotation = annotationStore.annotations[1] as Measurement

      // Should be offset by default 20px
      expect(pastedAnnotation.points[0].x).toBe(120)
      expect(pastedAnnotation.points[0].y).toBe(120)
      expect(pastedAnnotation.points[1].x).toBe(220)
      expect(pastedAnnotation.points[1].y).toBe(220)
    })

    it("should paste area annotation at cursor position", () => {
      const annotationStore = useAnnotationStore()
      const viewportStore = useViewportStore()
      const shortcuts = useKeyboardShortcuts()

      // Create an area annotation (triangle)
      const originalAnnotation: Area = {
        id: "test-3",
        type: "area",
        pageNum: 1,
        rotation: 0,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 150, y: 200 }
        ],
        area: 5000,
        center: { x: 150, y: 133.33 },
        labelRotation: 0
      }

      annotationStore.addAnnotation(originalAnnotation)
      annotationStore.selectAnnotation("test-3")

      // Copy annotation
      shortcuts.clipboard.value = JSON.parse(JSON.stringify(annotationStore.selectedAnnotation))

      // Set cursor position to (500, 500)
      viewportStore.setLastCursorPosition({ x: 500, y: 500 })

      // Paste annotation
      shortcuts.pasteAnnotation()

      // Get the pasted annotation
      expect(annotationStore.annotations.length).toBe(2)
      const pastedAnnotation = annotationStore.annotations[1] as Area

      // Calculate the centroid of the pasted annotation
      const sumX = pastedAnnotation.points.reduce((sum, p) => sum + p.x, 0)
      const sumY = pastedAnnotation.points.reduce((sum, p) => sum + p.y, 0)
      const centerX = sumX / pastedAnnotation.points.length
      const centerY = sumY / pastedAnnotation.points.length

      // The center should be at the cursor position (500, 500)
      expect(centerX).toBeCloseTo(500, 1)
      expect(centerY).toBeCloseTo(500, 1)
    })
  })

  describe("Duplicate Annotation", () => {
    it("should duplicate annotation at cursor position", () => {
      const annotationStore = useAnnotationStore()
      const viewportStore = useViewportStore()
      const shortcuts = useKeyboardShortcuts()

      // Create an annotation
      const originalAnnotation: Measurement = {
        id: "test-4",
        type: "measure",
        pageNum: 1,
        rotation: 0,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0
      }

      annotationStore.addAnnotation(originalAnnotation)
      annotationStore.selectAnnotation("test-4")

      // Set cursor position
      viewportStore.setLastCursorPosition({ x: 300, y: 300 })

      // Duplicate annotation
      shortcuts.duplicateAnnotation()

      // Should have 2 annotations
      expect(annotationStore.annotations.length).toBe(2)

      // The duplicate should be at cursor position
      const duplicated = annotationStore.annotations[1] as Measurement
      const centerX = (duplicated.points[0].x + duplicated.points[1].x) / 2
      const centerY = (duplicated.points[0].y + duplicated.points[1].y) / 2

      expect(centerX).toBeCloseTo(300, 1)
      expect(centerY).toBeCloseTo(300, 1)
    })
  })
})
