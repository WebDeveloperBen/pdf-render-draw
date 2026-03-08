/**
 * Shared viewport helpers for annotation tool components.
 *
 * Provides scale-compensation so preview markers/text stay a constant
 * screen size, and stamped transforms for completed annotations that
 * preserve the visual size from when they were created.
 *
 * Safe to call in any context (editor or export) — returns
 * sensible defaults when no active viewport exists.
 */
export function useToolViewport() {
  const viewportStore = useViewportStore()

  /** Inverse zoom factor for constant-screen-size preview elements. */
  const inverseScale = computed(() => viewportStore.getInverseScale)

  /**
   * Scale a value so it stays constant in screen pixels at any zoom.
   * Usage in templates: `:r="s(6)"` instead of `:r="6 * inverseScale"`
   */
  function s(value: number): number {
    return value * inverseScale.value
  }

  /**
   * Build a transform that positions an element at (cx, cy) and scales it
   * by inverseScale so it stays a constant screen size. Keeps SVG text crisp
   * at any zoom level (unlike setting a tiny font-size directly).
   *
   * Used for preview elements during drawing.
   */
  function screenTransform(cx: number, cy: number): string {
    const sc = inverseScale.value
    return `translate(${cx}, ${cy}) scale(${sc})`
  }

  /**
   * Build a transform using a stored (stamped) scale value from an annotation.
   * Completed annotations bake their labelScale at creation time so labels
   * stay at the visual size they were placed at, regardless of later zoom changes.
   *
   * Falls back to live inverseScale if no labelScale is stored (backward compat).
   */
  function stampedTransform(cx: number, cy: number, labelScale?: number): string {
    const sc = labelScale ?? inverseScale.value
    return `translate(${cx}, ${cy}) scale(${sc})`
  }

  /**
   * Scale a value using a stored labelScale from an annotation.
   * Falls back to live inverseScale if no labelScale is stored.
   */
  function stamped(value: number, labelScale?: number): number {
    return value * (labelScale ?? inverseScale.value)
  }

  return { inverseScale, s, screenTransform, stampedTransform, stamped }
}
