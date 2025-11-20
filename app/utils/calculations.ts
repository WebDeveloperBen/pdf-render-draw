import type { Point } from '~/types'

/**
 * Calculate distance between two points in real-world units (mm)
 */
export function calculateDistance(
  point1: Point,
  point2: Point,
  scaleString: string,
  dpi: number = 72
): number {
  // Distance in PDF units (points)
  const distanceInPoints = Math.sqrt(
    Math.pow(point2.x - point1.x, 2) +
    Math.pow(point2.y - point1.y, 2)
  )

  // Convert points to millimeters (1 point = 1/72 inch)
  const distanceInMm = (distanceInPoints / dpi) * 25.4

  // Apply scale (e.g., 1:100 = 100)
  const scale = parsePdfPageScale(scaleString)
  const realWorldDistance = distanceInMm * scale

  return Math.round(realWorldDistance)
}

/**
 * Calculate area of a polygon in square meters
 */
export function calculatePolygonArea(
  points: Point[],
  scaleString: string,
  dpi: number = 72
): number {
  let area = 0
  const scale = parsePdfPageScale(scaleString)
  const pixelsToMm = 25.4 / dpi

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length

    // Convert to real-world coordinates
    const x1 = points[i].x * pixelsToMm * scale
    const y1 = points[i].y * pixelsToMm * scale
    const x2 = points[j].x * pixelsToMm * scale
    const y2 = points[j].y * pixelsToMm * scale

    area += x1 * y2 - x2 * y1
  }

  // Convert mm² to m²
  const areaInM2 = Math.abs(area) / 2 / 1000000
  return Math.round(areaInM2 * 100) / 100 // 2 decimal places
}

/**
 * Calculate centroid of a polygon
 */
export function calculateCentroid(points: Point[]): Point {
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  )

  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  }
}

/**
 * Calculate midpoint between two points
 */
export function calculateMidpoint(point1: Point, point2: Point): Point {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2
  }
}

/**
 * Calculate distance between two points (no unit conversion)
 */
export function distance(point1: Point, point2: Point): number {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) +
    Math.pow(point2.y - point1.y, 2)
  )
}

/**
 * Parse PDF scale string (e.g., "1:100" -> 100)
 */
export function parsePdfPageScale(scaleString: string): number {
  const match = scaleString.match(/1:(\d+)/)
  return match ? parseInt(match[1]) : 1
}
