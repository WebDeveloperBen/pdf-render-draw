/**
 * useEditorScale - Scaling/resizing logic
 * Extracted from SimpleDebugEditor.vue
 *
 * Handles scaling of selected shapes from corner/edge handles
 * Supports rotated shapes by projecting mouse deltas into local space
 */

export const useEditorScale = createSharedComposable(() => {
  const selection = useEditorSelection()
  const bounds = useEditorBounds()
  const coordinates = useEditorCoordinates()
  const cursor = useCursor()
  const annotationStore = useAnnotationStore()
  const dragState = useEditorDragState()
  const toolRegistry = useToolRegistry()
  const transformFinalise = useEditorTransformFinalise()

  // Scaling state
  const isScaling = ref(false)
  const scaleHandle = ref<ScaleHandle | null>(null)
  const scaleStartPoint = ref<Point | null>(null)
  const scaleOriginalBounds = ref<Bounds | null>(null)
  const scaleOriginalShapes = ref<Map<string, { x: number; y: number; width: number; height: number }>>(new Map())
  const scaleOriginalPoints = ref<Map<string, Point[]>>(new Map())
  const scaleOriginalAnnotations = ref<Map<string, Annotation>>(new Map())

  /**
   * Start scaling
   */
  function startScale(event: MouseEvent, handle: ScaleHandle) {
    if (!selection.hasSelection.value || !bounds.selectionBounds.value) return

    const svg = getRootSVG(event.currentTarget)
    if (!svg) return

    coordinates.cacheSvg(svg)
    const svgPoint = coordinates.convertToSvgPoint(event, svg)
    if (!svgPoint) return

    isScaling.value = true
    scaleHandle.value = handle
    scaleStartPoint.value = svgPoint
    cursor.set("grabbing")

    // ALWAYS use the visual bounds (AABB) that the user sees
    // This ensures handles are where the user clicked
    scaleOriginalBounds.value = { ...bounds.selectionBounds.value }

    // Store original annotation data
    scaleOriginalShapes.value.clear()
    scaleOriginalPoints.value.clear()
    scaleOriginalAnnotations.value.clear()

    for (const annotation of selection.selectedAnnotations.value) {
      scaleOriginalAnnotations.value.set(annotation.id, structuredClone(toRaw(annotation)))
      // Annotations with points array - store points
      if (hasPointsArray(annotation)) {
        scaleOriginalPoints.value.set(annotation.id, structuredClone(toRaw(annotation.points)))
      }
      // Positioned rectangle annotations - store x, y, width, height
      else if (hasPositionedRect(annotation)) {
        scaleOriginalShapes.value.set(annotation.id, {
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height
        })
      }
    }

    annotationStore.setPersistenceSuppressed(true)
    event.stopPropagation()
  }

  /**
   * Update scale as mouse moves
   */
  function updateScale(event: MouseEvent) {
    if (!isScaling.value || !scaleStartPoint.value || !scaleOriginalBounds.value || !scaleHandle.value) return

    const svgPoint = coordinates.convertToSvgPoint(event)
    if (!svgPoint) return

    const deltaX = svgPoint.x - scaleStartPoint.value.x
    const deltaY = svgPoint.y - scaleStartPoint.value.y

    // Get rotation angle
    const rotation = bounds.selectionRotation.value

    // Project mouse delta into rotated coordinate system
    const { localDeltaX, localDeltaY } = projectDeltaToLocalSpace(deltaX, deltaY, rotation)

    // Determine which sides are being scaled
    const isLeft = scaleHandle.value === "nw" || scaleHandle.value === "sw" || scaleHandle.value === "w"
    const isTop = scaleHandle.value === "nw" || scaleHandle.value === "ne" || scaleHandle.value === "n"
    const isRight = scaleHandle.value === "ne" || scaleHandle.value === "se" || scaleHandle.value === "e"
    const isBottom = scaleHandle.value === "sw" || scaleHandle.value === "se" || scaleHandle.value === "s"
    const isEdgeHandle = scaleHandle.value.length === 1 // n, s, e, w

    // Calculate new bounds by applying deltas (matching Transform.vue logic)
    const newBounds = { ...scaleOriginalBounds.value }

    if (rotation !== 0) {
      // With rotation: apply deltas to dimensions only (not position)
      if (isEdgeHandle) {
        if (scaleHandle.value === "n") newBounds.height -= localDeltaY
        else if (scaleHandle.value === "e") newBounds.width += localDeltaX
        else if (scaleHandle.value === "s") newBounds.height += localDeltaY
        else if (scaleHandle.value === "w") newBounds.width -= localDeltaX
      } else {
        // Corner handles
        if (isLeft) newBounds.width -= localDeltaX
        if (isRight) newBounds.width += localDeltaX
        if (isTop) newBounds.height -= localDeltaY
        if (isBottom) newBounds.height += localDeltaY
      }
    } else {
      // No rotation: apply deltas to both dimensions and position
      if (isEdgeHandle) {
        if (scaleHandle.value === "n") {
          newBounds.y += deltaY
          newBounds.height -= deltaY
        } else if (scaleHandle.value === "e") {
          newBounds.width += deltaX
        } else if (scaleHandle.value === "s") {
          newBounds.height += deltaY
        } else if (scaleHandle.value === "w") {
          newBounds.x += deltaX
          newBounds.width -= deltaX
        }
      } else {
        // Corner handles
        if (isLeft) {
          newBounds.x += deltaX
          newBounds.width -= deltaX
        }
        if (isRight) newBounds.width += deltaX
        if (isTop) {
          newBounds.y += deltaY
          newBounds.height -= deltaY
        }
        if (isBottom) newBounds.height += deltaY
      }
    }

    // Calculate minimum size - check if tool provides custom minimum dimensions
    let minWidth = 10
    let minHeight = 10

    // For single selection, check if tool provides custom minimum dimensions
    if (selection.selectedAnnotations.value.length === 1) {
      const annotation = selection.selectedAnnotations.value[0]
      if (annotation) {
        const tool = toolRegistry.getTool(annotation.type)
        if (tool?.getMinDimensions) {
          const minDimensions = tool.getMinDimensions(annotation)
          minWidth = minDimensions.width
          minHeight = minDimensions.height
        }
      }
    }

    // Prevent scaling below minimum size
    if (newBounds.width < minWidth) {
      if (isLeft && rotation === 0)
        newBounds.x = scaleOriginalBounds.value!.x + scaleOriginalBounds.value!.width - minWidth
      newBounds.width = minWidth
    }
    if (newBounds.height < minHeight) {
      if (isTop && rotation === 0)
        newBounds.y = scaleOriginalBounds.value!.y + scaleOriginalBounds.value!.height - minHeight
      newBounds.height = minHeight
    }

    // Calculate scale factors from bounds ratio
    const scaleX = newBounds.width / scaleOriginalBounds.value!.width
    const scaleY = newBounds.height / scaleOriginalBounds.value!.height

    // Get center of original bounds
    const centerX = scaleOriginalBounds.value!.x + scaleOriginalBounds.value!.width / 2
    const centerY = scaleOriginalBounds.value!.y + scaleOriginalBounds.value!.height / 2

    // Apply scaling to all selected annotations
    for (const annotation of selection.selectedAnnotations.value) {
      // Annotations with points array - scale points from original
      if (hasPointsArray(annotation)) {
        const originalPoints = scaleOriginalPoints.value.get(annotation.id)
        if (!originalPoints) continue

        let scaledPoints: Point[]

        // For single selection without rotation: scale using newBounds
        // For multi-selection or with rotation: scale from selection center
        if (!selection.isMultiSelection.value && bounds.selectionRotation.value === 0) {
          // Scale from newBounds (accounts for handle direction)
          scaledPoints = originalPoints.map((p) => ({
            x: newBounds.x + (p.x - scaleOriginalBounds.value!.x) * Math.abs(scaleX),
            y: newBounds.y + (p.y - scaleOriginalBounds.value!.y) * Math.abs(scaleY)
          }))
        } else {
          // Multi-select or with rotation: scale each point relative to selection center
          scaledPoints = originalPoints.map((p) => {
            const offsetX = p.x - centerX
            const offsetY = p.y - centerY
            return {
              x: centerX + offsetX * scaleX,
              y: centerY + offsetY * scaleY
            }
          })
        }

        // Recalculate derived values (distance, area, etc.)
        // Type assertion needed because scaledPoints is Point[] but specific types expect tuples
        const derived = recalculateDerivedValues({
          ...annotation,
          points: scaledPoints
        } as typeof annotation)

        // Update with scaled points and recalculated derived values
        // Use Object.assign to merge objects properly for TypeScript
        annotationStore.updateAnnotation(annotation.id, Object.assign({ points: scaledPoints }, derived))
      }
      // Positioned rectangle annotations - scale dimensions and position
      else if (hasPositionedRect(annotation)) {
        const original = scaleOriginalShapes.value.get(annotation.id)
        if (!original) continue

        // Calculate shape's center in original state
        const shapeCenterX = original.x + original.width / 2
        const shapeCenterY = original.y + original.height / 2

        // Scale dimensions
        const scaledWidth = original.width * Math.abs(scaleX)
        const scaledHeight = original.height * Math.abs(scaleY)

        // Scale position relative to selection center
        const offsetX = shapeCenterX - centerX
        const offsetY = shapeCenterY - centerY

        const newCenterX = centerX + offsetX * scaleX
        const newCenterY = centerY + offsetY * scaleY

        // Update positioned annotation
        annotationStore.updateAnnotation(
          annotation.id,
          Object.assign({
            width: scaledWidth,
            height: scaledHeight,
            x: newCenterX - scaledWidth / 2,
            y: newCenterY - scaledHeight / 2
          })
        )
      }
    }

    // Update frozen bounds if they exist (from rotation) - scale the frozen bounds from center
    // This keeps the transformer stable if we're scaling after rotating
    if (bounds.frozenBounds.value) {
      bounds.updateFrozenBounds({
        x: centerX - (scaleOriginalBounds.value!.width / 2) * Math.abs(scaleX),
        y: centerY - (scaleOriginalBounds.value!.height / 2) * Math.abs(scaleY),
        width: scaleOriginalBounds.value!.width * Math.abs(scaleX),
        height: scaleOriginalBounds.value!.height * Math.abs(scaleY)
      })
    }
  }

  /**
   * End scaling
   */
  function endScale() {
    if (!isScaling.value) return

    console.log("🚫 [endScale] Scale operation ended", {
      hasFrozenBounds: !!bounds.frozenBounds.value,
      selectionRotation: bounds.selectionRotation.value
    })

    isScaling.value = false
    scaleHandle.value = null
    scaleStartPoint.value = null
    scaleOriginalBounds.value = null
    scaleOriginalShapes.value.clear()
    scaleOriginalPoints.value.clear()
    cursor.reset()
    coordinates.clearSvgCache()

    transformFinalise.finaliseTransformGesture({
      originalAnnotations: scaleOriginalAnnotations.value,
      annotations: selection.selectedAnnotations.value,
      description: "Resize selection"
    })

    // Mark drag end to prevent click from clearing selection
    dragState.markDragEnd()
  }

  return {
    // State
    isScaling: readonly(isScaling),
    scaleHandle: readonly(scaleHandle),

    // Methods
    startScale,
    updateScale,
    endScale
  }
})
