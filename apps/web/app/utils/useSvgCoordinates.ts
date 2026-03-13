/**
 * SVG Coordinate Utilities
 * Shared utilities for converting between screen and SVG coordinates
 */

export function useSvgCoordinates() {
  /**
   * Converts mouse event coordinates to SVG coordinate space
   * @param e Mouse event
   * @param svg SVG element to convert coordinates for
   * @returns Point in SVG coordinate space, or null if conversion fails
   */
  function getSvgPoint(e: EditorInputEvent, svg: SVGSVGElement): Point | null {
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY

    const ctm = svg.getScreenCTM()
    if (!ctm) return null

    const transformed = pt.matrixTransform(ctm.inverse())
    return { x: transformed.x, y: transformed.y }
  }

  /**
   * Converts array of points to SVG points string format
   * @param points Array of points
   * @returns Space-separated string of x,y coordinates
   */
  function toSvgPoints(points: Point[]): string {
    return points.map((p) => `${p.x},${p.y}`).join(" ")
  }

  return {
    getSvgPoint,
    toSvgPoints
  }
}
