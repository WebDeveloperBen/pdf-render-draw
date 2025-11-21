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

  // Clipboard state (in-memory for now, could use Clipboard API later)
  const clipboard = ref<any>(null)

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const modKey = isMac ? 'meta' : 'ctrl'

  /**
   * Paste annotation from clipboard
   * Creates a new annotation offset from the original
   */
  function pasteAnnotation() {
    if (!clipboard.value) return

    const original = clipboard.value
    const offset = 20 // Offset by 20px so it's visible

    // Create new annotation with new ID and offset position
    const newAnnotation = {
      ...original,
      id: crypto.randomUUID(),
    }

    // Offset position based on annotation type
    if ('points' in newAnnotation && Array.isArray(newAnnotation.points)) {
      // Point-based annotation - offset all points
      newAnnotation.points = newAnnotation.points.map((p: any) => ({
        x: p.x + offset,
        y: p.y + offset,
      }))

      // Recalculate derived values (center, midpoint, etc.)
      if ('center' in newAnnotation) {
        newAnnotation.center = {
          x: newAnnotation.center.x + offset,
          y: newAnnotation.center.y + offset,
        }
      }
      if ('midpoint' in newAnnotation) {
        newAnnotation.midpoint = {
          x: newAnnotation.midpoint.x + offset,
          y: newAnnotation.midpoint.y + offset,
        }
      }
      if ('segments' in newAnnotation && Array.isArray(newAnnotation.segments)) {
        newAnnotation.segments = newAnnotation.segments.map((seg: any) => ({
          ...seg,
          start: { x: seg.start.x + offset, y: seg.start.y + offset },
          end: { x: seg.end.x + offset, y: seg.end.y + offset },
          midpoint: { x: seg.midpoint.x + offset, y: seg.midpoint.y + offset },
        }))
      }
    } else if ('x' in newAnnotation && 'y' in newAnnotation) {
      // Text annotation - offset x, y
      newAnnotation.x += offset
      newAnnotation.y += offset
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
      key: 'z',
      [modKey]: true,
      handler: (e) => {
        if (historyStore.canUndo) {
          e.preventDefault()
          historyStore.undo()
        }
      },
      description: 'Undo'
    },
    // Redo: Ctrl/Cmd+Shift+Z
    {
      key: 'z',
      [modKey]: true,
      shift: true,
      handler: (e) => {
        if (historyStore.canRedo) {
          e.preventDefault()
          historyStore.redo()
        }
      },
      description: 'Redo'
    },
    // Redo (alternate): Ctrl/Cmd+Y
    {
      key: 'y',
      [modKey]: true,
      handler: (e) => {
        if (historyStore.canRedo) {
          e.preventDefault()
          historyStore.redo()
        }
      },
      description: 'Redo'
    },
    // Copy: Ctrl/Cmd+C
    {
      key: 'c',
      [modKey]: true,
      handler: (e) => {
        if (annotationStore.selectedAnnotation) {
          e.preventDefault()
          clipboard.value = JSON.parse(JSON.stringify(annotationStore.selectedAnnotation))
          console.log('Copied annotation to clipboard')
        }
      },
      description: 'Copy'
    },
    // Paste: Ctrl/Cmd+V
    {
      key: 'v',
      [modKey]: true,
      handler: (e) => {
        if (clipboard.value) {
          e.preventDefault()
          pasteAnnotation()
        }
      },
      description: 'Paste'
    },
    // Duplicate: Ctrl/Cmd+D
    {
      key: 'd',
      [modKey]: true,
      handler: (e) => {
        if (annotationStore.selectedAnnotation) {
          e.preventDefault()
          duplicateAnnotation()
        }
      },
      description: 'Duplicate'
    },
    // Delete: Delete key
    {
      key: 'Delete',
      handler: (e) => {
        if (annotationStore.selectedAnnotation) {
          e.preventDefault()
          historyStore.deleteAnnotationWithHistory(annotationStore.selectedAnnotation.id)
        }
      },
      description: 'Delete annotation'
    },
    // Delete: Backspace key
    {
      key: 'Backspace',
      handler: (e) => {
        if (annotationStore.selectedAnnotation) {
          e.preventDefault()
          historyStore.deleteAnnotationWithHistory(annotationStore.selectedAnnotation.id)
        }
      },
      description: 'Delete annotation'
    },
    // Escape: Deselect
    {
      key: 'Escape',
      handler: (e) => {
        // Check if any annotations are selected (multi-select support)
        if (annotationStore.selectedAnnotationIds.length > 0) {
          e.preventDefault()
          annotationStore.selectAnnotation(null)
        }
        // Cancel drawing handled by individual tool composables
      },
      description: 'Deselect / Cancel'
    }
  ]

  /**
   * Check if a shortcut matches the current keyboard event
   */
  function matchesShortcut(shortcut: ShortcutCommand, e: KeyboardEvent): boolean {
    if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) return false
    if (shortcut.ctrl && !e.ctrlKey) return false
    if (shortcut.shift && !e.shiftKey) return false
    if (shortcut.alt && !e.altKey) return false
    if (shortcut.meta && !e.metaKey) return false

    // If shortcut doesn't specify a modifier, but the event has it, don't match
    // (unless it's shift with redo, which we handle separately)
    if (!shortcut.shift && e.shiftKey && shortcut.key !== 'z') return false

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
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return {
    clipboard,
    shortcuts, // Expose for debugging/UI
    pasteAnnotation,
    duplicateAnnotation,
  }
}
