import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { defineComponent, h } from "vue"
import { mount } from "@vue/test-utils"
import { useAreaTool, useAreaToolState } from "./useAreaTool"
import type { Area } from "~/types/annotations"

// Mock UUID to make tests deterministic
vi.mock("uuid", () => ({
  v4: () => "test-uuid-area-123"
}))

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

describe("useAreaTool", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe("Injection State Pattern", () => {
    it("should provide and consume state correctly", () => {
      const result = withSetup(() => {
        const provider = useAreaTool()
        const consumer = useAreaToolState()
        return { provider, consumer }
      })

      expect(result.provider).toBeDefined()
      expect(result.consumer).toBeDefined()
      expect(result.consumer?.completed).toBeDefined()
    })

    it("should return undefined when consumer called without provider", () => {
      const result = withSetup(() => useAreaToolState())
      expect(result).toBeUndefined()
    })
  })

  describe("Point Placement", () => {
    it("should place first point on click", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      expect(annotationStore.isDrawing).toBe(false)

      const mockEvent = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent)

      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value).toHaveLength(1)
      expect(tool.points.value[0]).toEqual({ x: 100, y: 100 })
    })

    it("should place second point and continue drawing", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // First click
      const mockEvent1 = createMockMouseEvent(100, 100)
      tool.handleClick(mockEvent1)

      // Second click
      const mockEvent2 = createMockMouseEvent(200, 100)
      tool.handleClick(mockEvent2)

      // Should still be drawing (need minimum 3 points)
      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value).toHaveLength(2)
      expect(annotationStore.annotations).toHaveLength(0)
    })

    it("should place third point and continue drawing until closed", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Place 3 points
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))

      // Should still be drawing (not closed yet)
      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value).toHaveLength(3)
      expect(annotationStore.annotations).toHaveLength(0)
    })

    it("should not create area with less than 3 points", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Place only 2 points
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))

      expect(tool.points.value).toHaveLength(2)
      expect(annotationStore.annotations).toHaveLength(0)
    })
  })

  describe("Snap to Close Polygon", () => {
    it("should detect when near first point for closing", () => {
      const tool = withSetup(() => useAreaTool())

      // Place 3 points to form a triangle
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))

      // Move near the first point (within snap distance)
      const nearFirstPoint = createMockMouseEvent(105, 105)
      tool.handleMove(nearFirstPoint)

      expect(tool.canSnapToClose.value).toBe(true)
    })

    it("should complete polygon when clicking near first point", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Place 3 points
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))

      // Move near first point
      tool.handleMove(createMockMouseEvent(105, 105))

      // Click to close
      tool.handleClick(createMockMouseEvent(105, 105))

      // Should complete the area
      expect(annotationStore.isDrawing).toBe(false)
      expect(tool.points.value).toHaveLength(0) // Reset after completion
      expect(annotationStore.annotations).toHaveLength(1)

      const area = annotationStore.annotations[0] as Area
      expect(area.type).toBe("area")
      expect(area.points).toHaveLength(3)
    })
  })

  describe("Area Calculation", () => {
    it("should calculate polygon area", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Create a triangle: (0, 0), (100, 0), (50, 100)
      tool.handleClick(createMockMouseEvent(0, 0))
      tool.handleClick(createMockMouseEvent(100, 0))
      tool.handleClick(createMockMouseEvent(50, 100))

      // Close the polygon
      tool.handleMove(createMockMouseEvent(5, 5))
      tool.handleClick(createMockMouseEvent(5, 5))

      const area = annotationStore.annotations[0] as Area
      // Area should be calculated (exact value depends on scale/DPI)
      expect(area.area).toBeGreaterThan(0)
    })

    it("should calculate preview area while drawing", () => {
      const tool = withSetup(() => useAreaTool())

      // Place 2 points
      tool.handleClick(createMockMouseEvent(0, 0))
      tool.handleClick(createMockMouseEvent(100, 0))

      // Move mouse to create preview
      tool.handleMove(createMockMouseEvent(50, 100))

      expect(tool.previewArea.value).toBeGreaterThan(0)
    })

    it("should not show preview area with less than 2 points", () => {
      const tool = withSetup(() => useAreaTool())

      // Place only 1 point
      tool.handleClick(createMockMouseEvent(100, 100))

      expect(tool.previewArea.value).toBeNull()
    })

    it("should update preview area as mouse moves", () => {
      const tool = withSetup(() => useAreaTool())

      // Place 2 points
      tool.handleClick(createMockMouseEvent(0, 0))
      tool.handleClick(createMockMouseEvent(100, 0))

      // Move mouse to create small triangle
      tool.handleMove(createMockMouseEvent(50, 50))
      const smallArea = tool.previewArea.value

      // Move mouse to create larger triangle
      tool.handleMove(createMockMouseEvent(50, 200))
      const largeArea = tool.previewArea.value

      expect(largeArea).toBeGreaterThan(smallArea!)
    })
  })

  describe("Centroid Calculation", () => {
    it("should calculate centroid correctly", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Create a square: (0, 0), (100, 0), (100, 100), (0, 100)
      tool.handleClick(createMockMouseEvent(0, 0))
      tool.handleClick(createMockMouseEvent(100, 0))
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(0, 100))

      // Close polygon
      tool.handleMove(createMockMouseEvent(5, 5))
      tool.handleClick(createMockMouseEvent(5, 5))

      const area = annotationStore.annotations[0] as Area
      // Centroid of square should be near center (50, 50)
      expect(area.center.x).toBeCloseTo(50, 0)
      expect(area.center.y).toBeCloseTo(50, 0)
    })
  })

  describe("Preview Polygon", () => {
    it("should generate preview polygon path", () => {
      const tool = withSetup(() => useAreaTool())

      // Place 2 points
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))

      // Move mouse to show preview
      tool.handleMove(createMockMouseEvent(150, 200))

      expect(tool.previewPolygon.value).toBeDefined()
      expect(tool.previewPolygon.value).toContain("100,100")
      expect(tool.previewPolygon.value).toContain("200,100")
      expect(tool.previewPolygon.value).toContain("150,200")
    })

    it("should not show preview polygon before drawing starts", () => {
      const tool = withSetup(() => useAreaTool())

      expect(tool.previewPolygon.value).toBeNull()
    })

    it("should update preview polygon as points are added", () => {
      const tool = withSetup(() => useAreaTool())

      // Place first point
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleMove(createMockMouseEvent(150, 150))

      const firstPreview = tool.previewPolygon.value

      // Place second point
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleMove(createMockMouseEvent(150, 200))

      const secondPreview = tool.previewPolygon.value

      expect(firstPreview).not.toEqual(secondPreview)
    })
  })

  describe("Escape Key Cancellation", () => {
    it("should cancel area drawing on Escape key", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Start drawing
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))

      expect(annotationStore.isDrawing).toBe(true)
      expect(tool.points.value).toHaveLength(3)

      // Press Escape
      const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" })
      tool.handleKeyDown(escapeEvent)

      expect(annotationStore.isDrawing).toBe(false)
      expect(tool.points.value).toHaveLength(0)
      expect(annotationStore.annotations).toHaveLength(0)
    })

    it("should not affect completed areas on Escape", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Complete an area
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      expect(annotationStore.annotations).toHaveLength(1)

      // Press Escape
      const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" })
      tool.handleKeyDown(escapeEvent)

      // Area should still exist
      expect(annotationStore.annotations).toHaveLength(1)
    })
  })

  describe("Delete Key", () => {
    it("should delete selected area on Delete key", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Create and select area
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const area = annotationStore.annotations[0] as Area
      tool.selectAnnotation(area.id)

      expect(annotationStore.selectedAnnotationId).toBe(area.id)
      expect(annotationStore.annotations).toHaveLength(1)

      // Press Delete
      const deleteEvent = new KeyboardEvent("keydown", { key: "Delete" })
      tool.handleKeyDown(deleteEvent)

      expect(annotationStore.annotations).toHaveLength(0)
    })

    it("should delete selected area on Backspace key", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Create and select area
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const area = annotationStore.annotations[0] as Area
      tool.selectAnnotation(area.id)

      // Press Backspace
      const backspaceEvent = new KeyboardEvent("keydown", { key: "Backspace" })
      tool.handleKeyDown(backspaceEvent)

      expect(annotationStore.annotations).toHaveLength(0)
    })

    it("should not delete when nothing is selected", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Create area without selecting
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      expect(annotationStore.annotations).toHaveLength(1)

      // Press Delete without selection
      const deleteEvent = new KeyboardEvent("keydown", { key: "Delete" })
      tool.handleKeyDown(deleteEvent)

      // Area should still exist
      expect(annotationStore.annotations).toHaveLength(1)
    })
  })

  describe("45° Angle Snapping", () => {
    it("should snap to 45° when Shift pressed", () => {
      const tool = withSetup(() => useAreaTool())

      // Place first point
      tool.handleClick(createMockMouseEvent(100, 100))

      // Move with Shift (should snap)
      const mockEvent = createMockMouseEvent(150, 130, true)
      tool.handleMove(mockEvent)

      // Temp point should be snapped
      expect(tool.tempEndPoint.value).toBeDefined()
      expect(tool.tempEndPoint.value).not.toEqual({ x: 150, y: 130 })
    })

    it("should complete with snapped point when Shift pressed on click", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Place 3 points with Shift on last one
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 130, true)) // Shift - should snap

      // Close polygon
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const area = annotationStore.annotations[0] as Area
      expect(area.points[0]).toEqual({ x: 100, y: 100 })
      expect(area.points[1]).toEqual({ x: 200, y: 100 })
      // Third point should be snapped
      expect(area.points[2]).not.toEqual({ x: 150, y: 130 })
    })
  })

  describe("Page Awareness", () => {
    it("should only show areas from current page", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      // Set page 1
      rendererStore.setCurrentPage(1)

      // Create area on page 1
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value![0]!.pageNum).toBe(1)

      // Create another area on page 2
      const area2: Area = {
        id: "area-2",
        rotation: 0,
        type: "area",
        pageNum: 2,
        points: [
          { x: 300, y: 300 },
          { x: 400, y: 300 },
          { x: 350, y: 400 }
        ],
        area: 5000,
        center: { x: 350, y: 333 },
        labelRotation: 0
      }
      annotationStore.addAnnotation(area2)

      // Should still only show page 1 areas
      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value![0]!.pageNum).toBe(1)

      // Switch to page 2
      rendererStore.setCurrentPage(2)

      // Should now show page 2 areas
      expect(tool.completed.value).toHaveLength(1)
      expect(tool.completed.value![0]!.id).toBe("area-2")
      expect(tool.completed.value![0]!.pageNum).toBe(2)
    })
  })

  describe("Selection Behavior", () => {
    it("should select area", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Create area
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const area = annotationStore.annotations[0] as Area

      // Select it
      tool.selectAnnotation(area.id)

      expect(annotationStore.selectedAnnotationId).toBe(area.id)
      expect(tool.selected.value?.id).toBe(area.id)
    })

    it("should return null for selected when different type selected", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Create area
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      // Add different type annotation and select it
      const textAnnotation = {
        id: "text-1",
        type: "text" as const,
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000000",
        rotation: 0
      }
      annotationStore.addAnnotation(textAnnotation)
      annotationStore.selectAnnotation("text-1")

      // selected should be null (wrong type)
      expect(tool.selected.value).toBeNull()
    })
  })

  describe("Rotation Stamping", () => {
    it("should stamp counter-rotation from page rotation", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      // Set page rotation to 90 degrees
      rendererStore.setRotation(90)

      // Create area
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const area = annotationStore.annotations[0] as Area
      // Label should be counter-rotated to appear upright
      expect(area.labelRotation).toBe(-90)
    })

    it("should maintain rotation as static value (not reactive to page rotation)", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()
      const rendererStore = useRendererStore()

      // Set initial rotation
      rendererStore.setRotation(90)

      // Create area
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const area = annotationStore.annotations[0] as Area
      const originalRotation = area.labelRotation

      // Change page rotation
      rendererStore.setRotation(180)

      // Area rotation should NOT change (it's stamped)
      expect(area.labelRotation).toBe(originalRotation)
      expect(area.labelRotation).toBe(-90)
    })
  })

  describe("UUID Generation", () => {
    it("should generate unique ID for each area", () => {
      const tool = withSetup(() => useAreaTool())
      const annotationStore = useAnnotationStore()

      // Create area
      tool.handleClick(createMockMouseEvent(100, 100))
      tool.handleClick(createMockMouseEvent(200, 100))
      tool.handleClick(createMockMouseEvent(150, 200))
      tool.handleMove(createMockMouseEvent(105, 105))
      tool.handleClick(createMockMouseEvent(105, 105))

      const area = annotationStore.annotations[0] as Area
      expect(area.id).toBe("test-uuid-area-123")
      expect(area.id).toMatch(/^[a-z0-9-]+$/i)
    })
  })
})
