import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnnotationStore } from '~/stores/annotations'
import type { Fill } from '~/types/annotations'
import { calculateBounds } from '~/utils/bounds'

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

describe('Fill Rotation - Multiple Consecutive Rotations', () => {
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

  describe('Test 11-14: Multiple Consecutive Group Rotations', () => {
    it('Test 11: rotate 45° → rotate 45° again → verify cumulative 90°', () => {
      const store = useAnnotationStore()

      const fill1 = createFill('f1', 100, 100, 50, 50)
      const fill2 = createFill('f2', 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.selectAnnotations(['f1', 'f2'])

      const groupCenter = calculateGroupCenter([fill1, fill2])

      // First rotation: 45°
      applyGroupRotation(store, Math.PI / 4, groupCenter)

      const after1st = store.getAnnotationById('f1') as Fill
      expect(after1st.rotation).toBeCloseTo(Math.PI / 4, 5)

      // Second rotation: another 45°
      applyGroupRotation(store, Math.PI / 4, groupCenter)

      const after2nd = store.getAnnotationById('f1') as Fill
      const after2nd_f2 = store.getAnnotationById('f2') as Fill

      // Should be 90° total
      expect(after2nd.rotation).toBeCloseTo(Math.PI / 2, 5)
      expect(after2nd_f2.rotation).toBeCloseTo(Math.PI / 2, 5)

      // Position should still be unchanged
      expect(after2nd.x).toBe(100)
      expect(after2nd.y).toBe(100)
    })

    it('Test 12: rotate 90° → rotate -90° → verify returns to original', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 150, 150, 60, 60)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      const groupCenter = calculateGroupCenter([fill])

      // Rotate 90°
      applyGroupRotation(store, Math.PI / 2, groupCenter)

      const afterForward = store.getAnnotationById('f1') as Fill
      expect(afterForward.rotation).toBeCloseTo(Math.PI / 2, 5)

      // Rotate -90°
      applyGroupRotation(store, -Math.PI / 2, groupCenter)

      const afterBack = store.getAnnotationById('f1') as Fill

      // Should be back to 0
      expect(afterBack.rotation).toBeCloseTo(0, 5)
    })

    it('Test 13: rotate 360° (full circle) → verify back to original orientation', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      const groupCenter = calculateGroupCenter([fill])

      // Rotate full circle (2π radians)
      applyGroupRotation(store, 2 * Math.PI, groupCenter)

      const updated = store.getAnnotationById('f1') as Fill

      // Rotation should be 360° (2π)
      expect(updated.rotation).toBeCloseTo(2 * Math.PI, 5)

      // Visually, this should look the same as 0° rotation
      // (though the stored value is 2π, not normalized)
    })

    it('Test 14: rotate multiple times in sequence', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 120, 120, 40, 40)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      const groupCenter = calculateGroupCenter([fill])

      // Rotate 30° four times
      applyGroupRotation(store, Math.PI / 6, groupCenter) // 30°
      applyGroupRotation(store, Math.PI / 6, groupCenter) // 60°
      applyGroupRotation(store, Math.PI / 6, groupCenter) // 90°
      applyGroupRotation(store, Math.PI / 6, groupCenter) // 120°

      const final = store.getAnnotationById('f1') as Fill

      // Should be 120° total (4 × 30°)
      expect(final.rotation).toBeCloseTo(4 * Math.PI / 6, 5)

      // Position unchanged
      expect(final.x).toBe(120)
      expect(final.y).toBe(120)
      expect(final.width).toBe(40)
      expect(final.height).toBe(40)
    })
  })
})
