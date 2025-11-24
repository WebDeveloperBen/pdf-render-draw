/**
 * Unit Tests for Transform Math Utilities
 *
 * Tests core geometry and transformation functions to ensure correctness
 */

import { describe, it, expect } from 'vitest'
import {
  rotatePointAroundCenter,
  rotatePointsAroundCenter,
  getRotatedBoundingBox,
  getRotatedRectBounds,
  scalePointsToNewBounds,
  translatePoints,
  scalePointsAroundCenter,
  getUnionBounds,
  getBoundsCenter,
  pointInBounds
} from './transform-math'
import type { Point } from '~/types'
import type { Bounds } from './bounds'

describe('Transform Math Utilities', () => {
  describe('rotatePointAroundCenter', () => {
    it('should rotate point 90 degrees clockwise', () => {
      const point: Point = { x: 10, y: 0 }
      const center: Point = { x: 0, y: 0 }
      const angle = Math.PI / 2 // 90 degrees

      const result = rotatePointAroundCenter(point, center, angle)

      // After 90° rotation: (10, 0) → (0, 10)
      expect(result.x).toBeCloseTo(0, 5)
      expect(result.y).toBeCloseTo(10, 5)
    })

    it('should rotate point 180 degrees', () => {
      const point: Point = { x: 5, y: 3 }
      const center: Point = { x: 0, y: 0 }
      const angle = Math.PI // 180 degrees

      const result = rotatePointAroundCenter(point, center, angle)

      // After 180° rotation: (5, 3) → (-5, -3)
      expect(result.x).toBeCloseTo(-5, 5)
      expect(result.y).toBeCloseTo(-3, 5)
    })

    it('should rotate point around non-origin center', () => {
      const point: Point = { x: 10, y: 5 }
      const center: Point = { x: 5, y: 5 }
      const angle = Math.PI / 2 // 90 degrees

      const result = rotatePointAroundCenter(point, center, angle)

      // Point is 5 units to the right of center
      // After 90° rotation: should be 5 units above center
      expect(result.x).toBeCloseTo(5, 5)
      expect(result.y).toBeCloseTo(10, 5)
    })

    it('should not change point at center', () => {
      const point: Point = { x: 5, y: 5 }
      const center: Point = { x: 5, y: 5 }
      const angle = Math.PI / 2

      const result = rotatePointAroundCenter(point, center, angle)

      expect(result.x).toBeCloseTo(5, 5)
      expect(result.y).toBeCloseTo(5, 5)
    })

    it('should handle 0 degree rotation (no change)', () => {
      const point: Point = { x: 10, y: 5 }
      const center: Point = { x: 0, y: 0 }
      const angle = 0

      const result = rotatePointAroundCenter(point, center, angle)

      expect(result.x).toBeCloseTo(10, 5)
      expect(result.y).toBeCloseTo(5, 5)
    })
  })

  describe('rotatePointsAroundCenter', () => {
    it('should rotate multiple points', () => {
      const points: Point[] = [
        { x: 10, y: 0 },
        { x: 0, y: 10 }
      ]
      const center: Point = { x: 0, y: 0 }
      const angle = Math.PI / 2 // 90 degrees

      const result = rotatePointsAroundCenter(points, center, angle)

      expect(result).toHaveLength(2)
      expect(result[0]!.x).toBeCloseTo(0, 5)
      expect(result[0]!.y).toBeCloseTo(10, 5)
      expect(result[1]!.x).toBeCloseTo(-10, 5)
      expect(result[1]!.y).toBeCloseTo(0, 5)
    })

    it('should handle empty array', () => {
      const points: Point[] = []
      const center: Point = { x: 0, y: 0 }
      const angle = Math.PI / 2

      const result = rotatePointsAroundCenter(points, center, angle)

      expect(result).toHaveLength(0)
    })
  })

  describe('getRotatedBoundingBox', () => {
    it('should calculate correct bounds for rotated square', () => {
      // Square with corners at (0,0), (10,0), (10,10), (0,10)
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ]
      const center: Point = { x: 5, y: 5 }
      const angle = Math.PI / 4 // 45 degrees

      const result = getRotatedBoundingBox(points, center, angle)

      // 45° rotated square should have larger axis-aligned bounding box
      // Width and height should both be sqrt(2) * 10 / 2 ≈ 7.07
      const expectedSize = Math.sqrt(2) * 5 // ≈ 7.07
      expect(result.width).toBeCloseTo(expectedSize * 2, 1)
      expect(result.height).toBeCloseTo(expectedSize * 2, 1)
      expect(result.x).toBeCloseTo(5 - expectedSize, 1)
      expect(result.y).toBeCloseTo(5 - expectedSize, 1)
    })

    it('should return zero bounds for empty points', () => {
      const points: Point[] = []
      const center: Point = { x: 0, y: 0 }
      const angle = 0

      const result = getRotatedBoundingBox(points, center, angle)

      expect(result.x).toBe(0)
      expect(result.y).toBe(0)
      expect(result.width).toBe(0)
      expect(result.height).toBe(0)
    })
  })

  describe('getRotatedRectBounds', () => {
    it('should return same bounds for 0 rotation', () => {
      const result = getRotatedRectBounds(10, 20, 50, 30, 0)

      expect(result.x).toBe(10)
      expect(result.y).toBe(20)
      expect(result.width).toBe(50)
      expect(result.height).toBe(30)
    })

    it('should calculate correct bounds for 90 degree rotation', () => {
      const result = getRotatedRectBounds(0, 0, 10, 20, Math.PI / 2)

      // Rectangle 10x20 centered at (5, 10)
      // After 90° rotation: becomes 20x10 (width and height swap)
      // Center stays at (5, 10)
      expect(result.width).toBeCloseTo(20, 5)
      expect(result.height).toBeCloseTo(10, 5)
    })

    it('should calculate correct bounds for 45 degree rotation', () => {
      const result = getRotatedRectBounds(0, 0, 10, 10, Math.PI / 4)

      // Square 10x10 rotated 45° should have bounds of sqrt(2)*10 ≈ 14.14
      const expectedSize = Math.sqrt(2) * 10
      expect(result.width).toBeCloseTo(expectedSize, 1)
      expect(result.height).toBeCloseTo(expectedSize, 1)
    })
  })

  describe('scalePointsToNewBounds', () => {
    it('should scale points to new bounds', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ]
      const originalBounds: Bounds = { x: 0, y: 0, width: 10, height: 10 }
      const newBounds: Bounds = { x: 0, y: 0, width: 20, height: 20 }

      const result = scalePointsToNewBounds(points, originalBounds, newBounds)

      expect(result[0]!.x).toBeCloseTo(0, 5)
      expect(result[0]!.y).toBeCloseTo(0, 5)
      expect(result[1]!.x).toBeCloseTo(20, 5)
      expect(result[1]!.y).toBeCloseTo(20, 5)
    })

    it('should handle translation and scaling', () => {
      const points: Point[] = [{ x: 10, y: 10 }]
      const originalBounds: Bounds = { x: 0, y: 0, width: 20, height: 20 }
      const newBounds: Bounds = { x: 10, y: 10, width: 40, height: 40 }

      const result = scalePointsToNewBounds(points, originalBounds, newBounds)

      // Point at (10, 10) is at 50% position in original bounds
      // Should be at 50% position in new bounds: (10, 10) + 50% of (40, 40) = (30, 30)
      expect(result[0]!.x).toBeCloseTo(30, 5)
      expect(result[0]!.y).toBeCloseTo(30, 5)
    })

    it('should return original points if original bounds has zero dimension', () => {
      const points: Point[] = [{ x: 5, y: 5 }]
      const originalBounds: Bounds = { x: 0, y: 0, width: 0, height: 10 }
      const newBounds: Bounds = { x: 0, y: 0, width: 10, height: 10 }

      const result = scalePointsToNewBounds(points, originalBounds, newBounds)

      expect(result[0]!.x).toBe(5)
      expect(result[0]!.y).toBe(5)
    })
  })

  describe('translatePoints', () => {
    it('should translate points by delta', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ]

      const result = translatePoints(points, 5, -3)

      expect(result[0]!.x).toBe(5)
      expect(result[0]!.y).toBe(-3)
      expect(result[1]!.x).toBe(15)
      expect(result[1]!.y).toBe(7)
    })

    it('should handle zero delta', () => {
      const points: Point[] = [{ x: 5, y: 5 }]

      const result = translatePoints(points, 0, 0)

      expect(result[0]!.x).toBe(5)
      expect(result[0]!.y).toBe(5)
    })
  })

  describe('scalePointsAroundCenter', () => {
    it('should scale points around center', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ]
      const center: Point = { x: 5, y: 5 }

      const result = scalePointsAroundCenter(points, center, 2, 2)

      // Point (0, 0) is 5 units away from center in both directions
      // Scaled by 2: should be 10 units away → (-5, -5)
      expect(result[0]!.x).toBeCloseTo(-5, 5)
      expect(result[0]!.y).toBeCloseTo(-5, 5)
      // Point (10, 10) is 5 units away from center in both directions
      // Scaled by 2: should be 10 units away → (15, 15)
      expect(result[1]!.x).toBeCloseTo(15, 5)
      expect(result[1]!.y).toBeCloseTo(15, 5)
    })

    it('should not change center point', () => {
      const points: Point[] = [{ x: 5, y: 5 }]
      const center: Point = { x: 5, y: 5 }

      const result = scalePointsAroundCenter(points, center, 2, 2)

      expect(result[0]!.x).toBeCloseTo(5, 5)
      expect(result[0]!.y).toBeCloseTo(5, 5)
    })

    it('should handle non-uniform scaling', () => {
      const points: Point[] = [{ x: 10, y: 10 }]
      const center: Point = { x: 5, y: 5 }

      const result = scalePointsAroundCenter(points, center, 2, 0.5)

      // dx = 5, dy = 5
      // scaled: dx = 10, dy = 2.5
      expect(result[0]!.x).toBeCloseTo(15, 5)
      expect(result[0]!.y).toBeCloseTo(7.5, 5)
    })
  })

  describe('getUnionBounds', () => {
    it('should calculate union of multiple bounds', () => {
      const bounds: Bounds[] = [
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: 20, width: 10, height: 10 }
      ]

      const result = getUnionBounds(bounds)

      expect(result).not.toBeNull()
      expect(result!.x).toBe(0)
      expect(result!.y).toBe(0)
      expect(result!.width).toBe(30)
      expect(result!.height).toBe(30)
    })

    it('should handle overlapping bounds', () => {
      const bounds: Bounds[] = [
        { x: 0, y: 0, width: 15, height: 15 },
        { x: 10, y: 10, width: 15, height: 15 }
      ]

      const result = getUnionBounds(bounds)

      expect(result).not.toBeNull()
      expect(result!.x).toBe(0)
      expect(result!.y).toBe(0)
      expect(result!.width).toBe(25)
      expect(result!.height).toBe(25)
    })

    it('should return null for empty array', () => {
      const result = getUnionBounds([])

      expect(result).toBeNull()
    })

    it('should handle single bounds', () => {
      const bounds: Bounds[] = [{ x: 5, y: 10, width: 20, height: 30 }]

      const result = getUnionBounds(bounds)

      expect(result).not.toBeNull()
      expect(result!.x).toBe(5)
      expect(result!.y).toBe(10)
      expect(result!.width).toBe(20)
      expect(result!.height).toBe(30)
    })
  })

  describe('getBoundsCenter', () => {
    it('should calculate center of bounds', () => {
      const bounds: Bounds = { x: 0, y: 0, width: 10, height: 20 }

      const result = getBoundsCenter(bounds)

      expect(result.x).toBe(5)
      expect(result.y).toBe(10)
    })

    it('should calculate center of offset bounds', () => {
      const bounds: Bounds = { x: 10, y: 20, width: 30, height: 40 }

      const result = getBoundsCenter(bounds)

      expect(result.x).toBe(25)
      expect(result.y).toBe(40)
    })
  })

  describe('pointInBounds', () => {
    it('should return true for point inside bounds', () => {
      const point: Point = { x: 5, y: 5 }
      const bounds: Bounds = { x: 0, y: 0, width: 10, height: 10 }

      expect(pointInBounds(point, bounds)).toBe(true)
    })

    it('should return true for point on bounds edge', () => {
      const point: Point = { x: 10, y: 10 }
      const bounds: Bounds = { x: 0, y: 0, width: 10, height: 10 }

      expect(pointInBounds(point, bounds)).toBe(true)
    })

    it('should return false for point outside bounds', () => {
      const point: Point = { x: 15, y: 5 }
      const bounds: Bounds = { x: 0, y: 0, width: 10, height: 10 }

      expect(pointInBounds(point, bounds)).toBe(false)
    })

    it('should return false for point outside bounds (negative)', () => {
      const point: Point = { x: -1, y: 5 }
      const bounds: Bounds = { x: 0, y: 0, width: 10, height: 10 }

      expect(pointInBounds(point, bounds)).toBe(false)
    })
  })
})
