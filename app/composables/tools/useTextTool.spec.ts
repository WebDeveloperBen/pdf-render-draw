import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useProvideTextTool, useTextToolState } from './useTextTool'
import type { TextAnnotation } from '~/types/annotations'

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

describe('useTextTool', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Injection State Pattern', () => {
    it('should provide and consume state correctly', () => {
      const result = withSetup(() => {
        const provider = useProvideTextTool()
        const consumer = useTextToolState()
        return { provider, consumer }
      })

      expect(result.provider).toBeDefined()
      expect(result.consumer).toBeDefined()
      expect(result.consumer?.completed).toBeDefined()
    })

    it('should return null when consumer called without provider', () => {
      const result = withSetup(() => useTextToolState())
      expect(result).toBeUndefined()
    })
  })

  describe('Text Annotation Creation', () => {
    it('should create text annotation with rotation stamping', () => {
      const tool = withSetup(() => useProvideTextTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      // Set rotation to 90 degrees
      rendererStore.setRotation(90)

      // Mock SVG and event
      const mockSvg = {
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform: () => ({ x: 100, y: 200 })
        }),
        getScreenCTM: () => ({ inverse: () => ({}) })
      } as unknown as SVGSVGElement

      const mockEvent = { currentTarget: mockSvg, clientX: 100, clientY: 200 } as MouseEvent

      tool.handleClick(mockEvent)

      const texts = annotationStore.annotations as TextAnnotation[]
      expect(texts).toHaveLength(1)
      expect(texts[0].rotation).toBe(-90) // Counter-rotated
      expect(texts[0].content).toBe('Double-click to edit')
      expect(texts[0].id).toBe('test-uuid-123')
    })

    it('should set text as editing after creation', () => {
      const tool = withSetup(() => useProvideTextTool())

      const mockSvg = {
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform: () => ({ x: 100, y: 200 })
        }),
        getScreenCTM: () => ({ inverse: () => ({}) })
      } as unknown as SVGSVGElement

      const mockEvent = { currentTarget: mockSvg, clientX: 100, clientY: 200 } as MouseEvent

      tool.handleClick(mockEvent)

      expect(tool.editingId.value).toBe('test-uuid-123')
      expect(tool.editingContent.value).toBe('Double-click to edit')
    })
  })

  describe('Page Awareness', () => {
    it('should only show text annotations from current page', () => {
      const tool = withSetup(() => useProvideTextTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      rendererStore.setCurrentPage(1)
      const text1: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Page 1',
        fontSize: 16,
        color: '#000000',
        rotation: 0
      }

      const text2: TextAnnotation = {
        id: 'text-2',
        type: 'text',
        pageNum: 2,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Page 2',
        fontSize: 16,
        color: '#000000',
        rotation: 0
      }

      annotationStore.addAnnotation(text1)
      annotationStore.addAnnotation(text2)

      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value[0].id).toBe('text-1')

      rendererStore.setCurrentPage(2)
      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value[0].id).toBe('text-2')
    })
  })

  describe('Editing Functionality', () => {
    it('should start editing on double-click', () => {
      const tool = withSetup(() => useProvideTextTool())
      const annotationStore = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Original content',
        fontSize: 16,
        color: '#000000',
        rotation: 0
      }

      annotationStore.addAnnotation(text)
      tool.handleDoubleClick('text-1')

      expect(tool.editingId.value).toBe('text-1')
      expect(tool.editingContent.value).toBe('Original content')
    })

    it('should finish editing and save content', () => {
      const tool = withSetup(() => useProvideTextTool())
      const annotationStore = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Original',
        fontSize: 16,
        color: '#000000',
        rotation: 0
      }

      annotationStore.addAnnotation(text)
      tool.handleDoubleClick('text-1')
      tool.editingContent.value = 'Modified content'
      tool.finishEditing()

      const updated = annotationStore.getAnnotationById('text-1') as TextAnnotation
      expect(updated.content).toBe('Modified content')
      expect(tool.editingId.value).toBeNull()
    })
  })

  describe('Selection and Deletion', () => {
    it('should select text annotation', () => {
      const tool = withSetup(() => useProvideTextTool())
      const annotationStore = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
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

      annotationStore.addAnnotation(text)
      tool.selectAnnotation('text-1')

      expect(annotationStore.selectedAnnotationId).toBe('text-1')
      expect(tool.selected.value?.id).toBe('text-1')
    })

    it('should delete text annotation', () => {
      const tool = withSetup(() => useProvideTextTool())
      const annotationStore = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
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

      annotationStore.addAnnotation(text)
      expect(annotationStore.annotations).toHaveLength(1)

      tool.deleteText('text-1')
      expect(annotationStore.annotations).toHaveLength(0)
    })
  })

  describe('Rotation Stamping Regression Prevention', () => {
    it('should maintain rotation as a static value (stamp behavior)', () => {
      const tool = withSetup(() => useProvideTextTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      rendererStore.setRotation(90)

      const mockSvg = {
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform: () => ({ x: 100, y: 200 })
        }),
        getScreenCTM: () => ({ inverse: () => ({}) })
      } as unknown as SVGSVGElement

      const mockEvent = { currentTarget: mockSvg, clientX: 100, clientY: 200 } as MouseEvent

      tool.handleClick(mockEvent)

      const text = annotationStore.annotations[0] as TextAnnotation
      const originalRotation = text.rotation

      // Change page rotation
      rendererStore.setRotation(180)

      // Text rotation should NOT change (it's stamped)
      expect(text.rotation).toBe(originalRotation)
      expect(text.rotation).toBe(-90)
    })
  })
})
