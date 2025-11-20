import type { Point } from '~/types'

/**
 * Get SVG point from mouse event
 */
export function getSvgPoint(e: MouseEvent, svg: SVGSVGElement): Point {
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
  return points.map(p => `${p.x},${p.y}`).join(' ')
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
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)

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
