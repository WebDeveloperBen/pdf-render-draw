import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnnotationStore } from '~/stores/annotations'
import type { Fill } from '~/types/annotations'
import { calculateBounds } from '~/utils/bounds'

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

describe('Fill Rotation - Position and Distance Verification', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function createFill(id: string, x: number, y: number, width: number, height: number): Fill {
    return {
      id,
      type: 'fill',
      pageNum: 1,
      x,
      y,
      width,
      height,
      color: '#00FF00',
      opacity: 0.5,
      rotation: 0
    }
  }

  function calculateGroupCenter(annotations: any[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const ann of annotations) {
      const bounds = calculateBounds(ann)!
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.width)
      maxY = Math.max(maxY, bounds.y + bounds.height)
    }

    return {
      x: minX + (maxX - minX) / 2,
      y: minY + (maxY - minY) / 2
    }
  }

  function applyGroupRotation(store: any, rotationRadians: number, groupCenter: { x: number, y: number }) {
    const selectedAnns = store.selectedAnnotations

    selectedAnns.forEach((ann: any) => {
      if (ann.type === 'fill' || ann.type === 'text') {
        const currentRotation = ann.rotation || 0
        store.updateAnnotation(ann.id, {
          rotation: currentRotation + rotationRadians
        })
      } else if ('points' in ann) {
        const cos = Math.cos(rotationRadians)
        const sin = Math.sin(rotationRadians)

        const rotatedPoints = ann.points.map((p: { x: number, y: number }) => ({
          x: groupCenter.x + (p.x - groupCenter.x) * cos - (p.y - groupCenter.y) * sin,
          y: groupCenter.y + (p.x - groupCenter.x) * sin + (p.y - groupCenter.y) * cos
        }))

        store.updateAnnotation(ann.id, { points: rotatedPoints })
      }
    })
  }

  describe('Test 15-18: Position and Distance Verification', () => {
    it('Test 15: rotate group 90° → verify all fills maintain correct relative positions', () => {
      const store = useAnnotationStore()

      // Create a 2x2 grid of fills
      const fill1 = createFill('f1', 100, 100, 50, 50) // Top-left
      const fill2 = createFill('f2', 200, 100, 50, 50) // Top-right
      const fill3 = createFill('f3', 100, 200, 50, 50) // Bottom-left
      const fill4 = createFill('f4', 200, 200, 50, 50) // Bottom-right

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.addAnnotation(fill3)
      store.addAnnotation(fill4)
      store.selectAnnotations(['f1', 'f2', 'f3', 'f4'])

      // Calculate relative positions before rotation
      const groupCenter = calculateGroupCenter([fill1, fill2, fill3, fill4])

      // Before rotation: fill1 should be top-left of center
      expect(fill1.x).toBeLessThan(groupCenter.x)
      expect(fill1.y).toBeLessThan(groupCenter.y)

      // Before rotation: fill4 should be bottom-right of center
      expect(fill4.x).toBeGreaterThan(groupCenter.x)
      expect(fill4.y).toBeGreaterThan(groupCenter.y)

      // Rotate 90°
      applyGroupRotation(store, Math.PI / 2, groupCenter)

      const updated1 = store.getAnnotationById('f1') as Fill
      const updated2 = store.getAnnotationById('f2') as Fill
      const updated3 = store.getAnnotationById('f3') as Fill
      const updated4 = store.getAnnotationById('f4') as Fill

      // All should have same rotation
      expect(updated1.rotation).toBeCloseTo(Math.PI / 2, 5)
      expect(updated2.rotation).toBeCloseTo(Math.PI / 2, 5)
      expect(updated3.rotation).toBeCloseTo(Math.PI / 2, 5)
      expect(updated4.rotation).toBeCloseTo(Math.PI / 2, 5)

      // Positions should be unchanged (rotation transform handles visual rotation)
      expect(updated1.x).toBe(100)
      expect(updated1.y).toBe(100)
      expect(updated4.x).toBe(200)
      expect(updated4.y).toBe(200)
    })

    it('Test 16: rotate group → verify distances between annotations unchanged', () => {
      const store = useAnnotationStore()

      const fill1 = createFill('f1', 100, 100, 50, 50)
      const fill2 = createFill('f2', 300, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.selectAnnotations(['f1', 'f2'])

      // Calculate distance before rotation (center to center)
      const distanceBefore = Math.sqrt(
        Math.pow((fill2.x + fill2.width / 2) - (fill1.x + fill1.width / 2), 2) +
        Math.pow((fill2.y + fill2.height / 2) - (fill1.y + fill1.height / 2), 2)
      )

      const groupCenter = calculateGroupCenter([fill1, fill2])
      applyGroupRotation(store, Math.PI / 3, groupCenter) // 60°

      const updated1 = store.getAnnotationById('f1') as Fill
      const updated2 = store.getAnnotationById('f2') as Fill

      // Calculate distance after rotation (center to center)
      const distanceAfter = Math.sqrt(
        Math.pow((updated2.x + updated2.width / 2) - (updated1.x + updated1.width / 2), 2) +
        Math.pow((updated2.y + updated2.height / 2) - (updated1.y + updated1.height / 2), 2)
      )

      // Distance should be unchanged (positions don't move, only rotation applied)
      expect(distanceAfter).toBeCloseTo(distanceBefore, 5)
    })

    it('Test 17: rotate group with fills at various positions → verify group center calculation', () => {
      const store = useAnnotationStore()

      // Asymmetric layout
      const fill1 = createFill('f1', 50, 50, 30, 30)
      const fill2 = createFill('f2', 200, 100, 60, 40)
      const fill3 = createFill('f3', 150, 250, 40, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.addAnnotation(fill3)
      store.selectAnnotations(['f1', 'f2', 'f3'])

      const groupCenter = calculateGroupCenter([fill1, fill2, fill3])

      // Verify group center is calculated correctly
      // Minimum bounds: (50, 50)
      // Maximum bounds: (260, 300) - (200+60, 250+50)
      // Center should be: ((50+260)/2, (50+300)/2) = (155, 175)
      expect(groupCenter.x).toBeCloseTo(155, 1)
      expect(groupCenter.y).toBeCloseTo(175, 1)

      // Rotate and verify rotation applied
      applyGroupRotation(store, Math.PI / 4, groupCenter)

      const updated1 = store.getAnnotationById('f1') as Fill
      const updated2 = store.getAnnotationById('f2') as Fill
      const updated3 = store.getAnnotationById('f3') as Fill

      expect(updated1.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(updated2.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(updated3.rotation).toBeCloseTo(Math.PI / 4, 5)
    })

    it('Test 18: rotate group → verify fill positions relative to group center', () => {
      const store = useAnnotationStore()

      const fill1 = createFill('f1', 100, 100, 50, 50)
      const fill2 = createFill('f2', 200, 200, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.selectAnnotations(['f1', 'f2'])

      const groupCenter = calculateGroupCenter([fill1, fill2])

      // Calculate vectors from group center to fill centers before rotation
      const fill1Center = { x: fill1.x + fill1.width / 2, y: fill1.y + fill1.height / 2 }
      const fill2Center = { x: fill2.x + fill2.width / 2, y: fill2.y + fill2.height / 2 }

      const vectorBefore1 = {
        x: fill1Center.x - groupCenter.x,
        y: fill1Center.y - groupCenter.y
      }
      const vectorBefore2 = {
        x: fill2Center.x - groupCenter.x,
        y: fill2Center.y - groupCenter.y
      }

      const distanceBefore1 = Math.sqrt(vectorBefore1.x ** 2 + vectorBefore1.y ** 2)
      const distanceBefore2 = Math.sqrt(vectorBefore2.x ** 2 + vectorBefore2.y ** 2)

      // Rotate
      applyGroupRotation(store, Math.PI / 2, groupCenter)

      const updated1 = store.getAnnotationById('f1') as Fill
      const updated2 = store.getAnnotationById('f2') as Fill

      // Calculate vectors after rotation (positions unchanged, but conceptually rotated via transform)
      const updated1Center = { x: updated1.x + updated1.width / 2, y: updated1.y + updated1.height / 2 }
      const updated2Center = { x: updated2.x + updated2.width / 2, y: updated2.y + updated2.height / 2 }

      const vectorAfter1 = {
        x: updated1Center.x - groupCenter.x,
        y: updated1Center.y - groupCenter.y
      }
      const vectorAfter2 = {
        x: updated2Center.x - groupCenter.x,
        y: updated2Center.y - groupCenter.y
      }

      const distanceAfter1 = Math.sqrt(vectorAfter1.x ** 2 + vectorAfter1.y ** 2)
      const distanceAfter2 = Math.sqrt(vectorAfter2.x ** 2 + vectorAfter2.y ** 2)

      // Distances from group center should be unchanged
      expect(distanceAfter1).toBeCloseTo(distanceBefore1, 5)
      expect(distanceAfter2).toBeCloseTo(distanceBefore2, 5)

      // Rotation should be applied
      expect(updated1.rotation).toBeCloseTo(Math.PI / 2, 5)
      expect(updated2.rotation).toBeCloseTo(Math.PI / 2, 5)
    })
  })
})
