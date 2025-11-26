type CursorStyle =
  | "default"
  | "pointer"
  | "grab"
  | "grabbing"
  | "move"
  | "crosshair"
  | "text"
  | "wait"
  | "not-allowed"
  | "nwse-resize"
  | "nesw-resize"
  | "ns-resize"
  | "ew-resize"
  | string

/**
 * Composable for managing document cursor state reactively
 *
 * Usage (local instance):
 * ```ts
 * const cursor = useCursor()
 * cursor.set('grabbing')
 * cursor.reset()
 * ```
 *
 * Usage (global singleton):
 * ```ts
 * const cursor = useGlobalCursor()
 * cursor.set('grabbing') // Affects entire app
 * ```
 *
 * Usage (temporary cursor):
 * ```ts
 * const cursor = useCursor()
 * const cleanup = cursor.temp('grabbing')
 * // ... do work ...
 * cleanup() // Reset to default
 * ```
 */
export function useCursor() {
  const currentCursor = ref<CursorStyle>("default")

  // Watch for changes and apply to document.body
  watch(currentCursor, (newCursor) => {
    if (typeof document !== "undefined") {
      document.body.style.cursor = newCursor === "default" ? "" : newCursor
    }
  })

  /**
   * Set the cursor style
   */
  function set(cursor: CursorStyle) {
    currentCursor.value = cursor
  }

  /**
   * Reset cursor to default
   */
  function reset() {
    currentCursor.value = "default"
  }

  /**
   * Temporarily set cursor for duration of an operation
   * Returns a cleanup function to reset the cursor
   */
  function temp(cursor: CursorStyle): () => void {
    set(cursor)
    return reset
  }

  return {
    current: currentCursor,
    set,
    reset,
    temp
  }
}

/**
 * Create a singleton cursor manager for the entire application
 */
let cursorInstance: ReturnType<typeof useCursor> | null = null

export function useGlobalCursor() {
  if (!cursorInstance) {
    cursorInstance = useCursor()
  }
  return cursorInstance
}
