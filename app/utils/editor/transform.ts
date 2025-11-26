/**
 * Transform math utilities for V2 editor
 * Extracted from SimpleDebugEditor.vue
 */

/**
 * Rotate a point around a center point
 */
export function rotatePointAroundCenter(point: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  const dx = point.x - center.x
  const dy = point.y - center.y

  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  }
}

/**
 * Rotate multiple points around a center point
 */
export function rotatePointsAroundCenter(points: Point[], center: Point, angle: number): Point[] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  return points.map((point) => {
    const dx = point.x - center.x
    const dy = point.y - center.y

    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    }
  })
}

/**
 * Translate points by delta
 */
export function translatePoints(points: Point[], deltaX: number, deltaY: number): Point[] {
  return points.map((p) => ({
    x: p.x + deltaX,
    y: p.y + deltaY
  }))
}

/**
 * Project a delta into a rotated coordinate system
 * Used for scaling rotated shapes
 */
export function projectDeltaToLocalSpace(
  deltaX: number,
  deltaY: number,
  rotation: number
): { localDeltaX: number; localDeltaY: number } {
  const cos = Math.cos(-rotation)
  const sin = Math.sin(-rotation)

  return {
    localDeltaX: deltaX * cos - deltaY * sin,
    localDeltaY: deltaX * sin + deltaY * cos
  }
}

/**
 * Calculate real-world distance between two points
 * Automatically uses PDF scale from settings store
 */
export function calculateDistance(p1: Point, p2: Point, dpi: number = 72): number {
  // Get scale from global settings
  const settingsStore = useSettingStore()
  const scaleString = settingsStore.getPdfScale

  // Calculate distance in PDF units (points)
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const distanceInPoints = Math.sqrt(dx * dx + dy * dy)

  // Convert points to millimeters (1 point = 1/72 inch)
  const distanceInMm = (distanceInPoints / dpi) * 25.4

  // Apply scale (e.g., 1:100 = 100)
  const scale = parsePdfPageScale(scaleString)
  const realWorldDistance = distanceInMm * scale

  return Math.round(realWorldDistance)
}

/**
 * Calculate midpoint between two points
 */
export function calculateMidpoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  }
}

/**
 * Calculate centroid (center) of a polygon
 */
export function calculateCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]!
  if (points.length === 2) return calculateMidpoint(points[0]!, points[1]!)

  const sumX = points.reduce((sum, p) => sum + p.x, 0)
  const sumY = points.reduce((sum, p) => sum + p.y, 0)

  return {
    x: sumX / points.length,
    y: sumY / points.length
  }
}

/**
 * Calculate real-world polygon area using shoelace formula
 * Automatically uses PDF scale from settings store
 */
export function calculatePolygonArea(points: Point[], dpi: number = 72): number {
  if (points.length < 3) return 0

  // Get scale from global settings
  const settingsStore = useSettingStore()
  const scaleString = settingsStore.getPdfScale
  const scale = parsePdfPageScale(scaleString)
  const pixelsToMm = 25.4 / dpi

  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    const p1 = points[i]!
    const p2 = points[j]!

    // Convert to real-world coordinates (mm)
    const x1 = p1.x * pixelsToMm * scale
    const y1 = p1.y * pixelsToMm * scale
    const x2 = p2.x * pixelsToMm * scale
    const y2 = p2.y * pixelsToMm * scale

    area += x1 * y2 - x2 * y1
  }

  // Convert mm² to m²
  const areaInM2 = Math.abs(area) / 2 / 1000000
  return Math.round(areaInM2 * 100) / 100 // 2 decimal places
}

/**
 * Calculate perimeter of a polygon
 */
export function calculatePerimeter(points: Point[]): number {
  if (points.length < 2) return 0

  let sum = 0
  for (let i = 0; i < points.length - 1; i++) {
    sum += calculateDistance(points[i]!, points[i + 1]!)
  }

  // If polygon is closed (first point === last point), don't add closing edge
  const isClosed = points[0]!.x === points[points.length - 1]!.x && points[0]!.y === points[points.length - 1]!.y

  if (!isClosed && points.length > 2) {
    // Add closing edge for open polygons
    sum += calculateDistance(points[points.length - 1]!, points[0]!)
  }

  return sum
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
  if (!match || !match[1]) return 1
  return parseInt(match[1])
}
