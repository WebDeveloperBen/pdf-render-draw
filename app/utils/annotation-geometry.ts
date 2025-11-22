/**
 * Annotation geometry utilities for calculating centers, offsets, and transformations
 */

import { toRaw } from "vue"
import type { Point } from "~/types"
import type { Annotation, PerimeterSegment } from "~/types/annotations"
import { isMeasurement, isLine, isArea, isPerimeter, isFill, isText } from "~/types/annotations"
import { calculateCentroid, calculateMidpoint } from "~/utils/calculations"

/**
 * Get the center point of any annotation type
 * Handles different annotation types appropriately
 */
export function getAnnotationCenter(annotation: Annotation): Point {
  // Measurement and Line tools: use midpoint
  if (isMeasurement(annotation) || isLine(annotation)) {
    const points = annotation.points
    if (points.length >= 2) {
      return calculateMidpoint(points[0]!, points[1]!)
    }
  }

  // Area and Perimeter: use stored center or calculate centroid
  if (isArea(annotation) || isPerimeter(annotation)) {
    if ("center" in annotation && annotation.center) {
      return annotation.center
    }
    if (annotation.points.length >= 3) {
      return calculateCentroid(annotation.points)
    }
  }

  // Fill tool: calculate center from x,y,width,height
  if (isFill(annotation) && "x" in annotation && "y" in annotation && "width" in annotation && "height" in annotation) {
    return {
      x: annotation.x + annotation.width / 2,
      y: annotation.y + annotation.height / 2
    }
  }

  // Text tool: calculate center from x,y,width,height
  // Note: In SVG, text y is the baseline, so we need to offset by fontSize to get visual center
  if (isText(annotation) && "x" in annotation && "y" in annotation && "width" in annotation && "height" in annotation && "fontSize" in annotation) {
    // Visual bounds match the background rect in Text.vue
    const visualY = annotation.y - annotation.fontSize - 2
    return {
      x: annotation.x + annotation.width / 2,
      y: visualY + annotation.height / 2
    }
  }

  // Fallback: calculate centroid if points exist
  if ("points" in annotation && annotation.points.length > 0) {
    return calculateCentroid(annotation.points)
  }

  return { x: 0, y: 0 }
}

/**
 * Offset an annotation by delta X and delta Y
 * Creates a new annotation object with updated coordinates
 * Uses toRaw() to unwrap Vue reactivity before cloning
 */
export function offsetAnnotation(annotation: Annotation, deltaX: number, deltaY: number): Annotation {
  // Unwrap Vue reactivity to get plain object that structuredClone can handle
  const cloned = structuredClone(toRaw(annotation))

  // Offset points if they exist
  if ("points" in cloned && Array.isArray(cloned.points)) {
    cloned.points = cloned.points.map((p) => ({
      x: p.x + deltaX,
      y: p.y + deltaY
    }))

    // Also offset segments for perimeter tool
    if (isPerimeter(cloned) && "segments" in cloned && Array.isArray(cloned.segments)) {
      cloned.segments = cloned.segments.map((seg: PerimeterSegment) => ({
        ...seg,
        start: { x: seg.start.x + deltaX, y: seg.start.y + deltaY },
        end: { x: seg.end.x + deltaX, y: seg.end.y + deltaY }
      }))
    }
  }

  // Offset x/y for positioned annotations (fill, text)
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

/**
 * Calculate the distance from a point to the nearest point on an annotation
 * Useful for selection and hover detection
 */
export function distanceToAnnotation(annotation: Annotation, point: Point): number {
  if ("points" in annotation && annotation.points.length > 0) {
    // Find minimum distance to any point
    return Math.min(
      ...annotation.points.map((p) => {
        const dx = p.x - point.x
        const dy = p.y - point.y
        return Math.sqrt(dx * dx + dy * dy)
      })
    )
  }

  // For positioned annotations
  if ("x" in annotation && "y" in annotation && typeof annotation.x === "number" && typeof annotation.y === "number") {
    const dx = annotation.x - point.x
    const dy = annotation.y - point.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  return Infinity
}
