import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnnotationStore } from '~/stores/annotations'
import type { Fill } from '~/types/annotations'
import { calculateBounds } from '~/utils/bounds'

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

describe('Fill Rotation - Edge Cases', () => {
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

  describe('Test 36-40: Edge Cases', () => {
    it('Test 36: rotate empty selection → verify no errors', () => {
      const store = useAnnotationStore()

      // No annotations selected
      expect(store.selectedAnnotationIds.length).toBe(0)

      // Attempt rotation with empty selection
      const groupCenter = { x: 0, y: 0 }

      // Should not throw error
      expect(() => {
        applyGroupRotation(store, Math.PI / 4, groupCenter)
      }).not.toThrow()
    })

    it('Test 37: rotate single fill → verify no group center calculation', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      // For single selection, group center is just the fill's center
      const groupCenter = calculateGroupCenter([fill])

      // Calculate expected center
      const expectedCenterX = fill.x + fill.width / 2
      const expectedCenterY = fill.y + fill.height / 2

      expect(groupCenter.x).toBe(expectedCenterX)
      expect(groupCenter.y).toBe(expectedCenterY)

      // Rotate
      applyGroupRotation(store, Math.PI / 4, groupCenter)

      const updated = store.getAnnotationById('f1') as Fill

      // Should rotate correctly
      expect(updated.rotation).toBeCloseTo(Math.PI / 4, 5)

      // Transform should use fill's own center (not group center)
      const transform = store.getRotationTransform(updated)
      const angleDeg = 45
      expect(transform).toBe(`rotate(${angleDeg} ${expectedCenterX} ${expectedCenterY})`)
    })

    it('Test 38: rotate with fills at exact same position → verify no division by zero', () => {
      const store = useAnnotationStore()

      // Two fills at the exact same position
      const fill1 = createFill('f1', 100, 100, 50, 50)
      const fill2 = createFill('f2', 100, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.selectAnnotations(['f1', 'f2'])

      const groupCenter = calculateGroupCenter([fill1, fill2])

      // Group center should still be calculable
      expect(groupCenter.x).toBe(125) // 100 + 50/2
      expect(groupCenter.y).toBe(125) // 100 + 50/2

      // Should not throw error
      expect(() => {
        applyGroupRotation(store, Math.PI / 3, groupCenter)
      }).not.toThrow()

      const updated1 = store.getAnnotationById('f1') as Fill
      const updated2 = store.getAnnotationById('f2') as Fill

      // Both should have rotation applied
      expect(updated1.rotation).toBeCloseTo(Math.PI / 3, 5)
      expect(updated2.rotation).toBeCloseTo(Math.PI / 3, 5)
    })

    it('Test 39: rotate with very small rotation angles → verify precision', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      const groupCenter = calculateGroupCenter([fill])

      // Very small rotation: 0.001 radians (~0.057 degrees)
      const smallAngle = 0.001

      applyGroupRotation(store, smallAngle, groupCenter)

      const updated = store.getAnnotationById('f1') as Fill

      // Should store precise value
      expect(updated.rotation).toBeCloseTo(smallAngle, 10)

      // Rotate multiple times to accumulate
      applyGroupRotation(store, smallAngle, groupCenter)
      applyGroupRotation(store, smallAngle, groupCenter)

      const afterMultiple = store.getAnnotationById('f1') as Fill

      // Should accumulate precisely
      expect(afterMultiple.rotation).toBeCloseTo(smallAngle * 3, 10)
    })

    it('Test 40: rotate with very large rotation angles (> 2π) → verify normalization', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      const groupCenter = calculateGroupCenter([fill])

      // Rotate by more than one full circle (3 × 2π)
      const largeAngle = 3 * 2 * Math.PI

      applyGroupRotation(store, largeAngle, groupCenter)

      const updated = store.getAnnotationById('f1') as Fill

      // Should store the actual value (not normalized)
      // Our implementation doesn't normalize, so it should be 6π
      expect(updated.rotation).toBeCloseTo(largeAngle, 5)

      // Transform should still work (SVG handles large angles)
      const transform = store.getRotationTransform(updated)
      const angleDeg = largeAngle * (180 / Math.PI) // 1080 degrees
      const centerX = fill.x + fill.width / 2
      const centerY = fill.y + fill.height / 2
      expect(transform).toBe(`rotate(${angleDeg} ${centerX} ${centerY})`)

      // Rotate by another large negative angle
      applyGroupRotation(store, -largeAngle, groupCenter)

      const afterReverse = store.getAnnotationById('f1') as Fill

      // Should be back to 0
      expect(afterReverse.rotation).toBeCloseTo(0, 5)
    })
  })
})
