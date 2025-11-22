import { createGlobalState } from "@vueuse/core"

/**
 * Global text editing state
 *
 * Uses createGlobalState to share editing state across all components
 * without needing injection or store. This is a singleton composable
 * that maintains shared state automatically.
 */
export const useTextEditingState = createGlobalState(() => {
  const annotationStore = useAnnotationStore()

  const editingId = ref<string | null>(null)
  const editingContent = ref<string>("")

  function startEditing(id: string) {
    const annotation = annotationStore.getAnnotationById(id)
    if (annotation && annotation.type === 'text' && 'content' in annotation) {
      editingId.value = id
      editingContent.value = annotation.content as string
    }
  }

  function finishEditing() {
    if (editingId.value && editingContent.value !== undefined) {
      annotationStore.updateAnnotation(editingId.value, { content: editingContent.value })
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
})
