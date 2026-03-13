/**
 * Shared transform finalisation logic for move, rotate, and resize gestures.
 * Converts the captured "before" snapshot map into a single undoable batch update,
 * then restores normal persistence and flushes the final annotation state once.
 */
export const useEditorTransformFinalise = () => {
  const annotationStore = useAnnotationStore()
  const historyStore = useHistoryStore()

  function finaliseTransformGesture(options: {
    originalAnnotations: Map<string, Annotation>
    annotations: Annotation[]
    description: string
  }) {
    const changes = options.annotations
      .map((annotation) => {
        const before = options.originalAnnotations.get(annotation.id)
        if (!before) return null
        return {
          before,
          after: structuredClone(toRaw(annotation))
        }
      })
      .filter((change): change is { before: Annotation; after: Annotation } => change !== null)

    annotationStore.setPersistenceSuppressed(false)

    if (changes.length > 0) {
      historyStore.recordExecutedBatchUpdate(changes, options.description)
      annotationStore.flushPersistence(changes.map((change) => change.after.id))
    }

    options.originalAnnotations.clear()
  }

  return {
    finaliseTransformGesture
  }
}
