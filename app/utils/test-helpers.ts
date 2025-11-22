import type { Annotation } from '~/types/annotations'

/**
 * Test helper utilities for safely accessing annotation properties
 * These help avoid TypeScript errors in test files
 */

/**
 * Safely get rotation from an annotation (returns 0 if not present)
 */
export function getTestRotation(annotation: Annotation | undefined): number {
  if (!annotation) return 0
  return 'rotation' in annotation ? annotation.rotation ?? 0 : 0
}

/**
 * Safely get points from an annotation
 */
export function getTestPoints(annotation: Annotation | undefined): Array<{ x: number; y: number }> | undefined {
  if (!annotation) return undefined
  return 'points' in annotation ? annotation.points : undefined
}

/**
 * Safely get midpoint from a measurement annotation
 */
export function getTestMidpoint(annotation: Annotation | undefined): { x: number; y: number } | undefined {
  if (!annotation) return undefined
  return 'midpoint' in annotation ? annotation.midpoint : undefined
}

/**
 * Safely get distance from a measurement annotation
 */
export function getTestDistance(annotation: Annotation | undefined): number | undefined {
  if (!annotation) return undefined
  return 'distance' in annotation ? annotation.distance : undefined
}

/**
 * Safely get labelRotation from an annotation
 */
export function getTestLabelRotation(annotation: Annotation | undefined): number | undefined {
  if (!annotation) return undefined
  return 'labelRotation' in annotation ? annotation.labelRotation : undefined
}

/**
 * Assert that a value is defined (non-null, non-undefined)
 * Throws if the value is undefined or null
 */
export function assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message || 'Expected value to be defined')
  }
}
