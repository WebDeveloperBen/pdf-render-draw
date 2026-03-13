/**
 * useEditorMarquee - Marquee selection logic
 * Extracted from SimpleDebugEditor.vue
 *
 * Handles drag-to-select (marquee selection)
 * Supports adding to selection with Shift key
 */

export const useEditorMarquee = createSharedComposable(() => {
  const selection = useEditorSelection()
  const bounds = useEditorBounds()
  const coordinates = useEditorCoordinates()
  const cursor = useCursor()
  const viewportStore = useViewportStore()

  // Marquee state
  const isMarqueeSelecting = ref(false)
  const marqueeStartPoint = ref<Point | null>(null)
  const marqueeEndPoint = ref<Point | null>(null)
  const marqueeShiftKey = ref(false)

  // Prevent click events from clearing selection immediately after marquee ends
  const marqueeJustFinished = ref(false)
  let marqueeFinishedTimeout: ReturnType<typeof setTimeout> | null = null

  /**
   * Marquee bounds (computed from start and end points)
   */
  const marqueeBounds = computed<Bounds | null>(() => {
    if (!marqueeStartPoint.value || !marqueeEndPoint.value) return null

    const x1 = marqueeStartPoint.value.x
    const y1 = marqueeStartPoint.value.y
    const x2 = marqueeEndPoint.value.x
    const y2 = marqueeEndPoint.value.y

    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    }
  })

  /**
   * Start marquee selection
   */
  function startMarquee(event: MouseEvent) {
    // Don't start marquee if clicking on a shape, handle, or selection box
    const target = event.target as Element
    if (
      target.closest(".shape") ||
      target.closest(".selection-box") ||
      target.closest(".rotation-handle") ||
      target.closest(".scale-handle")
    ) {
      return
    }

    const svg = getRootSVG(event.currentTarget)
    if (!svg) return

    coordinates.cacheSvg(svg)
    const svgPoint = coordinates.convertToSvgPoint(event, svg)
    if (!svgPoint) return

    isMarqueeSelecting.value = true
    marqueeStartPoint.value = svgPoint
    marqueeEndPoint.value = svgPoint
    marqueeShiftKey.value = event.shiftKey
    cursor.set("crosshair")

    // If not holding shift, clear selection
    if (!event.shiftKey) {
      selection.clearSelection()
      bounds.unfreezeBounds()
    }

    event.stopPropagation()
  }

  /**
   * Update marquee as mouse moves
   */
  function updateMarquee(event: MouseEvent) {
    if (!isMarqueeSelecting.value) return

    const svgPoint = coordinates.convertToSvgPoint(event)
    if (!svgPoint) return

    marqueeEndPoint.value = svgPoint
  }

  /**
   * End marquee selection
   */
  function endMarquee() {
    if (!isMarqueeSelecting.value || !marqueeBounds.value) return

    // Find shapes that intersect with marquee
    const marquee = marqueeBounds.value
    const intersectingIds: string[] = []

    for (const shape of selection.shapes.value) {
      if (shape.pageNum !== viewportStore.getCurrentPage) continue
      // Simple AABB intersection test
      const shapeBounds = bounds.calculateShapeBounds(shape)

      if (boundsIntersect(shapeBounds, marquee)) {
        intersectingIds.push(shape.id)
      }
    }

    // Update selection
    if (marqueeShiftKey.value) {
      // Add to existing selection
      selection.addMultipleToSelection(intersectingIds)
    } else {
      // Replace selection
      selection.setSelection(intersectingIds)
    }

    // Reset marquee state
    isMarqueeSelecting.value = false
    marqueeStartPoint.value = null
    marqueeEndPoint.value = null
    marqueeShiftKey.value = false
    cursor.reset()
    coordinates.clearSvgCache()

    // Set "just finished" flag to prevent click from clearing selection
    // Clear any existing timeout
    if (marqueeFinishedTimeout) {
      clearTimeout(marqueeFinishedTimeout)
    }
    marqueeJustFinished.value = true
    marqueeFinishedTimeout = setTimeout(() => {
      marqueeJustFinished.value = false
      marqueeFinishedTimeout = null
    }, 100) // Same delay as dragState uses

    // Reset frozen bounds when selection changes
    if (intersectingIds.length > 0) {
      bounds.unfreezeBounds()
    }
  }

  /**
   * Check if marquee selection just finished (prevents click from clearing selection)
   */
  function isMarqueeJustFinished(): boolean {
    return marqueeJustFinished.value
  }

  return {
    // State
    isMarqueeSelecting: readonly(isMarqueeSelecting),
    marqueeBounds,

    // Methods
    startMarquee,
    updateMarquee,
    endMarquee,
    isMarqueeJustFinished
  }
})
