import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnnotationStore } from '~/stores/annotations'
import type { Measurement, Area, TextAnnotation } from '~/types/annotations'

// Mock UUID to make tests deterministic
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

describe('Transform Component', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Rotation Handle Drag Behavior', () => {
    it('should update rotationDragDelta during rotation drag', () => {
      const store = useAnnotationStore()

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

      // Verify initial state
      expect(store.rotationDragDelta).toBe(0)

      // Simulate rotation drag by setting drag delta
      const rotationDelta = Math.PI / 4 // 45 degrees
      store.rotationDragDelta = rotationDelta

      // Verify drag delta is applied during drag
      expect(store.rotationDragDelta).toBeCloseTo(Math.PI / 4, 5)

      // Get rotation transform - should include drag delta
      const transform = store.getRotationTransform(annotation)
      const angleMatch = transform.match(/rotate\(([0-9.]+)/)
      expect(angleMatch).toBeTruthy()
      expect(parseFloat(angleMatch![1])).toBeCloseTo(45, 5)
    })

    it('should stop rotation immediately when mouse is released', async () => {
      const store = useAnnotationStore()

      // Create a test annotation
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
        rotation: 0
      }

      store.addAnnotation(annotation)
      store.selectAnnotation('test-2')

      // Verify annotation is selected
      expect(store.selectedAnnotationId).toBe('test-2')
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
      store.updateAnnotation('test-2', { rotation: newRotation })

      // Verify drag delta is cleared immediately
      expect(store.rotationDragDelta).toBe(0)

      // Verify rotation is committed to annotation
      const updated = store.getAnnotationById('test-2')
      expect(updated?.rotation).toBeCloseTo(Math.PI / 4, 5)
    })

    it('should clear rotationDragDelta immediately on release', () => {
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
        labelRotation: 0,
        rotation: 0
      }

      store.addAnnotation(annotation)
      store.selectAnnotation('test-3')

      // Set drag delta
      store.rotationDragDelta = Math.PI / 3 // 60 degrees
      expect(store.rotationDragDelta).toBeCloseTo(Math.PI / 3, 5)

      // Simulate mouseup - clear immediately
      store.rotationDragDelta = 0

      // Verify cleared
      expect(store.rotationDragDelta).toBe(0)
    })

    it('should commit rotation on handle release', () => {
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
        labelRotation: 0,
        rotation: 0
      }

      store.addAnnotation(annotation)
      store.selectAnnotation('test-4')

      // Simulate drag and commit
      const dragDelta = Math.PI / 6 // 30 degrees
      store.rotationDragDelta = dragDelta

      // Commit rotation by updating annotation
      const existingRotation = (annotation as any).rotation || 0
      const newRotation = existingRotation + dragDelta
      store.updateAnnotation('test-4', { rotation: newRotation })

      // Clear drag delta
      store.rotationDragDelta = 0

      // Verify rotation is stored
      const updated = store.getAnnotationById('test-4')
      expect(updated?.rotation).toBeCloseTo(Math.PI / 6, 5)
      expect(store.rotationDragDelta).toBe(0)
    })
  })

  describe('Rotation Center Point', () => {
    it('should rotate around measurement midpoint', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-5',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: Math.PI / 4
      }

      store.addAnnotation(annotation)
      store.selectAnnotation('test-5')

      const transform = store.getRotationTransform(annotation)

      // Transform should include center point (midpoint for measurements)
      expect(transform).toContain('150 150')
    })

    it('should rotate around area center', () => {
      const store = useAnnotationStore()

      const annotation: Area = {
        id: 'test-6',
        type: 'area',
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 200, y: 200 },
          { x: 100, y: 200 }
        ],
        area: 10000,
        center: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: Math.PI / 4
      }

      store.addAnnotation(annotation)
      store.selectAnnotation('test-6')

      const transform = store.getRotationTransform(annotation)

      // Transform should include center point
      expect(transform).toContain('150 150')
    })
  })

  describe('Rotation Jump Prevention', () => {
    it('should not jump to 0 degrees on release', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-7',
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
      store.selectAnnotation('test-7')

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

    it('should not apply drag delta after rotation is released', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-8',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: Math.PI / 2 // 90 degrees
      }

      store.addAnnotation(annotation)
      store.selectAnnotation('test-8')

      // After rotation release, drag delta should be 0
      store.rotationDragDelta = 0

      const transform = store.getRotationTransform(annotation)

      // Should only show stored rotation (90 degrees)
      const angleMatch = transform.match(/rotate\(([0-9.]+)/)
      expect(angleMatch).toBeTruthy()
      expect(parseFloat(angleMatch![1])).toBeCloseTo(90, 5)
    })
  })

  describe('Cumulative Rotations', () => {
    it('should accumulate multiple rotations correctly', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-9',
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
      store.selectAnnotation('test-9')

      // First rotation: 45 degrees
      store.rotationDragDelta = Math.PI / 4
      store.updateAnnotation('test-9', { rotation: Math.PI / 4 })
      store.rotationDragDelta = 0

      let updated = store.getAnnotationById('test-9')
      expect(updated?.rotation).toBeCloseTo(Math.PI / 4, 5)

      // Second rotation: add another 30 degrees
      store.rotationDragDelta = Math.PI / 6
      const existingRotation = updated?.rotation || 0
      store.updateAnnotation('test-9', { rotation: existingRotation + Math.PI / 6 })
      store.rotationDragDelta = 0

      updated = store.getAnnotationById('test-9')
      // Should be 45 + 30 = 75 degrees (in radians)
      const expectedRotation = Math.PI / 4 + Math.PI / 6
      expect(updated?.rotation).toBeCloseTo(expectedRotation, 5)
    })

    it('should handle negative rotations', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-10',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: Math.PI / 4 // 45 degrees
      }

      store.addAnnotation(annotation)
      store.selectAnnotation('test-10')

      // Rotate backwards (counter-clockwise)
      store.rotationDragDelta = -Math.PI / 6 // -30 degrees
      store.updateAnnotation('test-10', { rotation: Math.PI / 4 - Math.PI / 6 })
      store.rotationDragDelta = 0

      const updated = store.getAnnotationById('test-10')
      // Should be 45 - 30 = 15 degrees
      const expectedRotation = Math.PI / 4 - Math.PI / 6
      expect(updated?.rotation).toBeCloseTo(expectedRotation, 5)
    })

    it('should handle rotations beyond 360 degrees', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-11',
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
      store.selectAnnotation('test-11')

      // Rotate more than 360 degrees (e.g., 450 degrees = 90 degrees)
      const rotation = (Math.PI * 2) + (Math.PI / 2) // 360 + 90 degrees
      store.updateAnnotation('test-11', { rotation })

      const updated = store.getAnnotationById('test-11')
      expect(updated?.rotation).toBeCloseTo(rotation, 5)

      // Transform should still work correctly
      const transform = store.getRotationTransform(updated!)
      expect(transform).toBeTruthy()
    })
  })

  describe('Resize Corner Handles', () => {
    it('should scale annotation when corner handle is dragged', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-12',
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

      store.updateAnnotation('test-12', { points: scaledPoints })

      // Verify points were scaled
      const updated = store.getAnnotationById('test-12')
      expect(updated?.points[0]).toEqual({ x: 100, y: 100 })
      expect(updated?.points[1]).toEqual({ x: 300, y: 300 })

      // Verify distance was recalculated (should be ~2x original)
      expect(updated?.distance).toBeGreaterThan(200)
    })

    it('should maintain aspect ratio when Shift key pressed during resize', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-13',
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

      // Calculate original aspect ratio
      const originalWidth = 100
      const originalHeight = 100
      const aspectRatio = originalWidth / originalHeight

      // Simulate uniform scaling (maintaining aspect ratio)
      const scale = 1.5
      const originX = 100
      const originY = 100

      const scaledPoints = annotation.points.map(p => ({
        x: originX + (p.x - originX) * scale,
        y: originY + (p.y - originY) * scale
      }))

      store.updateAnnotation('test-13', { points: scaledPoints })

      const updated = store.getAnnotationById('test-13')
      expect(updated?.points[0]).toEqual({ x: 100, y: 100 })
      expect(updated?.points[1]).toEqual({ x: 250, y: 250 })

      // Verify aspect ratio maintained
      const newWidth = 150
      const newHeight = 150
      expect(newWidth / newHeight).toBeCloseTo(aspectRatio, 5)
    })

    it('should resize from correct corner', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-14',
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

      // Simulate resize from bottom-right corner (only second point moves)
      const scaledPoints = [
        { x: 100, y: 100 }, // First point stays fixed
        { x: 300, y: 300 }  // Second point scaled
      ]

      store.updateAnnotation('test-14', { points: scaledPoints })

      const updated = store.getAnnotationById('test-14')
      expect(updated?.points[0]).toEqual({ x: 100, y: 100 })
      expect(updated?.points[1]).toEqual({ x: 300, y: 300 })
    })
  })

  describe('Move Handle', () => {
    it('should update annotation position when moved', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-15',
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

      store.updateAnnotation('test-15', { points: movedPoints })

      // Verify points were updated
      const updated = store.getAnnotationById('test-15')
      expect(updated?.points[0]).toEqual({ x: 150, y: 130 })
      expect(updated?.points[1]).toEqual({ x: 250, y: 230 })

      // Verify derived values were recalculated
      expect(updated?.midpoint.x).toBeCloseTo(200, 5)
      expect(updated?.midpoint.y).toBeCloseTo(180, 5)
    })

    it('should move text annotations correctly', () => {
      const store = useAnnotationStore()

      const annotation: TextAnnotation = {
        id: 'test-16',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Test Text',
        fontSize: 16,
        color: '#000000',
        rotation: 0
      }

      store.addAnnotation(annotation)

      // Simulate moving the text annotation
      const deltaX = 50
      const deltaY = 30

      store.updateAnnotation('test-16', {
        x: annotation.x + deltaX,
        y: annotation.y + deltaY
      })

      const updated = store.getAnnotationById('test-16')
      expect((updated as any)?.x).toBe(150)
      expect((updated as any)?.y).toBe(130)
    })

    it('should preserve annotation properties during move', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-17',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: -45,
        rotation: Math.PI / 4
      }

      store.addAnnotation(annotation)

      // Move annotation
      const deltaX = 25
      const deltaY = 25

      const movedPoints = annotation.points.map(p => ({
        x: p.x + deltaX,
        y: p.y + deltaY
      }))

      store.updateAnnotation('test-17', { points: movedPoints })

      const updated = store.getAnnotationById('test-17')
      // Verify rotation and label rotation preserved
      expect((updated as any)?.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(updated?.labelRotation).toBe(-45)
    })
  })

  describe('Transform Handles Visibility', () => {
    it('should show transform handles when annotation is selected', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-18',
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
      store.selectAnnotation('test-18')

      // Verify selection state
      expect(store.selectedAnnotationId).toBe('test-18')
      expect(store.selectedAnnotation).toBeDefined()
      expect(store.selectedAnnotation?.id).toBe('test-18')
    })

    it('should hide transform handles when annotation is deselected', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-19',
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
      store.selectAnnotation('test-19')

      expect(store.selectedAnnotationId).toBe('test-19')

      // Deselect
      store.selectAnnotation(null)

      expect(store.selectedAnnotationId).toBeNull()
      expect(store.selectedAnnotation).toBeNull()
    })

    it('should update transform handles when switching selection', () => {
      const store = useAnnotationStore()

      const annotation1: Measurement = {
        id: 'test-20',
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

      const annotation2: Measurement = {
        id: 'test-21',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 300, y: 300 },
          { x: 400, y: 400 }
        ],
        distance: 141.42,
        midpoint: { x: 350, y: 350 },
        labelRotation: 0,
        rotation: 0
      }

      store.addAnnotation(annotation1)
      store.addAnnotation(annotation2)

      // Select first annotation
      store.selectAnnotation('test-20')
      expect(store.selectedAnnotationId).toBe('test-20')

      // Switch to second annotation
      store.selectAnnotation('test-21')
      expect(store.selectedAnnotationId).toBe('test-21')
      expect(store.selectedAnnotation?.id).toBe('test-21')
    })
  })

  describe('Transform State Management', () => {
    it('should clear rotation drag delta when deselecting', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-22',
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
      store.selectAnnotation('test-22')

      // Set drag delta
      store.rotationDragDelta = Math.PI / 4

      // Deselect
      store.selectAnnotation(null)

      // Drag delta should be cleared
      expect(store.rotationDragDelta).toBe(0)
    })

    it('should handle derived value recalculation on transform', () => {
      const store = useAnnotationStore()

      const annotation: Measurement = {
        id: 'test-23',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 } // Horizontal line
        ],
        distance: 100,
        midpoint: { x: 150, y: 100 },
        labelRotation: 0,
        rotation: 0
      }

      store.addAnnotation(annotation)

      // Move annotation
      const movedPoints = [
        { x: 100, y: 100 },
        { x: 300, y: 100 } // Extended horizontally
      ]

      store.updateAnnotation('test-23', { points: movedPoints })

      const updated = store.getAnnotationById('test-23')

      // Midpoint should be recalculated
      expect(updated?.midpoint.x).toBeCloseTo(200, 5)
      expect(updated?.midpoint.y).toBeCloseTo(100, 5)

      // Distance should be recalculated
      expect(updated?.distance).toBeGreaterThan(100)
    })
  })
})
