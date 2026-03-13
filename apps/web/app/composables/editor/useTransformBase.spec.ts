import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { defineComponent, h } from "vue"
import { mount } from "@vue/test-utils"
import { useTransformBase } from "./useTransformBase"
import type { TransformHandlers } from "./useTransformBase"

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

// Helper to create mock SVG element with coordinate conversion
function createMockSvgWithCoords(x: number, y: number) {
  return {
    ownerSVGElement: {
      createSVGPoint: () => ({
        x: 0,
        y: 0,
        matrixTransform: vi.fn(() => ({ x, y }))
      }),
      getScreenCTM: () => ({ inverse: () => ({}) })
    } as unknown as SVGSVGElement
  } as unknown as SVGGElement
}

function createMockSvg() {
  return createMockSvgWithCoords(100, 200)
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
    target: mockSvg,
    currentTarget: mockSvg,
    clientX: x,
    clientY: y,
    shiftKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as unknown as MouseEvent
}

describe("useTransformBase", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe("Initialization", () => {
    it("should initialize drag state correctly", () => {
      const transform = withSetup(() => useTransformBase())

      expect(transform.isDragging.value).toBe(false)
      expect(transform.activeHandle.value).toBeNull()
      expect(transform.dragMode.value).toBeNull()
      expect(transform.dragStart.value).toBeNull()
      expect(transform.originalBounds.value).toBeNull()
      expect(transform.startRotationAngle.value).toBe(0)
      expect(transform.currentRotationDelta.value).toBe(0)
      expect(transform.isShiftPressed.value).toBe(false)
      expect(transform.hasMoved.value).toBe(false)
    })

    it("should initialize svgRef as null", () => {
      const transform = withSetup(() => useTransformBase())

      expect(transform.svgRef.value).toBeNull()
    })
  })

  describe("getSvgPoint", () => {
    it("should convert screen coordinates to SVG coordinates", () => {
      const transform = withSetup(() => useTransformBase())

      // Set up mock SVG element with specific coordinates
      transform.svgRef.value = createMockSvgWithCoords(150, 250)

      const mockEvent = createMockMouseEvent(150, 250)
      const svgPoint = transform.getSvgPoint(mockEvent)

      expect(svgPoint).toEqual({ x: 150, y: 250 })
    })

    it("should return null when svgRef is null", () => {
      const transform = withSetup(() => useTransformBase())

      // svgRef is null by default
      const mockEvent = createMockMouseEvent(150, 250)
      const svgPoint = transform.getSvgPoint(mockEvent)

      expect(svgPoint).toBeNull()
    })

    it("should return null when ownerSVGElement is null", () => {
      const transform = withSetup(() => useTransformBase())

      // Set svgRef but with null ownerSVGElement
      transform.svgRef.value = { ownerSVGElement: null } as unknown as SVGGElement

      const mockEvent = createMockMouseEvent(150, 250)
      const svgPoint = transform.getSvgPoint(mockEvent)

      expect(svgPoint).toBeNull()
    })
  })

  describe("startDrag", () => {
    it("should set isDragging to true", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const mockEvent = createMockMouseEvent(150, 150)

      transform.startDrag(mockEvent, "top-left", "resize", bounds)

      expect(transform.isDragging.value).toBe(true)
    })

    it("should capture dragStart point", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvgWithCoords(150, 150)

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const mockEvent = createMockMouseEvent(150, 150)

      transform.startDrag(mockEvent, "top-left", "resize", bounds)

      expect(transform.dragStart.value).toEqual({ x: 150, y: 150 })
    })

    it("should set drag mode to resize", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const mockEvent = createMockMouseEvent(150, 150)

      transform.startDrag(mockEvent, "top-left", "resize", bounds)

      expect(transform.dragMode.value).toBe("resize")
    })

    it("should set drag mode to rotate", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const mockEvent = createMockMouseEvent(150, 150)

      transform.startDrag(mockEvent, "rotation", "rotate", bounds)

      expect(transform.dragMode.value).toBe("rotate")
    })

    it("should set drag mode to move", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const mockEvent = createMockMouseEvent(150, 150)

      transform.startDrag(mockEvent, "center", "move", bounds)

      expect(transform.dragMode.value).toBe("move")
    })

    it("should set activeHandle", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const mockEvent = createMockMouseEvent(150, 150)

      transform.startDrag(mockEvent, "bottom-right", "resize", bounds)

      expect(transform.activeHandle.value).toBe("bottom-right")
    })

    it("should store original bounds", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const mockEvent = createMockMouseEvent(150, 150)

      transform.startDrag(mockEvent, "top-left", "resize", bounds)

      expect(transform.originalBounds.value).toEqual(bounds)
    })

    it("should initialize hasMoved to false", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const mockEvent = createMockMouseEvent(150, 150)

      transform.startDrag(mockEvent, "top-left", "resize", bounds)

      expect(transform.hasMoved.value).toBe(false)
    })

    it("should call onStart callback if provided", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvgWithCoords(150, 150)

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const mockEvent = createMockMouseEvent(150, 150)
      const onStart = vi.fn()

      transform.startDrag(mockEvent, "top-left", "resize", bounds, onStart)

      expect(onStart).toHaveBeenCalledWith({ x: 150, y: 150 })
    })

    it("should prevent default and stop propagation", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const mockEvent = createMockMouseEvent(150, 150)

      transform.startDrag(mockEvent, "top-left", "resize", bounds)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it("should not start drag when getSvgPoint returns null", () => {
      const transform = withSetup(() => useTransformBase())
      // svgRef is null

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const mockEvent = createMockMouseEvent(150, 150)

      transform.startDrag(mockEvent, "top-left", "resize", bounds)

      expect(transform.isDragging.value).toBe(false)
      expect(transform.dragStart.value).toBeNull()
    })
  })

  describe("Mouse Move Handler", () => {
    it("should calculate delta correctly during resize", () => {
      const transform = withSetup(() => useTransformBase())

      const onResize = vi.fn()
      const handlers: TransformHandlers = {
        onResize,
        onRotate: vi.fn(),
        onMove: vi.fn(),
        onEndDrag: vi.fn()
      }

      transform.setupEventListeners(handlers)

      // Start drag at 150, 150
      transform.svgRef.value = createMockSvgWithCoords(150, 150)
      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const startEvent = createMockMouseEvent(150, 150)
      transform.startDrag(startEvent, "top-left", "resize", bounds)

      // Simulate pointermove to 200, 250
      transform.svgRef.value = createMockSvgWithCoords(200, 250)
      const moveEvent = createMockMouseEvent(200, 250)
      window.dispatchEvent(new PointerEvent("pointermove", moveEvent as any))

      expect(onResize).toHaveBeenCalledWith(50, 100) // delta = (200-150, 250-150)
    })

    it("should trigger rotate handler during rotation", () => {
      const transform = withSetup(() => useTransformBase())

      const onRotate = vi.fn()
      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate,
        onMove: vi.fn(),
        onEndDrag: vi.fn()
      }

      transform.setupEventListeners(handlers)

      // Start drag
      transform.svgRef.value = createMockSvgWithCoords(150, 150)
      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const startEvent = createMockMouseEvent(150, 150)
      transform.startDrag(startEvent, "rotation", "rotate", bounds)

      // Simulate pointermove
      transform.svgRef.value = createMockSvgWithCoords(200, 250)
      const moveEvent = createMockMouseEvent(200, 250)
      window.dispatchEvent(new PointerEvent("pointermove", moveEvent as any))

      expect(onRotate).toHaveBeenCalledWith(200, 250)
    })

    it("should trigger move handler during move", () => {
      const transform = withSetup(() => useTransformBase())

      const onMove = vi.fn()
      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate: vi.fn(),
        onMove,
        onEndDrag: vi.fn()
      }

      transform.setupEventListeners(handlers)

      // Start drag
      transform.svgRef.value = createMockSvgWithCoords(150, 150)
      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const startEvent = createMockMouseEvent(150, 150)
      transform.startDrag(startEvent, "center", "move", bounds)

      // Simulate pointermove
      transform.svgRef.value = createMockSvgWithCoords(200, 250)
      const moveEvent = createMockMouseEvent(200, 250)
      window.dispatchEvent(new PointerEvent("pointermove", moveEvent as any))

      expect(onMove).toHaveBeenCalledWith(50, 100)
    })

    it("should track hasMoved flag when mouse moves significantly", () => {
      const transform = withSetup(() => useTransformBase())

      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate: vi.fn(),
        onMove: vi.fn(),
        onEndDrag: vi.fn()
      }

      transform.setupEventListeners(handlers)

      // Start drag at 150, 150
      transform.svgRef.value = createMockSvgWithCoords(150, 150)
      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const startEvent = createMockMouseEvent(150, 150)
      transform.startDrag(startEvent, "center", "move", bounds)

      expect(transform.hasMoved.value).toBe(false)

      // Small move (< 1 pixel)
      transform.svgRef.value = createMockSvgWithCoords(150.5, 150.5)
      const smallMoveEvent = createMockMouseEvent(150.5, 150.5)
      window.dispatchEvent(new PointerEvent("pointermove", smallMoveEvent as any))

      expect(transform.hasMoved.value).toBe(false)

      // Significant move (> 1 pixel)
      transform.svgRef.value = createMockSvgWithCoords(200, 250)
      const largeMoveEvent = createMockMouseEvent(200, 250)
      window.dispatchEvent(new PointerEvent("pointermove", largeMoveEvent as any))

      expect(transform.hasMoved.value).toBe(true)
    })

    it("should not trigger handlers when not dragging", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate: vi.fn(),
        onMove: vi.fn(),
        onEndDrag: vi.fn()
      }

      transform.setupEventListeners(handlers)

      // No drag started
      const moveEvent = createMockMouseEvent(200, 250)
      window.dispatchEvent(new PointerEvent("pointermove", moveEvent as any))

      expect(handlers.onResize).not.toHaveBeenCalled()
      expect(handlers.onRotate).not.toHaveBeenCalled()
      expect(handlers.onMove).not.toHaveBeenCalled()
    })
  })

  describe("Mouse Up Handler", () => {
    it("should clear isDragging immediately", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate: vi.fn(),
        onMove: vi.fn(),
        onEndDrag: vi.fn()
      }

      transform.setupEventListeners(handlers)

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const startEvent = createMockMouseEvent(150, 150)
      transform.startDrag(startEvent, "center", "move", bounds)

      expect(transform.isDragging.value).toBe(true)

      // Trigger mouseup
      window.dispatchEvent(new PointerEvent("pointerup"))

      expect(transform.isDragging.value).toBe(false)
    })

    it("should clear rotationDragDelta immediately", () => {
      const transform = withSetup(() => useTransformBase())
      const annotationStore = useAnnotationStore()
      transform.svgRef.value = createMockSvg()

      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate: vi.fn(),
        onMove: vi.fn(),
        onEndDrag: vi.fn()
      }

      transform.setupEventListeners(handlers)

      // Set a rotation drag delta
      annotationStore.rotationDragDelta = 45

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const startEvent = createMockMouseEvent(150, 150)
      transform.startDrag(startEvent, "rotation", "rotate", bounds)

      // Trigger mouseup
      window.dispatchEvent(new PointerEvent("pointerup"))

      expect(annotationStore.rotationDragDelta).toBe(0)
    })

    it("should call onEndDrag handler with mode and hasMoved", () => {
      const transform = withSetup(() => useTransformBase())

      const onEndDrag = vi.fn()
      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate: vi.fn(),
        onMove: vi.fn(),
        onEndDrag
      }

      transform.setupEventListeners(handlers)

      // Start drag
      transform.svgRef.value = createMockSvgWithCoords(150, 150)
      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const startEvent = createMockMouseEvent(150, 150)
      transform.startDrag(startEvent, "center", "move", bounds)

      // Move significantly
      transform.svgRef.value = createMockSvgWithCoords(200, 250)
      const moveEvent = createMockMouseEvent(200, 250)
      window.dispatchEvent(new PointerEvent("pointermove", moveEvent as any))

      // Trigger mouseup
      window.dispatchEvent(new PointerEvent("pointerup"))

      expect(onEndDrag).toHaveBeenCalledWith("move", true) // true because hasMoved
    })

    it("should pass false for hasMoved if mouse did not move", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const onEndDrag = vi.fn()
      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate: vi.fn(),
        onMove: vi.fn(),
        onEndDrag
      }

      transform.setupEventListeners(handlers)

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const startEvent = createMockMouseEvent(150, 150)
      transform.startDrag(startEvent, "center", "move", bounds)

      // No mousemove, directly mouseup
      window.dispatchEvent(new PointerEvent("pointerup"))

      expect(onEndDrag).toHaveBeenCalledWith("move", false) // false because no movement
    })

    it("should clean up state after mouseup", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate: vi.fn(),
        onMove: vi.fn(),
        onEndDrag: vi.fn()
      }

      transform.setupEventListeners(handlers)

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const startEvent = createMockMouseEvent(150, 150)
      transform.startDrag(startEvent, "top-left", "resize", bounds)

      // Trigger mouseup
      window.dispatchEvent(new PointerEvent("pointerup"))

      expect(transform.activeHandle.value).toBeNull()
      expect(transform.dragMode.value).toBeNull()
      expect(transform.dragStart.value).toBeNull()
      expect(transform.originalBounds.value).toBeNull()
      expect(transform.startRotationAngle.value).toBe(0)
      expect(transform.currentRotationDelta.value).toBe(0)
      expect(transform.hasMoved.value).toBe(false)
    })

    it("should not call onEndDrag when mouseup without drag", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const onEndDrag = vi.fn()
      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate: vi.fn(),
        onMove: vi.fn(),
        onEndDrag
      }

      transform.setupEventListeners(handlers)

      // No drag started, just trigger mouseup
      window.dispatchEvent(new PointerEvent("pointerup"))

      expect(onEndDrag).not.toHaveBeenCalled()
    })
  })

  describe("Shift Key Tracking", () => {
    it("should track Shift key press", () => {
      const transform = withSetup(() => useTransformBase())

      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate: vi.fn(),
        onMove: vi.fn(),
        onEndDrag: vi.fn()
      }

      transform.setupEventListeners(handlers)

      expect(transform.isShiftPressed.value).toBe(false)

      // Press Shift
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }))

      expect(transform.isShiftPressed.value).toBe(true)
    })

    it("should track Shift key release", () => {
      const transform = withSetup(() => useTransformBase())

      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate: vi.fn(),
        onMove: vi.fn(),
        onEndDrag: vi.fn()
      }

      transform.setupEventListeners(handlers)

      // Press Shift
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }))

      expect(transform.isShiftPressed.value).toBe(true)

      // Release Shift
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }))

      expect(transform.isShiftPressed.value).toBe(false)
    })

    it("should not track other keys", () => {
      const transform = withSetup(() => useTransformBase())

      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate: vi.fn(),
        onMove: vi.fn(),
        onEndDrag: vi.fn()
      }

      transform.setupEventListeners(handlers)

      expect(transform.isShiftPressed.value).toBe(false)

      // Press other key
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }))

      expect(transform.isShiftPressed.value).toBe(false)
    })
  })

  describe("cleanupState", () => {
    it("should reset all state to initial values", () => {
      const transform = withSetup(() => useTransformBase())
      transform.svgRef.value = createMockSvg()

      const handlers: TransformHandlers = {
        onResize: vi.fn(),
        onRotate: vi.fn(),
        onMove: vi.fn(),
        onEndDrag: vi.fn()
      }

      transform.setupEventListeners(handlers)

      const bounds: Bounds = { x: 100, y: 100, width: 200, height: 100 }
      const startEvent = createMockMouseEvent(150, 150)
      transform.startDrag(startEvent, "top-left", "resize", bounds)

      // Set some values
      transform.startRotationAngle.value = 45
      transform.currentRotationDelta.value = 10

      // Cleanup
      transform.cleanupState()

      expect(transform.activeHandle.value).toBeNull()
      expect(transform.dragMode.value).toBeNull()
      expect(transform.dragStart.value).toBeNull()
      expect(transform.originalBounds.value).toBeNull()
      expect(transform.startRotationAngle.value).toBe(0)
      expect(transform.currentRotationDelta.value).toBe(0)
      expect(transform.hasMoved.value).toBe(false)
    })
  })
})
