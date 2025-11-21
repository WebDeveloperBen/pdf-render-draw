/**
 * Keyboard Shortcuts Composable
 *
 * Handles global keyboard shortcuts for annotation operations using a command map pattern.
 */

import type { Annotation, Point, PerimeterSegment } from '~/types/annotations'

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

  // Clipboard state (in-memory for now, could use Clipboard API later)
  const clipboard = ref<Annotation | null>(null)

  // Detect Mac platform using userAgent (platform is deprecated)
  const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent)
  const modKey: 'meta' | 'ctrl' = isMac ? 'meta' : 'ctrl'

  /**
   * Paste annotation from clipboard
   * Places annotation at cursor position (or offset from original if no cursor position)
   */
  function pasteAnnotation() {
    if (!clipboard.value) return

    const original = clipboard.value
    const cursorPos = rendererStore.lastCursorPosition

    // Create new annotation with new ID
    const newAnnotation = {
      ...original,
      id: crypto.randomUUID(),
    }

    // Calculate offset - either to cursor or default 20px offset
    let offsetX = 20
    let offsetY = 20

    if (cursorPos) {
      // Calculate center of original annotation
      let originalCenterX = 0
      let originalCenterY = 0

      if ('points' in original && Array.isArray(original.points) && original.points.length > 0) {
        // Calculate centroid of points
        const sumX = original.points.reduce((sum, p) => sum + p.x, 0)
        const sumY = original.points.reduce((sum, p) => sum + p.y, 0)
        originalCenterX = sumX / original.points.length
        originalCenterY = sumY / original.points.length
      } else if ('x' in original && 'y' in original) {
        // Text annotation - use x, y as center
        originalCenterX = original.x
        originalCenterY = original.y
      }

      // Calculate offset to move center to cursor
      offsetX = cursorPos.x - originalCenterX
      offsetY = cursorPos.y - originalCenterY
    }

    // Apply offset based on annotation type
    if ('points' in newAnnotation && Array.isArray(newAnnotation.points)) {
      // Point-based annotation - offset all points
      newAnnotation.points = newAnnotation.points.map((p: Point) => ({
        x: p.x + offsetX,
        y: p.y + offsetY,
      }))

      // Recalculate derived values (center, midpoint, etc.)
      if ('center' in newAnnotation) {
        newAnnotation.center = {
          x: newAnnotation.center.x + offsetX,
          y: newAnnotation.center.y + offsetY,
        }
      }
      if ('midpoint' in newAnnotation) {
        newAnnotation.midpoint = {
          x: newAnnotation.midpoint.x + offsetX,
          y: newAnnotation.midpoint.y + offsetY,
        }
      }
      if ('segments' in newAnnotation && Array.isArray(newAnnotation.segments)) {
        newAnnotation.segments = newAnnotation.segments.map((seg: PerimeterSegment): PerimeterSegment => ({
          ...seg,
          start: { x: seg.start.x + offsetX, y: seg.start.y + offsetY },
          end: { x: seg.end.x + offsetX, y: seg.end.y + offsetY },
          midpoint: { x: seg.midpoint.x + offsetX, y: seg.midpoint.y + offsetY },
        }))
      }
    } else if ('x' in newAnnotation && 'y' in newAnnotation) {
      // Text annotation - offset x, y
      newAnnotation.x += offsetX
      newAnnotation.y += offsetY
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
      ctrl: !isMac,
      meta: isMac,
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
      ctrl: !isMac,
      meta: isMac,
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
      ctrl: !isMac,
      meta: isMac,
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
      ctrl: !isMac,
      meta: isMac,
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
      ctrl: !isMac,
      meta: isMac,
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
      ctrl: !isMac,
      meta: isMac,
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
