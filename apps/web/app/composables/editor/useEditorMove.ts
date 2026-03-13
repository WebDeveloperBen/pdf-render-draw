/**
 * useEditorMove - Move/drag logic
 * Extracted from SimpleDebugEditor.vue
 *
 * Handles dragging selected shapes to move them
 * Maintains frozen bounds during drag
 */

export const useEditorMove = createSharedComposable(() => {
  const selection = useEditorSelection()
  const bounds = useEditorBounds()
  const coordinates = useEditorCoordinates()
  const cursor = useCursor()
  const annotationStore = useAnnotationStore()
  const dragState = useEditorDragState()
  const transformFinalise = useEditorTransformFinalise()

  // Drag state
  const isDragging = ref(false)
  const dragStartPoint = ref<Point | null>(null)
  const dragOriginalPositions = ref<Map<string, { x: number; y: number }>>(new Map())
  const dragOriginalPoints = ref<Map<string, Point[]>>(new Map())
  const dragOriginalAnnotations = ref<Map<string, Annotation>>(new Map())
  const dragOriginalLockedBounds = ref<Bounds | null>(null)

  /**
   * Start dragging
   */
  function startDrag(event: EditorInputEvent) {
    if (!selection.hasSelection.value) return

    const svg = getRootSVG(event.currentTarget)
    if (!svg) return

    coordinates.cacheSvg(svg)
    const svgPoint = coordinates.convertToSvgPoint(event, svg)
    if (!svgPoint) return

    isDragging.value = true
    dragStartPoint.value = svgPoint
    cursor.set("grabbing")

    // Store original positions/points of all selected annotations
    dragOriginalPositions.value.clear()
    dragOriginalPoints.value.clear()
    dragOriginalAnnotations.value.clear()

    for (const annotation of selection.selectedAnnotations.value) {
      dragOriginalAnnotations.value.set(annotation.id, structuredClone(toRaw(annotation)))
      // Point-based annotations - store points array
      if (hasPointsArray(annotation)) {
        dragOriginalPoints.value.set(annotation.id, structuredClone(toRaw(annotation.points)))
      }
      // Positioned rectangle annotations - store x, y
      else if (hasPositionedRect(annotation)) {
        dragOriginalPositions.value.set(annotation.id, { x: annotation.x, y: annotation.y })
      }
    }

    // Store original frozen bounds (just frozen above or from previous rotation)
    if (bounds.frozenBounds.value) {
      dragOriginalLockedBounds.value = { ...bounds.frozenBounds.value }
    }

    annotationStore.setPersistenceSuppressed(true)
    event.stopPropagation()
  }

  /**
   * Update drag as mouse moves
   */
  function updateDrag(event: EditorInputEvent) {
    if (!isDragging.value || !dragStartPoint.value) return

    const svgPoint = coordinates.convertToSvgPoint(event)
    if (!svgPoint) return

    const deltaX = svgPoint.x - dragStartPoint.value.x
    const deltaY = svgPoint.y - dragStartPoint.value.y

    // Move all selected annotations
    for (const annotation of selection.selectedAnnotations.value) {
      // Annotations with points array - translate all points
      if (hasPointsArray(annotation)) {
        const originalPoints = dragOriginalPoints.value.get(annotation.id)
        if (!originalPoints) continue

        const movedPoints = originalPoints.map((p) => ({
          x: p.x + deltaX,
          y: p.y + deltaY
        }))

        // Recalculate derived values (distance, area, etc.)
        // Type assertion needed because movedPoints is Point[] but specific types expect tuples
        const derived = recalculateDerivedValues({
          ...annotation,
          points: movedPoints
        } as typeof annotation)

        // Update with moved points and recalculated derived values
        annotationStore.updateAnnotation(annotation.id, Object.assign({ points: movedPoints }, derived))
      }
      // Positioned annotations - update x, y
      else if ("x" in annotation && "y" in annotation) {
        const originalPos = dragOriginalPositions.value.get(annotation.id)
        if (originalPos) {
          annotationStore.updateAnnotation(
            annotation.id,
            Object.assign({
              x: originalPos.x + deltaX,
              y: originalPos.y + deltaY
            })
          )
        }
      }
    }

    // If we have frozen bounds (from a previous rotation), update their position too
    // This keeps the transformer stable if we're moving after rotating
    if (dragOriginalLockedBounds.value && bounds.frozenBounds.value) {
      bounds.updateFrozenBounds({
        x: dragOriginalLockedBounds.value.x + deltaX,
        y: dragOriginalLockedBounds.value.y + deltaY,
        width: dragOriginalLockedBounds.value.width,
        height: dragOriginalLockedBounds.value.height
      })
    }
  }

  /**
   * End dragging
   */
  function endDrag() {
    if (!isDragging.value) return

    isDragging.value = false
    dragStartPoint.value = null
    dragOriginalPositions.value.clear()
    dragOriginalPoints.value.clear()
    dragOriginalLockedBounds.value = null
    cursor.reset()
    coordinates.clearSvgCache()

    transformFinalise.finaliseTransformGesture({
      originalAnnotations: dragOriginalAnnotations.value,
      annotations: selection.selectedAnnotations.value,
      description: "Move selection"
    })

    // Mark drag end to prevent click from clearing selection
    dragState.markDragEnd()
  }

  return {
    // State
    isDragging: readonly(isDragging),

    // Methods
    startDrag,
    updateDrag,
    endDrag
  }
})
