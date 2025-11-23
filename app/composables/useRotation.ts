import type { MaybeRefOrGetter } from "vue"
import { reactive, readonly, toValue } from "vue"
import { degreesToRadians, radiansToDegrees } from "~/utils/math"
import { debugLog } from "~/utils/debug"

/**
 * Shared rotation composable for DRY rotation logic across components.
 *
 * Internally works in radians. Consumers can request degree I/O via `units`.
 */

export interface RotationOptions {
  /** Center point for rotation calculations */
  center: MaybeRefOrGetter<{ x: number; y: number }>
  /** Snap angles in degrees (default: [0, 45, 90, 135, 180, 225, 270, 315]) */
  snapAngles?: number[]
  /** Snap threshold in degrees (default: 5) */
  snapThreshold?: number
  /** Whether to enable snapping (default: true for corner handles, false for wheel) */
  enableSnapping?: boolean
  /** Whether to accumulate rotation over multiple drags (default: false) */
  accumulateRotation?: boolean
  /** Smoothing factor for rotation (0-1, default: 0.8) */
  smoothingFactor?: number
  /** Units exposed to callers (internal math always uses radians) */
  units?: "radians" | "degrees"
}

export interface RotationState {
  isDragging: boolean
  /** Delta from the rotation at drag start (internal radians) */
  currentDelta: number
  /** Absolute rotation at drag start (internal radians) */
  baseRotation: number
  /** Mouse angle at drag start (radians) */
  startAngle: number
  /** Last processed mouse angle (radians) */
  lastMouseAngle: number
}

export function useRotation(options: RotationOptions) {
  const {
    center,
    snapAngles = [0, 45, 90, 135, 180, 225, 270, 315],
    snapThreshold = 5,
    enableSnapping = true,
    accumulateRotation = false,
    smoothingFactor = 0.8,
    units = "radians"
  } = options

  const useDegrees = units === "degrees"
  const toInternal = (angle: number) => (useDegrees ? degreesToRadians(angle) : angle)
  const fromInternal = (angle: number) => (useDegrees ? radiansToDegrees(angle) : angle)

  // Reactive state
  const state = reactive<RotationState>({
    isDragging: false,
    currentDelta: 0,
    baseRotation: 0,
    startAngle: 0,
    lastMouseAngle: 0
  })

  /**
   * Normalize an angle to the range [-π, π)
   */
  function normalizeRadians(angle: number): number {
    const twoPi = Math.PI * 2
    return ((angle + Math.PI) % twoPi) - Math.PI
  }

  /**
   * Calculate angle from center to a point in degrees
   * Returns angle in range [0, 360)
   */
  function calculateAngle(x: number, y: number): number {
    const centerPos = toValue(center)
    const deltaX = x - centerPos.x
    const deltaY = y - centerPos.y

    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90
    if (angle < 0) angle += 360

    return angle
  }

  /**
   * Calculate angle from center to a point in radians
   * Returns angle in range (-π, π]
   */
  function calculateAngleRadians(x: number, y: number): number {
    const centerPos = toValue(center)
    return Math.atan2(y - centerPos.y, x - centerPos.x)
  }

  /**
   * Apply snapping to an angle if within threshold of snap points (angles in degrees)
   */
  function applySnapping(angle: number): number {
    if (!enableSnapping) return angle

    for (const snapAngle of snapAngles) {
      const diff = Math.abs(angle - snapAngle)
      if (diff < snapThreshold || diff > 360 - snapThreshold) {
        return snapAngle
      }
    }

    return angle
  }

  /**
   * Start a rotation drag operation
   */
  function startRotation(startX: number, startY: number, initialRotation = 0) {
    const startAngle = calculateAngleRadians(startX, startY)
    state.isDragging = true
    state.startAngle = startAngle
    state.lastMouseAngle = startAngle
    state.baseRotation = toInternal(initialRotation)
    state.currentDelta = 0

    debugLog("useRotation", "Start rotation:", {
      startX,
      startY,
      initialRotation: initialRotation.toFixed(3),
      startAngle: state.startAngle.toFixed(3)
    })
  }

  /**
   * Update rotation during drag
   * Returns absolute rotation in requested units.
   */
  function updateRotation(currentX: number, currentY: number, shiftKey = false): number {
    if (!state.isDragging) return fromInternal(state.baseRotation + state.currentDelta)

    const currentAngle = calculateAngleRadians(currentX, currentY)
    let dragDelta: number

    if (accumulateRotation) {
      // Incremental delta from last sample
      let deltaStep = currentAngle - state.lastMouseAngle
      if (deltaStep > Math.PI) deltaStep -= 2 * Math.PI
      else if (deltaStep < -Math.PI) deltaStep += 2 * Math.PI

      const accumulated = state.currentDelta + deltaStep

      // Apply smoothing for steadier wheel interaction
      dragDelta = state.currentDelta * (1 - smoothingFactor) + accumulated * smoothingFactor
    } else {
      dragDelta = normalizeRadians(currentAngle - state.startAngle)
    }

    state.lastMouseAngle = currentAngle

    let absoluteRotation = state.baseRotation + dragDelta

    // Snap to nearest increment if requested
    if (shiftKey) {
      const snapped = Math.round(radiansToDegrees(absoluteRotation) / 15) * 15
      absoluteRotation = degreesToRadians(snapped)
    } else {
      const snappedDegrees = applySnapping(radiansToDegrees(absoluteRotation))
      absoluteRotation = degreesToRadians(snappedDegrees)
    }

    state.currentDelta = absoluteRotation - state.baseRotation

    debugLog("useRotation", "Update rotation:", {
      currentX,
      currentY,
      deltaDeg: radiansToDegrees(state.currentDelta).toFixed(1) + "°",
      absoluteDeg: radiansToDegrees(absoluteRotation).toFixed(1) + "°"
    })

    return fromInternal(absoluteRotation)
  }

  /**
   * End rotation drag
   */
  function endRotation() {
    debugLog(
      "useRotation",
      "End rotation, final delta:",
      radiansToDegrees(state.currentDelta).toFixed(1) + "°"
    )

    state.isDragging = false
  }

  /**
   * Reset rotation state
   */
  function reset() {
    state.isDragging = false
    state.currentDelta = 0
    state.baseRotation = 0
    state.startAngle = 0
    state.lastMouseAngle = 0
  }

  /**
   * Get the current rotation delta from drag start
   */
  function getRotationDelta(): number {
    return fromInternal(state.currentDelta)
  }

  /**
   * Get the current absolute rotation (base + delta)
   */
  function getCurrentAngle(): number {
    return fromInternal(state.baseRotation + state.currentDelta)
  }

  return {
    // State
    state: readonly(state),

    // Methods
    calculateAngle,
    calculateAngleRadians,
    startRotation,
    updateRotation,
    endRotation,
    reset,
    getRotationDelta,
    getCurrentAngle,

    // Utilities
    applySnapping
  }
}
