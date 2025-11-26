/**
 * Global text editing state
 *
 * Uses exported refs to share editing state across all components
 * without needing injection or store. This is a singleton pattern
 * that maintains shared state automatically.
 */

// Global state refs
const editingId = ref<string | null>(null)
const editingContent = ref<string>("")

export const useTextEditingState = () => {
  const annotationStore = useAnnotationStore()

  function startEditing(id: string) {
    const annotation = annotationStore.getAnnotationById(id)
    if (annotation && annotation.type === 'text' && 'content' in annotation) {
      editingId.value = id
      editingContent.value = annotation.content as string
    }
  }

  function finishEditing(dimensions?: { width?: number; height?: number }) {
    if (editingId.value && editingContent.value !== undefined) {
      const updates: Record<string, unknown> = { content: editingContent.value }

      // Update dimensions if provided (to fit wrapped text)
      if (dimensions?.width) updates.width = dimensions.width
      if (dimensions?.height) updates.height = dimensions.height

      annotationStore.updateAnnotation(editingId.value, updates)
    }
    editingId.value = null
    editingContent.value = ""
  }

  function cancelEditing() {
    editingId.value = null
    editingContent.value = ""
  }

  return {
    editingId,
    editingContent,
    startEditing,
    finishEditing,
    cancelEditing,
  }
}
