/**
 * Bounds calculation utilities for V2 editor
 * Extracted from DebugEditor.vue
 * Extended to support all annotation types
 */

import type { Bounds, Point } from "~/types/editor"
import type { Annotation } from "~/types/annotations"
import { isPointBased } from "./derived-values"

/**
 * Calculate bounding box for a positioned shape (with rotation support)
 */
export function calculateRotatedRectBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number
): Bounds {
  if (rotation === 0) {
    return { x, y, width, height }
  }

  // For rotated rectangles: calculate rotated bounding box
  const centerX = x + width / 2
  const centerY = y + height / 2

  // Get four corners
  const corners = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ]

  // Rotate corners
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)

  const rotatedCorners = corners.map((corner) => {
    const dx = corner.x - centerX
    const dy = corner.y - centerY
    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos
    }
  })

  // Find min/max to get axis-aligned bounding box
  const xs = rotatedCorners.map((p) => p.x)
  const ys = rotatedCorners.map((p) => p.y)

  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  }
}

/**
 * Calculate union bounding box for multiple bounds
 */
export function calculateUnionBounds(bounds: Bounds[]): Bounds | null {
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
 * Get center point of a bounds
 */
export function getBoundsCenter(bounds: Bounds): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  }
}

/**
 * Check if two bounds intersect (for marquee selection)
 */
export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  )
}

/**
 * Calculate bounding box for point-based annotations
 * Returns AABB of the points
 */
export function calculatePointsBounds(points: Point[]): Bounds {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

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

/**
 * Calculate bounding box for any annotation type
 * Handles both point-based and positioned annotations
 */
export function calculateAnnotationBounds(annotation: Annotation): Bounds {
  // Point-based annotations (measure, area, perimeter, line)
  if (isPointBased(annotation)) {
    return calculatePointsBounds(annotation.points)
  }

  // Positioned annotations (fill, text, count)
  if ("x" in annotation && "width" in annotation) {
    return calculateRotatedRectBounds(
      annotation.x,
      annotation.y,
      annotation.width,
      annotation.height,
      annotation.rotation
    )
  }

  // Fallback
  return { x: 0, y: 0, width: 0, height: 0 }
}
