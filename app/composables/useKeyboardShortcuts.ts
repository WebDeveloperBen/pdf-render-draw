/**
 * Keyboard Shortcuts Composable
 *
 * Handles global keyboard shortcuts for annotation operations using a command map pattern.
 */

interface ShortcutCommand {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  handler: (e: KeyboardEvent) => void
  description: string
}

export function useKeyboardShortcuts() {
  const historyStore = useHistoryStore()
  const annotationStore = useAnnotationStore()
  const rendererStore = useRendererStore()
  const { isMac } = usePlatform()

  // Clipboard state (in-memory for now, could use Clipboard API later)
  const clipboard = ref<Annotation | null>(null)

  /**
   * Paste annotation from clipboard
   * Places annotation at cursor position (or offset from original if no cursor position)
   */
  function pasteAnnotation() {
    if (!clipboard.value) return

    const original = clipboard.value
    const cursorPos = rendererStore.lastCursorPosition

    // Calculate offset - either to cursor or default 20px offset
    let offsetX = 20
    let offsetY = 20

    if (cursorPos) {
      // Calculate center of original annotation and offset to cursor
      const originalCenter = getAnnotationCenter(original)
      offsetX = cursorPos.x - originalCenter.x
      offsetY = cursorPos.y - originalCenter.y
    }

    // Create new annotation with offset position and new ID
    const newAnnotation = {
      ...offsetAnnotation(original, offsetX, offsetY),
      id: crypto.randomUUID()
    }

    historyStore.addAnnotationWithHistory(newAnnotation)
    annotationStore.selectAnnotation(newAnnotation.id)
  }

  /**
   * Duplicate selected annotation
   * Same as copy+paste in one action
   */
  function duplicateAnnotation() {
    if (!annotationStore.selectedAnnotation) return

    clipboard.value = JSON.parse(JSON.stringify(annotationStore.selectedAnnotation))
    pasteAnnotation()
  }

  // Command Map - Define all keyboard shortcuts in one place
  const shortcuts: ShortcutCommand[] = [
    // Undo: Ctrl/Cmd+Z
    {
      key: "z",
      ctrl: !isMac.value,
      meta: isMac.value,
      handler: (e) => {
        if (historyStore.canUndo) {
          e.preventDefault()
          historyStore.undo()
        }
      },
      description: "Undo"
    },
    // Redo: Ctrl/Cmd+Shift+Z
    {
      key: "z",
      ctrl: !isMac.value,
      meta: isMac.value,
      shift: true,
      handler: (e) => {
        if (historyStore.canRedo) {
          e.preventDefault()
          historyStore.redo()
        }
      },
      description: "Redo"
    },
    // Redo (alternate): Ctrl/Cmd+Y
    {
      key: "y",
      ctrl: !isMac.value,
      meta: isMac.value,
      handler: (e) => {
        if (historyStore.canRedo) {
          e.preventDefault()
          historyStore.redo()
        }
      },
      description: "Redo"
    },
    // Copy: Ctrl/Cmd+C
    {
      key: "c",
      ctrl: !isMac.value,
      meta: isMac.value,
      handler: (e) => {
        if (annotationStore.selectedAnnotation) {
          e.preventDefault()
          clipboard.value = JSON.parse(JSON.stringify(annotationStore.selectedAnnotation))
          console.log("Copied annotation to clipboard")
        }
      },
      description: "Copy"
    },
    // Paste: Ctrl/Cmd+V
    {
      key: "v",
      ctrl: !isMac.value,
      meta: isMac.value,
      handler: (e) => {
        if (clipboard.value) {
          e.preventDefault()
          pasteAnnotation()
        }
      },
      description: "Paste"
    },
    // Duplicate: Ctrl/Cmd+D
    {
      key: "d",
      ctrl: !isMac.value,
      meta: isMac.value,
      handler: (e) => {
        if (annotationStore.selectedAnnotation) {
          e.preventDefault()
          duplicateAnnotation()
        }
      },
      description: "Duplicate"
    },
    // Delete annotation handler (works with both Delete and Backspace keys)
    ...[{ key: "Delete" }, { key: "Backspace" }].map(({ key }) => ({
      key,
      handler: (e: KeyboardEvent) => {
        if (annotationStore.selectedAnnotation) {
          e.preventDefault()
          historyStore.deleteAnnotationWithHistory(annotationStore.selectedAnnotation.id)
        }
      },
      description: "Delete annotation"
    })),
    // Escape: Deselect
    {
      key: "Escape",
      handler: (e) => {
        // Check if any annotations are selected (multi-select support)
        if (annotationStore.selectedAnnotationIds.length > 0) {
          e.preventDefault()
          annotationStore.selectAnnotation(null)
        }
        // Cancel drawing handled by individual tool composables
      },
      description: "Deselect / Cancel"
    }
  ]

  /**
   * Check if a shortcut matches the current keyboard event
   * Requires exact modifier match - all modifiers must match exactly
   */
  function matchesShortcut(shortcut: ShortcutCommand, e: KeyboardEvent): boolean {
    if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) return false

    // Check that all required modifiers are pressed
    if (shortcut.ctrl && !e.ctrlKey) return false
    if (shortcut.shift && !e.shiftKey) return false
    if (shortcut.alt && !e.altKey) return false
    if (shortcut.meta && !e.metaKey) return false

    // Check that no extra modifiers are pressed (exact match)
    if (!shortcut.ctrl && e.ctrlKey) return false
    if (!shortcut.shift && e.shiftKey) return false
    if (!shortcut.alt && e.altKey) return false
    if (!shortcut.meta && e.metaKey) return false

    return true
  }

  /**
   * Handle keyboard events by matching against command map
   */
  function handleKeyDown(e: KeyboardEvent) {
    for (const shortcut of shortcuts) {
      if (matchesShortcut(shortcut, e)) {
        shortcut.handler(e)
        return // Only execute first match
      }
    }
  }

  // Set up event listener on mount, cleanup on unmount
  onMounted(() => {
    window.addEventListener("keydown", handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeyDown)
  })

  return {
    clipboard,
    shortcuts, // Expose for debugging/UI
    pasteAnnotation,
    duplicateAnnotation
  }
}
