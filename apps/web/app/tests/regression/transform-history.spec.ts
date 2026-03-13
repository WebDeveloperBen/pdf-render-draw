import { beforeEach, describe, expect, it, vi } from "vitest"

function createMouseEvent(svg: SVGSVGElement, x: number, y: number): MouseEvent & { currentTarget: SVGSVGElement } {
  return {
    clientX: x,
    clientY: y,
    target: svg,
    currentTarget: svg,
    stopPropagation: vi.fn()
  } as unknown as MouseEvent & { currentTarget: SVGSVGElement }
}

describe("transform gesture history", () => {
  beforeEach(() => {
    const annotationStore = useAnnotationStore()
    annotationStore.clearAnnotations()
    annotationStore.deselectAll()
    annotationStore.setPersistenceSuppressed(false)

    const historyStore = useHistoryStore()
    historyStore.clearHistory()

    global.SVGSVGElement.prototype.createSVGPoint = vi.fn(() => ({
      x: 0,
      y: 0,
      matrixTransform: function () {
        return { x: this.x, y: this.y }
      }
    })) as never

    global.SVGSVGElement.prototype.getScreenCTM = vi.fn(() => ({
      inverse: () => ({})
    })) as never
  })

  it("does not create a history entry when drag starts and ends without movement", () => {
    const annotationStore = useAnnotationStore()
    const historyStore = useHistoryStore()
    const selection = useEditorSelection()
    const move = useEditorMove()

    annotationStore.addAnnotation({
      id: "fill-1",
      type: "fill",
      pageNum: 1,
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      color: "#000",
      opacity: 0.5,
      rotation: 0
    } as Fill)

    selection.selectShape("fill-1")
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")

    move.startDrag(createMouseEvent(svg, 10, 10))
    // No updateDrag call — release immediately
    move.endDrag()

    expect(annotationStore.getAnnotationById("fill-1")).toMatchObject({ x: 10, y: 10 })
    expect(historyStore.canUndo).toBe(false)
    expect(annotationStore.persistenceSuppressed).toBe(false)
  })

  it("records a multi-annotation move as a single undoable step", () => {
    const annotationStore = useAnnotationStore()
    const historyStore = useHistoryStore()
    const selection = useEditorSelection()
    const move = useEditorMove()

    annotationStore.addAnnotation({
      id: "fill-a",
      type: "fill",
      pageNum: 1,
      x: 0,
      y: 0,
      width: 20,
      height: 20,
      color: "#000",
      opacity: 0.5,
      rotation: 0
    } as Fill)

    annotationStore.addAnnotation({
      id: "fill-b",
      type: "fill",
      pageNum: 1,
      x: 100,
      y: 100,
      width: 20,
      height: 20,
      color: "#f00",
      opacity: 0.5,
      rotation: 0
    } as Fill)

    selection.selectShape("fill-a")
    selection.addToSelection("fill-b")

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")

    move.startDrag(createMouseEvent(svg, 10, 10))
    move.updateDrag(createMouseEvent(svg, 30, 20))
    move.endDrag()

    expect(annotationStore.getAnnotationById("fill-a")).toMatchObject({ x: 20, y: 10 })
    expect(annotationStore.getAnnotationById("fill-b")).toMatchObject({ x: 120, y: 110 })

    // Single undo restores both
    historyStore.undo()
    expect(annotationStore.getAnnotationById("fill-a")).toMatchObject({ x: 0, y: 0 })
    expect(annotationStore.getAnnotationById("fill-b")).toMatchObject({ x: 100, y: 100 })

    // Only one undo step was created
    expect(historyStore.canUndo).toBe(false)
  })

  it("records a move interaction as a single undoable step", () => {
    const annotationStore = useAnnotationStore()
    const historyStore = useHistoryStore()
    const selection = useEditorSelection()
    const move = useEditorMove()

    annotationStore.addAnnotation({
      id: "fill-1",
      type: "fill",
      pageNum: 1,
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      color: "#000",
      opacity: 0.5,
      rotation: 0
    } as Fill)

    selection.selectShape("fill-1")

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")

    move.startDrag(createMouseEvent(svg, 10, 10))
    move.updateDrag(createMouseEvent(svg, 40, 30))
    move.endDrag()

    expect(annotationStore.getAnnotationById("fill-1")).toMatchObject({ x: 40, y: 30 })
    expect(historyStore.canUndo).toBe(true)

    historyStore.undo()
    expect(annotationStore.getAnnotationById("fill-1")).toMatchObject({ x: 10, y: 10 })

    historyStore.redo()
    expect(annotationStore.getAnnotationById("fill-1")).toMatchObject({ x: 40, y: 30 })
  })
})
