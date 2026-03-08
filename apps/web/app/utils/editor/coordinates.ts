/**
 * Coordinate transformation utilities for PDF annotations
 *
 * Handles conversion between:
 * - Screen coordinates (mouse events, pixels on screen)
 * - PDF coordinates (logical coordinates in PDF space)
 * - SVG coordinates (viewBox coordinates)
 *
 * The coordinate system flow:
 * 1. Mouse events provide screen coordinates (clientX, clientY)
 * 2. SVG getScreenCTM() converts to SVG viewBox coordinates
 * 3. SVG viewBox coordinates map 1:1 to PDF logical coordinates
 * 4. Renderer store applies transforms (scale, rotate, translate) via CSS
 */

/**
 * Convert mouse event to SVG coordinates using the SVG element's CTM
 * This automatically accounts for all CSS transforms applied to the SVG
 *
 * @param event - Mouse event with clientX, clientY
 * @param svg - SVG element to convert coordinates for
 * @returns Point in SVG viewBox coordinates (= PDF logical coordinates)
 */
export function screenToSvgPoint(event: MouseEvent, svg: SVGSVGElement): Point | null {
  try {
    const pt = svg.createSVGPoint()
    pt.x = event.clientX
    pt.y = event.clientY

    // Get the inverse of the screen CTM to convert screen -> SVG
    const ctm = svg.getScreenCTM()
    if (!ctm) return null

    const svgPoint = pt.matrixTransform(ctm.inverse())
    return { x: svgPoint.x, y: svgPoint.y }
  } catch (e) {
    console.error("Failed to convert screen to SVG coordinates:", e)
    return null
  }
}

/**
 * Convert SVG coordinates to PDF coordinates
 * When the SVG viewBox matches the PDF dimensions, these are 1:1
 *
 * @param svgPoint - Point in SVG viewBox coordinates
 * @returns Point in PDF logical coordinates
 */
export function svgToPdfPoint(svgPoint: Point): Point {
  // When viewBox matches PDF dimensions, coordinates are the same
  return { ...svgPoint }
}

/**
 * Convert PDF coordinates to SVG coordinates
 * When the SVG viewBox matches the PDF dimensions, these are 1:1
 *
 * @param pdfPoint - Point in PDF logical coordinates
 * @returns Point in SVG viewBox coordinates
 */
export function pdfToSvgPoint(pdfPoint: Point): Point {
  // When viewBox matches PDF dimensions, coordinates are the same
  return { ...pdfPoint }
}

/**
 * Convenience function: Convert mouse event directly to PDF coordinates
 *
 * @param event - Mouse event
 * @param svg - SVG overlay element
 * @returns Point in PDF logical coordinates, or null if conversion fails
 */
export function screenToPdfPoint(event: MouseEvent, svg: SVGSVGElement): Point | null {
  const svgPoint = screenToSvgPoint(event, svg)
  if (!svgPoint) return null
  return svgToPdfPoint(svgPoint)
}

/**
 * Calculate distance between two points
 */
export function pointDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate midpoint between two points
 */
export function pointMidpoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  }
}

/**
 * Add two points (vector addition)
 */
export function pointAdd(p1: Point, p2: Point): Point {
  return {
    x: p1.x + p2.x,
    y: p1.y + p2.y
  }
}

/**
 * Subtract two points (vector subtraction)
 */
export function pointSubtract(p1: Point, p2: Point): Point {
  return {
    x: p1.x - p2.x,
    y: p1.y - p2.y
  }
}

/**
 * Rotate a point around a center point
 *
 * @param point - Point to rotate
 * @param center - Center of rotation
 * @param angleRadians - Rotation angle in radians
 * @returns Rotated point
 */
export function rotatePoint(point: Point, center: Point, angleRadians: number): Point {
  const cos = Math.cos(angleRadians)
  const sin = Math.sin(angleRadians)

  // Translate to origin
  const x = point.x - center.x
  const y = point.y - center.y

  // Rotate
  const xRotated = x * cos - y * sin
  const yRotated = x * sin + y * cos

  // Translate back
  return {
    x: xRotated + center.x,
    y: yRotated + center.y
  }
}

/**
 * Rotate multiple points around a center point
 */
export function rotatePoints(points: Point[], center: Point, angleRadians: number): Point[] {
  return points.map((p) => rotatePoint(p, center, angleRadians))
}

/**
 * Calculate the center point of an array of points
 */
export function calculateCenter(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }

  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })

  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  }
}

/**
 * Normalize an angle to 0-360 degrees
 */
export function normalizeAngleDeg(degrees: number): number {
  let normalized = degrees % 360
  if (normalized < 0) normalized += 360
  return normalized
}

/**
 * Normalize an angle to 0-2π radians
 */
export function normalizeAngleRad(radians: number): number {
  const TWO_PI = Math.PI * 2
  let normalized = radians % TWO_PI
  if (normalized < 0) normalized += TWO_PI
  return normalized
}

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI
}
