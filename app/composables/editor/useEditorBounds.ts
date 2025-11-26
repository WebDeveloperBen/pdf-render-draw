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
      console.log("🔲 [selectionBounds] No selection, returning null")
      return null
    }

    // If we have frozen bounds AND selection rotation (during or after rotation)
    // use the locked bounds to keep transformer stable
    if (frozenBounds.value && selectionRotation.value !== 0) {
      console.log("🔲 [selectionBounds] Using frozen bounds", {
        hasFrozen: !!frozenBounds.value,
        rotation: selectionRotation.value,
        bounds: frozenBounds.value
      })
      return frozenBounds.value
    }

    // Multi-selection - calculate union of rotated bounds (check this FIRST!)
    if (selection.isMultiSelection.value) {
      const allBounds = selection.selectedShapes.value.map((s) => calculateShapeBounds(s))
      const result = calculateUnionBounds(allBounds)
      console.log("🔲 [selectionBounds] Multi-select, calculating union", { result })
      return result
    }

    // Single selection - use rotated bounds and sync selectionRotation with shape's rotation
    if (selection.selectedShape.value) {
      const shape = selection.selectedShape.value
      const result = calculateShapeBounds(shape)

      // Sync selectionRotation with the shape's rotation so transform handles rotate correctly
      // This ensures handles "hug" the rotated shape instead of showing axis-aligned box
      if (shape.rotation !== selectionRotation.value) {
        console.log("🔲 [selectionBounds] Syncing selectionRotation with shape rotation", {
          from: selectionRotation.value,
          to: shape.rotation
        })
        selectionRotation.value = shape.rotation
      }

      console.log("🔲 [selectionBounds] Single select, calculating bounds", { result })
      return result
    }

    console.log("🔲 [selectionBounds] Fallback to null")
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
      console.log("❄️ [freezeBounds] Bounds frozen", frozenBounds.value)
    } else {
      console.log("❄️ [freezeBounds] Cannot freeze - no selection bounds")
    }
  }

  /**
   * Unlock bounds (called when selection changes)
   */
  function unfreezeBounds() {
    console.log("🔥 [unfreezeBounds] Clearing frozen bounds and rotation", {
      hadFrozen: !!frozenBounds.value,
      hadRotation: selectionRotation.value
    })
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
    console.log("🔄 [setSelectionRotation]", {
      from: selectionRotation.value,
      to: rotation,
      degrees: (rotation * 180) / Math.PI
    })
    selectionRotation.value = rotation
  }

  // Reset frozen bounds when selection changes
  watch(
    () => selection.selectedIds.value,
    (newIds, oldIds) => {
      // Convert to regular arrays to see actual values
      const oldArray = oldIds ? [...oldIds] : []
      const newArray = newIds ? [...newIds] : []

      console.log("👀 [watch selectedIds] Selection changed, calling unfreezeBounds", {
        from: oldArray,
        to: newArray,
        same: JSON.stringify(oldArray) === JSON.stringify(newArray)
      })

      // Only unfreeze if selection actually changed
      if (JSON.stringify(oldArray) !== JSON.stringify(newArray)) {
        unfreezeBounds()
      } else {
        console.log("👀 [watch selectedIds] Arrays are the same, NOT unfreezing")
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
