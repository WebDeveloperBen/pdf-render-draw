/**
 * Selection Marquee (Drag-to-Select)
 *
 * Allows dragging a rectangle to select multiple annotations at once.
 * Similar to Figma, Illustrator, etc.
 */

import type { Point } from "~/types"

export function useSelectionMarquee() {
  const annotationStore = useAnnotationStore()
  const { getSvgPoint: getSvgPointUtil } = useSvgCoordinates()

  const isDrawing = ref(false)
  const startPoint = ref<Point | null>(null)
  const endPoint = ref<Point | null>(null)

  // Calculate marquee rectangle bounds
  const marqueeBounds = computed(() => {
    if (!startPoint.value || !endPoint.value) return null

    const x1 = Math.min(startPoint.value.x, endPoint.value.x)
    const y1 = Math.min(startPoint.value.y, endPoint.value.y)
    const x2 = Math.max(startPoint.value.x, endPoint.value.x)
    const y2 = Math.max(startPoint.value.y, endPoint.value.y)

    return {
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1
    }
  })

  function getSvgPoint(e: MouseEvent, svg: SVGSVGElement): Point | null {
    return getSvgPointUtil(e, svg)
  }

  function startMarquee(e: MouseEvent, svg: SVGSVGElement) {
    const point = getSvgPoint(e, svg)
    if (!point) return
    isDrawing.value = true
    startPoint.value = point
    endPoint.value = point
  }

  function updateMarquee(e: MouseEvent, svg: SVGSVGElement) {
    if (!isDrawing.value || !startPoint.value) return
    const point = getSvgPoint(e, svg)
    if (point) {
      endPoint.value = point
    }
  }

  function endMarquee() {
    if (!isDrawing.value || !marqueeBounds.value) {
      isDrawing.value = false
      startPoint.value = null
      endPoint.value = null
      return
    }

    const marquee = marqueeBounds.value

    // Find all annotations that intersect with the marquee
    const selectedIds: string[] = []

    annotationStore.annotations.forEach((annotation) => {
      const annoBounds = calculateBounds(annotation)
      if (annoBounds && boundsIntersect(marquee, annoBounds)) {
        selectedIds.push(annotation.id)
      }
    })

    // Select all annotations within the marquee (multi-select)
    if (selectedIds.length > 0) {
      annotationStore.selectAnnotation(selectedIds)
    }

    // Reset marquee
    isDrawing.value = false
    startPoint.value = null
    endPoint.value = null
  }

  return {
    isDrawing,
    marqueeBounds,
    startMarquee,
    updateMarquee,
    endMarquee
  }
}
