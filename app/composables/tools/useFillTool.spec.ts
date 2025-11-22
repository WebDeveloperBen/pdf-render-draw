import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { defineComponent, h } from "vue"
import { mount } from "@vue/test-utils"
import { useFillTool, useFillToolState } from "./useFillTool"
import type { Fill } from "~/types/annotations"

// Mock UUID to make tests deterministic
vi.mock("uuid", () => ({
  v4: () => "test-fill-uuid-456"
}))

// Helper to create mock mouse event
function createMockMouseEvent(x: number, y: number, shiftKey = false, svgX?: number, svgY?: number): MouseEvent {
  const mockSvg = {
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform: () => ({ x: svgX ?? x, y: svgY ?? y })
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

// Helper to test composables within Vue setup context
function withSetup<T>(composable: () => T): T {
  let result: T
  const app = defineComponent({
    setup() {
      result = composable()
      return () => h("div")
    }
  })
  mount(app)
  return result!
}

describe("useFillTool", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe("Injection State Pattern", () => {
    it("should provide and consume state correctly", () => {
      const result = withSetup(() => {
        const provider = useFillTool()
        const consumer = useFillToolState()
        return { provider, consumer }
      })

      expect(result.provider).toBeDefined()
      expect(result.consumer).toBeDefined()
      expect(result.consumer?.completed).toBeDefined()
    })

    it("should return null when consumer called without provider", () => {
      const result = withSetup(() => useFillToolState())
      expect(result).toBeUndefined()
    })
  })

  describe("Fill Annotation Creation", () => {
    it("should create fill annotation on drag", () => {
      const tool = withSetup(() => useFillTool())
      const annotationStore = useAnnotationStore()
      const settingsStore = useSettingStore()

      settingsStore.updateFillToolSettings({
        fillColor: "#ff0000",
        opacity: 0.5
      })

      // Simulate mouse down
      const mockMouseDownEvent = createMockMouseEvent(150, 250)
      tool.handleMouseDown(mockMouseDownEvent)

      // Simulate mouse move
      const mockMouseMoveEvent = createMockMouseEvent(200, 300, false, 200, 300)
      tool.handleMouseMove(mockMouseMoveEvent)

      // Simulate mouse up
      const mockMouseUpEvent = createMockMouseEvent(200, 300, false, 200, 300)
      tool.handleMouseUp(mockMouseUpEvent)

      const fills = annotationStore.annotations as Fill[]
      expect(fills).toHaveLength(1)
      expect(fills[0]).toMatchObject({
        id: "test-fill-uuid-456",
        type: "fill",
        x: 150,
        y: 250,
        width: 50,
        height: 50,
        color: "#ff0000",
        opacity: 0.5
      })
    })

    it("should create fill with correct page number", () => {
      const tool = withSetup(() => useFillTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      rendererStore.setCurrentPage(3)

      // Simulate mouse down
      const mockMouseDownEvent = createMockMouseEvent(100, 200)
      tool.handleMouseDown(mockMouseDownEvent)

      // Simulate mouse move
      const mockMouseMoveEvent = createMockMouseEvent(150, 250, false, 150, 250)
      tool.handleMouseMove(mockMouseMoveEvent)

      // Simulate mouse up
      const mockMouseUpEvent = createMockMouseEvent(150, 250, false, 150, 250)
      tool.handleMouseUp(mockMouseUpEvent)

      const fills = annotationStore.annotations as Fill[]
      expect(fills).toHaveLength(1)
      expect(fills![0]!.pageNum).toBe(3)
    })
  })

  describe("Page Awareness", () => {
    it("should only show fill annotations from current page", () => {
      const tool = withSetup(() => useFillTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      rendererStore.setCurrentPage(1)
      const fill1: Fill = {
        id: "fill-1",

        rotation: 0,
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        color: "#ff0000",
        opacity: 0.5
      }

      const fill2: Fill = {
        id: "fill-2",
        type: "fill",
        rotation: 0,
        pageNum: 2,
        x: 200,
        y: 200,
        width: 50,
        height: 50,
        color: "#00ff00",
        opacity: 0.5
      }

      annotationStore.addAnnotation(fill1)
      annotationStore.addAnnotation(fill2)

      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value![0]!.id).toBe("fill-1")

      rendererStore.setCurrentPage(2)
      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value![0]!.id).toBe("fill-2")
    })

    it("should return empty array when page has no fills", () => {
      const tool = withSetup(() => useFillTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      const fill: Fill = {
        id: "fill-1",
        type: "fill",
        pageNum: 1,
        rotation: 0,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        color: "#ff0000",
        opacity: 0.5
      }

      annotationStore.addAnnotation(fill)

      rendererStore.setCurrentPage(2)
      expect(tool.completed.value).toHaveLength(0)
    })
  })

  describe("Selection and Deletion", () => {
    it("should select fill annotation", () => {
      const tool = withSetup(() => useFillTool())
      const annotationStore = useAnnotationStore()

      const fill: Fill = {
        id: "fill-1",
        type: "fill",
        rotation: 0,
        pageNum: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        color: "#ff0000",
        opacity: 0.5
      }

      annotationStore.addAnnotation(fill)
      tool.selectAnnotation("fill-1")

      expect(annotationStore.selectedAnnotationId).toBe("fill-1")
      expect(tool.selected.value?.id).toBe("fill-1")
    })

    it("should delete fill annotation", () => {
      const tool = withSetup(() => useFillTool())
      const annotationStore = useAnnotationStore()

      const fill: Fill = {
        id: "fill-1",
        type: "fill",
        pageNum: 1,
        x: 100,
        rotation: 0,
        y: 100,
        width: 50,
        height: 50,
        color: "#ff0000",
        opacity: 0.5
      }

      annotationStore.addAnnotation(fill)
      expect(annotationStore.annotations).toHaveLength(1)

      tool.deleteFill("fill-1")
      expect(annotationStore.annotations).toHaveLength(0)
    })
  })
})
