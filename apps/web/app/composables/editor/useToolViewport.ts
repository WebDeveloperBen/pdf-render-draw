/**
 * Shared viewport helpers for annotation tool components.
 *
 * Provides label rotation so preview text stays upright
 * regardless of PDF rotation, and scale-compensation so
 * preview markers/text stay a constant screen size.
 *
 * Safe to call in any context (editor or export) — returns
 * sensible defaults when no active viewport exists.
 */
export function useToolViewport() {
  const viewportStore = useViewportStore()

  /** Counter-rotation value (degrees) to keep text upright in the viewport */
  const labelRotation = computed(() => viewportStore.getViewportLabelRotation)

  /**
   * Build an SVG `rotate()` transform string that keeps an element
   * upright relative to the viewport, pivoting around (cx, cy).
   * Returns `undefined` when no rotation is needed (avoids empty attributes).
   */
  function labelRotationTransform(cx: number, cy: number): string | undefined {
    const r = labelRotation.value
    return r ? `rotate(${r}, ${cx}, ${cy})` : undefined
  }

  /**
   * Raw inverse zoom factor — stays constant screen size at all zoom levels.
   * Used for preview elements (cursors, point markers) that should always
   * appear the same size regardless of zoom direction.
   */
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
   * so it stays a constant screen size. Used for preview elements.
   */
  function screenTransform(cx: number, cy: number): string {
    const sc = inverseScale.value
    return `translate(${cx}, ${cy}) scale(${sc})`
  }

  /**
   * Clamped inverse scale — never goes above 1, so elements render at their
   * natural PDF-space size when zoomed out but shrink-compensate when zoomed in.
   * Used for completed annotation labels that should look "placed on the canvas".
   */
  const clampedInverseScale = computed(() => Math.min(1, inverseScale.value))

  /**
   * Like s() but clamped — won't enlarge beyond natural size when zoomed out.
   */
  function sc(value: number): number {
    return value * clampedInverseScale.value
  }

  /**
   * Like screenTransform() but clamped — labels stay at natural size when
   * zoomed out, only compensate when zoomed in to prevent shrinking.
   */
  function labelTransform(cx: number, cy: number): string {
    const scale = clampedInverseScale.value
    return `translate(${cx}, ${cy}) scale(${scale})`
  }

  return { labelRotation, labelRotationTransform, inverseScale, s, screenTransform, clampedInverseScale, sc, labelTransform }
}
