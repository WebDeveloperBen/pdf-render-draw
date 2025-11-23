/**
 * Safe property access utilities for Annotation union types
 * These help avoid TypeScript errors when accessing properties that don't exist on all annotation types
 */

// Type guards for checking if properties exist
export function hasRotation(annotation: Annotation): annotation is Measurement | Area | Perimeter | Line {
  return "rotation" in annotation
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
