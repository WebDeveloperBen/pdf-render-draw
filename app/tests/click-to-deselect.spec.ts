import { describe, it, expect, beforeEach } from "vitest"
import { setActivePinia, createPinia } from "pinia"

/**
 * Tests for click-outside-to-deselect behavior
 */
describe("Click to Deselect", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it("should deselect annotation when clicking outside (store level)", () => {
    const annotationStore = useAnnotationStore()

    const fill: Fill = {
      id: "f1",
      type: "fill",
      pageNum: 1,
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      color: "#ff0000",
      opacity: 0.5,
      rotation: 0
    }

    annotationStore.addAnnotation(fill)

    // Select the annotation
    annotationStore.selectAnnotation("f1")
    expect(annotationStore.selectedAnnotationIds).toEqual(["f1"])

    // Click outside (pass null to deselect)
    annotationStore.selectAnnotation(null)
    expect(annotationStore.selectedAnnotationIds).toEqual([])
  })

  it("should deselect when selectAnnotation is called with null", () => {
    const annotationStore = useAnnotationStore()

    // Create and select annotation
    annotationStore.addAnnotation({
      id: "test1",
      type: "fill",
      pageNum: 1,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      color: "#000",
      opacity: 1,
      rotation: 0
    })

    annotationStore.selectAnnotation("test1")
    expect(annotationStore.selectedAnnotationIds).toContain("test1")

    // Deselect
    annotationStore.selectAnnotation(null)
    expect(annotationStore.selectedAnnotationIds).toEqual([])
  })

  it("should clear selection when switching to selection tool with nothing selected", () => {
    const annotationStore = useAnnotationStore()

    // Create and select annotation
    annotationStore.addAnnotation({
      id: "test1",
      type: "fill",
      pageNum: 1,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      color: "#000",
      opacity: 1,
      rotation: 0
    })

    annotationStore.selectAnnotation("test1")
    expect(annotationStore.selectedAnnotationIds).toContain("test1")

    // Clicking empty space should call selectAnnotation(null)
    annotationStore.selectAnnotation(null)
    expect(annotationStore.selectedAnnotationIds).toEqual([])
  })
})
