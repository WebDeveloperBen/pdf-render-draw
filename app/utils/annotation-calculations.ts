/**
 * Recalculate derived values for annotations when their data changes
 * Tools call this after transformations to keep derived values in sync
 */

export function recalculateDerivedValues(annotation: Annotation): Partial<Annotation> {
  // Note: calculateDistance and calculatePolygonArea get scale from settings store internally
  // so we don't need to pass it here

  if (isMeasurement(annotation)) {
    // Recalculate distance and midpoint
    const [p1, p2] = annotation.points
    const updates: Partial<Measurement> = {}

    if (p1 && p2) {
      updates.distance = calculateDistance(p1, p2)
      updates.midpoint = calculateMidpoint(p1, p2)
    }

    return updates
  } else if (isArea(annotation)) {
    // Recalculate area and center
    const updates: Partial<Area> = {}

    if (annotation.points.length >= 3) {
      updates.area = calculatePolygonArea(annotation.points)
      updates.center = calculateCentroid(annotation.points)
    }

    return updates
  } else if (isPerimeter(annotation)) {
    // Recalculate segments, totalLength, and center
    const updates: Partial<Perimeter> = {}

    if (annotation.points.length >= 3) {
      const segments: PerimeterSegment[] = []
      let totalLength = 0

      for (let i = 0; i < annotation.points.length; i++) {
        const start = annotation.points[i]
        const end = annotation.points[(i + 1) % annotation.points.length]

        if (start && end) {
          const segmentLength = calculateDistance(start, end)
          totalLength += segmentLength

          segments.push({
            start,
            end,
            length: segmentLength,
            midpoint: calculateMidpoint(start, end)
          })
        }
      }

      updates.segments = segments
      updates.totalLength = totalLength
      updates.center = calculateCentroid(annotation.points)
    }

    return updates
  }

  return {}
}
