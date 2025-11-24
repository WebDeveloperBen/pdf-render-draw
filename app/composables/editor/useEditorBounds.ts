/**
 * useEditorBounds - Bounds calculation with frozen pattern
 * Extracted from DebugEditor.vue
 *
 * Calculates bounding boxes for selected shapes
 * Implements frozen bounds pattern to prevent transformer jumping during rotation
 */

import type { Bounds, Shape } from "~/types/editor"
import { calculateRotatedRectBounds, calculateUnionBounds, getBoundsCenter } from "~/utils/editor/bounds"
import { useEditorSelection } from "./useEditorSelection"

export const useEditorBounds = createSharedComposable(() => {
  const selection = useEditorSelection()

  // Selection group rotation (accumulated during rotation)
  const selectionRotation = ref(0)

  // Frozen bounds (locked during rotation to prevent jumping)
  const frozenBounds = ref<Bounds | null>(null)

  /**
   * Calculate bounds for a single shape
   */
  function calculateShapeBounds(shape: Shape): Bounds {
    return calculateRotatedRectBounds(
      shape.x,
      shape.y,
      shape.width,
      shape.height,
      shape.rotation
    )
  }

  /**
   * Selection bounds - uses frozen bounds if available, otherwise calculates
   * This prevents transformer jumping during rotation
   */
  const selectionBounds = computed(() => {
    if (selection.selectedIds.value.length === 0) return null

    // If we have frozen bounds and selection rotation (during or after rotation)
    // use the frozen bounds to keep transformer stable
    if (frozenBounds.value && selectionRotation.value !== 0) {
      return frozenBounds.value
    }

    // Single selection - use rotated bounds
    if (selection.selectedShape.value) {
      return calculateShapeBounds(selection.selectedShape.value)
    }

    // Multi-selection - calculate union of rotated bounds
    if (selection.selectedShapes.value.length > 1) {
      const allBounds = selection.selectedShapes.value.map((s) => calculateShapeBounds(s))
      return calculateUnionBounds(allBounds)
    }

    return null
  })

  /**
   * Selection center point
   */
  const selectionCenter = computed(() => {
    if (!selectionBounds.value) return null
    return getBoundsCenter(selectionBounds.value)
  })

  /**
   * Lock current bounds (called when rotation starts)
   */
  function freezeBounds() {
    if (selectionBounds.value) {
      frozenBounds.value = { ...selectionBounds.value }
    }
  }

  /**
   * Unlock bounds (called when selection changes)
   */
  function unfreezeBounds() {
    frozenBounds.value = null
    selectionRotation.value = 0
  }

  /**
   * Update frozen bounds (during drag to keep transformer aligned)
   */
  function updateFrozenBounds(bounds: Bounds) {
    frozenBounds.value = bounds
  }

  /**
   * Set selection rotation
   */
  function setSelectionRotation(rotation: number) {
    selectionRotation.value = rotation
  }

  // Reset frozen bounds when selection changes
  watch(
    () => selection.selectedIds.value,
    () => {
      unfreezeBounds()
    },
    { deep: true }
  )

  return {
    // State
    selectionRotation: readonly(selectionRotation),
    frozenBounds: readonly(frozenBounds),

    // Computed
    selectionBounds,
    selectionCenter,

    // Methods
    calculateShapeBounds,
    freezeBounds,
    unfreezeBounds,
    updateFrozenBounds,
    setSelectionRotation
  }
})
