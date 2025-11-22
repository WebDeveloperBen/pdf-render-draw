import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnnotationStore } from '~/stores/annotations'
import type { Fill } from '~/types/annotations'
import { calculateBounds } from '~/utils/bounds'

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

describe('Fill Rotation - Frozen Transformer Bounds', () => {
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
      y: minY + (maxY - minY) / 2,
      width: maxX - minX,
      height: maxY - minY,
      minX,
      minY,
      maxX,
      maxY
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

  describe('Test 32-35: Frozen Transformer Bounds', () => {
    it('Test 32: rotate group → verify transformer bounds don\'t recalculate on drop', () => {
      const store = useAnnotationStore()

      const fill1 = createFill('f1', 100, 100, 50, 50)
      const fill2 = createFill('f2', 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.selectAnnotations(['f1', 'f2'])

      // Calculate initial bounds
      const initialBounds = calculateGroupCenter([fill1, fill2])

      // Rotate group
      applyGroupRotation(store, Math.PI / 4, initialBounds)

      const afterRotate1 = store.getAnnotationById('f1') as Fill
      const afterRotate2 = store.getAnnotationById('f2') as Fill

      // Recalculate bounds after rotation
      const afterRotateBounds = calculateGroupCenter([afterRotate1, afterRotate2])

      // Bounds should be unchanged (positions don't move during rotation)
      expect(afterRotateBounds.minX).toBe(initialBounds.minX)
      expect(afterRotateBounds.minY).toBe(initialBounds.minY)
      expect(afterRotateBounds.maxX).toBe(initialBounds.maxX)
      expect(afterRotateBounds.maxY).toBe(initialBounds.maxY)
      expect(afterRotateBounds.x).toBe(initialBounds.x)
      expect(afterRotateBounds.y).toBe(initialBounds.y)
    })

    it('Test 33: rotate group → move group → verify transformer follows without recalculating', () => {
      const store = useAnnotationStore()

      const fill1 = createFill('f1', 100, 100, 50, 50)
      const fill2 = createFill('f2', 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.selectAnnotations(['f1', 'f2'])

      // Rotate
      const initialBounds = calculateGroupCenter([fill1, fill2])
      applyGroupRotation(store, Math.PI / 3, initialBounds)

      const afterRotate1 = store.getAnnotationById('f1') as Fill
      const afterRotate2 = store.getAnnotationById('f2') as Fill

      const boundsAfterRotate = calculateGroupCenter([afterRotate1, afterRotate2])

      // Move group
      const deltaX = 50
      const deltaY = 30

      store.updateAnnotation('f1', {
        x: afterRotate1.x + deltaX,
        y: afterRotate1.y + deltaY
      })
      store.updateAnnotation('f2', {
        x: afterRotate2.x + deltaX,
        y: afterRotate2.y + deltaY
      })

      const afterMove1 = store.getAnnotationById('f1') as Fill
      const afterMove2 = store.getAnnotationById('f2') as Fill

      const boundsAfterMove = calculateGroupCenter([afterMove1, afterMove2])

      // Bounds should have moved by the same delta
      expect(boundsAfterMove.minX).toBeCloseTo(boundsAfterRotate.minX + deltaX, 5)
      expect(boundsAfterMove.minY).toBeCloseTo(boundsAfterRotate.minY + deltaY, 5)
      expect(boundsAfterMove.maxX).toBeCloseTo(boundsAfterRotate.maxX + deltaX, 5)
      expect(boundsAfterMove.maxY).toBeCloseTo(boundsAfterRotate.maxY + deltaY, 5)

      // Bounds width and height should be unchanged
      expect(boundsAfterMove.width).toBeCloseTo(boundsAfterRotate.width, 5)
      expect(boundsAfterMove.height).toBeCloseTo(boundsAfterRotate.height, 5)
    })

    it('Test 34: rotate group → verify transformer angle matches group rotation', () => {
      const store = useAnnotationStore()

      const fill1 = createFill('f1', 100, 100, 50, 50)
      const fill2 = createFill('f2', 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.selectAnnotations(['f1', 'f2'])

      const groupCenter = calculateGroupCenter([fill1, fill2])

      // Test various rotation angles
      const testAngles = [
        Math.PI / 6,  // 30°
        Math.PI / 4,  // 45°
        Math.PI / 2,  // 90°
        Math.PI,      // 180°
        -Math.PI / 4  // -45°
      ]

      for (const angle of testAngles) {
        // Reset rotations
        store.updateAnnotation('f1', { rotation: 0 })
        store.updateAnnotation('f2', { rotation: 0 })

        // Apply rotation
        applyGroupRotation(store, angle, groupCenter)

        const rotated1 = store.getAnnotationById('f1') as Fill
        const rotated2 = store.getAnnotationById('f2') as Fill

        // Both fills should have the same rotation
        expect(rotated1.rotation).toBeCloseTo(angle, 5)
        expect(rotated2.rotation).toBeCloseTo(angle, 5)

        // In a real transformer, the transformer's rotation would match this angle
        // Here we just verify the stored rotation matches expected
      }
    })

    it('Test 35: deselect → reselect → verify transformer bounds recalculate correctly', () => {
      const store = useAnnotationStore()

      const fill1 = createFill('f1', 100, 100, 50, 50)
      const fill2 = createFill('f2', 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.selectAnnotations(['f1', 'f2'])

      // Rotate
      const groupCenter = calculateGroupCenter([fill1, fill2])
      applyGroupRotation(store, Math.PI / 4, groupCenter)

      const afterRotate1 = store.getAnnotationById('f1') as Fill
      const afterRotate2 = store.getAnnotationById('f2') as Fill

      const boundsBeforeDeselect = calculateGroupCenter([afterRotate1, afterRotate2])

      // Deselect
      store.deselectAll()
      expect(store.selectedAnnotationIds.length).toBe(0)

      // Reselect
      store.selectAnnotations(['f1', 'f2'])

      const reselected1 = store.getAnnotationById('f1') as Fill
      const reselected2 = store.getAnnotationById('f2') as Fill

      const boundsAfterReselect = calculateGroupCenter([reselected1, reselected2])

      // Bounds should be identical (nothing moved)
      expect(boundsAfterReselect.minX).toBe(boundsBeforeDeselect.minX)
      expect(boundsAfterReselect.minY).toBe(boundsBeforeDeselect.minY)
      expect(boundsAfterReselect.maxX).toBe(boundsBeforeDeselect.maxX)
      expect(boundsAfterReselect.maxY).toBe(boundsBeforeDeselect.maxY)

      // Rotations should be preserved
      expect(reselected1.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(reselected2.rotation).toBeCloseTo(Math.PI / 4, 5)
    })
  })
})
