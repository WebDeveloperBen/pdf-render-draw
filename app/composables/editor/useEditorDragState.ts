/**
 * Shared Drag State
 *
 * Tracks when transforms are being dragged to prevent click handlers
 * from firing immediately after drag ends.
 */

export const useEditorDragState = createSharedComposable(() => {
  const justFinishedDragging = ref(false)
  let preventClickTimer: ReturnType<typeof setTimeout> | null = null

  function markDragEnd() {
    justFinishedDragging.value = true

    // Reset after a short delay to allow click event to be blocked
    if (preventClickTimer) clearTimeout(preventClickTimer)
    preventClickTimer = setTimeout(() => {
      justFinishedDragging.value = false
    }, 150)
  }

  function isDragJustFinished(): boolean {
    return justFinishedDragging.value
  }

  return {
    markDragEnd,
    isDragJustFinished
  }
})
