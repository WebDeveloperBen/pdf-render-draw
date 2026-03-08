/**
 * Validation utilities for type checking and value validation
 */

/**
 * Validate that a value is a finite number
 */
export function validateNumber(value: unknown, name: string): boolean {
  if (typeof value !== "number" || !isFinite(value)) {
    console.warn(`Invalid ${name} value:`, value)
    return false
  }
  return true
}

/**
 * Validate that a value is a positive number
 */
export function validatePositiveNumber(value: unknown, name: string): boolean {
  if (!validateNumber(value, name)) return false
  if ((value as number) < 0) {
    console.warn(`${name} must be non-negative:`, value)
    return false
  }
  return true
}

/**
 * Validate that a value is an integer
 */
export function validateInteger(value: unknown, name: string): boolean {
  if (typeof value !== "number" || !isFinite(value)) {
    console.warn(`Invalid ${name}:`, value)
    return false
  }
  if (!Number.isInteger(value as number)) {
    console.warn(`Invalid ${name}:`, value)
    return false
  }
  return true
}

/**
 * Validate that an object has required numeric properties
 * Validates all properties and produces a single warning about the whole object if any fail
 */
export function validateNumericProperties(obj: unknown, properties: string[], name: string): boolean {
  if (typeof obj !== "object" || obj === null) {
    console.warn(`Invalid ${name}:`, obj)
    return false
  }

  // Check all properties first
  for (const prop of properties) {
    const value = (obj as Record<string, unknown>)[prop]
    if (typeof value !== "number" || !isFinite(value)) {
      console.warn(`Invalid ${name}:`, obj)
      return false
    }
  }

  return true
}
