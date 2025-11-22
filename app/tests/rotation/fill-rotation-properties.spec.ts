import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnnotationStore } from '~/stores/annotations'
import type { Fill } from '~/types/annotations'
import { calculateBounds } from '~/utils/bounds'

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

describe('Fill Rotation - Rotation Property Tracking', () => {
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

  describe('Test 19-22: Rotation Property Tracking', () => {
    it('Test 19: verify rotation property starts at 0 (or undefined)', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 100, 100, 50, 50)

      store.addAnnotation(fill)

      const retrieved = store.getAnnotationById('f1') as Fill

      // Rotation should start at 0 (as defined in createFill)
      expect(retrieved.rotation).toBe(0)
    })

    it('Test 20: rotate 45° → verify rotation property is π/4', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      const groupCenter = calculateGroupCenter([fill])
      applyGroupRotation(store, Math.PI / 4, groupCenter)

      const updated = store.getAnnotationById('f1') as Fill

      expect(updated.rotation).toBeCloseTo(Math.PI / 4, 5)
    })

    it('Test 21: rotate -45° → verify rotation property is -π/4', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 150, 150, 60, 60)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      const groupCenter = calculateGroupCenter([fill])
      applyGroupRotation(store, -Math.PI / 4, groupCenter)

      const updated = store.getAnnotationById('f1') as Fill

      expect(updated.rotation).toBeCloseTo(-Math.PI / 4, 5)
    })

    it('Test 22: verify rotation property persists across selection changes', () => {
      const store = useAnnotationStore()

      const fill1 = createFill('f1', 100, 100, 50, 50)
      const fill2 = createFill('f2', 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)

      // Select and rotate fill1
      store.selectAnnotation('f1')
      const groupCenter1 = calculateGroupCenter([fill1])
      applyGroupRotation(store, Math.PI / 3, groupCenter1) // 60°

      const afterRotate1 = store.getAnnotationById('f1') as Fill
      expect(afterRotate1.rotation).toBeCloseTo(Math.PI / 3, 5)

      // Deselect all
      store.deselectAll()
      expect(store.selectedAnnotationIds.length).toBe(0)

      // Verify rotation persisted
      const afterDeselect = store.getAnnotationById('f1') as Fill
      expect(afterDeselect.rotation).toBeCloseTo(Math.PI / 3, 5)

      // Select fill2
      store.selectAnnotation('f2')
      expect(store.selectedAnnotationIds).toEqual(['f2'])

      // Verify fill1 rotation still persisted
      const afterSelectOther = store.getAnnotationById('f1') as Fill
      expect(afterSelectOther.rotation).toBeCloseTo(Math.PI / 3, 5)

      // Reselect fill1
      store.selectAnnotation('f1')
      const afterReselect = store.getAnnotationById('f1') as Fill
      expect(afterReselect.rotation).toBeCloseTo(Math.PI / 3, 5)

      // Select both and rotate again
      store.selectAnnotations(['f1', 'f2'])
      const groupCenter2 = calculateGroupCenter([fill1, fill2])
      applyGroupRotation(store, Math.PI / 6, groupCenter2) // +30°

      const final1 = store.getAnnotationById('f1') as Fill
      const final2 = store.getAnnotationById('f2') as Fill

      // fill1 should have cumulative rotation (60° + 30° = 90°)
      expect(final1.rotation).toBeCloseTo(Math.PI / 3 + Math.PI / 6, 5)
      // fill2 should have only the group rotation (30°)
      expect(final2.rotation).toBeCloseTo(Math.PI / 6, 5)
    })
  })
})
