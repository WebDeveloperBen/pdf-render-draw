import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnnotationStore } from '~/stores/annotations'
import type { Fill } from '~/types/annotations'
import { calculateBounds } from '~/utils/bounds'

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

describe('Fill Rotation - Interaction with Move/Resize', () => {
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

  describe('Test 27-31: Interaction with Move/Resize', () => {
    it('Test 27: rotate group → move group → verify rotation preserved', () => {
      const store = useAnnotationStore()

      const fill1 = createFill('f1', 100, 100, 50, 50)
      const fill2 = createFill('f2', 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.selectAnnotations(['f1', 'f2'])

      // Rotate group
      const groupCenter = calculateGroupCenter([fill1, fill2])
      applyGroupRotation(store, Math.PI / 4, groupCenter)

      const afterRotate1 = store.getAnnotationById('f1') as Fill
      const afterRotate2 = store.getAnnotationById('f2') as Fill

      expect(afterRotate1.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(afterRotate2.rotation).toBeCloseTo(Math.PI / 4, 5)

      // Move group (simulate drag)
      const deltaX = 50
      const deltaY = 30

      store.updateAnnotation('f1', {
        x: fill1.x + deltaX,
        y: fill1.y + deltaY
      })
      store.updateAnnotation('f2', {
        x: fill2.x + deltaX,
        y: fill2.y + deltaY
      })

      const afterMove1 = store.getAnnotationById('f1') as Fill
      const afterMove2 = store.getAnnotationById('f2') as Fill

      // Verify rotation preserved
      expect(afterMove1.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(afterMove2.rotation).toBeCloseTo(Math.PI / 4, 5)

      // Verify positions updated
      expect(afterMove1.x).toBe(150)
      expect(afterMove1.y).toBe(130)
      expect(afterMove2.x).toBe(250)
      expect(afterMove2.y).toBe(130)
    })

    it('Test 28: rotate group → resize individual fill → verify rotation preserved', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      // Rotate
      const groupCenter = calculateGroupCenter([fill])
      applyGroupRotation(store, Math.PI / 3, groupCenter)

      const afterRotate = store.getAnnotationById('f1') as Fill
      expect(afterRotate.rotation).toBeCloseTo(Math.PI / 3, 5)

      // Resize
      store.updateAnnotation('f1', {
        width: 80,
        height: 60
      })

      const afterResize = store.getAnnotationById('f1') as Fill

      // Verify rotation preserved
      expect(afterResize.rotation).toBeCloseTo(Math.PI / 3, 5)

      // Verify size updated
      expect(afterResize.width).toBe(80)
      expect(afterResize.height).toBe(60)
    })

    it('Test 29: move fill → rotate group → verify movement + rotation work together', () => {
      const store = useAnnotationStore()

      const fill1 = createFill('f1', 100, 100, 50, 50)
      const fill2 = createFill('f2', 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)

      // Move fill1
      store.updateAnnotation('f1', {
        x: 120,
        y: 120
      })

      const afterMove = store.getAnnotationById('f1') as Fill
      expect(afterMove.x).toBe(120)
      expect(afterMove.y).toBe(120)

      // Now rotate group
      store.selectAnnotations(['f1', 'f2'])
      const groupCenter = calculateGroupCenter([afterMove, fill2])
      applyGroupRotation(store, Math.PI / 2, groupCenter)

      const final1 = store.getAnnotationById('f1') as Fill
      const final2 = store.getAnnotationById('f2') as Fill

      // Verify rotation applied
      expect(final1.rotation).toBeCloseTo(Math.PI / 2, 5)
      expect(final2.rotation).toBeCloseTo(Math.PI / 2, 5)

      // Verify positions preserved (from after move)
      expect(final1.x).toBe(120)
      expect(final1.y).toBe(120)
      expect(final2.x).toBe(200)
      expect(final2.y).toBe(100)
    })

    it('Test 30: resize fill → rotate group → verify size + rotation work together', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 100, 100, 50, 50)

      store.addAnnotation(fill)

      // Resize
      store.updateAnnotation('f1', {
        width: 100,
        height: 80
      })

      const afterResize = store.getAnnotationById('f1') as Fill
      expect(afterResize.width).toBe(100)
      expect(afterResize.height).toBe(80)

      // Rotate
      store.selectAnnotation('f1')
      const groupCenter = calculateGroupCenter([afterResize])
      applyGroupRotation(store, Math.PI / 6, groupCenter)

      const final = store.getAnnotationById('f1') as Fill

      // Verify rotation applied
      expect(final.rotation).toBeCloseTo(Math.PI / 6, 5)

      // Verify size preserved
      expect(final.width).toBe(100)
      expect(final.height).toBe(80)

      // Verify position unchanged
      expect(final.x).toBe(100)
      expect(final.y).toBe(100)
    })

    it('Test 31: rotate → move → rotate again → verify cumulative behavior', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      // First rotation
      let groupCenter = calculateGroupCenter([fill])
      applyGroupRotation(store, Math.PI / 4, groupCenter)

      const afterRotate1 = store.getAnnotationById('f1') as Fill
      expect(afterRotate1.rotation).toBeCloseTo(Math.PI / 4, 5)

      // Move
      store.updateAnnotation('f1', {
        x: 200,
        y: 200
      })

      const afterMove = store.getAnnotationById('f1') as Fill
      expect(afterMove.x).toBe(200)
      expect(afterMove.y).toBe(200)
      expect(afterMove.rotation).toBeCloseTo(Math.PI / 4, 5)

      // Second rotation
      groupCenter = calculateGroupCenter([afterMove])
      applyGroupRotation(store, Math.PI / 4, groupCenter)

      const final = store.getAnnotationById('f1') as Fill

      // Verify cumulative rotation (45° + 45° = 90°)
      expect(final.rotation).toBeCloseTo(Math.PI / 2, 5)

      // Verify position preserved
      expect(final.x).toBe(200)
      expect(final.y).toBe(200)
    })
  })
})
