import { describe, it, expect } from 'vitest'
import {
  calculateDistance,
  calculatePolygonArea,
  calculateCentroid,
  calculateMidpoint,
} from './calculations'
import type { Point } from '~/types'

describe('calculations', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const p1: Point = { x: 0, y: 0 }
      const p2: Point = { x: 100, y: 0 }

      // With scale 1:1 and default DPI (72), 100 PDF points = 35mm
      const distance = calculateDistance(p1, p2, '1:1')

      expect(distance).toBeCloseTo(35, 0)
    })

    it('should account for scale', () => {
      const p1: Point = { x: 0, y: 0 }
      const p2: Point = { x: 100, y: 0 }

      const distance1x = calculateDistance(p1, p2, '1:1')
      const distance100x = calculateDistance(p1, p2, '1:100')

      // Distance with 1:100 scale should be approximately 100x larger
      // Each calculation rounds independently, so we verify the ratio is close to 100
      const ratio = distance100x / distance1x
      expect(ratio).toBeGreaterThan(95)
      expect(ratio).toBeLessThan(105)

      // Verify actual values for regression testing
      expect(distance1x).toBe(35)   // 100 PDF points at 1:1 scale
      expect(distance100x).toBe(3528) // 100 PDF points at 1:100 scale
    })

    it('should handle diagonal measurements', () => {
      const p1: Point = { x: 0, y: 0 }
      const p2: Point = { x: 100, y: 100 }

      const distance = calculateDistance(p1, p2, '1:1')

      // Diagonal of 100x100 square ≈ 141.42 points ≈ 50mm
      expect(distance).toBeGreaterThan(49)
      expect(distance).toBeLessThan(51)
    })
  })

  describe('calculatePolygonArea', () => {
    it('should calculate area of a rectangle with scale', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ]

      const area = calculatePolygonArea(points, '1:100')

      // 100x100 PDF points at 1:100 scale = ~12.45 m²
      expect(area).toBeGreaterThan(0)
      expect(area).toBeCloseTo(12.45, 1)
    })

    it('should calculate area of a triangle', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ]

      const area = calculatePolygonArea(points, '1:100')

      // Triangle area should be roughly half of rectangle = ~6.22 m²
      expect(area).toBeGreaterThan(0)
      expect(area).toBeCloseTo(6.22, 1)
    })

    it('should return 0 for fewer than 3 points', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]

      const area = calculatePolygonArea(points, '1:100')

      expect(area).toBe(0)
    })

    it('should scale area correctly', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ]

      const area1 = calculatePolygonArea(points, '1:1')
      const area100 = calculatePolygonArea(points, '1:100')

      // Area should scale by square of scale factor (100² = 10,000x)
      expect(area100).toBeGreaterThan(area1)
    })
  })

  describe('calculateCentroid', () => {
    it('should find center of a square', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ]

      const centroid = calculateCentroid(points)

      expect(centroid.x).toBeCloseTo(50, 1)
      expect(centroid.y).toBeCloseTo(50, 1)
    })

    it('should find center of a triangle', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ]

      const centroid = calculateCentroid(points)

      expect(centroid.x).toBeCloseTo(50, 1)
      expect(centroid.y).toBeCloseTo(33.33, 1)
    })
  })

  describe('calculateMidpoint', () => {
    it('should find midpoint between two points', () => {
      const p1: Point = { x: 0, y: 0 }
      const p2: Point = { x: 100, y: 100 }

      const midpoint = calculateMidpoint(p1, p2)

      expect(midpoint.x).toBe(50)
      expect(midpoint.y).toBe(50)
    })

    it('should handle negative coordinates', () => {
      const p1: Point = { x: -50, y: -50 }
      const p2: Point = { x: 50, y: 50 }

      const midpoint = calculateMidpoint(p1, p2)

      expect(midpoint.x).toBe(0)
      expect(midpoint.y).toBe(0)
    })
  })
})
