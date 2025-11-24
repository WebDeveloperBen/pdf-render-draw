/**
 * useEditorMove - Move/drag logic
 * Extracted from DebugEditor.vue
 *
 * Handles dragging selected shapes to move them
 * Maintains frozen bounds during drag
 */

import type { Point, Bounds } from "~/types/editor"
import { useEditorSelection } from "./useEditorSelection"
import { useEditorBounds } from "./useEditorBounds"
import { useEditorCoordinates } from "./useEditorCoordinates"

export const useEditorMove = createSharedComposable(() => {
  const selection = useEditorSelection()
  const bounds = useEditorBounds()
  const coordinates = useEditorCoordinates()
  const cursor = useCursor()

  // Drag state
  const isDragging = ref(false)
  const dragStartPoint = ref<Point | null>(null)
  const dragOriginalPositions = ref<Map<string, { x: number; y: number }>>(new Map())
  const dragOriginalLockedBounds = ref<Bounds | null>(null)

  /**
   * Start dragging
   */
  function startDrag(event: MouseEvent) {
    if (!selection.hasSelection.value) return

    const svg = getRootSVG(event.currentTarget)
    if (!svg) return

    coordinates.cacheSvg(svg)
    const svgPoint = coordinates.convertToSvgPoint(event, svg)
    if (!svgPoint) return

    isDragging.value = true
    dragStartPoint.value = svgPoint
    cursor.set("grabbing")

    // Store original positions of all selected shapes
    dragOriginalPositions.value.clear()
    for (const shape of selection.selectedShapes.value) {
      dragOriginalPositions.value.set(shape.id, { x: shape.x, y: shape.y })
    }

    // Store original frozen bounds if they exist (from previous rotation)
    if (bounds.frozenBounds.value) {
      dragOriginalLockedBounds.value = { ...bounds.frozenBounds.value }
    }

    event.stopPropagation()
  }

  /**
   * Update drag as mouse moves
   */
  function updateDrag(event: MouseEvent) {
    if (!isDragging.value || !dragStartPoint.value) return

    const svgPoint = coordinates.convertToSvgPoint(event)
    if (!svgPoint) return

    const deltaX = svgPoint.x - dragStartPoint.value.x
    const deltaY = svgPoint.y - dragStartPoint.value.y

    // Move all selected shapes
    for (const shape of selection.selectedShapes.value) {
      const originalPos = dragOriginalPositions.value.get(shape.id)
      if (originalPos) {
        shape.x = originalPos.x + deltaX
        shape.y = originalPos.y + deltaY
      }
    }

    // If we have frozen bounds (from a previous rotation), update their position too
    if (dragOriginalLockedBounds.value) {
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
    dragOriginalLockedBounds.value = null
    cursor.reset()
    coordinates.clearSvgCache()
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
