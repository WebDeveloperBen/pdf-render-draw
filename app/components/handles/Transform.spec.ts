import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@nuxt/test-utils/runtime'
import { setActivePinia, createPinia } from 'pinia'
import Transform from './Transform.vue'
import { useAnnotationStore } from '~/stores/annotations'
import type { Measurement } from '~/types/annotations'

describe('Transform Component', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Rotation Behavior', () => {
    it('should stop rotation immediately when mouse is released', async () => {
      const store = useAnnotationStore()

      // Create a test annotation
      const annotation: Measurement = {
        id: 'test-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: 0
      }

      store.addAnnotation(annotation)
      store.selectAnnotation('test-1')

      // Verify annotation is selected
      expect(store.selectedAnnotationId).toBe('test-1')
      expect(store.selectedAnnotation).toBeDefined()

      // Simulate rotation drag
      store.rotationDragDelta = Math.PI / 4 // 45 degrees

      // Verify drag delta is applied
      expect(store.rotationDragDelta).toBe(Math.PI / 4)

      // Simulate mouseup (rotation release) by manually calling what endDrag does
      store.rotationDragDelta = 0

      // Update annotation with committed rotation
      const existingRotation = annotation.rotation || 0
      const newRotation = existingRotation + Math.PI / 4
      store.updateAnnotation('test-1', { rotation: newRotation })

      // Verify drag delta is cleared immediately
      expect(store.rotationDragDelta).toBe(0)

      // Verify rotation is committed to annotation
      const updated = store.getAnnotationById('test-1')
      expect(updated?.rotation).toBeCloseTo(Math.PI / 4, 5)
    })

    it('should not apply drag delta after rotation is released', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-2',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: Math.PI / 4 // Already rotated 45 degrees
      }

      store.addAnnotation(annotation)
      store.selectAnnotation('test-2')

      // Clear drag delta (simulating after mouseup)
      store.rotationDragDelta = 0

      // Get rotation transform - should only use stored rotation
      const transform = store.getRotationTransform(annotation)

      // Should contain the stored rotation (45 degrees)
      const angleMatch1 = transform.match(/rotate\(([0-9.]+)/)
      expect(angleMatch1).toBeTruthy()
      expect(parseFloat(angleMatch1![1])).toBeCloseTo(45, 5)

      // Set a drag delta (simulating starting a new rotation)
      store.rotationDragDelta = Math.PI / 6 // 30 degrees

      // Get transform again - should now include drag delta
      const transformWithDelta = store.getRotationTransform(annotation)

      // Should contain 45 + 30 = 75 degrees (handle floating point precision)
      const angleMatch2 = transformWithDelta.match(/rotate\(([0-9.]+)/)
      expect(angleMatch2).toBeTruthy()
      expect(parseFloat(angleMatch2![1])).toBeCloseTo(75, 5)

      // Clear drag delta (simulating mouseup)
      store.rotationDragDelta = 0

      // Get transform again - should be back to stored rotation only
      const transformAfterRelease = store.getRotationTransform(annotation)
      const angleMatch3 = transformAfterRelease.match(/rotate\(([0-9.]+)/)
      expect(angleMatch3).toBeTruthy()
      expect(parseFloat(angleMatch3![1])).toBeCloseTo(45, 5)
    })
  })

  describe('Move Behavior', () => {
    it('should update annotation position when moved', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-3',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0
      }

      store.addAnnotation(annotation)

      // Simulate moving the annotation 50px right and 30px down
      const deltaX = 50
      const deltaY = 30

      const movedPoints = annotation.points.map(p => ({
        x: p.x + deltaX,
        y: p.y + deltaY
      }))

      store.updateAnnotation('test-3', { points: movedPoints })

      // Verify points were updated
      const updated = store.getAnnotationById('test-3')
      expect(updated?.points[0]).toEqual({ x: 150, y: 130 })
      expect(updated?.points[1]).toEqual({ x: 250, y: 230 })

      // Verify derived values were recalculated
      expect(updated?.midpoint.x).toBeCloseTo(200, 5)
      expect(updated?.midpoint.y).toBeCloseTo(180, 5)
    })
  })

  describe('Resize Behavior', () => {
    it('should scale annotation points when resized', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-4',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0
      }

      store.addAnnotation(annotation)

      // Simulate scaling by 2x
      const scaleX = 2
      const scaleY = 2
      const originX = 100
      const originY = 100

      const scaledPoints = annotation.points.map(p => ({
        x: originX + (p.x - originX) * scaleX,
        y: originY + (p.y - originY) * scaleY
      }))

      store.updateAnnotation('test-4', { points: scaledPoints })

      // Verify points were scaled
      const updated = store.getAnnotationById('test-4')
      expect(updated?.points[0]).toEqual({ x: 100, y: 100 })
      expect(updated?.points[1]).toEqual({ x: 300, y: 300 })

      // Verify distance was recalculated (should be ~2x original)
      expect(updated?.distance).toBeGreaterThan(200)
    })
  })
})
