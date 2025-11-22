import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { mountSuspended } from "@nuxt/test-utils/runtime"
import SvgAnnotationLayer from "~/components/SvgAnnotationLayer.vue"
import { useAnnotationStore } from "~/stores/annotations"
import { useRendererStore } from "~/stores/renderer"
import { useSettingStore } from "~/stores/settings"
import type { Fill, Measure } from "~/types/annotations"
import { v4 as uuidv4 } from "uuid"

describe("Tool Interaction Behavior", () => {
  let annotationStore: ReturnType<typeof useAnnotationStore>
  let rendererStore: ReturnType<typeof useRendererStore>

  beforeEach(() => {
    // Reset pinia stores
    setActivePinia(createPinia())

    annotationStore = useAnnotationStore()
    rendererStore = useRendererStore()
    const settingsStore = useSettingStore()

    // Setup basic canvas/PDF state
    rendererStore.setCanvasSize({ width: 1000, height: 1000 })
    rendererStore.setCurrentPage(1)
  })

  describe("Click to Deselect", () => {
    it("should deselect all annotations when clicking empty space in selection mode", async () => {
      // Create and select an annotation
      const fill: Fill = {
        id: uuidv4(),
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        color: "#ff0000",
        opacity: 0.5
      }
      annotationStore.addAnnotation(fill)
      annotationStore.selectAnnotation(fill.id)

      expect(annotationStore.selectedAnnotationIds).toContain(fill.id)

      // Mount component
      const wrapper = await mountSuspended(SvgAnnotationLayer)
      const svg = wrapper.find("svg")

      // Click empty space (not on the fill)
      await svg.trigger("click", {
        clientX: 500,
        clientY: 500
      })

      // Should deselect
      expect(annotationStore.selectedAnnotationIds).toHaveLength(0)
    })

    it("should deselect when clicking empty space with measure tool active", async () => {
      // Create and select an annotation
      const fill: Fill = {
        id: uuidv4(),
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        color: "#ff0000",
        opacity: 0.5
      }
      annotationStore.addAnnotation(fill)
      annotationStore.selectAnnotation(fill.id)
      annotationStore.setActiveTool("measure")

      expect(annotationStore.selectedAnnotationIds).toContain(fill.id)

      const wrapper = await mountSuspended(SvgAnnotationLayer)
      const svg = wrapper.find("svg")

      // Click empty space
      await svg.trigger("click", {
        clientX: 500,
        clientY: 500
      })

      // Should deselect
      expect(annotationStore.selectedAnnotationIds).toHaveLength(0)
    })

    it("should deselect multiple selected annotations when clicking empty space", async () => {
      // Create and select multiple annotations
      const fill1: Fill = {
        id: uuidv4(),
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
        id: uuidv4(),
        type: "fill",
        pageNum: 1,
        x: 200,
        y: 200,
        width: 50,
        height: 50,
        color: "#00ff00",
        opacity: 0.5
      }
      annotationStore.addAnnotation(fill1)
      annotationStore.addAnnotation(fill2)
      annotationStore.selectAnnotation(fill1.id)
      annotationStore.selectAnnotation(fill2.id, { addToSelection: true })

      expect(annotationStore.selectedAnnotationIds).toHaveLength(2)

      const wrapper = await mountSuspended(SvgAnnotationLayer)
      const svg = wrapper.find("svg")

      // Click empty space
      await svg.trigger("click", {
        clientX: 500,
        clientY: 500
      })

      // Should deselect all
      expect(annotationStore.selectedAnnotationIds).toHaveLength(0)
    })

    it("should NOT deselect while actively drawing", async () => {
      // Create and select an annotation
      const fill: Fill = {
        id: uuidv4(),
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        color: "#ff0000",
        opacity: 0.5
      }
      annotationStore.addAnnotation(fill)
      annotationStore.selectAnnotation(fill.id)
      annotationStore.setActiveTool("area")

      const wrapper = await mountSuspended(SvgAnnotationLayer)
      const svg = wrapper.find("svg")

      // Start drawing - first click
      await svg.trigger("click", {
        clientX: 300,
        clientY: 300
      })

      expect(annotationStore.isDrawing).toBe(true)

      // Second click while drawing
      await svg.trigger("click", {
        clientX: 400,
        clientY: 400
      })

      // Should still have selection (not deselected because we're drawing)
      expect(annotationStore.selectedAnnotationIds).toContain(fill.id)
    })
  })

  describe("Drawing Through Existing Annotations", () => {
    it("should place measure points when clicking on existing fill with measure tool active", async () => {
      // Create a fill annotation
      const fill: Fill = {
        id: uuidv4(),
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        color: "#ff0000",
        opacity: 0.5
      }
      annotationStore.addAnnotation(fill)
      annotationStore.setActiveTool("measure")

      const wrapper = await mountSuspended(SvgAnnotationLayer)
      const svg = wrapper.find("svg")

      // Click inside the fill area to start measuring
      await svg.trigger("click", {
        clientX: 150,
        clientY: 150
      })

      expect(annotationStore.isDrawing).toBe(true)

      // Second click (also inside fill area)
      await svg.trigger("click", {
        clientX: 250,
        clientY: 250
      })

      // Should have created a measurement
      const measures = annotationStore.getAnnotationsByType("measure")
      expect(measures).toHaveLength(1)

      // Fill should NOT be selected
      expect(annotationStore.selectedAnnotationIds).not.toContain(fill.id)
    })

    it("should place area points when clicking on existing measurement with area tool active", async () => {
      // Create a measurement annotation
      const measure: Measure = {
        id: uuidv4(),
        type: "measure",
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ],
        distance: 3536,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0
      }
      annotationStore.addAnnotation(measure)
      annotationStore.setActiveTool("area")

      const wrapper = await mountSuspended(SvgAnnotationLayer)
      const svg = wrapper.find("svg")

      // Click three points that cross over the measurement line
      await svg.trigger("click", { clientX: 120, clientY: 120 })
      await svg.trigger("click", { clientX: 180, clientY: 180 })
      await svg.trigger("click", { clientX: 150, clientY: 250 })

      expect(annotationStore.isDrawing).toBe(true)

      // Close the area by clicking near the first point
      await svg.trigger("mousemove", { clientX: 125, clientY: 125 })
      await svg.trigger("click", { clientX: 125, clientY: 125 })

      // Should have created an area
      const areas = annotationStore.getAnnotationsByType("area")
      expect(areas).toHaveLength(1)

      // Measurement should NOT be selected
      expect(annotationStore.selectedAnnotationIds).not.toContain(measure.id)
    })

    it("should allow drawing line tool over multiple existing annotations", async () => {
      // Create multiple annotations
      const fill1: Fill = {
        id: uuidv4(),
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        color: "#ff0000",
        opacity: 0.5
      }
      const fill2: Fill = {
        id: uuidv4(),
        type: "fill",
        pageNum: 1,
        x: 300,
        y: 300,
        width: 100,
        height: 100,
        color: "#00ff00",
        opacity: 0.5
      }
      annotationStore.addAnnotation(fill1)
      annotationStore.addAnnotation(fill2)
      annotationStore.setActiveTool("line")

      const wrapper = await mountSuspended(SvgAnnotationLayer)
      const svg = wrapper.find("svg")

      // Draw line from inside fill1 to inside fill2
      await svg.trigger("click", { clientX: 150, clientY: 150 })
      await svg.trigger("click", { clientX: 350, clientY: 350 })

      // Should have created a line
      const lines = annotationStore.getAnnotationsByType("line")
      expect(lines).toHaveLength(1)

      // Neither fill should be selected
      expect(annotationStore.selectedAnnotationIds).not.toContain(fill1.id)
      expect(annotationStore.selectedAnnotationIds).not.toContain(fill2.id)
    })
  })

  describe("Selection Mode Annotation Clicks", () => {
    it("should select annotation when clicked in selection mode", async () => {
      const fill: Fill = {
        id: uuidv4(),
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        color: "#ff0000",
        opacity: 0.5
      }
      annotationStore.addAnnotation(fill)
      annotationStore.setActiveTool("selection")

      const wrapper = await mountSuspended(SvgAnnotationLayer)

      // Find the fill element and click it
      const fillElement = wrapper.find(`[data-annotation-id="${fill.id}"]`)
      expect(fillElement.exists()).toBe(true)

      await fillElement.trigger("click")

      // Should be selected
      expect(annotationStore.selectedAnnotationIds).toContain(fill.id)
    })

    it("should NOT select annotation when clicked with drawing tool active", async () => {
      const fill: Fill = {
        id: uuidv4(),
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        color: "#ff0000",
        opacity: 0.5
      }
      annotationStore.addAnnotation(fill)
      annotationStore.setActiveTool("measure")

      const wrapper = await mountSuspended(SvgAnnotationLayer)

      // Find the fill element and click it
      const fillElement = wrapper.find(`[data-annotation-id="${fill.id}"]`)
      expect(fillElement.exists()).toBe(true)

      await fillElement.trigger("click")

      // Should NOT be selected (measure tool is active)
      expect(annotationStore.selectedAnnotationIds).not.toContain(fill.id)
    })

    it("should select annotation when clicked with empty tool (no active tool)", async () => {
      const fill: Fill = {
        id: uuidv4(),
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        color: "#ff0000",
        opacity: 0.5
      }
      annotationStore.addAnnotation(fill)
      annotationStore.setActiveTool("")

      const wrapper = await mountSuspended(SvgAnnotationLayer)

      // Find the fill element and click it
      const fillElement = wrapper.find(`[data-annotation-id="${fill.id}"]`)
      expect(fillElement.exists()).toBe(true)

      await fillElement.trigger("click")

      // Should be selected (empty tool acts like selection)
      expect(annotationStore.selectedAnnotationIds).toContain(fill.id)
    })
  })

  describe("Edge Cases", () => {
    it("should not deselect during marquee selection", async () => {
      const fill: Fill = {
        id: uuidv4(),
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        color: "#ff0000",
        opacity: 0.5
      }
      annotationStore.addAnnotation(fill)
      annotationStore.selectAnnotation(fill.id)
      annotationStore.setActiveTool("selection")

      const wrapper = await mountSuspended(SvgAnnotationLayer)
      const svg = wrapper.find("svg")

      // Start marquee selection by mousedown on empty space
      await svg.trigger("mousedown", { clientX: 300, clientY: 300 })

      // The click handler should not deselect during marquee
      // (This is tested indirectly - marquee sets isDrawing flag)
      expect(annotationStore.selectedAnnotationIds).toContain(fill.id)
    })

    it("should handle click on annotation that doesn't exist anymore", async () => {
      annotationStore.setActiveTool("selection")

      const wrapper = await mountSuspended(SvgAnnotationLayer)
      const svg = wrapper.find("svg")

      // Create a fake click event with non-existent annotation ID
      const fakeElement = document.createElement("div")
      fakeElement.setAttribute("data-annotation-id", "non-existent-id")

      // This shouldn't throw an error
      await svg.trigger("click", {
        target: fakeElement
      })

      expect(annotationStore.selectedAnnotationIds).toHaveLength(0)
    })

    it("should allow switching from drawing tool to selection mid-drawing", async () => {
      annotationStore.setActiveTool("perimeter")

      const wrapper = await mountSuspended(SvgAnnotationLayer)
      const svg = wrapper.find("svg")

      // Start drawing perimeter
      await svg.trigger("click", { clientX: 100, clientY: 100 })
      await svg.trigger("click", { clientX: 200, clientY: 100 })

      expect(annotationStore.isDrawing).toBe(true)

      // Switch to selection tool mid-drawing
      annotationStore.setActiveTool("selection")

      // Create a fill to select
      const fill: Fill = {
        id: uuidv4(),
        type: "fill",
        pageNum: 1,
        x: 300,
        y: 300,
        width: 100,
        height: 100,
        color: "#ff0000",
        opacity: 0.5
      }
      annotationStore.addAnnotation(fill)

      await wrapper.vm.$nextTick()

      // Click on the fill
      const fillElement = wrapper.find(`[data-annotation-id="${fill.id}"]`)
      await fillElement.trigger("click")

      // Should select the fill (not continue perimeter drawing)
      expect(annotationStore.selectedAnnotationIds).toContain(fill.id)
    })
  })
})
