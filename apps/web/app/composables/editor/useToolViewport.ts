/**
 * Shared viewport helpers for annotation tool components.
 *
 * Provides label rotation so preview text stays upright
 * regardless of PDF rotation. Safe to call in any context
 * (editor or export) — returns sensible defaults when
 * no active viewport exists.
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

  return { labelRotation, labelRotationTransform }
}
