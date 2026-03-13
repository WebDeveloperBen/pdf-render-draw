/**
 * useEditorEventHandlers - Central event coordination
 * Extracted from SimpleDebugEditor.vue
 *
 * Coordinates all mouse event handlers and prevents accidental interactions
 */

export const useEditorEventHandlers = createSharedComposable(() => {
  const selection = useEditorSelection()
  const bounds = useEditorBounds()
  const rotation = useEditorRotation()
  const scale = useEditorScale()
  const move = useEditorMove()
  const marquee = useEditorMarquee()

  // Prevent background clicks immediately after drag/rotate/scale ends
  const justFinishedInteraction = ref(false)

  /**
   * Handle shape click (with Shift support for multi-select)
   */
  function handleShapeClick(shapeId: string, event: EditorInputEvent) {
    event.stopPropagation()

    if (event.shiftKey) {
      // Shift+click: toggle selection
      selection.toggleShape(shapeId)
    } else {
      // Regular click: single select
      selection.selectShape(shapeId)
    }

    // Reset selection rotation and frozen bounds when selection changes
    // This ensures transform handles recalculate from actual shape positions
    bounds.unfreezeBounds()
  }

  /**
   * Handle background click (deselect all)
   */
  function handleBackgroundClick() {
    // Don't deselect if we just finished an interaction
    if (move.isDragging.value || rotation.isRotating.value || scale.isScaling.value || justFinishedInteraction.value) {
      return
    }

    selection.clearSelection()
  }

  // RAF batching: coalesce rapid pointermove events into a single frame update.
  // On 120Hz+ displays, multiple pointermove events can fire between frames —
  // only the latest event matters for each animation frame.
  let pendingMoveEvent: EditorInputEvent | null = null
  let moveRafId: number | null = null

  function processMoveFrame() {
    moveRafId = null
    if (!pendingMoveEvent) return
    const event = pendingMoveEvent
    pendingMoveEvent = null

    move.updateDrag(event)
    rotation.updateRotation(event)
    scale.updateScale(event)
    marquee.updateMarquee(event)
  }

  /**
   * Global pointermove handler — batched via requestAnimationFrame
   */
  function handleGlobalMouseMove(event: EditorInputEvent) {
    pendingMoveEvent = event
    if (moveRafId === null) {
      moveRafId = requestAnimationFrame(processMoveFrame)
    }
  }

  /**
   * Global pointerup handler (ends all active interactions)
   */
  function handleGlobalMouseUp() {
    // Flush any pending move before ending interactions
    if (pendingMoveEvent) {
      if (moveRafId !== null) {
        cancelAnimationFrame(moveRafId)
        moveRafId = null
      }
      processMoveFrame()
    }

    const wasInteracting =
      move.isDragging.value || rotation.isRotating.value || scale.isScaling.value || marquee.isMarqueeSelecting.value

    move.endDrag()
    rotation.endRotation()
    scale.endScale()
    marquee.endMarquee()

    // Prevent accidental background clicks
    if (wasInteracting) {
      justFinishedInteraction.value = true
      setTimeout(() => {
        justFinishedInteraction.value = false
      }, 100)
    }
  }

  /**
   * Set up global mouse event listeners
   */
  function setupGlobalListeners() {
    if (typeof window === "undefined") return

    window.addEventListener("pointermove", handleGlobalMouseMove)
    window.addEventListener("pointerup", handleGlobalMouseUp)
  }

  /**
   * Clean up global mouse event listeners
   */
  function cleanupGlobalListeners() {
    if (typeof window === "undefined") return

    window.removeEventListener("pointermove", handleGlobalMouseMove)
    window.removeEventListener("pointerup", handleGlobalMouseUp)

    // Cancel any pending RAF
    if (moveRafId !== null) {
      cancelAnimationFrame(moveRafId)
      moveRafId = null
      pendingMoveEvent = null
    }
  }

  return {
    // Methods
    handleShapeClick,
    handleBackgroundClick,
    setupGlobalListeners,
    cleanupGlobalListeners
  }
})
