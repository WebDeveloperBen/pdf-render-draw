import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useProvideFillTool, useFillToolState } from './useFillTool'
import type { Fill } from '~/types/annotations'

// Mock UUID to make tests deterministic
vi.mock('uuid', () => ({
  v4: () => 'test-fill-uuid-456'
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

describe('useFillTool', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Injection State Pattern', () => {
    it('should provide and consume state correctly', () => {
      const result = withSetup(() => {
        const provider = useProvideFillTool()
        const consumer = useFillToolState()
        return { provider, consumer }
      })

      expect(result.provider).toBeDefined()
      expect(result.consumer).toBeDefined()
      expect(result.consumer?.completed).toBeDefined()
    })

    it('should return null when consumer called without provider', () => {
      const result = withSetup(() => useFillToolState())
      expect(result).toBeUndefined()
    })
  })

  describe('Fill Annotation Creation', () => {
    it('should create fill annotation on drag', () => {
      const tool = withSetup(() => useProvideFillTool())
      const annotationStore = useAnnotationStore()
      const settingsStore = useSettingStore()

      settingsStore.updateFillToolSettings({
        fillColor: '#ff0000',
        opacity: 0.5
      })

      const mockSvg = {
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform: () => ({ x: 150, y: 250 })
        }),
        getScreenCTM: () => ({ inverse: () => ({}) })
      } as unknown as SVGSVGElement

      // Simulate mouse down
      const mockMouseDownEvent = { currentTarget: mockSvg, clientX: 150, clientY: 250 } as MouseEvent
      tool.handleMouseDown(mockMouseDownEvent)

      // Update mock to return different point for mouse move
      mockSvg.createSVGPoint = () => ({
        x: 0,
        y: 0,
        matrixTransform: () => ({ x: 200, y: 300 })
      })

      // Simulate mouse move
      const mockMouseMoveEvent = { currentTarget: mockSvg, clientX: 200, clientY: 300 } as MouseEvent
      tool.handleMouseMove(mockMouseMoveEvent)

      // Simulate mouse up
      const mockMouseUpEvent = { currentTarget: mockSvg, clientX: 200, clientY: 300 } as MouseEvent
      tool.handleMouseUp(mockMouseUpEvent)

      const fills = annotationStore.annotations as Fill[]
      expect(fills).toHaveLength(1)
      expect(fills[0]).toMatchObject({
        id: 'test-fill-uuid-456',
        type: 'fill',
        x: 150,
        y: 250,
        width: 50,
        height: 50,
        color: '#ff0000',
        opacity: 0.5
      })
    })

    it('should create fill with correct page number', () => {
      const tool = withSetup(() => useProvideFillTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      rendererStore.setCurrentPage(3)

      const mockSvg = {
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform: () => ({ x: 100, y: 200 })
        }),
        getScreenCTM: () => ({ inverse: () => ({}) })
      } as unknown as SVGSVGElement

      // Simulate mouse down
      const mockMouseDownEvent = { currentTarget: mockSvg, clientX: 100, clientY: 200 } as MouseEvent
      tool.handleMouseDown(mockMouseDownEvent)

      // Update mock to return different point for mouse move
      mockSvg.createSVGPoint = () => ({
        x: 0,
        y: 0,
        matrixTransform: () => ({ x: 150, y: 250 })
      })

      // Simulate mouse move
      const mockMouseMoveEvent = { currentTarget: mockSvg, clientX: 150, clientY: 250 } as MouseEvent
      tool.handleMouseMove(mockMouseMoveEvent)

      // Simulate mouse up
      const mockMouseUpEvent = { currentTarget: mockSvg, clientX: 150, clientY: 250 } as MouseEvent
      tool.handleMouseUp(mockMouseUpEvent)

      const fills = annotationStore.annotations as Fill[]
      expect(fills[0].pageNum).toBe(3)
    })
  })

  describe('Page Awareness', () => {
    it('should only show fill annotations from current page', () => {
      const tool = withSetup(() => useProvideFillTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      rendererStore.setCurrentPage(1)
      const fill1: Fill = {
        id: 'fill-1',
        type: 'fill',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        color: '#ff0000',
        opacity: 0.5
      }

      const fill2: Fill = {
        id: 'fill-2',
        type: 'fill',
        pageNum: 2,
        x: 200,
        y: 200,
        width: 50,
        height: 50,
        color: '#00ff00',
        opacity: 0.5
      }

      annotationStore.addAnnotation(fill1)
      annotationStore.addAnnotation(fill2)

      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value[0].id).toBe('fill-1')

      rendererStore.setCurrentPage(2)
      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value[0].id).toBe('fill-2')
    })

    it('should return empty array when page has no fills', () => {
      const tool = withSetup(() => useProvideFillTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      const fill: Fill = {
        id: 'fill-1',
        type: 'fill',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        color: '#ff0000',
        opacity: 0.5
      }

      annotationStore.addAnnotation(fill)

      rendererStore.setCurrentPage(2)
      expect(tool.completed.value).toHaveLength(0)
    })
  })

  describe('Selection and Deletion', () => {
    it('should select fill annotation', () => {
      const tool = withSetup(() => useProvideFillTool())
      const annotationStore = useAnnotationStore()

      const fill: Fill = {
        id: 'fill-1',
        type: 'fill',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        color: '#ff0000',
        opacity: 0.5
      }

      annotationStore.addAnnotation(fill)
      tool.selectAnnotation('fill-1')

      expect(annotationStore.selectedAnnotationId).toBe('fill-1')
      expect(tool.selected.value?.id).toBe('fill-1')
    })

    it('should delete fill annotation', () => {
      const tool = withSetup(() => useProvideFillTool())
      const annotationStore = useAnnotationStore()

      const fill: Fill = {
        id: 'fill-1',
        type: 'fill',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        color: '#ff0000',
        opacity: 0.5
      }

      annotationStore.addAnnotation(fill)
      expect(annotationStore.annotations).toHaveLength(1)

      tool.deleteFill('fill-1')
      expect(annotationStore.annotations).toHaveLength(0)
    })
  })
})
