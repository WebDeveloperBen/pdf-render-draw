/**
 * Derived value recalculation for annotations
 *
 * After transforms (rotation, scale, move), annotations need their derived values recalculated:
 * - Measurement: distance, midpoint
 * - Area: area, center
 * - Perimeter: segments, totalLength, center
 * - Line: none
 * - Fill/Text/Count: none (positioned annotations)
 */

import type { Annotation, Measurement, Area, Perimeter, PerimeterSegment } from "~/types/annotations"
import type { Point } from "~/types/editor"
import { calculateDistance, calculateMidpoint, calculateCentroid, calculatePolygonArea, calculatePerimeter } from "./transform"

/**
 * Recalculate derived values for an annotation after transform
 * Returns only the properties that need updating
 */
export function recalculateDerivedValues(annotation: Annotation): Partial<Annotation> {
  const updates: Partial<Annotation> = {}

  switch (annotation.type) {
    case "measure": {
      const measure = annotation as Measurement
      if (measure.points.length === 2) {
        const [p1, p2] = measure.points
        updates.distance = calculateDistance(p1!, p2!)
        updates.midpoint = calculateMidpoint(p1!, p2!)
      }
      break
    }

    case "area": {
      const area = annotation as Area
      if (area.points.length >= 3) {
        updates.area = calculatePolygonArea(area.points)
        updates.center = calculateCentroid(area.points)
      }
      break
    }

    case "perimeter": {
      const perimeter = annotation as Perimeter
      if (perimeter.points.length >= 3) {
        const segments: PerimeterSegment[] = []
        let totalLength = 0

        for (let i = 0; i < perimeter.points.length; i++) {
          const start = perimeter.points[i]!
          const end = perimeter.points[(i + 1) % perimeter.points.length]!
          const length = calculateDistance(start, end)
          const midpoint = calculateMidpoint(start, end)

          segments.push({ start, end, length, midpoint })
          totalLength += length
        }

        updates.segments = segments
        updates.totalLength = totalLength
        updates.center = calculateCentroid(perimeter.points)
      }
      break
    }

    case "line":
    case "fill":
    case "text":
    case "count":
      // No derived values to recalculate
      break
  }

  return updates
}

/**
 * Get rotation center for any annotation type
 * Point-based: centroid or midpoint
 * Positioned: geometric center
 */
export function getAnnotationCenter(annotation: Annotation): Point {
  // Point-based annotations
  if ("points" in annotation && Array.isArray(annotation.points)) {
    if (annotation.points.length === 2) {
      return calculateMidpoint(annotation.points[0]!, annotation.points[1]!)
    }
    return calculateCentroid(annotation.points)
  }

  // Positioned annotations
  if ("x" in annotation && "width" in annotation) {
    return {
      x: annotation.x + annotation.width / 2,
      y: annotation.y + annotation.height / 2
    }
  }

  return { x: 0, y: 0 }
}

/**
 * Check if annotation is point-based (has points array)
 */
export function isPointBased(annotation: Annotation): annotation is Measurement | Area | Perimeter | Line {
  return "points" in annotation && Array.isArray(annotation.points)
}

/**
 * Check if annotation is positioned (has x, y, width, height)
 */
export function isPositioned(annotation: Annotation): boolean {
  return "x" in annotation && "y" in annotation && "width" in annotation && "height" in annotation
}
