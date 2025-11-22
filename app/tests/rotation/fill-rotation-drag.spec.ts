import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnnotationStore } from '~/stores/annotations'
import type { Fill } from '~/types/annotations'
import { calculateBounds } from '~/utils/bounds'

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

describe('Fill Rotation - Real-time Drag Behavior', () => {
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

  describe('Test 45-48: Real-time Drag Behavior', () => {
    it('Test 45: during rotation drag → verify rotationDragDelta updates', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      // Initial state: no drag delta
      expect(store.rotationDragDelta).toBe(0)

      // Simulate rotation drag in progress
      store.rotationDragDelta = Math.PI / 6 // 30°

      expect(store.rotationDragDelta).toBeCloseTo(Math.PI / 6, 5)

      // Continue dragging - update delta
      store.rotationDragDelta = Math.PI / 4 // 45°

      expect(store.rotationDragDelta).toBeCloseTo(Math.PI / 4, 5)

      // Transform should include the drag delta
      const fillDuringDrag = store.getAnnotationById('f1') as Fill
      const transform = store.getRotationTransform(fillDuringDrag)

      const centerX = fill.x + fill.width / 2
      const centerY = fill.y + fill.height / 2
      expect(transform).toBe(`rotate(45 ${centerX} ${centerY})`)
    })

    it('Test 46: during rotation drag → verify stored rotation doesn\'t change', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      // Pre-rotate the fill
      const groupCenter = calculateGroupCenter([fill])
      applyGroupRotation(store, Math.PI / 6, groupCenter) // 30° stored

      const preRotated = store.getAnnotationById('f1') as Fill
      expect(preRotated.rotation).toBeCloseTo(Math.PI / 6, 5)

      // Simulate rotation drag (additional 45° temporary)
      store.rotationDragDelta = Math.PI / 4

      // Check stored rotation hasn't changed
      const duringDrag = store.getAnnotationById('f1') as Fill
      expect(duringDrag.rotation).toBeCloseTo(Math.PI / 6, 5) // Still 30°

      // But transform should include both
      const transform = store.getRotationTransform(duringDrag)
      const totalAngleDeg = ((Math.PI / 6) + (Math.PI / 4)) * (180 / Math.PI) // 75°
      const centerX = fill.x + fill.width / 2
      const centerY = fill.y + fill.height / 2
      expect(transform).toBe(`rotate(${totalAngleDeg} ${centerX} ${centerY})`)
    })

    it('Test 47: on rotation drag end → verify rotationDragDelta resets to 0', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      // Simulate rotation drag
      store.rotationDragDelta = Math.PI / 4 // 45°

      expect(store.rotationDragDelta).toBeCloseTo(Math.PI / 4, 5)

      // Simulate drag end: apply the delta to stored rotation
      const groupCenter = calculateGroupCenter([fill])
      applyGroupRotation(store, store.rotationDragDelta, groupCenter)

      // Reset drag delta
      store.rotationDragDelta = 0

      expect(store.rotationDragDelta).toBe(0)

      // Stored rotation should now include the delta
      const afterDragEnd = store.getAnnotationById('f1') as Fill
      expect(afterDragEnd.rotation).toBeCloseTo(Math.PI / 4, 5)
    })

    it('Test 48: on rotation drag end → verify stored rotation updates', () => {
      const store = useAnnotationStore()

      const fill = createFill('f1', 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation('f1')

      // Pre-rotate
      const groupCenter = calculateGroupCenter([fill])
      applyGroupRotation(store, Math.PI / 6, groupCenter) // 30° stored

      const preRotated = store.getAnnotationById('f1') as Fill
      expect(preRotated.rotation).toBeCloseTo(Math.PI / 6, 5)

      // Simulate rotation drag (additional 45°)
      store.rotationDragDelta = Math.PI / 4

      // Drag end: apply delta to stored rotation
      applyGroupRotation(store, store.rotationDragDelta, groupCenter)
      store.rotationDragDelta = 0

      const afterDragEnd = store.getAnnotationById('f1') as Fill

      // Stored rotation should be cumulative (30° + 45° = 75°)
      expect(afterDragEnd.rotation).toBeCloseTo(Math.PI / 6 + Math.PI / 4, 5)

      // Drag delta should be reset
      expect(store.rotationDragDelta).toBe(0)

      // Transform should use only stored rotation now
      const transform = store.getRotationTransform(afterDragEnd)
      const totalAngleDeg = (Math.PI / 6 + Math.PI / 4) * (180 / Math.PI) // 75°
      const centerX = fill.x + fill.width / 2
      const centerY = fill.y + fill.height / 2
      expect(transform).toBe(`rotate(${totalAngleDeg} ${centerX} ${centerY})`)
    })
  })
})
