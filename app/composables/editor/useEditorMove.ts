/**
 * useEditorMove - Move/drag logic
 * Extracted from DebugEditor.vue
 *
 * Handles dragging selected shapes to move them
 * Maintains frozen bounds during drag
 */

import type { Point, Bounds } from "~/types/editor"
import type { Annotation } from "~/types/annotations"
import { recalculateDerivedValues, isPointBased, getAnnotationCenter } from "~/utils/editor/derived-values"
import { useEditorSelection } from "./useEditorSelection"
import { useEditorBounds } from "./useEditorBounds"
import { useEditorCoordinates } from "./useEditorCoordinates"

export const useEditorMove = createSharedComposable(() => {
  const selection = useEditorSelection()
  const bounds = useEditorBounds()
  const coordinates = useEditorCoordinates()
  const cursor = useCursor()
  const annotationStore = useAnnotationStore()
  const dragState = useDragState()

  // Drag state
  const isDragging = ref(false)
  const dragStartPoint = ref<Point | null>(null)
  const dragOriginalPositions = ref<Map<string, { x: number; y: number }>>(new Map())
  const dragOriginalPoints = ref<Map<string, Point[]>>(new Map())
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

    // Store original positions/points of all selected annotations
    dragOriginalPositions.value.clear()
    dragOriginalPoints.value.clear()

    for (const annotation of selection.selectedAnnotations.value) {
      // Point-based annotations - store points array
      if (isPointBased(annotation)) {
        dragOriginalPoints.value.set(annotation.id, JSON.parse(JSON.stringify(annotation.points)))
      }
      // Positioned annotations - store x, y
      else if ('x' in annotation && 'y' in annotation) {
        dragOriginalPositions.value.set(annotation.id, { x: annotation.x, y: annotation.y })
      }
    }

    // Store original frozen bounds (just frozen above or from previous rotation)
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

    // Move all selected annotations
    for (const annotation of selection.selectedAnnotations.value) {
      const updates: Partial<Annotation> = {}

      // Point-based annotations - translate all points
      if (isPointBased(annotation)) {
        const originalPoints = dragOriginalPoints.value.get(annotation.id)
        if (originalPoints) {
          const movedPoints = originalPoints.map((p) => ({
            x: p.x + deltaX,
            y: p.y + deltaY
          }))

          updates.points = movedPoints

          // Recalculate derived values (distance, area, etc.)
          const derived = recalculateDerivedValues({
            ...annotation,
            points: movedPoints
          })
          Object.assign(updates, derived)
        }
      }
      // Positioned annotations - update x, y
      else if ('x' in annotation && 'y' in annotation) {
        const originalPos = dragOriginalPositions.value.get(annotation.id)
        if (originalPos) {
          updates.x = originalPos.x + deltaX
          updates.y = originalPos.y + deltaY
        }
      }

      // Update annotation in store
      if (Object.keys(updates).length > 0) {
        annotationStore.updateAnnotation(annotation.id, updates)
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

    console.log('🚫 [endDrag] Drag operation ended', {
      hasFrozenBounds: !!bounds.frozenBounds.value,
      selectionRotation: bounds.selectionRotation.value
    })

    isDragging.value = false
    dragStartPoint.value = null
    dragOriginalPositions.value.clear()
    dragOriginalPoints.value.clear()
    dragOriginalLockedBounds.value = null
    cursor.reset()
    coordinates.clearSvgCache()

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
