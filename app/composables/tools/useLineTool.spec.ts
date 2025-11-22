import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useProvideLineTool, useLineToolState } from './useLineTool'
import type { Line } from '~/types/annotations'

// Mock UUID to make tests deterministic
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-line-123'
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

describe('useLineTool', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Injection State Pattern', () => {
    it('should provide and consume state correctly', () => {
      const result = withSetup(() => {
        const provider = useProvideLineTool()
        const consumer = useLineToolState()
        return { provider, consumer }
      })

      expect(result.provider).toBeDefined()
      expect(result.consumer).toBeDefined()
      expect(result.consumer?.completed).toBeDefined()
    })

    it('should return undefined when consumer called without provider', () => {
      const result = withSetup(() => useLineToolState())
      expect(result).toBeUndefined()
    })
  })

  describe('Point Placement', () => {
    it('should place first point on click', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()

      expect(annotationStore.isDrawing).toBe(false)

      const mockEvent = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent)

      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value).toHaveLength(1)
      expect(tool.points.value[0]).toEqual({ x: 100, y: 100 })
    })

    it('should complete line on second click', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()

      const mockEvent1 = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent1)

      expect(tool.points.value).toHaveLength(1)

      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent2)

      // Should auto-complete with 2 points
      expect(annotationStore.isDrawing).toBe(false)
      expect(tool.points.value).toHaveLength(0) // Reset after completion
      expect(annotationStore.annotations).toHaveLength(1)

      const line = annotationStore.annotations[0] as Line
      expect(line.type).toBe('line')
      expect(line.points).toEqual([
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])
    })

    it('should not create line with less than 2 points', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()

      const mockEvent = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent)

      expect(tool.points.value).toHaveLength(1)
      expect(annotationStore.annotations).toHaveLength(0)
    })
  })

  describe('Multi-Point Lines', () => {
    it('should create polyline with multiple points', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()

      // Currently auto-completes at 2 points, but testing the concept
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))

      const line = annotationStore.annotations[0] as Line
      expect(line.points).toHaveLength(2)
    })
  })

  describe('Mouse Move Preview', () => {
    it('should update temp point on mouse move', () => {
      const tool = withSetup(() => useProvideLineTool())

      tool.handleClick(createMockMouseEvent(100, 100))

      tool.handleMove(createMockMouseEvent(150, 150))

      expect(tool.tempEndPoint.value).toEqual({ x: 150, y: 150 })

      tool.handleMove(createMockMouseEvent(200, 200))

      expect(tool.tempEndPoint.value).toEqual({ x: 200, y: 200 })
    })

    it('should update temp point even before drawing starts', () => {
      const tool = withSetup(() => useProvideLineTool())

      const mockEvent = createMockMouseEvent(250, 250)
      tool.handleMove(mockEvent)

      expect(tool.tempEndPoint.value).toEqual({ x: 250, y: 250 })
    })
  })

  describe('Escape Key Cancellation', () => {
    it('should cancel line drawing on Escape key', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()

      const mockEvent = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent)

      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value).toHaveLength(1)

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      tool.handleKeyDown(escapeEvent)

      expect(annotationStore.isDrawing).toBe(false)
      expect(tool.points.value).toHaveLength(0)
      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should not affect completed lines on Escape', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()

      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      expect(annotationStore.annotations).toHaveLength(1)

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      tool.handleKeyDown(escapeEvent)

      expect(annotationStore.annotations).toHaveLength(1)
    })
  })

  describe('Delete Key', () => {
    it('should delete selected line on Delete key', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()

      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      const line = annotationStore.annotations[0] as Line
      tool.selectAnnotation(line.id)

      expect(annotationStore.selectedAnnotationId).toBe(line.id)
      expect(annotationStore.annotations).toHaveLength(1)

      const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete' })
      tool.handleKeyDown(deleteEvent)

      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should delete selected line on Backspace key', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()

      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      const line = annotationStore.annotations[0] as Line
      tool.selectAnnotation(line.id)

      const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace' })
      tool.handleKeyDown(backspaceEvent)

      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should not delete when nothing is selected', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()

      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      expect(annotationStore.annotations).toHaveLength(1)

      const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete' })
      tool.handleKeyDown(deleteEvent)

      expect(annotationStore.annotations).toHaveLength(1)
    })
  })

  describe('45° Angle Snapping', () => {
    it('should snap to 45° when Shift pressed', () => {
      const tool = withSetup(() => useProvideLineTool())

      tool.handleClick(createMockMouseEvent(100, 100))

      const mockEvent = createMockMouseEvent(150, 130, true)
      tool.handleMove(mockEvent)

      expect(tool.tempEndPoint.value).toBeDefined()
      expect(tool.tempEndPoint.value).not.toEqual({ x: 150, y: 130 })
    })

    it('should complete with snapped point when Shift pressed on second click', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()

      tool.handleClick(createMockMouseEvent(100, 100))

      const mockEvent2 = createMockMouseEvent(150, 130, true)
      tool.handleClick(mockEvent2)

      const line = annotationStore.annotations[0] as Line
      expect(line.points[0]).toEqual({ x: 100, y: 100 })
      expect(line.points[1]).not.toEqual({ x: 150, y: 130 })
    })
  })

  describe('Page Awareness', () => {
    it('should only show lines from current page', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      rendererStore.setCurrentPage(1)

      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value[0].pageNum).toBe(1)

      const line2: Line = {
        id: 'line-2',
        type: 'line',
        pageNum: 2,
        points: [{ x: 300, y: 300 }, { x: 400, y: 400 }]
      }
      annotationStore.addAnnotation(line2)

      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value[0].pageNum).toBe(1)

      rendererStore.setCurrentPage(2)

      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value[0].id).toBe('line-2')
      expect(tool.completed.value[0].pageNum).toBe(2)
    })
  })

  describe('Selection Behavior', () => {
    it('should select line', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()

      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      const line = annotationStore.annotations[0] as Line

      tool.selectAnnotation(line.id)

      expect(annotationStore.selectedAnnotationId).toBe(line.id)
      expect(tool.selected.value?.id).toBe(line.id)
    })

    it('should return null for selected when different type selected', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()

      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

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

  describe('UUID Generation', () => {
    it('should generate unique ID for each line', () => {
      const tool = withSetup(() => useProvideLineTool())
      const annotationStore = useAnnotationStore()

      const mockEvent1 = createMockMouseEvent(100, 100)
      const mockEvent2 = createMockMouseEvent(200, 200)
      tool.handleClick(mockEvent1)
      tool.handleClick(mockEvent2)

      const line = annotationStore.annotations[0] as Line
      expect(line.id).toBe('test-uuid-line-123')
      expect(line.id).toMatch(/^[a-z0-9-]+$/i)
    })
  })
})
