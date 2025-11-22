import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useProvideMeasureTool, useMeasureToolState } from './useMeasureTool'
import type { Measurement } from '~/types/annotations'

// Mock UUID to make tests deterministic
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

// Helper to test composables within Vue setup context
function withSetup<T>(composable: () => T): T {
  let result: T
  const app = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    }
  })
  mount(app)
  return result!
}

// Helper to create mock SVG element with coordinate conversion
function createMockSvg() {
  return {
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform: vi.fn((_matrix) => {
        // Return the point as-is for simplicity
        return { x: 100, y: 200 }
      })
    }),
    getScreenCTM: () => ({ inverse: () => ({}) })
  } as unknown as SVGSVGElement
}

// Helper to create mock mouse event
function createMockMouseEvent(x: number, y: number, shiftKey = false): MouseEvent {
  const mockSvg = createMockSvg()

  // Override matrixTransform to return the specified coordinates
  mockSvg.createSVGPoint = () => ({
    x: 0,
    y: 0,
    matrixTransform: () => ({ x, y } as any)
  } as any)

  return {
    currentTarget: mockSvg,
    clientX: x,
    clientY: y,
    shiftKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as unknown as MouseEvent
}

describe('useMeasureTool', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Injection State Pattern', () => {
    it('should provide and consume state correctly', () => {
      const result = withSetup(() => {
        const provider = useProvideMeasureTool()
        const consumer = useMeasureToolState()
        return { provider, consumer }
      })

      expect(result.provider).toBeDefined()
      expect(result.consumer).toBeDefined()
      expect(result.consumer?.completed).toBeDefined()
    })

    it('should return undefined when consumer called without provider', () => {
      const result = withSetup(() => useMeasureToolState())
      expect(result).toBeUndefined()
    })
  })

  describe('Point Placement', () => {
    it('should place first point on click', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      expect(annotationStore.isDrawing).toBe(false)

      const mockEvent = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent)

      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value).toHaveLength(1)
      expect(tool.points.value[0]).toEqual({ x: 100, y: 100 })
    })

    it('should place second point and complete measurement', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      // First click
      const mockEvent1 = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent1)

      expect(tool.points.value).toHaveLength(1)

      // Second click
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent2)

      // Should auto-complete with 2 points
      expect(annotationStore.isDrawing).toBe(false)
      expect(tool.points.value).toHaveLength(0) // Reset after completion
      expect(annotationStore.annotations).toHaveLength(1)

      const measurement = annotationStore.annotations[0] as Measurement
      expect(measurement.type).toBe('measure')
      expect(measurement.points).toEqual([
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])
    })

    it('should not create measurement with less than 2 points', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      // Place only first point
      const mockEvent = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent)

      expect(tool.points.value).toHaveLength(1)
      expect(annotationStore.annotations).toHaveLength(0)
    })
  })

  describe('Distance Calculation', () => {
    it('should calculate distance between two points', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      // Create measurement: (0, 0) to (3, 4) = 5 units
      const mockEvent1 = createMockMouseEvent(0, 0)
      const mockEvent2 = createMockMouseEvent(3, 4)

      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      const measurement = annotationStore.annotations[0] as Measurement
      // Distance should be calculated (exact value depends on scale/DPI)
      expect(measurement.distance).toBeGreaterThan(0)
    })

    it('should calculate preview distance while hovering', () => {
      const tool = withSetup(() => useProvideMeasureTool())

      // Place first point
      const mockEvent1 = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent1)

      // Move mouse to create preview
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleMove(mockEvent2)

      expect(tool.tempEndPoint.value).toEqual({ x: 200, y: 200 })
      expect(tool.previewDistance.value).toBeGreaterThan(0)
    })

    it('should not show preview distance before first point', () => {
      const tool = withSetup(() => useProvideMeasureTool())

      // Move mouse without placing first point
      const mockEvent = createMockMouseEvent(200, 200)
      tool.handleMove(mockEvent)

      expect(tool.previewDistance.value).toBeNull()
    })
  })

  describe('Midpoint Calculation', () => {
    it('should calculate midpoint correctly', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      // Create measurement: (100, 100) to (200, 200)
      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)

      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      const measurement = annotationStore.annotations[0] as Measurement
      expect(measurement.midpoint).toEqual({ x: 150, y: 150 })
    })
  })

  describe('Mouse Move Preview', () => {
    it('should update temp point on mouse move', () => {
      const tool = withSetup(() => useProvideMeasureTool())

      // Place first point
      const mockEvent1 = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent1)

      // Move mouse
      const mockEvent2 = createMockMouseEvent(150, 150)
      tool.handleMove(mockEvent2)

      expect(tool.tempEndPoint.value).toEqual({ x: 150, y: 150 })

      // Move again
      const mockEvent3 = createMockMouseEvent(200, 200)
      tool.handleMove(mockEvent3)

      expect(tool.tempEndPoint.value).toEqual({ x: 200, y: 200 })
    })

    it('should update temp point even before drawing starts', () => {
      const tool = withSetup(() => useProvideMeasureTool())

      // Move mouse before any clicks
      const mockEvent = createMockMouseEvent(250, 250)
      tool.handleMove(mockEvent)

      expect(tool.tempEndPoint.value).toEqual({ x: 250, y: 250 })
    })
  })

  describe('Escape Key Cancellation', () => {
    it('should cancel measurement on Escape key', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      // Start drawing
      const mockEvent = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent)

      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value).toHaveLength(1)

      // Press Escape
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      tool.handleKeyDown(escapeEvent)

      expect(annotationStore.isDrawing).toBe(false)
      expect(tool.points.value).toHaveLength(0)
      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should not affect completed measurements on Escape', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      // Complete a measurement
      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      expect(annotationStore.annotations).toHaveLength(1)

      // Press Escape
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      tool.handleKeyDown(escapeEvent)

      // Measurement should still exist
      expect(annotationStore.annotations).toHaveLength(1)
    })
  })

  describe('Delete Key', () => {
    it('should delete selected measurement on Delete key', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      // Create and select measurement
      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      const measurement = annotationStore.annotations[0] as Measurement
      tool.selectAnnotation(measurement.id)

      expect(annotationStore.selectedAnnotationId).toBe(measurement.id)
      expect(annotationStore.annotations).toHaveLength(1)

      // Press Delete
      const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete' })
      tool.handleKeyDown(deleteEvent)

      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should delete selected measurement on Backspace key', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      // Create and select measurement
      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      const measurement = annotationStore.annotations[0] as Measurement
      tool.selectAnnotation(measurement.id)

      // Press Backspace
      const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace' })
      tool.handleKeyDown(backspaceEvent)

      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should not delete when nothing is selected', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      // Create measurement without selecting
      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      expect(annotationStore.annotations).toHaveLength(1)

      // Press Delete without selection
      const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete' })
      tool.handleKeyDown(deleteEvent)

      // Measurement should still exist
      expect(annotationStore.annotations).toHaveLength(1)
    })
  })

  describe('45° Angle Snapping', () => {
    it('should snap to 45° when Shift pressed', () => {
      const tool = withSetup(() => useProvideMeasureTool())

      // Place first point
      const mockEvent1 = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent1)

      // Move with Shift (should snap)
      const mockEvent2 = createMockMouseEvent(150, 130, true)
      tool.handleMove(mockEvent2)

      // Temp point should be snapped (exact coordinates depend on snap logic)
      expect(tool.tempEndPoint.value).toBeDefined()
      expect(tool.tempEndPoint.value).not.toEqual({ x: 150, y: 130 })
    })

    it('should complete with snapped point when Shift pressed on second click', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      // Place first point at (100, 100)
      const mockEvent1 = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent1)

      // Click with Shift at (150, 130) - should snap
      const mockEvent2 = createMockMouseEvent(150, 130, true)
      tool.handleClick(mockEvent2)

      const measurement = annotationStore.annotations[0] as Measurement
      expect(measurement.points[0]).toEqual({ x: 100, y: 100 })
      // Second point should be snapped
      expect(measurement.points[1]).not.toEqual({ x: 150, y: 130 })
    })
  })

  describe('Page Awareness', () => {
    it('should only show measurements from current page', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      // Set page 1
      rendererStore.setCurrentPage(1)

      // Create measurement on page 1
      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value![0]!.pageNum).toBe(1)

      // Create another measurement on page 1
      const measurement2: Measurement = {
        id: 'test-2',
        type: 'measure',
        pageNum: 2,
        points: [{ x: 300, y: 300 }, { x: 400, y: 400 }],
        distance: 141.42,
        midpoint: { x: 350, y: 350 },
        labelRotation: 0
      }
      annotationStore.addAnnotation(measurement2)

      // Should still only show page 1 measurements
      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value![0]!.pageNum).toBe(1)

      // Switch to page 2
      rendererStore.setCurrentPage(2)

      // Should now show page 2 measurements
      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value![0]!.id).toBe('test-2')
      expect(tool.completed.value![0]!.pageNum).toBe(2)
    })
  })

  describe('Selection Behavior', () => {
    it('should select measurement', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      // Create measurement
      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      const measurement = annotationStore.annotations[0] as Measurement

      // Select it
      tool.selectAnnotation(measurement.id)

      expect(annotationStore.selectedAnnotationId).toBe(measurement.id)
      expect(tool.selected.value?.id).toBe(measurement.id)
    })

    it('should return null for selected when different type selected', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      // Create measurement
      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      // Add different type annotation and select it
      const textAnnotation = {
        id: 'text-1',
        type: 'text' as const,
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Test',
        fontSize: 16,
        color: '#000000',
        rotation: 0
      }
      annotationStore.addAnnotation(textAnnotation)
      annotationStore.selectAnnotation('text-1')

      // selected should be null (wrong type)
      expect(tool.selected.value).toBeNull()
    })
  })

  describe('Rotation Stamping', () => {
    it('should stamp counter-rotation from page rotation', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      // Set page rotation to 90 degrees
      rendererStore.setRotation(90)

      // Create measurement
      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      const measurement = annotationStore.annotations[0] as Measurement
      // Label should be counter-rotated to appear upright
      expect(measurement.labelRotation).toBe(-90)
    })

    it('should maintain rotation as static value (not reactive to page rotation)', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      // Set initial rotation
      rendererStore.setRotation(90)

      // Create measurement
      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      const measurement = annotationStore.annotations[0] as Measurement
      const originalRotation = measurement.labelRotation

      // Change page rotation
      rendererStore.setRotation(180)

      // Measurement rotation should NOT change (it's stamped)
      expect(measurement.labelRotation).toBe(originalRotation)
      expect(measurement.labelRotation).toBe(-90)
    })
  })

  describe('UUID Generation', () => {
    it('should generate unique ID for each measurement', () => {
      const tool = withSetup(() => useProvideMeasureTool())
      const annotationStore = useAnnotationStore()

      // Create measurement
      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      const measurement = annotationStore.annotations[0] as Measurement
      expect(measurement.id).toBe('test-uuid-123')
      expect(measurement.id).toMatch(/^[a-z0-9-]+$/i)
    })
  })
})
