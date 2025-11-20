import type { Point } from '~/types'
import { distance } from '~/utils/calculations'

export interface BaseToolOptions {
  type: string
  minPoints?: number
  canClose?: boolean
  snapDistance?: number
}

export function useBaseTool(options: BaseToolOptions) {
  const settings = useSettingStore()
  const annotationStore = useAnnotationStore()

  // State
  const points = ref<Point[]>([])
  const tempEndPoint = ref<Point | null>(null)

  // Computed
  const hasMinimumPoints = computed(() =>
    points.value.length >= (options.minPoints ?? 2)
  )

  const canSnapToClose = computed(() => {
    if (!options.canClose || points.value.length < (options.minPoints ?? 3)) {
      return false
    }
    if (!tempEndPoint.value) return false

    const firstPoint = points.value[0]
    const dist = distance(tempEndPoint.value, firstPoint)
    const snapDist = options.snapDistance ?? settings.toolSnapDistance
    return dist < snapDist
  })

  // Methods
  function startDrawing(point: Point) {
    points.value = [point]
    annotationStore.isDrawing = true
  }

  function addPoint(point: Point) {
    points.value.push(point)
  }

  function updateTempPoint(point: Point) {
    tempEndPoint.value = point
  }

  function reset() {
    points.value = []
    tempEndPoint.value = null
    annotationStore.isDrawing = false
  }

  function complete() {
    annotationStore.isDrawing = false
    return [...points.value]
  }

  // SVG utilities
  function getSvgPoint(e: MouseEvent): Point {
    const svg = e.currentTarget as SVGSVGElement
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const transformed = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: transformed.x, y: transformed.y }
  }

  function toSvgPoints(pts: Point[]): string {
    return pts.map(p => `${p.x},${p.y}`).join(' ')
  }

  function snapTo45Degrees(start: Point, end: Point): Point {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    const snappedAngle = Math.round(angle / 45) * 45
    const dist = Math.sqrt(dx * dx + dy * dy)

    return {
      x: start.x + dist * Math.cos(snappedAngle * Math.PI / 180),
      y: start.y + dist * Math.sin(snappedAngle * Math.PI / 180)
    }
  }

  return {
    // State
    points,
    tempEndPoint,

    // Computed
    hasMinimumPoints,
    canSnapToClose,

    // Methods
    startDrawing,
    addPoint,
    updateTempPoint,
    reset,
    complete,
    getSvgPoint,
    toSvgPoints,
    snapTo45Degrees,
  }
}
