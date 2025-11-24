/**
 * useEditorSelection - Selection state management
 * Extracted from DebugEditor.vue
 *
 * Manages which annotations are currently selected
 * Supports single selection, multi-selection (Shift+Click), and marquee selection
 * Works with all annotation types (point-based and positioned)
 */

import type { Annotation } from "~/types/annotations"
import { rotatePointsAroundCenter } from "~/utils/editor/transform"
import { recalculateDerivedValues, isPointBased, getAnnotationCenter } from "~/utils/editor/derived-values"

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
    console.log('🎯 selectShape called:', shapeId, 'current selection:', selectedIds.value)

    // If clicking the same shape that's already the only selection, do nothing
    // This prevents baking rotation when clicking on an already-selected shape
    if (selectedIds.value.length === 1 && selectedIds.value[0] === shapeId) {
      console.log('   ↳ Same shape already selected, skipping')
      return
    }

    console.log('   ↳ Changing selection, will bake rotation')
    // We're changing selection - bake rotation into previously selected annotations
    for (const annotation of selectedAnnotations.value) {
      bakeRotationIntoPoints(annotation)
    }

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
   * Bake rotation into points for point-based annotations
   * This applies the CSS rotation transform to the actual point coordinates
   */
  function bakeRotationIntoPoints(annotation: Annotation) {
    if (!isPointBased(annotation) || annotation.rotation === 0) return

    console.log('🔄 Baking rotation into points for annotation:', annotation.id, 'rotation:', annotation.rotation)

    // Get center and rotate points
    const center = getAnnotationCenter(annotation)
    const rotatedPoints = rotatePointsAroundCenter(
      annotation.points,
      center,
      annotation.rotation
    )

    // Update annotation with rotated points and reset rotation
    annotation.points = rotatedPoints
    annotation.rotation = 0

    // Recalculate derived values
    const derived = recalculateDerivedValues(annotation)
    Object.assign(annotation, derived)
  }

  /**
   * Clear all selection (and bake rotation into points)
   */
  function clearSelection() {
    // Bake rotation into points before clearing selection
    for (const annotation of selectedAnnotations.value) {
      bakeRotationIntoPoints(annotation)
    }
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
