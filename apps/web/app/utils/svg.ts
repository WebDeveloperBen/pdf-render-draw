/**
 * Get SVG point from mouse event
 */
export function getSvgPoint(e: EditorInputEvent, svg: SVGSVGElement): Point {
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const transformed = pt.matrixTransform(svg.getScreenCTM()!.inverse())
  return { x: transformed.x, y: transformed.y }
}

/**
 * Convert points array to SVG points string
 */
export function toSvgPoints(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ")
}

/**
 * Get bounding box of points
 */
export function getBoundingBox(points: Point[]): {
  x: number
  y: number
  width: number
  height: number
} {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

export function getRootSVG(target: EventTarget | null): SVGSVGElement | null {
  if (!(target instanceof Element)) return null

  // Case 1: target is itself an <svg>
  if (target instanceof SVGSVGElement) {
    return target
  }

  // Case 2: target is an SVG graphics element (<path>, <rect>, <g>, etc.)
  if (target instanceof SVGGraphicsElement) {
    return target.ownerSVGElement ?? null
  }

  // Case 3: fallback — walk up DOM if needed
  const svg = target.closest("svg")
  return svg instanceof SVGSVGElement ? svg : null
}
