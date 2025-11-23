export interface BaseToolOptions {
  type: string
  minPoints?: number
  canClose?: boolean
  snapDistance?: number
}

/**
 * Base drawing tool composable
 *
 * s core functionality for all annotation drawing tools including
 * point management, snap-to-close detection, SVG coordinate conversion,
 * and 45-degree angle snapping.
 *
 * @param options - Configuration options for the tool
 * @param options.type - Tool type identifier
 * @param options.minPoints - Minimum points required to complete (default: 2)
 * @param options.canClose - Whether tool supports polygon closing (default: false)
 * @param options.snapDistance - Distance threshold for snap-to-close in PDF points
 * @returns Object containing drawing state, computed properties, and utility methods
 *
 * @example
 * const base = useBaseTool({
 *   type: 'polygon',
 *   minPoints: 3,
 *   canClose: true,
 *   snapDistance: 25
 * })
 */
export function useBaseTool(options: BaseToolOptions) {
  const settings = useSettingStore()
  const annotationStore = useAnnotationStore()

  // State
  const points = ref<Point[]>([])
  const tempEndPoint = ref<Point | null>(null)

  // Computed
  const hasMinimumPoints = computed(() => points.value.length >= (options.minPoints ?? 2))

  const canSnapToClose = computed(() => {
    if (!options.canClose || points.value.length < (options.minPoints ?? 3)) {
      return false
    }
    if (!tempEndPoint.value) return false

    const firstPoint = points.value[0]!
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
    //debugLog("BaseTool", "updateTempPoint called:", point, "tempEndPoint.value:", tempEndPoint.value)
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
  /**
   * Convert mouse event coordinates to SVG coordinate space
   *
   * Takes screen coordinates from a MouseEvent and transforms them to
   * SVG coordinate space using the inverse of the screen CTM (coordinate
   * transformation matrix). This handles zoom, pan, and rotation transforms.
   *
   * @param e - MouseEvent with clientX/clientY in screen coordinates
   * @returns Point in SVG coordinate space (PDF points)
   */
  function getSvgPoint(e: MouseEvent): Point {
    const svg = e.currentTarget as SVGSVGElement
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const transformed = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: transformed.x, y: transformed.y }
  }

  /**
   * Convert points array to SVG points string format
   *
   * @param pts - Array of points
   * @returns Space-separated "x,y" coordinate pairs for SVG polyline/polygon
   * @example
   * toSvgPoints([{x:0,y:0}, {x:10,y:20}]) // Returns "0,0 10,20"
   */
  function toSvgPoints(pts: Point[]): string {
    return pts.map((p) => `${p.x},${p.y}`).join(" ")
  }

  /**
   * Snap point to nearest 45-degree angle from start point
   *
   * Constrains the end point to 0°, 45°, 90°, 135°, 180°, etc. from the
   * start point while preserving distance. Used when Shift key is held.
   *
   * @param start - Starting/anchor point
   * @param end - Current cursor position
   * @returns New end point snapped to nearest 45° angle
   */
  function snapTo45Degrees(start: Point, end: Point): Point {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const angle = radiansToDegrees(Math.atan2(dy, dx))
    const snappedAngle = snapToNearestAngle(angle, 45)
    const dist = Math.sqrt(dx * dx + dy * dy)

    return {
      x: start.x + dist * Math.cos(degreesToRadians(snappedAngle)),
      y: start.y + dist * Math.sin(degreesToRadians(snappedAngle))
    }
  }

  function clearPreview() {
    tempEndPoint.value = null
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
    clearPreview,
    getSvgPoint,
    toSvgPoints,
    snapTo45Degrees
  }
}
