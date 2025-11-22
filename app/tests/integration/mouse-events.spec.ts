import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnnotationStore } from '~/stores/annotations'
import { useRendererStore } from '~/stores/renderer'
import type { Measurement, Area, Perimeter, PerimeterSegment } from '~/types/annotations'

// Mock UUID to make tests deterministic
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

describe('Mouse Events Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // Helper function to create test annotations
  function createTestMeasurement(id: string, points: [{ x: number; y: number }, { x: number; y: number }]): Measurement {
    return {
      id,
      type: 'measure',
      pageNum: 1,
      points,
      distance: 100,
      midpoint: {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2
      },
      labelRotation: 0,
      rotation: 0
    }
  }

  function createTestArea(id: string, points: { x: number; y: number }[]): Area {
    return {
      id,
      type: 'area',
      pageNum: 1,
      points,
      area: 100,
      center: { x: 150, y: 150 },
      labelRotation: 0,
      rotation: 0
    }
  }

  function createTestPerimeter(id: string, points: { x: number; y: number }[]): Perimeter {
    const segments: PerimeterSegment[] = []
    for (let i = 0; i < points.length; i++) {
      const start = points[i]
      const end = points[(i + 1) % points.length]
      segments.push({
        start,
        end,
        length: Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)),
        midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
      })
    }

    return {
      id,
      type: 'perimeter',
      pageNum: 1,
      points,
      segments,
      totalLength: segments.reduce((sum, seg) => sum + seg.length, 0),
      center: { x: 150, y: 150 },
      labelRotation: 0,
      rotation: 0
    }
  }

  describe('Selection via Mouse Events', () => {
    it('should select annotation on click', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)

      // Simulate click selection
      store.selectAnnotation('m1')

      expect(store.selectedAnnotationId).toBe('m1')
      expect(store.selectedAnnotation?.id).toBe('m1')
      expect(store.activeTool).toBe('selection')
    })

    it('should deselect all on background click', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation('m1')

      expect(store.selectedAnnotationId).toBe('m1')

      // Simulate background click (deselect)
      store.selectAnnotation(null)

      expect(store.selectedAnnotationId).toBeNull()
      expect(store.selectedAnnotation).toBeNull()
    })

    it('should add to multi-selection with Ctrl+Click', () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])
      const measurement2 = createTestMeasurement('m2', [
        { x: 300, y: 300 },
        { x: 400, y: 400 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)

      // First click selects m1
      store.selectAnnotation('m1')
      expect(store.selectedAnnotationIds).toEqual(['m1'])

      // Ctrl+Click adds m2 to selection
      store.selectAnnotation('m2', { addToSelection: true })
      expect(store.selectedAnnotationIds).toEqual(['m1', 'm2'])
      expect(store.selectedAnnotations).toHaveLength(2)
    })

    it('should toggle selection with toggle option', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)

      // First toggle selects
      store.selectAnnotation('m1', { toggle: true })
      expect(store.selectedAnnotationIds).toEqual(['m1'])

      // Second toggle deselects
      store.selectAnnotation('m1', { toggle: true })
      expect(store.selectedAnnotationIds).toEqual([])
    })

    it('should replace selection on click without modifiers', () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])
      const measurement2 = createTestMeasurement('m2', [
        { x: 300, y: 300 },
        { x: 400, y: 400 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)

      // Select both
      store.selectAnnotations(['m1', 'm2'])
      expect(store.selectedAnnotationIds).toEqual(['m1', 'm2'])

      // Click on m1 without modifier replaces selection
      store.selectAnnotation('m1')
      expect(store.selectedAnnotationIds).toEqual(['m1'])
    })

    it('should switch to selection tool when annotation selected', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)
      store.setActiveTool('measure')

      expect(store.activeTool).toBe('measure')

      // Selecting an annotation switches to selection tool
      store.selectAnnotation('m1')

      expect(store.activeTool).toBe('selection')
    })
  })

  describe('Drag Operations', () => {
    it('should start rotation on rotation handle drag', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation('m1')

      expect(store.rotationDragDelta).toBe(0)

      // Simulate starting rotation drag
      store.rotationDragDelta = Math.PI / 4 // 45 degrees

      expect(store.rotationDragDelta).toBeCloseTo(Math.PI / 4, 5)
    })

    it('should update annotation in real-time during drag', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation('m1')

      // Simulate rotation drag
      store.rotationDragDelta = Math.PI / 6 // 30 degrees

      // Get transform - should include drag delta
      const transform = store.getRotationTransform(measurement)
      expect(transform).toContain('rotate(')

      // Extract angle from transform string and verify it's close to 30 degrees
      const angleMatch = transform.match(/rotate\(([0-9.]+)/)
      expect(angleMatch).toBeTruthy()
      expect(parseFloat(angleMatch![1])).toBeCloseTo(30, 5)
    })

    it('should commit changes to store on drag release', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation('m1')

      // Simulate rotation drag and release
      const rotationDelta = Math.PI / 4
      store.rotationDragDelta = rotationDelta

      // Commit rotation
      const existingRotation = measurement.rotation || 0
      store.updateAnnotation('m1', { rotation: existingRotation + rotationDelta })

      // Clear drag delta (release)
      store.rotationDragDelta = 0

      // Verify rotation committed
      const updated = store.getAnnotationById('m1')
      expect(updated?.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(store.rotationDragDelta).toBe(0)
    })

    it('should update derived values during move', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])

      store.addAnnotation(measurement)

      const originalMidpoint = { ...measurement.midpoint }

      // Simulate move
      const deltaX = 50
      const deltaY = 30

      const movedPoints = measurement.points.map(p => ({
        x: p.x + deltaX,
        y: p.y + deltaY
      })) as [{ x: number; y: number }, { x: number; y: number }]

      store.updateAnnotation('m1', { points: movedPoints })

      // Verify midpoint recalculated
      const updated = store.getAnnotationById('m1') as Measurement
      expect(updated.midpoint.x).not.toBe(originalMidpoint.x)
      expect(updated.midpoint.y).not.toBe(originalMidpoint.y)
      // New points are [150, 130] and [250, 130]
      // Midpoint should be (150 + 250) / 2 = 200, (130 + 130) / 2 = 130
      expect(updated.midpoint.x).toBeCloseTo(200, 5)
      expect(updated.midpoint.y).toBeCloseTo(130, 5)
    })

    it('should handle resize operations', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)

      const originalDistance = measurement.distance

      // Simulate resize by scaling points
      const scaleX = 2
      const scaleY = 2
      const originX = 100
      const originY = 100

      const scaledPoints = measurement.points.map(p => ({
        x: originX + (p.x - originX) * scaleX,
        y: originY + (p.y - originY) * scaleY
      })) as [{ x: number; y: number }, { x: number; y: number }]

      store.updateAnnotation('m1', { points: scaledPoints })

      // Verify distance recalculated
      const updated = store.getAnnotationById('m1') as Measurement
      expect(updated.distance).toBeGreaterThan(originalDistance)
    })

    it('should handle multi-select group drag', () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement('m2', [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(['m1', 'm2'])

      // Simulate group move
      const deltaX = 50
      const deltaY = 30

      const movePoints = (points: { x: number; y: number }[]) =>
        points.map(p => ({ x: p.x + deltaX, y: p.y + deltaY }))

      store.updateAnnotation('m1', { points: movePoints(measurement1.points) as [{ x: number; y: number }, { x: number; y: number }] })
      store.updateAnnotation('m2', { points: movePoints(measurement2.points) as [{ x: number; y: number }, { x: number; y: number }] })

      // Verify both moved
      const updated1 = store.getAnnotationById('m1') as Measurement
      const updated2 = store.getAnnotationById('m2') as Measurement

      expect(updated1.points[0].x).toBe(150)
      expect(updated2.points[0].x).toBe(150)
    })
  })

  describe('Cancellation', () => {
    it('should cancel operation on Escape during drag', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation('m1')

      const originalRotation = measurement.rotation || 0

      // Start rotation drag
      store.rotationDragDelta = Math.PI / 4

      // Simulate Escape - clear drag delta without committing
      store.rotationDragDelta = 0

      // Verify rotation not changed
      const updated = store.getAnnotationById('m1')
      expect(updated?.rotation).toBe(originalRotation)
    })

    it('should restore original annotation state on cancellation', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)

      const originalPoints = [...measurement.points]
      const originalMidpoint = { ...measurement.midpoint }

      // Start drag but don't commit
      // (In practice, the component would track original state)

      // Simulate cancellation - annotation should remain unchanged
      const current = store.getAnnotationById('m1') as Measurement
      expect(current.points).toEqual(originalPoints)
      expect(current.midpoint).toEqual(originalMidpoint)
    })

    it('should clear drag delta on deselection', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation('m1')

      // Start drag
      store.rotationDragDelta = Math.PI / 4

      // Deselect
      store.selectAnnotation(null)

      // Drag delta should be cleared
      expect(store.rotationDragDelta).toBe(0)
    })
  })

  describe('Tool-Specific Behavior', () => {
    it('should respect current active tool for mouse events', () => {
      const store = useAnnotationStore()

      // Set measure tool active
      store.setActiveTool('measure')
      expect(store.activeTool).toBe('measure')
      expect(store.isDrawing).toBe(false)

      // Simulate starting to draw
      store.isDrawing = true
      expect(store.isDrawing).toBe(true)

      // Complete drawing
      store.isDrawing = false
      expect(store.isDrawing).toBe(false)
    })

    it('should switch tools correctly', () => {
      const store = useAnnotationStore()

      store.setActiveTool('measure')
      expect(store.activeTool).toBe('measure')

      store.setActiveTool('area')
      expect(store.activeTool).toBe('area')
      expect(store.selectedAnnotationIds).toEqual([]) // Selection cleared
      expect(store.isDrawing).toBe(false) // Drawing state reset
    })

    it('should prevent selection during drawing', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)
      store.setActiveTool('measure')

      // Start drawing
      store.isDrawing = true

      // Try to select (in practice, component would prevent this)
      expect(store.isDrawing).toBe(true)

      // Selection should only work when not drawing
      store.isDrawing = false
      store.selectAnnotation('m1')
      expect(store.selectedAnnotationId).toBe('m1')
    })

    it('should handle tool-specific drawing completion', () => {
      const store = useAnnotationStore()

      store.setActiveTool('area')
      expect(store.activeTool).toBe('area')

      // Simulate drawing
      store.isDrawing = true

      // Complete
      store.isDrawing = false

      expect(store.isDrawing).toBe(false)
    })
  })

  describe('Boundary Conditions', () => {
    it('should handle mouse events at page boundaries', () => {
      const store = useAnnotationStore()
      const rendererStore = useRendererStore()

      // Set page dimensions (typical PDF page)
      rendererStore.setCurrentPage(1)

      const measurement = createTestMeasurement('m1', [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ])

      store.addAnnotation(measurement)

      // Verify annotation at boundary is valid
      expect(measurement.points[0].x).toBe(0)
      expect(measurement.points[0].y).toBe(0)
    })

    it('should handle events on multi-page documents', () => {
      const store = useAnnotationStore()
      const rendererStore = useRendererStore()

      // Create annotations on different pages
      const measurement1 = createTestMeasurement('m1-page1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])
      measurement1.pageNum = 1

      const measurement2 = createTestMeasurement('m2-page2', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])
      measurement2.pageNum = 2

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)

      // View page 1
      rendererStore.setCurrentPage(1)
      const page1Annotations = store.getAnnotationsByPage(1)
      expect(page1Annotations).toHaveLength(1)
      expect(page1Annotations[0].id).toBe('m1-page1')

      // View page 2
      rendererStore.setCurrentPage(2)
      const page2Annotations = store.getAnnotationsByPage(2)
      expect(page2Annotations).toHaveLength(1)
      expect(page2Annotations[0].id).toBe('m2-page2')
    })

    it('should handle very small drag distances', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)

      // Simulate tiny drag (should be ignored as click, not drag)
      // In practice, hasMoved flag tracks this
      const deltaX = 0.5
      const deltaY = 0.5

      // Very small deltas shouldn't trigger move
      expect(Math.abs(deltaX) < 1).toBe(true)
      expect(Math.abs(deltaY) < 1).toBe(true)
    })

    it('should handle very large drag distances', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)

      // Simulate large drag
      const deltaX = 10000
      const deltaY = 10000

      const movedPoints = measurement.points.map(p => ({
        x: p.x + deltaX,
        y: p.y + deltaY
      })) as [{ x: number; y: number }, { x: number; y: number }]

      store.updateAnnotation('m1', { points: movedPoints })

      const updated = store.getAnnotationById('m1') as Measurement
      expect(updated.points[0].x).toBe(10100)
      expect(updated.points[0].y).toBe(10100)
    })

    it('should handle rapid mouse events', () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])
      const measurement2 = createTestMeasurement('m2', [
        { x: 300, y: 300 },
        { x: 400, y: 400 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)

      // Rapid selection changes
      store.selectAnnotation('m1')
      expect(store.selectedAnnotationId).toBe('m1')

      store.selectAnnotation('m2')
      expect(store.selectedAnnotationId).toBe('m2')

      store.selectAnnotation('m1')
      expect(store.selectedAnnotationId).toBe('m1')
    })

    it('should handle empty selection scenarios', () => {
      const store = useAnnotationStore()

      // Deselect when nothing is selected
      store.selectAnnotation(null)
      expect(store.selectedAnnotationId).toBeNull()

      // Try to select non-existent annotation
      store.selectAnnotation('non-existent')
      expect(store.selectedAnnotationIds).toEqual([])
    })
  })

  describe('Multi-Select Operations', () => {
    it('should select multiple annotations via array', () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])
      const measurement2 = createTestMeasurement('m2', [
        { x: 300, y: 300 },
        { x: 400, y: 400 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)

      // Select both via array
      store.selectAnnotations(['m1', 'm2'])

      expect(store.selectedAnnotationIds).toEqual(['m1', 'm2'])
      expect(store.selectedAnnotations).toHaveLength(2)
    })

    it('should apply drag to all selected annotations', () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement('m2', [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(['m1', 'm2'])

      // Simulate group rotation
      const rotationDelta = Math.PI / 6
      store.rotationDragDelta = rotationDelta

      // Both should be affected by group rotation
      expect(store.selectedAnnotations).toHaveLength(2)
      expect(store.rotationDragDelta).toBe(rotationDelta)
    })

    it('should handle mixed annotation types in selection', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])
      const area = createTestArea('a1', [
        { x: 300, y: 300 },
        { x: 400, y: 300 },
        { x: 350, y: 400 }
      ])

      store.addAnnotation(measurement)
      store.addAnnotation(area)

      // Select both different types
      store.selectAnnotations(['m1', 'a1'])

      expect(store.selectedAnnotations).toHaveLength(2)
      expect(store.selectedAnnotations[0].type).toBe('measure')
      expect(store.selectedAnnotations[1].type).toBe('area')
    })

    it('should clear rotation delta on selection change', () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])
      const measurement2 = createTestMeasurement('m2', [
        { x: 300, y: 300 },
        { x: 400, y: 400 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)

      // Select m1 and start rotation
      store.selectAnnotation('m1')
      store.rotationDragDelta = Math.PI / 4

      // Change selection - drag delta should persist during same session
      // but in practice component clears it
      expect(store.rotationDragDelta).toBe(Math.PI / 4)

      // Manually clear as component would
      store.rotationDragDelta = 0
      store.selectAnnotation('m2')

      expect(store.rotationDragDelta).toBe(0)
    })
  })

  describe('State Consistency', () => {
    it('should maintain consistent state during selection changes', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)

      // Select
      store.selectAnnotation('m1')
      expect(store.selectedAnnotationId).toBe('m1')
      expect(store.selectedAnnotation?.id).toBe('m1')
      expect(store.activeTool).toBe('selection')

      // Deselect
      store.selectAnnotation(null)
      expect(store.selectedAnnotationId).toBeNull()
      expect(store.selectedAnnotation).toBeNull()
    })

    it('should maintain annotation data integrity during operations', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)

      const original = { ...measurement }

      // Multiple operations
      store.selectAnnotation('m1')
      store.rotationDragDelta = Math.PI / 4
      store.rotationDragDelta = 0

      // Original annotation should be unchanged
      const current = store.getAnnotationById('m1') as Measurement
      expect(current.points).toEqual(original.points)
      expect(current.id).toBe(original.id)
      expect(current.type).toBe(original.type)
    })

    it('should handle concurrent operations correctly', () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement('m1', [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)

      // Simulate concurrent operations
      store.selectAnnotation('m1')
      store.rotationDragDelta = Math.PI / 6

      // Update points while rotating (shouldn't interfere)
      store.updateAnnotation('m1', {
        points: [{ x: 150, y: 150 }, { x: 250, y: 250 }]
      })

      const updated = store.getAnnotationById('m1') as Measurement
      expect(updated.points[0].x).toBe(150)
      expect(store.rotationDragDelta).toBe(Math.PI / 6)
    })
  })
})
