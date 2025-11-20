import type { Annotation, BaseAnnotation } from '~/types/annotations'
import type { Point } from '~/types'
import { v4 as uuidv4 } from 'uuid'

export interface DrawingToolConfig<T extends Annotation> {
  type: T['type']
  minPoints: number
  canClose: boolean
  calculate: (points: Point[]) => Omit<T, keyof BaseAnnotation>
  onCreate: (annotation: T) => void
  onUpdate?: (annotation: T) => void
  snapDistance?: number
}

export function useDrawingTool<T extends Annotation>(config: DrawingToolConfig<T>) {
  const annotationStore = useAnnotationStore()
  const rendererStore = useRendererStore()

  const base = useBaseTool({
    type: config.type,
    minPoints: config.minPoints,
    canClose: config.canClose,
    snapDistance: config.snapDistance,
  })

  // Tool-specific state
  const completed = computed(() =>
    annotationStore.getAnnotationsByType(config.type) as T[]
  )

  const selected = computed(() => {
    if (!annotationStore.selectedAnnotationId) return null
    const ann = annotationStore.selectedAnnotation
    return ann?.type === config.type ? (ann as T) : null
  })

  // Event handlers
  function handleClick(e: MouseEvent) {
    console.log(`[${config.type}Tool] handleClick called`, {
      isDrawing: annotationStore.isDrawing,
      currentPoints: base.points.value.length
    })

    const point = base.getSvgPoint(e)
    console.log(`[${config.type}Tool] Got SVG point:`, point)

    // Check for snap to close
    if (base.canSnapToClose.value) {
      console.log(`[${config.type}Tool] Snapping to close`)
      completeDrawing()
      return
    }

    if (!annotationStore.isDrawing) {
      console.log(`[${config.type}Tool] Starting new drawing`)
      base.startDrawing(point)
    } else {
      const pointToAdd = e.shiftKey
        ? base.snapTo45Degrees(base.points.value[base.points.value.length - 1], point)
        : point

      console.log(`[${config.type}Tool] Adding point:`, pointToAdd)
      base.addPoint(pointToAdd)

      // Auto-complete for 2-point tools (measure, line)
      if (config.minPoints === 2 && base.points.value.length === 2) {
        console.log(`[${config.type}Tool] Auto-completing (2 points)`)
        completeDrawing()
      }
    }
  }

  function handleMove(e: MouseEvent) {
    if (!annotationStore.isDrawing) return

    const point = base.getSvgPoint(e)
    const lastPoint = base.points.value[base.points.value.length - 1]

    const snappedPoint = e.shiftKey && lastPoint
      ? base.snapTo45Degrees(lastPoint, point)
      : point

    base.updateTempPoint(snappedPoint)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && annotationStore.isDrawing) {
      base.reset()
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && selected.value) {
      deleteAnnotation(selected.value.id)
    }
  }

  function completeDrawing() {
    console.log(`[${config.type}Tool] completeDrawing called`, {
      hasMinimumPoints: base.hasMinimumPoints.value,
      pointsCount: base.points.value.length
    })

    if (!base.hasMinimumPoints.value) {
      console.log(`[${config.type}Tool] Not enough points, resetting`)
      base.reset()
      return
    }

    const points = base.complete()
    console.log(`[${config.type}Tool] Points completed:`, points)

    const calculatedData = config.calculate(points)
    console.log(`[${config.type}Tool] Calculated data:`, calculatedData)

    const annotation: T = {
      id: uuidv4(),
      type: config.type,
      pageNum: rendererStore.currentPage,
      ...calculatedData,
    } as T

    console.log(`[${config.type}Tool] Creating annotation:`, annotation)
    annotationStore.addAnnotation(annotation)
    config.onCreate(annotation)
    base.reset()
  }

  function selectAnnotation(id: string) {
    annotationStore.selectAnnotation(id)
  }

  function deleteAnnotation(id: string) {
    annotationStore.deleteAnnotation(id)
  }

  return {
    // Base state
    isDrawing: computed(() => annotationStore.isDrawing),
    points: base.points,
    tempEndPoint: base.tempEndPoint,
    canSnapToClose: base.canSnapToClose,

    // Tool state
    completed,
    selected,

    // Methods
    handleClick,
    handleMove,
    handleKeyDown,
    selectAnnotation,
    deleteAnnotation,
    getSvgPoint: base.getSvgPoint,
    toSvgPoints: base.toSvgPoints,
  }
}
