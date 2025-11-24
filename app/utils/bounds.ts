/**
 * Bounding Box Utilities
 * Calculate bounding boxes for different annotation types
 *
 * IMPORTANT: These functions calculate the GLOBAL (viewport) bounding box
 * that encompasses the element in its current transformed state.
 * For rotated elements, this returns the axis-aligned bounding box.
 */

import { getRotatedRectBounds } from './transform-math'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Calculate bounding box for any annotation type
 * This returns the global (viewport) axis-aligned bounding box
 * that encompasses the element, accounting for rotation.
 *
 * @param annotation The annotation to calculate bounds for
 * @param ignoreRotation If true, calculate bounds without rotation (for internal calculations)
 * @returns Bounds object or null if unable to calculate
 */
export function calculateBounds(annotation: Annotation, ignoreRotation = false): Bounds | null {
  const rotation = !ignoreRotation && ('rotation' in annotation) ? (annotation.rotation || 0) : 0

  // Text annotations need special handling
  // In SVG, text y-coordinate is the baseline, not the top
  // The visual bounds need to account for font size offset
  if (
    annotation.type === "text" &&
    "x" in annotation &&
    "y" in annotation &&
    "width" in annotation &&
    "height" in annotation &&
    "fontSize" in annotation
  ) {
    const baseBounds = {
      x: annotation.x - 5, // Match background rect padding
      y: annotation.y - annotation.fontSize - 2, // Offset for baseline + padding
      width: annotation.width + 10, // Include padding
      height: annotation.height + 4 // Include padding
    }

    // If rotated, calculate rotated bounds
    if (rotation !== 0) {
      return getRotatedRectBounds(
        baseBounds.x,
        baseBounds.y,
        baseBounds.width,
        baseBounds.height,
        rotation
      )
    }

    return baseBounds
  }

  // Fill and positioned annotations have explicit bounds (x,y is top-left)
  if ("x" in annotation && "y" in annotation && "width" in annotation && "height" in annotation) {
    // If rotated, calculate rotated bounds
    if (rotation !== 0) {
      return getRotatedRectBounds(
        annotation.x,
        annotation.y,
        annotation.width,
        annotation.height,
        rotation
      )
    }

    return {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height
    }
  }

  // Count annotations are point-based with circular markers
  if (annotation.type === "count" && "x" in annotation && "y" in annotation) {
    // Use a reasonable bounding box around the count marker (15px radius + some padding)
    const radius = 20 // Match the hitbox radius from Count.vue

    // Note: circular markers don't change bounds when rotated
    return {
      x: annotation.x - radius,
      y: annotation.y - radius,
      width: radius * 2,
      height: radius * 2
    }
  }

  // Point-based annotations (measure, area, perimeter, line)
  // For these, rotation is already applied to the points themselves,
  // so we just calculate the min/max bounds directly
  if ("points" in annotation && Array.isArray(annotation.points) && annotation.points.length > 0) {
    const xs = annotation.points.map((p: Point) => p.x)
    const ys = annotation.points.map((p: Point) => p.y)
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

  return null
}

/**
 * Check if two bounding boxes intersect
 * @param a First bounds
 * @param b Second bounds
 * @returns True if the bounds intersect
 */
export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return !(a.x + a.width < b.x || a.x > b.x + b.width || a.y + a.height < b.y || a.y > b.y + b.height)
}
