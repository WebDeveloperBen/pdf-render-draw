import { beforeEach, describe, expect, it, vi } from "vitest"
import { createPinia, setActivePinia } from "pinia"

function createMouseEvent(
  svg: SVGSVGElement,
  x: number,
  y: number,
  shiftKey: boolean = false
): MouseEvent & { currentTarget: SVGSVGElement } {
  return {
    clientX: x,
    clientY: y,
    shiftKey,
    target: svg,
    currentTarget: svg,
    stopPropagation: vi.fn()
  } as unknown as MouseEvent & { currentTarget: SVGSVGElement }
}

describe("useEditorMarquee", () => {
  beforeEach(() => {
    setActivePinia(createPinia())

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

  it("only selects annotations from the current page", () => {
    const annotationStore = useAnnotationStore()
    const viewportStore = useViewportStore()
    const marquee = useEditorMarquee()

    viewportStore.currentPage = 1

    annotationStore.addAnnotation({
      id: "page-one",
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
      id: "page-two",
      type: "fill",
      pageNum: 2,
      x: 0,
      y: 0,
      width: 20,
      height: 20,
      color: "#000",
      opacity: 0.5,
      rotation: 0
    } as Fill)

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")

    marquee.startMarquee(createMouseEvent(svg, 0, 0))
    marquee.updateMarquee(createMouseEvent(svg, 25, 25))
    marquee.endMarquee()

    expect(annotationStore.selectedAnnotationIds).toEqual(["page-one"])
  })
})
