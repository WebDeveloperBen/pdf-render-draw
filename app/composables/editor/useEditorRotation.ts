/**
 * useEditorRotation - Rotation logic
 * Extracted from DebugEditor.vue
 *
 * Handles rotation of selected annotations around selection center
 * Implements frozen bounds pattern to prevent transformer jumping
 * Supports both point-based and positioned annotations
 */

export const useEditorRotation = createSharedComposable(() => {
  const selection = useEditorSelection()
  const bounds = useEditorBounds()
  const coordinates = useEditorCoordinates()
  const cursor = useCursor()
  const annotationStore = useAnnotationStore()
  const dragState = useDragState()

  // Rotation state
  const isRotating = ref(false)
  const rotationStartAngle = ref(0)
  const rotationStartSelectionAngle = ref(0)
  const rotationCenter = ref<Point | null>(null)

  // Original state (before rotation started)
  const rotationOriginalAngles = ref<Map<string, number>>(new Map())
  const rotationOriginalPositions = ref<Map<string, { x: number; y: number }>>(new Map())
  const rotationOriginalPoints = ref<Map<string, Point[]>>(new Map())

  /**
   * Start rotating
   */
  function startRotation(event: MouseEvent) {
    if (!selection.hasSelection.value || !bounds.selectionBounds.value) return

    const svg = getRootSVG(event.currentTarget)
    if (!svg) return

    coordinates.cacheSvg(svg)
    const svgPoint = coordinates.convertToSvgPoint(event, svg)
    if (!svgPoint) return

    // Lock the current visible bounding box (already calculated AABB)
    // This prevents the bounds from changing when isRotating becomes true
    bounds.freezeBounds()

    // Calculate center of selection
    const center = bounds.selectionCenter.value
    if (!center) return

    rotationCenter.value = center

    // Calculate starting angle from center to mouse
    const dx = svgPoint.x - center.x
    const dy = svgPoint.y - center.y
    rotationStartAngle.value = Math.atan2(dy, dx)

    // Store the current selection rotation (for accumulating multiple rotations)
    rotationStartSelectionAngle.value = bounds.selectionRotation.value

    // Store original rotations and positions
    rotationOriginalAngles.value.clear()
    rotationOriginalPositions.value.clear()
    rotationOriginalPoints.value.clear()

    for (const annotation of selection.selectedAnnotations.value) {
      rotationOriginalAngles.value.set(annotation.id, annotation.rotation)

      // For point-based annotations, store points for orbit
      if (hasPointsArray(annotation)) {
        rotationOriginalPoints.value.set(annotation.id, JSON.parse(JSON.stringify(annotation.points)))
      }
      // For positioned annotations, store x,y for orbit
      else if ("x" in annotation && "y" in annotation) {
        rotationOriginalPositions.value.set(annotation.id, { x: annotation.x, y: annotation.y })
      }
    }

    isRotating.value = true
    cursor.set("grabbing")

    event.stopPropagation()
  }

  /**
   * Update rotation as mouse moves
   */
  function updateRotation(event: MouseEvent) {
    if (!isRotating.value || !rotationCenter.value) return

    const svgPoint = coordinates.convertToSvgPoint(event)
    if (!svgPoint) return

    // Calculate current angle from center to mouse
    const dx = svgPoint.x - rotationCenter.value.x
    const dy = svgPoint.y - rotationCenter.value.y
    const currentAngle = Math.atan2(dy, dx)

    // Calculate rotation delta from when we started THIS rotation
    const rotationDelta = currentAngle - rotationStartAngle.value

    // Update selection group rotation (accumulate with previous rotation)
    bounds.setSelectionRotation(rotationStartSelectionAngle.value + rotationDelta)

    // Apply rotation to all selected annotations
    for (const annotation of selection.selectedAnnotations.value) {
      const originalRotation = rotationOriginalAngles.value.get(annotation.id) || 0
      const updates: Partial<Annotation> = {}

      // Annotations with points array - always physically rotate points around transformer center
      // This ensures shape rotates around the visible transformer center, not its centroid
      if (hasPointsArray(annotation)) {
        const originalPoints = rotationOriginalPoints.value.get(annotation.id)
        if (!originalPoints) continue

        // Rotate each point around the transformer center (selection center / AABB center)
        const rotatedPoints = originalPoints.map((p) =>
          rotatePointAroundCenter(p, rotationCenter.value!, rotationDelta)
        )

        // Recalculate derived values
        // Type assertion needed because rotatedPoints is Point[] but specific types expect tuples
        const derived = recalculateDerivedValues({
          ...annotation,
          points: rotatedPoints
        } as typeof annotation)

        Object.assign(updates, { points: rotatedPoints, ...derived })
      }
      // Positioned rectangle annotations - update rotation property
      else if (hasPositionedRect(annotation)) {
        updates.rotation = originalRotation + rotationDelta

        // Orbit for multi-select
        if (selection.isMultiSelection.value) {
          const originalPos = rotationOriginalPositions.value.get(annotation.id)
          if (!originalPos) continue

          const shapeCenterX = originalPos.x + annotation.width / 2
          const shapeCenterY = originalPos.y + annotation.height / 2

          const rotatedCenter = rotatePointAroundCenter(
            { x: shapeCenterX, y: shapeCenterY },
            rotationCenter.value!,
            rotationDelta
          )

          Object.assign(updates, {
            x: rotatedCenter.x - annotation.width / 2,
            y: rotatedCenter.y - annotation.height / 2
          })
        }
      }

      // Update annotation in store
      if (Object.keys(updates).length > 0) {
        annotationStore.updateAnnotation(annotation.id, updates)
      }
    }
  }

  /**
   * End rotation
   */
  function endRotation() {
    if (!isRotating.value) return

    console.log("🚫 [endRotation] Rotation operation ended - KEEPING frozen bounds and rotation", {
      hasFrozenBounds: !!bounds.frozenBounds.value,
      selectionRotation: bounds.selectionRotation.value,
      selectionRotationDeg: (bounds.selectionRotation.value * 180) / Math.PI
    })

    isRotating.value = false
    rotationStartAngle.value = 0
    rotationOriginalAngles.value.clear()
    rotationOriginalPositions.value.clear()
    rotationOriginalPoints.value.clear()
    rotationCenter.value = null
    cursor.reset()
    coordinates.clearSvgCache()

    // Mark drag end to prevent click from clearing selection
    dragState.markDragEnd()

    // Keep frozen bounds and selection rotation until selection changes
  }

  return {
    // State
    isRotating: readonly(isRotating),

    // Methods
    startRotation,
    updateRotation,
    endRotation
  }
})
