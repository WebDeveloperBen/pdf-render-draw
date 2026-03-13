/**
 * useEditorBounds - Bounds calculation with frozen pattern
 * Extracted from SimpleDebugEditor.vue
 *
 * Calculates bounding boxes for selected annotations
 * Implements frozen bounds pattern to prevent transformer jumping during rotation
 * Supports both point-based and positioned annotations
 */

export const useEditorBounds = createSharedComposable(() => {
  const selection = useEditorSelection()

  // Selection group rotation (accumulated during rotation)
  const selectionRotation = ref(0)

  // Frozen bounds (locked during rotation to prevent jumping)
  const frozenBounds = ref<Bounds | null>(null)

  /**
   * Calculate bounds for a single annotation
   * Handles both point-based and positioned annotations
   */
  function calculateShapeBounds(annotation: Annotation): Bounds {
    return calculateAnnotationBounds(annotation)
  }

  /**
   * Selection bounds - uses frozen bounds if available (during/after rotation), otherwise calculates
   * Matches SimpleDebugEditor.vue behavior: only freeze during rotation
   */
  const selectionBounds = computed(() => {
    if (selection.selectedIds.value.length === 0) {
      return null
    }

    // If we have frozen bounds AND selection rotation (during or after rotation)
    // use the locked bounds to keep transformer stable
    if (frozenBounds.value && selectionRotation.value !== 0) {
      return frozenBounds.value
    }

    // Multi-selection - calculate union of rotated bounds (check this FIRST!)
    if (selection.isMultiSelection.value) {
      const allBounds = selection.selectedShapes.value.map((s) => calculateShapeBounds(s))
      return calculateUnionBounds(allBounds)
    }

    // Single selection - use rotated bounds and sync selectionRotation with shape's rotation
    if (selection.selectedShape.value) {
      const shape = selection.selectedShape.value
      const result = calculateShapeBounds(shape)

      // Sync selectionRotation with the shape's rotation so transform handles rotate correctly
      // This ensures handles "hug" the rotated shape instead of showing axis-aligned box
      if (shape.rotation !== selectionRotation.value) {
        selectionRotation.value = shape.rotation
      }

      return result
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
    (newIds, oldIds) => {
      const oldArray = oldIds ? [...oldIds] : []
      const newArray = newIds ? [...newIds] : []

      // Only unfreeze if selection actually changed
      if (JSON.stringify(oldArray) !== JSON.stringify(newArray)) {
        unfreezeBounds()
      }
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
