import { beforeEach, describe, expect, it } from "vitest"
import { createPinia, setActivePinia } from "pinia"

describe("useEditorTransformFinalise", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function createFill(overrides: Partial<Fill> = {}): Fill {
    return {
      id: "fill-1",
      type: "fill",
      pageNum: 1,
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      color: "#000",
      opacity: 0.5,
      rotation: 0,
      ...overrides
    }
  }

  it("records a batch history entry and restores persistence", () => {
    const annotationStore = useAnnotationStore()
    const historyStore = useHistoryStore()
    const finalise = useEditorTransformFinalise()

    const fill = createFill()
    annotationStore.addAnnotation(fill)

    const originalAnnotations = new Map<string, Annotation>()
    originalAnnotations.set("fill-1", { ...fill })

    // Simulate a move already applied
    annotationStore.updateAnnotation("fill-1", { x: 80, y: 80 })
    annotationStore.setPersistenceSuppressed(true)

    finalise.finaliseTransformGesture({
      originalAnnotations,
      annotations: [annotationStore.getAnnotationById("fill-1")!],
      description: "Move selection"
    })

    expect(annotationStore.persistenceSuppressed).toBe(false)
    expect(historyStore.canUndo).toBe(true)
    expect(originalAnnotations.size).toBe(0) // cleared after finalise
  })

  it("skips history when no changes occurred (click without move)", () => {
    const annotationStore = useAnnotationStore()
    const historyStore = useHistoryStore()
    const finalise = useEditorTransformFinalise()

    const fill = createFill()
    annotationStore.addAnnotation(fill)

    const originalAnnotations = new Map<string, Annotation>()
    originalAnnotations.set("fill-1", { ...fill })

    annotationStore.setPersistenceSuppressed(true)

    finalise.finaliseTransformGesture({
      originalAnnotations,
      annotations: [annotationStore.getAnnotationById("fill-1")!],
      description: "Move selection"
    })

    expect(annotationStore.persistenceSuppressed).toBe(false)
    expect(historyStore.canUndo).toBe(false)
  })

  it("gracefully skips annotations missing from the originalAnnotations map", () => {
    const annotationStore = useAnnotationStore()
    const historyStore = useHistoryStore()
    const finalise = useEditorTransformFinalise()

    const fill1 = createFill({ id: "fill-1" })
    const fill2 = createFill({ id: "fill-2", x: 100, y: 100 })
    annotationStore.addAnnotation(fill1)
    annotationStore.addAnnotation(fill2)

    // Only fill-1 was in the original snapshot
    const originalAnnotations = new Map<string, Annotation>()
    originalAnnotations.set("fill-1", { ...fill1 })

    annotationStore.updateAnnotation("fill-1", { x: 50, y: 50 })
    annotationStore.setPersistenceSuppressed(true)

    finalise.finaliseTransformGesture({
      originalAnnotations,
      annotations: [
        annotationStore.getAnnotationById("fill-1")!,
        annotationStore.getAnnotationById("fill-2")!
      ],
      description: "Move selection"
    })

    expect(historyStore.canUndo).toBe(true)

    // Undo should only affect fill-1 (fill-2 was not in the snapshot)
    historyStore.undo()
    expect(annotationStore.getAnnotationById("fill-1")).toMatchObject({ x: 10, y: 10 })
    expect(annotationStore.getAnnotationById("fill-2")).toMatchObject({ x: 100, y: 100 })
  })
})
