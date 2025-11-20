/**
 * Selection Marquee (Drag-to-Select)
 *
 * Allows dragging a rectangle to select multiple annotations at once.
 * Similar to Figma, Illustrator, etc.
 */

import type { Point } from '~/types'

export function useSelectionMarquee() {
  const annotationStore = useAnnotationStore()

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

  function getSvgPoint(e: MouseEvent, svg: SVGSVGElement): Point {
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const transformed = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: transformed.x, y: transformed.y }
  }

  function startMarquee(e: MouseEvent, svg: SVGSVGElement) {
    const point = getSvgPoint(e, svg)
    isDrawing.value = true
    startPoint.value = point
    endPoint.value = point
  }

  function updateMarquee(e: MouseEvent, svg: SVGSVGElement) {
    if (!isDrawing.value || !startPoint.value) return
    endPoint.value = getSvgPoint(e, svg)
  }

  function endMarquee() {
    if (!isDrawing.value || !marqueeBounds.value) {
      isDrawing.value = false
      startPoint.value = null
      endPoint.value = null
      return
    }

    const bounds = marqueeBounds.value

    // Find all annotations that intersect with the marquee
    const selectedIds: string[] = []

    annotationStore.annotations.forEach(annotation => {
      if (intersectsMarquee(annotation, bounds)) {
        selectedIds.push(annotation.id)
      }
    })

    // Select the first one for now (multi-select coming later)
    if (selectedIds.length > 0) {
      annotationStore.selectAnnotation(selectedIds[0])
    }

    // Reset marquee
    isDrawing.value = false
    startPoint.value = null
    endPoint.value = null
  }

  function intersectsMarquee(annotation: any, marquee: { x: number; y: number; width: number; height: number }): boolean {
    // Calculate annotation bounds
    let annoBounds: { x: number; y: number; width: number; height: number } | null = null

    if ('x' in annotation && 'y' in annotation && 'width' in annotation && 'height' in annotation) {
      // Text annotation
      annoBounds = {
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height
      }
    } else if ('points' in annotation && Array.isArray(annotation.points) && annotation.points.length > 0) {
      // Point-based annotation
      const xs = annotation.points.map((p: Point) => p.x)
      const ys = annotation.points.map((p: Point) => p.y)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)

      annoBounds = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      }
    }

    if (!annoBounds) return false

    // Check if rectangles intersect
    return !(
      marquee.x + marquee.width < annoBounds.x ||
      marquee.x > annoBounds.x + annoBounds.width ||
      marquee.y + marquee.height < annoBounds.y ||
      marquee.y > annoBounds.y + annoBounds.height
    )
  }

  return {
    isDrawing,
    marqueeBounds,
    startMarquee,
    updateMarquee,
    endMarquee
  }
}
