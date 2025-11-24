/**
 * useEditorSelection - Selection state management
 * Extracted from DebugEditor.vue
 *
 * Manages which annotations are currently selected
 * Supports single selection, multi-selection (Shift+Click), and marquee selection
 * Works with all annotation types (point-based and positioned)
 */

import type { Annotation } from "~/types/annotations"

export const useEditorSelection = createSharedComposable(() => {
  // Selected annotation IDs
  const selectedIds = ref<string[]>([])

  // All annotations (will be provided by parent or store)
  const annotations = ref<Annotation[]>([])

  // Computed: selected annotations
  const selectedAnnotations = computed(() => {
    if (selectedIds.value.length === 0) return []
    return annotations.value.filter((a) => selectedIds.value.includes(a.id))
  })

  // Computed: single selected annotation
  const selectedAnnotation = computed(() => {
    if (selectedIds.value.length === 1) {
      return annotations.value.find((a) => a.id === selectedIds.value[0]) || null
    }
    return null
  })

  // Alias for backwards compatibility with Shape naming
  const selectedShapes = selectedAnnotations
  const selectedShape = selectedAnnotation
  const shapes = annotations

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
    annotations,
    shapes, // Alias for backwards compatibility

    // Computed
    selectedAnnotations,
    selectedAnnotation,
    selectedShapes, // Alias for backwards compatibility
    selectedShape, // Alias for backwards compatibility
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
