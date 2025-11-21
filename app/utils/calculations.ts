import type { Point } from '~/types'

/**
 * Calculate real-world distance between two points
 *
 * Converts PDF coordinate distance to real-world millimeters using DPI and scale factor.
 * Uses the Euclidean distance formula and applies PDF-to-real-world conversion.
 *
 * @param point1 - Starting point in PDF coordinates
 * @param point2 - Ending point in PDF coordinates
 * @param scaleString - Scale ratio as string (e.g., "1:100")
 * @param dpi - Dots per inch of the PDF (default: 72 for standard PDF resolution)
 * @returns Distance in millimeters, rounded to nearest integer
 *
 * @example
 * const distance = calculateDistance(
 *   { x: 0, y: 0 },
 *   { x: 72, y: 0 },
 *   "1:100",
 *   72
 * ) // Returns 2540 (1 inch * 25.4mm * 100 scale)
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
 * Calculate real-world area of a polygon
 *
 * Uses the Shoelace formula (surveyor's formula) to calculate polygon area.
 * Converts PDF coordinates to real-world square meters using DPI and scale factor.
 *
 * @param points - Array of polygon vertices in PDF coordinates (min 3 points)
 * @param scaleString - Scale ratio as string (e.g., "1:100")
 * @param dpi - Dots per inch of the PDF (default: 72 for standard PDF resolution)
 * @returns Area in square meters, rounded to 2 decimal places
 *
 * @example
 * const area = calculatePolygonArea(
 *   [{ x: 0, y: 0 }, { x: 72, y: 0 }, { x: 72, y: 72 }, { x: 0, y: 72 }],
 *   "1:100",
 *   72
 * ) // Returns area of 1-inch square scaled to 100x (6.45 m²)
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
 * Calculate geometric center (centroid) of a polygon
 *
 * Computes the arithmetic mean of all vertex coordinates. For irregular polygons,
 * this returns the center of the bounding points, not the center of mass.
 *
 * @param points - Array of polygon vertices
 * @returns Point representing the centroid coordinates
 *
 * @example
 * const center = calculateCentroid([
 *   { x: 0, y: 0 },
 *   { x: 100, y: 0 },
 *   { x: 100, y: 100 }
 * ]) // Returns { x: 66.67, y: 33.33 }
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
 *
 * Returns the point exactly halfway between two given points using
 * simple arithmetic mean of coordinates.
 *
 * @param point1 - First point
 * @param point2 - Second point
 * @returns Point at the midpoint
 *
 * @example
 * const mid = calculateMidpoint({ x: 0, y: 0 }, { x: 100, y: 50 })
 * // Returns { x: 50, y: 25 }
 */
export function calculateMidpoint(point1: Point, point2: Point): Point {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2
  }
}

/**
 * Calculate raw Euclidean distance between two points
 *
 * Computes straight-line distance without any unit conversion.
 * Result is in the same coordinate space as the input points.
 *
 * @param point1 - First point
 * @param point2 - Second point
 * @returns Distance in coordinate units (PDF points if using PDF coordinates)
 *
 * @example
 * const dist = distance({ x: 0, y: 0 }, { x: 3, y: 4 })
 * // Returns 5 (Pythagorean theorem: sqrt(3² + 4²))
 */
export function distance(point1: Point, point2: Point): number {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) +
    Math.pow(point2.y - point1.y, 2)
  )
}

/**
 * Parse PDF drawing scale from string format
 *
 * Extracts the numeric scale factor from a ratio string.
 * For architectural/engineering drawings, scale represents how many
 * real-world units equal one drawing unit (e.g., "1:100" means 1mm on
 * paper = 100mm in reality).
 *
 * @param scaleString - Scale ratio string in format "1:N" where N is the scale factor
 * @returns Numeric scale factor, or 1 if parsing fails
 *
 * @example
 * parsePdfPageScale("1:100") // Returns 100
 * parsePdfPageScale("1:50")  // Returns 50
 * parsePdfPageScale("invalid") // Returns 1 (fallback)
 */
export function parsePdfPageScale(scaleString: string): number {
  const match = scaleString.match(/1:(\d+)/)
  return match ? parseInt(match[1]) : 1
}
