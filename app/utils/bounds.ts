/**
 * Bounding Box Utilities
 * Calculate bounding boxes for different annotation types
 */

import type { Annotation } from '~/types/annotations'
import type { Point } from '~/types'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Calculate bounding box for any annotation type
 * @param annotation The annotation to calculate bounds for
 * @returns Bounds object or null if unable to calculate
 */
export function calculateBounds(annotation: Annotation): Bounds | null {
  // Text annotations need special handling
  // In SVG, text y-coordinate is the baseline, not the top
  // The visual bounds need to account for font size offset
  if (annotation.type === 'text' && 'x' in annotation && 'y' in annotation && 'width' in annotation && 'height' in annotation && 'fontSize' in annotation) {
    return {
      x: annotation.x - 5, // Match background rect padding
      y: annotation.y - annotation.fontSize - 2, // Offset for baseline + padding
      width: annotation.width + 10, // Include padding
      height: annotation.height + 4, // Include padding
    }
  }

  // Fill annotations have explicit bounds (x,y is top-left)
  if ('x' in annotation && 'y' in annotation && 'width' in annotation && 'height' in annotation) {
    return {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
    }
  }

  // Point-based annotations (measure, area, perimeter, line)
  if ('points' in annotation && Array.isArray(annotation.points) && annotation.points.length > 0) {
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
      height: maxY - minY,
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
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  )
}
