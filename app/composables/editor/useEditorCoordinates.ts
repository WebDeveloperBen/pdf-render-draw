/**
 * useEditorCoordinates - Coordinate conversion for PDF annotations
 * Extracted from SimpleDebugEditor.vue
 *
 * Handles conversion between screen (mouse) coordinates and PDF coordinates
 * Works with the renderer store's transform system
 */

export const useEditorCoordinates = createSharedComposable(() => {
  // Cache SVG element during interactions to avoid repeated DOM lookups
  const cachedSvg = ref<SVGSVGElement | null>(null)

  /**
   * Convert mouse event coordinates to SVG coordinates
   * This accounts for all CSS transforms on the SVG element
   */
  function convertToSvgPoint(event: MouseEvent, svg?: SVGSVGElement): Point | null {
    const element = svg || cachedSvg.value
    if (!element) return null

    return screenToSvgPoint(event, element)
  }

  /**
   * Convert mouse event coordinates to PDF coordinates
   * Since our SVG viewBox matches PDF dimensions, this is the same as convertToSvgPoint
   */
  function convertToPdfPoint(event: MouseEvent, svg?: SVGSVGElement): Point | null {
    const element = svg || cachedSvg.value
    if (!element) return null

    return screenToPdfPoint(event, element)
  }

  /**
   * Cache SVG element for the duration of an interaction
   */
  function cacheSvg(svg: SVGSVGElement) {
    cachedSvg.value = svg
  }

  /**
   * Clear SVG cache after interaction ends
   */
  function clearSvgCache() {
    cachedSvg.value = null
  }

  return {
    // Coordinate conversion
    convertToSvgPoint,
    convertToPdfPoint,

    // SVG element caching
    cacheSvg,
    clearSvgCache,

    // Expose cached SVG for direct access if needed
    cachedSvg: readonly(cachedSvg)
  }
})
