/**
 * useEditorSelection - Selection state management
 * Extracted from DebugEditor.vue
 *
 * Manages which shapes are currently selected
 * Supports single selection, multi-selection (Shift+Click), and marquee selection
 */

import type { Shape } from "~/types/editor"

export const useEditorSelection = createSharedComposable(() => {
  // Selected shape IDs
  const selectedIds = ref<string[]>([])

  // All shapes (will be provided by parent or store)
  const shapes = ref<Shape[]>([])

  // Computed: selected shapes
  const selectedShapes = computed(() => {
    if (selectedIds.value.length === 0) return []
    return shapes.value.filter((s) => selectedIds.value.includes(s.id))
  })

  // Computed: single selected shape (for backwards compatibility)
  const selectedShape = computed(() => {
    if (selectedIds.value.length === 1) {
      return shapes.value.find((s) => s.id === selectedIds.value[0]) || null
    }
    return null
  })

  // Computed: is multi-selection active
  const isMultiSelection = computed(() => selectedIds.value.length > 1)

  // Computed: has selection
  const hasSelection = computed(() => selectedIds.value.length > 0)

  /**
   * Select a single shape (replaces current selection)
   */
  function selectShape(shapeId: string) {
    selectedIds.value = [shapeId]
  }

  /**
   * Toggle shape selection (Shift+Click behavior)
   */
  function toggleShape(shapeId: string) {
    if (selectedIds.value.includes(shapeId)) {
      selectedIds.value = selectedIds.value.filter((id) => id !== shapeId)
    } else {
      selectedIds.value = [...selectedIds.value, shapeId]
    }
  }

  /**
   * Add shape to selection
   */
  function addToSelection(shapeId: string) {
    if (!selectedIds.value.includes(shapeId)) {
      selectedIds.value = [...selectedIds.value, shapeId]
    }
  }

  /**
   * Add multiple shapes to selection
   */
  function addMultipleToSelection(shapeIds: string[]) {
    selectedIds.value = [...new Set([...selectedIds.value, ...shapeIds])]
  }

  /**
   * Set selection to specific shape IDs
   */
  function setSelection(shapeIds: string[]) {
    selectedIds.value = shapeIds
  }

  /**
   * Clear all selection
   */
  function clearSelection() {
    selectedIds.value = []
  }

  /**
   * Check if a shape is selected
   */
  function isSelected(shapeId: string): boolean {
    return selectedIds.value.includes(shapeId)
  }

  return {
    // State
    selectedIds: readonly(selectedIds),
    shapes,

    // Computed
    selectedShapes,
    selectedShape,
    isMultiSelection,
    hasSelection,

    // Methods
    selectShape,
    toggleShape,
    addToSelection,
    addMultipleToSelection,
    setSelection,
    clearSelection,
    isSelected
  }
})
