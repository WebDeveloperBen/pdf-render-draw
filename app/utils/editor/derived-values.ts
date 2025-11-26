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

import { toRaw } from "vue"
import { calculateDistance, calculateMidpoint, calculateCentroid, calculatePolygonArea } from "./transform"

/**
 * Recalculate derived values for an annotation after transform
 * Returns only the properties that need updating
 * Generic to preserve type narrowing
 */
export function recalculateDerivedValues<T extends Annotation>(annotation: T): Partial<T> {
  const updates: Partial<T> = {}

  switch (annotation.type) {
    case "measure": {
      const measure = annotation as Measurement
      if (measure.points.length === 2) {
        const [p1, p2] = measure.points
        ;(updates as Partial<Measurement>).distance = calculateDistance(p1!, p2!)
        ;(updates as Partial<Measurement>).midpoint = calculateMidpoint(p1!, p2!)
      }
      break
    }

    case "area": {
      const area = annotation as Area
      if (area.points.length >= 3) {
        ;(updates as Partial<Area>).area = calculatePolygonArea(area.points)
        ;(updates as Partial<Area>).center = calculateCentroid(area.points)
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

        ;(updates as Partial<Perimeter>).segments = segments
        ;(updates as Partial<Perimeter>).totalLength = totalLength
        ;(updates as Partial<Perimeter>).center = calculateCentroid(perimeter.points)
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
    const center = {
      x: annotation.x + annotation.width / 2,
      y: annotation.y + annotation.height / 2
    }

    // Debug logging for Count annotations
    if (annotation.type === "count") {
      debugLog(`getAnnotationCenter - Count #${annotation.id.slice(0, 8)}`, {
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
        calculatedCenter: center
      })
    }

    return center
  }

  debugWarn("getAnnotationCenter", `No center calculation for annotation type: ${annotation.type}`, annotation)
  return { x: 0, y: 0 }
}

/**
 * Type guard for annotations with a points array structure
 * Uses Extract to automatically include any annotation type with points property
 */
export function hasPointsArray(annotation: Annotation): annotation is Extract<Annotation, { points: Point[] }> {
  return "points" in annotation && Array.isArray(annotation.points)
}

/**
 * Type guard for annotations with positioned rectangle structure (x, y, width, height)
 * Uses Extract to automatically include any annotation type with these properties
 */
export function hasPositionedRect(
  annotation: Annotation
): annotation is Extract<Annotation, { x: number; y: number; width: number; height: number }> {
  return "x" in annotation && "y" in annotation && "width" in annotation && "height" in annotation
}

/**
 * Offset an annotation by delta X and delta Y
 * Creates a new annotation object with updated coordinates
 */
export function offsetAnnotation(annotation: Annotation, deltaX: number, deltaY: number): Annotation {
  const cloned = structuredClone(toRaw(annotation))

  // Offset points if they exist
  if (hasPointsArray(cloned)) {
    cloned.points = cloned.points.map((p) => ({
      x: p.x + deltaX,
      y: p.y + deltaY
    }))

    // Also offset segments for perimeter tool
    if (cloned.type === "perimeter" && "segments" in cloned && Array.isArray(cloned.segments)) {
      cloned.segments = cloned.segments.map((seg: PerimeterSegment) => ({
        ...seg,
        start: { x: seg.start.x + deltaX, y: seg.start.y + deltaY },
        end: { x: seg.end.x + deltaX, y: seg.end.y + deltaY },
        midpoint: { x: seg.midpoint.x + deltaX, y: seg.midpoint.y + deltaY }
      }))
    }
  }

  // Offset x/y for positioned annotations (fill, text, count)
  if ("x" in cloned && typeof cloned.x === "number") {
    cloned.x += deltaX
  }
  if ("y" in cloned && typeof cloned.y === "number") {
    cloned.y += deltaY
  }

  // Offset center if it exists
  if ("center" in cloned && cloned.center) {
    cloned.center = {
      x: cloned.center.x + deltaX,
      y: cloned.center.y + deltaY
    }
  }

  // Offset midpoint if it exists
  if ("midpoint" in cloned && cloned.midpoint) {
    cloned.midpoint = {
      x: cloned.midpoint.x + deltaX,
      y: cloned.midpoint.y + deltaY
    }
  }

  return cloned
}
