/**
 * useEditorCoordinates - SVG coordinate conversion
 * Extracted from DebugEditor.vue
 *
 * Handles conversion between screen (mouse) coordinates and SVG coordinates
 */

import type { Point } from "~/types/editor"

export const useEditorCoordinates = createSharedComposable(() => {
  // Cache SVG element during interactions to avoid repeated DOM lookups
  const cachedSvg = ref<SVGSVGElement | null>(null)

  /**
   * Convert mouse event coordinates to SVG coordinates
   */
  function convertToSvgPoint(event: MouseEvent, svg?: SVGSVGElement): Point | null {
    const element = svg || cachedSvg.value
    if (!element) return null

    const pt = element.createSVGPoint()
    pt.x = event.clientX
    pt.y = event.clientY
    const svgP = pt.matrixTransform(element.getScreenCTM()!.inverse())

    return { x: svgP.x, y: svgP.y }
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
    convertToSvgPoint,
    cacheSvg,
    clearSvgCache
  }
})
