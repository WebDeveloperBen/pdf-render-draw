import { describe, it, expect, beforeEach } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import type { Fill } from "~/types/annotations"

describe("Fill Multi-Select", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it("should allow multi-selecting two fills with Shift+click (store level)", () => {
    const annotationStore = useAnnotationStore()

    const fill1: Fill = {
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

    const fill2: Fill = {
      id: "f2",
      type: "fill",
      pageNum: 1,
      x: 250,
      y: 250,
      width: 100,
      height: 100,
      color: "#00ff00",
      opacity: 0.5,
      rotation: 0
    }

    annotationStore.addAnnotation(fill1)
    annotationStore.addAnnotation(fill2)

    // Select first fill
    annotationStore.selectAnnotation("f1")
    expect(annotationStore.selectedAnnotationIds).toEqual(["f1"])

    // Shift+click second fill (simulated via addToSelection)
    annotationStore.selectAnnotation("f2", { addToSelection: true })
    expect(annotationStore.selectedAnnotationIds).toEqual(["f1", "f2"])
  })

  it("should allow multi-selecting fill and line", () => {
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

    const line = {
      id: "l1",
      type: "line" as const,
      pageNum: 1,
      points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
      rotation: 0
    }

    annotationStore.addAnnotation(fill)
    annotationStore.addAnnotation(line)

    // Select fill first
    annotationStore.selectAnnotation("f1")
    expect(annotationStore.selectedAnnotationIds).toEqual(["f1"])

    // Add line to selection
    annotationStore.selectAnnotation("l1", { addToSelection: true })
    expect(annotationStore.selectedAnnotationIds).toEqual(["f1", "l1"])
  })

  it("should verify fill annotations are created with rotation property", () => {
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

    const stored = annotationStore.getAnnotationById("f1") as Fill
    expect(stored.rotation).toBeDefined()
    expect(stored.rotation).toBe(0)
    expect("rotation" in stored).toBe(true)
  })
})
