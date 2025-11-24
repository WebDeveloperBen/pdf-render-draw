/**
 * useEditorEventHandlers - Central event coordination
 * Extracted from DebugEditor.vue
 *
 * Coordinates all mouse event handlers and prevents accidental interactions
 */

import { useEditorSelection } from "./useEditorSelection"
import { useEditorBounds } from "./useEditorBounds"
import { useEditorRotation } from "./useEditorRotation"
import { useEditorScale } from "./useEditorScale"
import { useEditorMove } from "./useEditorMove"
import { useEditorMarquee } from "./useEditorMarquee"

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
  function handleShapeClick(shapeId: string, event: MouseEvent) {
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
    if (
      move.isDragging.value ||
      rotation.isRotating.value ||
      scale.isScaling.value ||
      justFinishedInteraction.value
    )
      return

    selection.clearSelection()
  }

  /**
   * Global mousemove handler (updates all active interactions)
   */
  function handleGlobalMouseMove(event: MouseEvent) {
    move.updateDrag(event)
    rotation.updateRotation(event)
    scale.updateScale(event)
    marquee.updateMarquee(event)
  }

  /**
   * Global mouseup handler (ends all active interactions)
   */
  function handleGlobalMouseUp() {
    const wasInteracting =
      move.isDragging.value ||
      rotation.isRotating.value ||
      scale.isScaling.value ||
      marquee.isMarqueeSelecting.value

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

    window.addEventListener("mousemove", handleGlobalMouseMove)
    window.addEventListener("mouseup", handleGlobalMouseUp)
  }

  /**
   * Clean up global mouse event listeners
   */
  function cleanupGlobalListeners() {
    if (typeof window === "undefined") return

    window.removeEventListener("mousemove", handleGlobalMouseMove)
    window.removeEventListener("mouseup", handleGlobalMouseUp)
  }

  return {
    // Methods
    handleShapeClick,
    handleBackgroundClick,
    setupGlobalListeners,
    cleanupGlobalListeners
  }
})
