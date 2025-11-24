/**
 * Transform Math Utilities
 *
 * Provides CTM-based (Current Transformation Matrix) utilities for handling
 * complex SVG transforms including rotation, scaling, and translation.
 *
 * Key principles:
 * 1. Always work in global (viewport) coordinates for bounding boxes
 * 2. Use element.getCTM() to get the current transformation matrix
 * 3. Apply transforms in correct order: translate → rotate → scale
 * 4. Cache computed values to avoid recalculation during drag operations
 */

import type { Point } from '~/types'
import type { Bounds } from './bounds'

/**
 * Rotate a point around a center point
 */
export function rotatePointAroundCenter(
  point: Point,
  center: Point,
  angleRadians: number
): Point {
  const cos = Math.cos(angleRadians)
  const sin = Math.sin(angleRadians)
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
  angleRadians: number
): Point[] {
  const cos = Math.cos(angleRadians)
  const sin = Math.sin(angleRadians)

  return points.map(p => {
    const dx = p.x - center.x
    const dy = p.y - center.y
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    }
  })
}

/**
 * Calculate the global (viewport) bounding box for rotated points
 * Returns the axis-aligned bounding box that encompasses all rotated points
 */
export function getRotatedBoundingBox(
  points: Point[],
  center: Point,
  angleRadians: number
): Bounds {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const rotatedPoints = rotatePointsAroundCenter(points, center, angleRadians)

  const xs = rotatedPoints.map(p => p.x)
  const ys = rotatedPoints.map(p => p.y)
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

/**
 * Get the axis-aligned bounding box for a rotated rectangle
 * This is used for elements with x, y, width, height, rotation properties
 */
export function getRotatedRectBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number
): Bounds {
  // If no rotation, return simple bounds
  if (rotation === 0) {
    return { x, y, width, height }
  }

  // Calculate center point
  const centerX = x + width / 2
  const centerY = y + height / 2

  // Get four corners of the rectangle
  const corners: Point[] = [
    { x, y },                          // Top-left
    { x: x + width, y },               // Top-right
    { x: x + width, y: y + height },   // Bottom-right
    { x, y: y + height }               // Bottom-left
  ]

  // Rotate corners around center
  const rotatedCorners = rotatePointsAroundCenter(corners, { x: centerX, y: centerY }, rotation)

  // Find bounding box of rotated corners
  const xs = rotatedCorners.map(p => p.x)
  const ys = rotatedCorners.map(p => p.y)

  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  }
}

/**
 * Scale points from an original bounding box to a new bounding box
 */
export function scalePointsToNewBounds(
  points: Point[],
  originalBounds: Bounds,
  newBounds: Bounds
): Point[] {
  if (originalBounds.width === 0 || originalBounds.height === 0) {
    return points
  }

  const scaleX = newBounds.width / originalBounds.width
  const scaleY = newBounds.height / originalBounds.height

  return points.map(p => ({
    x: newBounds.x + (p.x - originalBounds.x) * scaleX,
    y: newBounds.y + (p.y - originalBounds.y) * scaleY
  }))
}

/**
 * Translate (move) points by a delta
 */
export function translatePoints(
  points: Point[],
  deltaX: number,
  deltaY: number
): Point[] {
  return points.map(p => ({
    x: p.x + deltaX,
    y: p.y + deltaY
  }))
}

/**
 * Scale points around a center point (for rotated shapes)
 * This maintains the rotation while scaling
 */
export function scalePointsAroundCenter(
  points: Point[],
  center: Point,
  scaleX: number,
  scaleY: number
): Point[] {
  return points.map(p => {
    const dx = p.x - center.x
    const dy = p.y - center.y
    return {
      x: center.x + dx * scaleX,
      y: center.y + dy * scaleY
    }
  })
}

/**
 * Calculate union bounding box for multiple bounds
 * Used for multi-select to get the combined bounding box
 */
export function getUnionBounds(bounds: Bounds[]): Bounds | null {
  if (bounds.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const b of bounds) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }

  if (minX === Infinity) return null

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Get center point of a bounding box
 */
export function getBoundsCenter(bounds: Bounds): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  }
}

/**
 * Check if a point is inside a bounding box
 */
export function pointInBounds(point: Point, bounds: Bounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}
