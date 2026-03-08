/**
 * Mathematical constants and utilities
 */

// Angle conversion constants
export const DEG_TO_RAD = Math.PI / 180
export const RAD_TO_DEG = 180 / Math.PI

/**
 * Convert degrees to radians
 */
export function degreesToRadians(degrees: number): number {
  return degrees * DEG_TO_RAD
}

/**
 * Convert radians to degrees
 */
export function radiansToDegrees(radians: number): number {
  return radians * RAD_TO_DEG
}

/**
 * Snap an angle to the nearest multiple of snapDegrees
 * @param angle - Angle in degrees
 * @param snapDegrees - Snap increment (default: 45)
 */
export function snapToNearestAngle(angle: number, snapDegrees: number = 45): number {
  return Math.round(angle / snapDegrees) * snapDegrees
}

/**
 * Normalize angle to 0-360 range
 */
export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360
}

/**
 * Check if a value is within a threshold
 */
export function isWithinThreshold(value: number, threshold: number): boolean {
  return Math.abs(value) < threshold
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Calculate euclidean distance between two points
 * Simple pixel distance - no scale conversion
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}
