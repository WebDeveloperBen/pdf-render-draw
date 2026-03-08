/**
 * Safe property access utilities for Annotation union types
 * These help avoid TypeScript errors when accessing properties that don't exist on all annotation types
 */

// Type guards for checking if properties exist
export function hasRotation(annotation: Annotation): annotation is Annotation & { rotation: number } {
  return "rotation" in annotation && typeof (annotation as { rotation?: unknown }).rotation === "number"
}

export function hasPoints(annotation: Annotation): annotation is Measurement | Area | Perimeter | Line {
  return "points" in annotation
}

export function hasX(annotation: Annotation): annotation is Fill | TextAnnotation {
  return "x" in annotation
}

export function hasY(annotation: Annotation): annotation is Fill | TextAnnotation {
  return "y" in annotation
}

export function hasWidth(annotation: Annotation): annotation is Fill | TextAnnotation {
  return "width" in annotation
}

export function hasHeight(annotation: Annotation): annotation is Fill | TextAnnotation {
  return "height" in annotation
}

export function hasLabelRotation(annotation: Annotation): annotation is Measurement | Area | Perimeter {
  return "labelRotation" in annotation
}

export function hasMidpoint(annotation: Annotation): annotation is Measurement {
  return "midpoint" in annotation
}

export function hasCenter(annotation: Annotation): annotation is Area | Perimeter {
  return "center" in annotation
}

export function hasDistance(annotation: Annotation): annotation is Measurement {
  return "distance" in annotation
}

export function hasArea(annotation: Annotation): annotation is Area {
  return "area" in annotation
}

// Safe property getters with fallbacks
export function getRotation(annotation: Annotation): number | undefined {
  return hasRotation(annotation) ? annotation.rotation : undefined
}

export function getPoints(annotation: Annotation): Array<{ x: number; y: number }> | undefined {
  return hasPoints(annotation) ? annotation.points : undefined
}

export function getX(annotation: Annotation): number | undefined {
  return hasX(annotation) ? annotation.x : undefined
}

export function getY(annotation: Annotation): number | undefined {
  return hasY(annotation) ? annotation.y : undefined
}

export function getWidth(annotation: Annotation): number | undefined {
  return hasWidth(annotation) ? annotation.width : undefined
}

export function getHeight(annotation: Annotation): number | undefined {
  return hasHeight(annotation) ? annotation.height : undefined
}

export function getLabelRotation(annotation: Annotation): number | undefined {
  return hasLabelRotation(annotation) ? annotation.labelRotation : undefined
}

export function getMidpoint(annotation: Annotation): { x: number; y: number } | undefined {
  return hasMidpoint(annotation) ? annotation.midpoint : undefined
}

export function getCenter(annotation: Annotation): { x: number; y: number } | undefined {
  return hasCenter(annotation) ? annotation.center : undefined
}

export function getDistance(annotation: Annotation): number | undefined {
  return hasDistance(annotation) ? annotation.distance : undefined
}

export function getArea(annotation: Annotation): number | undefined {
  return hasArea(annotation) ? annotation.area : undefined
}

// Helper function to check if we're in selection mode
export function isSelectionMode(tool: string) {
  return tool === "selection" || tool === ""
}

// Utility for creating safe partial updates
export function createSafeAnnotationUpdate(updates: Record<string, unknown>): Partial<Annotation> {
  const safeUpdates: Record<string, unknown> = {}

  // Only include properties that exist on at least one annotation type
  Object.keys(updates).forEach((key) => {
    if (updates[key] !== undefined) {
      safeUpdates[key] = updates[key]
    }
  })

  return safeUpdates as Partial<Annotation>
}

// Utility for checking if two annotation property values are different
export function annotationPropertyChanged(current: Annotation, original: Annotation, property: string): boolean {
  const currentValue = (current as unknown as Record<string, unknown>)[property]
  const originalValue = (original as unknown as Record<string, unknown>)[property]

  if (currentValue === undefined && originalValue === undefined) return false
  if (currentValue === undefined || originalValue === undefined) return true

  // For arrays and objects, do deep comparison
  if (Array.isArray(currentValue) && Array.isArray(originalValue)) {
    return JSON.stringify(currentValue) !== JSON.stringify(originalValue)
  }

  if (
    typeof currentValue === "object" &&
    typeof originalValue === "object" &&
    currentValue !== null &&
    originalValue !== null
  ) {
    return JSON.stringify(currentValue) !== JSON.stringify(originalValue)
  }

  return currentValue !== originalValue
}

/**
 * Safely get an item from an array at a given index
 * Throws if the item is undefined
 */
export function assertArrayItem<T>(array: T[], index: number, message?: string): T {
  const item = array[index]
  if (item === undefined) {
    throw new Error(message || `Array item at index ${index} is undefined`)
  }
  return item
}

// FIX: Ensure these are correctly being used. We shouldn't have tool aware functions here and should potentially use the above general ones instead to be able to extend into the future easier as we add new tools but keeping for backwards compat for now

// Type guards
export function isMeasurement(ann: Annotation): ann is Measurement {
  return ann.type === "measure"
}

export function isArea(ann: Annotation): ann is Area {
  return ann.type === "area"
}

export function isPerimeter(ann: Annotation): ann is Perimeter {
  return ann.type === "perimeter"
}

export function isLine(ann: Annotation): ann is Line {
  return ann.type === "line"
}

export function isFill(ann: Annotation): ann is Fill {
  return ann.type === "fill"
}

export function isText(ann: Annotation): ann is TextAnnotation {
  return ann.type === "text"
}

export function isCount(ann: Annotation): ann is Count {
  return ann.type === "count"
}

/**
 * Runtime validation functions
 * These check data integrity beyond just type checking
 */

export function isValidPoint(point: unknown): point is Point {
  return (
    typeof point === "object" &&
    point !== null &&
    "x" in point &&
    "y" in point &&
    typeof (point as Point).x === "number" &&
    typeof (point as Point).y === "number" &&
    !isNaN((point as Point).x) &&
    !isNaN((point as Point).y)
  )
}

/**
 * Generic shape-based validation for annotations
 * Validates based on data structure rather than specific tool types
 * This allows tools to be decoupled from the validation logic
 */
export function validateAnnotation(ann: unknown): ann is Annotation {
  if (typeof ann !== "object" || ann === null) return false

  const obj = ann as Record<string, unknown>

  // Validate base properties (required for all annotations)
  if (!obj.id || typeof obj.id !== "string") return false
  if (!obj.type || typeof obj.type !== "string") return false
  if (typeof obj.pageNum !== "number" || obj.pageNum < 1) return false

  // Shape-based validation: validate properties based on their presence
  // This makes validation tool-agnostic

  // Points array (for point-based annotations)
  if ("points" in obj) {
    if (!Array.isArray(obj.points)) return false
    if (obj.points.length < 2) return false
    if (!obj.points.every(isValidPoint)) return false
  }

  // Segments array (for perimeter-like annotations)
  if ("segments" in obj) {
    if (!Array.isArray(obj.segments)) return false
  }

  // Numeric measurement values
  if ("distance" in obj && (typeof obj.distance !== "number" || obj.distance < 0 || isNaN(obj.distance))) return false
  if ("area" in obj && (typeof obj.area !== "number" || obj.area < 0 || isNaN(obj.area))) return false
  if ("totalLength" in obj && (typeof obj.totalLength !== "number" || obj.totalLength < 0 || isNaN(obj.totalLength)))
    return false

  // Point properties (center, midpoint)
  if ("center" in obj && !isValidPoint(obj.center)) return false
  if ("midpoint" in obj && !isValidPoint(obj.midpoint)) return false

  // Rotation values (should be numbers, can be any value including negative)
  if ("rotation" in obj && (typeof obj.rotation !== "number" || isNaN(obj.rotation))) return false
  if ("labelRotation" in obj && (typeof obj.labelRotation !== "number" || isNaN(obj.labelRotation))) return false

  // Positioned rectangle properties
  if ("x" in obj && (typeof obj.x !== "number" || isNaN(obj.x))) return false
  if ("y" in obj && (typeof obj.y !== "number" || isNaN(obj.y))) return false
  if ("width" in obj && (typeof obj.width !== "number" || isNaN(obj.width))) return false
  if ("height" in obj && (typeof obj.height !== "number" || isNaN(obj.height))) return false

  // Color and opacity
  if ("color" in obj && typeof obj.color !== "string") return false
  if ("opacity" in obj && (typeof obj.opacity !== "number" || obj.opacity < 0 || obj.opacity > 1)) return false

  // Text-specific
  if ("content" in obj && typeof obj.content !== "string") return false
  if ("fontSize" in obj && (typeof obj.fontSize !== "number" || obj.fontSize <= 0)) return false

  // Count-specific
  if ("number" in obj && (typeof obj.number !== "number" || obj.number <= 0)) return false
  if ("label" in obj && obj.label !== undefined && typeof obj.label !== "string") return false

  return true
}
