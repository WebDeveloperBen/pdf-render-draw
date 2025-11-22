import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useProvidePerimeterTool, usePerimeterToolState } from './usePerimeterTool'
import type { Perimeter } from '~/types/annotations'

// Mock UUID to make tests deterministic
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-perimeter-123'
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

// Helper to create mock mouse event
function createMockMouseEvent(x: number, y: number, shiftKey = false): MouseEvent {
  const mockSvg = {
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform: () => ({ x, y })
    }),
    getScreenCTM: () => ({ inverse: () => ({}) })
  } as unknown as SVGSVGElement

  return {
    currentTarget: mockSvg,
    clientX: x,
    clientY: y,
    shiftKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as unknown as MouseEvent
}

describe('usePerimeterTool', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Injection State Pattern', () => {
    it('should provide and consume state correctly', () => {
      const result = withSetup(() => {
        const provider = useProvidePerimeterTool()
        const consumer = usePerimeterToolState()
        return { provider, consumer }
      })

      expect(result.provider).toBeDefined()
      expect(result.consumer).toBeDefined()
      expect(result.consumer?.completed).toBeDefined()
    })

    it('should return undefined when consumer called without provider', () => {
      const result = withSetup(() => usePerimeterToolState())
      expect(result).toBeUndefined()
    })
  })

  describe('Point Placement', () => {
    it('should place first point on click', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      expect(annotationStore.isDrawing).toBe(false)

      const mockEvent = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent)

      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value).toHaveLength(1)
      expect(tool.points.value[0]).toEqual({ x: 100, y: 100 })
    })

    it('should place second point and continue drawing', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))

      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value).toHaveLength(2)
      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should place third point and continue drawing until closed', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))

      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value).toHaveLength(3)
      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should not create perimeter with less than 3 points', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))

      expect(tool.points.value).toHaveLength(2)
      expect(annotationStore.annotations).toHaveLength(0)
    })
  })

  describe('Snap to Close Polygon', () => {
    it('should detect when near first point for closing', () => {
      const tool = withSetup(() => useProvidePerimeterTool())

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))

      tool.handleMove(createMockMouseEvent(105, 105))

      expect(tool.canSnapToClose.value).toBe(true)
    })

    it('should complete perimeter when clicking near first point', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      expect(annotationStore.isDrawing).toBe(false)
      expect(tool.points.value).toHaveLength(0)
      expect(annotationStore.annotations).toHaveLength(1)

      const perimeter = annotationStore.annotations[0] as Perimeter
      expect(perimeter.type).toBe('perimeter')
      expect(perimeter.points).toHaveLength(3)
    })
  })

  describe('Segment Calculation', () => {
    it('should calculate individual segment lengths', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      // Create a triangle
      tool.handleClick(createMockMouseEvent(0, 0))
      tool.handleClick(createMockMouseEvent(100, 0))
      tool.handleClick(createMockMouseEvent(0, 100))
      tool.handleMove(createMockMouseEvent(5, 5))
      tool.handleClick(createMockMouseEvent(5, 5))

      const perimeter = annotationStore.annotations[0] as Perimeter

      // Should have 3 segments for a triangle
      expect(perimeter.segments).toHaveLength(3)

      // Each segment should have start, end, length, midpoint
      perimeter.segments.forEach(segment => {
        expect(segment).toHaveProperty('start')
        expect(segment).toHaveProperty('end')
        expect(segment).toHaveProperty('length')
        expect(segment).toHaveProperty('midpoint')
        expect(segment.length).toBeGreaterThan(0)
      })
    })

    it('should calculate correct segment midpoints', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      // Create a square for easy midpoint verification
      tool.handleClick(createMockMouseEvent(0, 0))
      tool.handleClick(createMockMouseEvent(100, 0))
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(0, 100))
      tool.handleMove(createMockMouseEvent(5, 5))
      tool.handleClick(createMockMouseEvent(5, 5))

      const perimeter = annotationStore.annotations[0] as Perimeter

      // First segment: (0,0) to (100,0), midpoint should be (50,0)
      expect(perimeter.segments![0]!.midpoint.x).toBeCloseTo(50, 1)
      expect(perimeter.segments![0]!.midpoint.y).toBeCloseTo(0, 1)

      // Second segment: (100,0) to (100,100), midpoint should be (100,50)
      expect(perimeter.segments![1]!.midpoint.x).toBeCloseTo(100, 1)
      expect(perimeter.segments![1]!.midpoint.y).toBeCloseTo(50, 1)
    })

    it('should create closing segment from last to first point', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const perimeter = annotationStore.annotations[0] as Perimeter

      // Last segment should connect back to first point
      const lastSegment = perimeter.segments![perimeter.segments!.length - 1]
      expect(lastSegment!.end).toEqual(perimeter.points[0])
    })
  })

  describe('Total Length Calculation', () => {
    it('should calculate total perimeter length', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(0, 0))
      tool.handleClick(createMockMouseEvent(100, 0))
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleMove(createMockMouseEvent(5, 5))
      tool.handleClick(createMockMouseEvent(5, 5))

      const perimeter = annotationStore.annotations[0] as Perimeter
      expect(perimeter.totalLength).toBeGreaterThan(0)
    })

    it('should sum all segment lengths correctly', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(0, 0))
      tool.handleClick(createMockMouseEvent(100, 0))
      tool.handleClick(createMockMouseEvent(0, 100))
      tool.handleMove(createMockMouseEvent(5, 5))
      tool.handleClick(createMockMouseEvent(5, 5))

      const perimeter = annotationStore.annotations[0] as Perimeter

      // Manual sum should equal totalLength
      const manualSum = perimeter.segments.reduce((sum, seg) => sum + seg.length, 0)
      expect(perimeter.totalLength).toBeCloseTo(manualSum, 2)
    })
  })

  describe('Centroid Calculation', () => {
    it('should calculate centroid correctly', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      // Create a square
      tool.handleClick(createMockMouseEvent(0, 0))
      tool.handleClick(createMockMouseEvent(100, 0))
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(0, 100))
      tool.handleMove(createMockMouseEvent(5, 5))
      tool.handleClick(createMockMouseEvent(5, 5))

      const perimeter = annotationStore.annotations[0] as Perimeter

      // Centroid of square should be near center (50, 50)
      expect(perimeter.center.x).toBeCloseTo(50, 0)
      expect(perimeter.center.y).toBeCloseTo(50, 0)
    })
  })

  describe('Preview Segments', () => {
    it('should show preview segments while drawing', () => {
      const tool = withSetup(() => useProvidePerimeterTool())

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleMove(createMockMouseEvent(150, 200))

      expect(tool.previewSegments.value).toHaveLength(2)

      // First segment: completed between points 1 and 2
      expect(tool.previewSegments.value![0]!.start).toEqual({ x: 100, y: 100 })
      expect(tool.previewSegments.value![0]!.end).toEqual({ x: 200, y: 100 })

      // Second segment: temp segment to cursor
      expect(tool.previewSegments.value![1]!.start).toEqual({ x: 200, y: 100 })
      expect(tool.previewSegments.value![1]!.end).toEqual({ x: 150, y: 200 })
    })

    it('should not show preview segments before drawing starts', () => {
      const tool = withSetup(() => useProvidePerimeterTool())

      expect(tool.previewSegments.value).toHaveLength(0)
    })

    it('should update preview segments as mouse moves', () => {
      const tool = withSetup(() => useProvidePerimeterTool())

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))

      // Move to first position
      tool.handleMove(createMockMouseEvent(150, 150))
      const firstPreview = tool.previewSegments.value[1]

      // Move to second position
      tool.handleMove(createMockMouseEvent(150, 250))
      const secondPreview = tool.previewSegments.value[1]

      // Preview segment should have different end points
      expect(firstPreview!.end).not.toEqual(secondPreview!.end)
      expect(secondPreview!.end).toEqual({ x: 150, y: 250 })
    })

    it('should calculate lengths for preview segments', () => {
      const tool = withSetup(() => useProvidePerimeterTool())

      tool.handleClick(createMockMouseEvent(0, 0))
      tool.handleClick(createMockMouseEvent(100, 0))
      tool.handleMove(createMockMouseEvent(100, 100))

      expect(tool.previewSegments.value).toHaveLength(2)

      // Both segments should have calculated lengths
      tool.previewSegments.value.forEach(segment => {
        expect(segment.length).toBeGreaterThan(0)
        expect(segment.length).toBeDefined()
      })
    })
  })

  describe('Escape Key Cancellation', () => {
    it('should cancel perimeter drawing on Escape key', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))

      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value).toHaveLength(3)

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      tool.handleKeyDown(escapeEvent)

      expect(annotationStore.isDrawing).toBe(false)
      expect(tool.points.value).toHaveLength(0)
      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should not affect completed perimeters on Escape', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      expect(annotationStore.annotations).toHaveLength(1)

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      tool.handleKeyDown(escapeEvent)

      expect(annotationStore.annotations).toHaveLength(1)
    })
  })

  describe('Delete Key', () => {
    it('should delete selected perimeter on Delete key', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const perimeter = annotationStore.annotations[0] as Perimeter
      tool.selectAnnotation(perimeter.id)

      expect(annotationStore.selectedAnnotationId).toBe(perimeter.id)
      expect(annotationStore.annotations).toHaveLength(1)

      const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete' })
      tool.handleKeyDown(deleteEvent)

      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should delete selected perimeter on Backspace key', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const perimeter = annotationStore.annotations[0] as Perimeter
      tool.selectAnnotation(perimeter.id)

      const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace' })
      tool.handleKeyDown(backspaceEvent)

      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should not delete when nothing is selected', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      expect(annotationStore.annotations).toHaveLength(1)

      const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete' })
      tool.handleKeyDown(deleteEvent)

      expect(annotationStore.annotations).toHaveLength(1)
    })
  })

  describe('45° Angle Snapping', () => {
    it('should snap to 45° when Shift pressed', () => {
      const tool = withSetup(() => useProvidePerimeterTool())

      tool.handleClick(createMockMouseEvent(100, 100))

      const mockEvent = createMockMouseEvent(150, 130, true)
      tool.handleMove(mockEvent)

      expect(tool.tempEndPoint.value).toBeDefined()
      expect(tool.tempEndPoint.value).not.toEqual({ x: 150, y: 130 })
    })

    it('should complete with snapped point when Shift pressed on click', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 130, true)) // Shift - should snap
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const perimeter = annotationStore.annotations[0] as Perimeter
      expect(perimeter.points[0]).toEqual({ x: 100, y: 100 })
      expect(perimeter.points[1]).toEqual({ x: 200, y: 100 })
      expect(perimeter.points[2]).not.toEqual({ x: 150, y: 130 })
    })
  })

  describe('Page Awareness', () => {
    it('should only show perimeters from current page', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      rendererStore.setCurrentPage(1)

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
       tool.handleClick(createMockMouseEvent(105, 105))

       expect(tool.completed.value).toHaveLength(1)
       expect(tool.completed.value![0]!.pageNum).toBe(1)

       const perimeter2: Perimeter = {
        id: 'perimeter-2',
        type: 'perimeter',
        pageNum: 2,
        points: [{ x: 300, y: 300 }, { x: 400, y: 300 }, { x: 350, y: 400 }],
        segments: [
          {
            start: { x: 300, y: 300 },
            end: { x: 400, y: 300 },
            length: 100,
            midpoint: { x: 350, y: 300 }
          },
          {
            start: { x: 400, y: 300 },
            end: { x: 350, y: 400 },
            length: 111.8,
            midpoint: { x: 375, y: 350 }
          },
          {
            start: { x: 350, y: 400 },
            end: { x: 300, y: 300 },
            length: 111.8,
            midpoint: { x: 325, y: 350 }
          }
        ],
        totalLength: 323.6,
        center: { x: 350, y: 333 },
        labelRotation: 0
      }
      annotationStore.addAnnotation(perimeter2)

      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value![0]!.pageNum).toBe(1)

      rendererStore.setCurrentPage(2)

      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value![0]!.id).toBe('perimeter-2')
      expect(tool.completed.value![0]!.pageNum).toBe(2)
    })
  })

  describe('Selection Behavior', () => {
    it('should select perimeter', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const perimeter = annotationStore.annotations[0] as Perimeter
      tool.selectAnnotation(perimeter.id)

      expect(annotationStore.selectedAnnotationId).toBe(perimeter.id)
      expect(tool.selected.value?.id).toBe(perimeter.id)
    })

    it('should return null for selected when different type selected', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

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

      expect(tool.selected.value).toBeNull()
    })
  })

  describe('Rotation Stamping', () => {
    it('should stamp counter-rotation from page rotation', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      rendererStore.setRotation(90)

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const perimeter = annotationStore.annotations[0] as Perimeter
      expect(perimeter.labelRotation).toBe(-90)
    })

    it('should maintain rotation as static value (not reactive to page rotation)', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      rendererStore.setRotation(90)

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const perimeter = annotationStore.annotations[0] as Perimeter
      const originalRotation = perimeter.labelRotation

      rendererStore.setRotation(180)

      expect(perimeter.labelRotation).toBe(originalRotation)
      expect(perimeter.labelRotation).toBe(-90)
    })
  })

  describe('UUID Generation', () => {
    it('should generate unique ID for each perimeter', () => {
      const tool = withSetup(() => useProvidePerimeterTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const perimeter = annotationStore.annotations[0] as Perimeter
      expect(perimeter.id).toBe('test-uuid-perimeter-123')
      expect(perimeter.id).toMatch(/^[a-z0-9-]+$/i)
    })
  })
})
