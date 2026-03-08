import { v4 as uuidv4 } from "uuid"

export interface DrawingToolConfig<T extends Annotation> {
  type: T["type"]
  minPoints: number
  canClose: boolean
  calculate: (points: Point[]) => Omit<T, keyof BaseAnnotation>
  onCreate: (annotation: T) => void
  onUpdate?: (annotation: T) => void
  snapDistance?: number
}

export function useDrawingTool<T extends Annotation>(config: DrawingToolConfig<T>) {
  const annotationStore = useAnnotationStore()
  const viewportStore = useViewportStore()
  const historyStore = useHistoryStore()

  // Get modifier keys for multi-select support (optional for tests)
  const modifierKeys = useModifierKeys()!

  const base = useBaseTool({
    type: config.type,
    minPoints: config.minPoints,
    canClose: config.canClose,
    snapDistance: config.snapDistance
  })

  // Tool-specific state - only show annotations for current page
  const completed = computed(
    () => annotationStore.getAnnotationsByTypeAndPage(config.type, viewportStore.getCurrentPage) as T[]
  )

  const selected = computed(() => {
    if (!annotationStore.selectedAnnotationId) return null
    const ann = annotationStore.selectedAnnotation
    return ann?.type === config.type ? (ann as T) : null
  })

  // Event handlers
  function handleClick(e: MouseEvent) {
    debugLog(`${config.type}Tool`, "handleClick called", {
      isDrawing: annotationStore.isDrawing,
      currentPoints: base.points.value.length
    })

    const lastPoint = base.points.value[base.points.value.length - 1]
    const rawPoint = base.getSvgPoint(e)

    // Build snap options: shift-constrain + snap work together
    let point: Point
    if (e.shiftKey && lastPoint) {
      const constrained = base.snapTo45Degrees(lastPoint, rawPoint)
      point = base.getSnappedSvgPoint(rawPoint, {
        ctrlHeld: e.ctrlKey,
        shiftStart: lastPoint,
        shiftConstrained: constrained
      })
    } else {
      point = base.getSnappedSvgPoint(rawPoint, { ctrlHeld: e.ctrlKey })
    }

    debugLog(`${config.type}Tool`, "Got point:", point)

    // Check for snap to close
    if (base.canSnapToClose.value) {
      debugLog(`${config.type}Tool`, "Snapping to close")
      completeDrawing()
      return
    }

    if (!annotationStore.isDrawing) {
      debugLog(`${config.type}Tool`, "Starting new drawing")
      base.startDrawing(point)
    } else {
      debugLog(`${config.type}Tool`, "Adding point:", point)
      base.addPoint(point)

      // Auto-complete for 2-point tools (measure, line)
      if (config.minPoints === 2 && base.points.value.length === 2) {
        debugLog(`${config.type}Tool`, "Auto-completing (2 points)")
        completeDrawing()
      }
    }
  }

  function handleMove(e: MouseEvent) {
    const lastPoint = base.points.value[base.points.value.length - 1]
    const rawPoint = base.getSvgPoint(e)

    // Always update temp point for preview, even before first click
    if (!annotationStore.isDrawing) {
      const snapped = base.getSnappedSvgPoint(rawPoint, { ctrlHeld: e.ctrlKey })
      base.updateTempPoint(snapped)
      return
    }

    // Build snap options with shift-constrain support
    let point: Point
    if (e.shiftKey && lastPoint) {
      const constrained = base.snapTo45Degrees(lastPoint, rawPoint)
      point = base.getSnappedSvgPoint(rawPoint, {
        ctrlHeld: e.ctrlKey,
        shiftStart: lastPoint,
        shiftConstrained: constrained
      })
    } else {
      point = base.getSnappedSvgPoint(rawPoint, { ctrlHeld: e.ctrlKey })
    }

    base.updateTempPoint(point)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && annotationStore.isDrawing) {
      base.reset()
    }

    if ((e.key === "Delete" || e.key === "Backspace") && selected.value) {
      deleteAnnotation(selected.value.id)
    }
  }

  function completeDrawing() {
    debugLog(`${config.type}Tool`, "completeDrawing called", {
      hasMinimumPoints: base.hasMinimumPoints.value,
      pointsCount: base.points.value.length
    })

    if (!base.hasMinimumPoints.value) {
      debugLog(`${config.type}Tool`, "Not enough points, resetting")
      base.reset()
      return
    }

    const points = base.complete()
    debugLog(`${config.type}Tool`, "Points completed:", points)

    const calculatedData = config.calculate(points)
    debugLog(`${config.type}Tool`, "Calculated data:", calculatedData)

    const annotation: T = {
      id: uuidv4(),
      type: config.type,
      pageNum: viewportStore.currentPage,
      labelScale: viewportStore.getInverseScale,
      ...calculatedData
    } as T

    debugLog(`${config.type}Tool`, "Creating annotation:", annotation)
    historyStore.addAnnotationWithHistory(annotation)
    config.onCreate(annotation)
    base.reset()
  }

  function selectAnnotation(id: string) {
    // Support Shift+click for multi-select (fallback to false if not provided)
    annotationStore.selectAnnotation(id, { addToSelection: modifierKeys?.isShiftPressed.value ?? false })
  }

  function deleteAnnotation(id: string) {
    historyStore.deleteAnnotationWithHistory(id)
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
    isAnnotationSelected: annotationStore.isAnnotationSelected,
    getRotationTransform: annotationStore.getRotationTransform,
    clearPreview: base.clearPreview,
    getSvgPoint: base.getSvgPoint,
    toSvgPoints: base.toSvgPoints
  }
}
