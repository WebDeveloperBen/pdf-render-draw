/**
 * Unified input event type for the editor.
 * All editor interaction handlers accept this instead of raw MouseEvent/PointerEvent.
 * Change this single type to PointerEvent when completing the full migration.
 */
export type EditorInputEvent = PointerEvent | MouseEvent

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Scale handle positions
 */
export type ScaleHandle = "nw" | "ne" | "se" | "sw" | "n" | "e" | "s" | "w"
