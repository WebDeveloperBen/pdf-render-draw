/**
 * Transform math utilities for V2 editor
 * Extracted from DebugEditor.vue
 */

import type { Point } from "~/types/editor"

/**
 * Rotate a point around a center point
 */
export function rotatePointAroundCenter(
  point: Point,
  center: Point,
  angle: number
): Point {
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
export function rotatePointsAroundCenter(
  points: Point[],
  center: Point,
  angle: number
): Point[] {
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
 * Calculate distance between two points
 */
export function calculateDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
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
 * Calculate polygon area using shoelace formula
 */
export function calculatePolygonArea(points: Point[]): number {
  if (points.length < 3) return 0

  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]!
    const p2 = points[(i + 1) % points.length]!
    sum += p1.x * p2.y - p2.x * p1.y
  }

  return Math.abs(sum / 2)
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
  const isClosed =
    points[0]!.x === points[points.length - 1]!.x &&
    points[0]!.y === points[points.length - 1]!.y

  if (!isClosed && points.length > 2) {
    // Add closing edge for open polygons
    sum += calculateDistance(points[points.length - 1]!, points[0]!)
  }

  return sum
}
