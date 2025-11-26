/**
 * useEditorSelection - Selection state management
 * Extracted from SimpleDebugEditor.vue
 *
 * Manages which annotations are currently selected
 * Supports single selection, multi-selection (Shift+Click), and marquee selection
 * Works with all annotation types (point-based and positioned)
 */

export const useEditorSelection = createSharedComposable(() => {
  // Bridge to annotation store - use it as the single source of truth
  const annotationStore = useAnnotationStore()

  // Selected annotation IDs - read from store
  const selectedIds = computed(() => annotationStore.selectedAnnotationIds)

  // All annotations - read from store
  const annotations = computed(() => annotationStore.annotations)

  // Computed: selected annotations
  const selectedAnnotations = computed(() => {
    return annotationStore.selectedAnnotations
  })

  // Computed: single selected annotation
  const selectedAnnotation = computed(() => {
    return annotationStore.selectedAnnotation
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
    console.log("🎯 selectShape called:", shapeId, "current selection:", selectedIds.value)

    // If clicking the same shape that's already the only selection, do nothing
    // This prevents baking rotation when clicking on an already-selected shape
    if (selectedIds.value.length === 1 && selectedIds.value[0] === shapeId) {
      console.log("   ↳ Same shape already selected, skipping")
      return
    }

    console.log("   ↳ Changing selection, will bake rotation")
    // We're changing selection - bake rotation into previously selected annotations
    for (const annotation of selectedAnnotations.value) {
      bakeRotationIntoPoints(annotation)
    }

    // Use store's selectAnnotation method
    annotationStore.selectAnnotation(shapeId)
  }

  /**
   * Toggle shape selection (Shift+Click behavior)
   */
  function toggleShape(shapeId: string) {
    // Use store's toggle mode
    annotationStore.selectAnnotation(shapeId, { toggle: true })
  }

  /**
   * Add shape to selection
   */
  function addToSelection(shapeId: string) {
    // Use store's addToSelection mode
    annotationStore.selectAnnotation(shapeId, { addToSelection: true })
  }

  /**
   * Add multiple shapes to selection
   */
  function addMultipleToSelection(shapeIds: string[]) {
    // Use store's multi-select
    annotationStore.selectAnnotations(shapeIds)
  }

  /**
   * Set selection to specific shape IDs
   */
  function setSelection(shapeIds: string[]) {
    annotationStore.selectAnnotations(shapeIds)
  }

  /**
   * Bake rotation into points for point-based annotations
   * This applies the CSS rotation transform to the actual point coordinates
   */
  function bakeRotationIntoPoints(annotation: Annotation) {
    if (!hasPointsArray(annotation) || annotation.rotation === 0) return

    console.log("🔄 Baking rotation into points for annotation:", annotation.id, "rotation:", annotation.rotation)

    // Get center and rotate points
    const center = getAnnotationCenter(annotation)
    const rotatedPoints = rotatePointsAroundCenter(annotation.points, center, annotation.rotation)

    // Recalculate derived values
    // Type assertion needed because rotatedPoints is Point[] but specific types expect tuples
    const derived = recalculateDerivedValues({
      ...annotation,
      points: rotatedPoints,
      rotation: 0
    } as typeof annotation)

    // Update annotation in store with rotated points and reset rotation
    annotationStore.updateAnnotation(annotation.id, Object.assign({ points: rotatedPoints, rotation: 0 }, derived))
  }

  /**
   * Clear all selection (and bake rotation into points)
   */
  function clearSelection() {
    // Bake rotation into points before clearing selection
    for (const annotation of selectedAnnotations.value) {
      bakeRotationIntoPoints(annotation)
    }

    // Use store's deselectAll method
    annotationStore.deselectAll()
  }

  /**
   * Check if a shape is selected
   */
  function isSelected(shapeId: string): boolean {
    return annotationStore.isAnnotationSelected(shapeId)
  }

  // Watch for selection changes and bake rotation for previously selected annotations
  // This handles cases where selection changes without going through selectShape/clearSelection
  const previousSelection = ref<string[]>([])
  watch(
    () => selectedIds.value,
    (newIds) => {
      // Find annotations that were selected but are no longer selected
      const deselectedIds = previousSelection.value.filter((id) => !newIds.includes(id))

      // Bake rotation for deselected annotations
      for (const id of deselectedIds) {
        const annotation = annotationStore.getAnnotationById(id)
        if (annotation) {
          bakeRotationIntoPoints(annotation)
        }
      }

      // Update previous selection
      previousSelection.value = [...newIds]
    },
    { deep: true }
  )

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
