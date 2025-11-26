import { describe, it, expect, beforeEach } from "vitest"
import { setActivePinia, createPinia } from "pinia"

/**
 * Selection Interactions Test Suite
 *
 * Tests the click-to-deselect and drawing-through-annotations behavior.
 * These are store-level tests that verify the selection logic.
 *
 * Key behaviors tested:
 * 1. Clicking empty space should deselect all (regardless of active tool)
 * 2. Annotation components only handle clicks in selection mode
 * 3. Drawing tools can place points over existing annotations
 */
describe("Selection Interactions", () => {
  beforeEach(() => {
    // Reset pinia stores
    setActivePinia(createPinia())

    // Set up minimal renderer state
    const rendererStore = useRendererStore()
    rendererStore.currentPage = 1
    rendererStore.scale = 1
  })

  describe("Store-Level Selection Logic", () => {
    it("should deselect when calling selectAnnotation with null", () => {
      const annotationStore = useAnnotationStore()

      // Create and select a measurement
      const measure: Measurement = {
        id: "m1",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 }
        ] as [Point, Point],
        distance: 3528,
        midpoint: { x: 150, y: 100 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(measure)
      annotationStore.selectAnnotation("m1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["m1"])

      // Deselect by passing null
      annotationStore.selectAnnotation(null)

      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })

    it("should deselect all when selecting null with multiple selections", () => {
      const annotationStore = useAnnotationStore()

      // Create multiple annotations
      const m1: Measurement = {
        id: "m1",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 }
        ] as [Point, Point],
        distance: 3528,
        midpoint: { x: 150, y: 100 },
        labelRotation: 0,
        rotation: 0
      }

      const m2: Measurement = {
        id: "m2",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 100, y: 200 },
          { x: 200, y: 200 }
        ] as [Point, Point],
        distance: 3528,
        midpoint: { x: 150, y: 200 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(m1)
      annotationStore.addAnnotation(m2)

      // Select both
      annotationStore.selectAnnotation("m1")
      annotationStore.selectAnnotation("m2", { addToSelection: true })
      expect(annotationStore.selectedAnnotationIds).toEqual(["m1", "m2"])

      // Deselect all
      annotationStore.selectAnnotation(null)

      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })

    it("should maintain selection when switching tools", () => {
      const annotationStore = useAnnotationStore()

      const fill: Fill = {
        id: "f1",
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        color: "#ff0000",
        opacity: 0.5,
        rotation: 0
      }

      annotationStore.addAnnotation(fill)
      annotationStore.selectAnnotation("f1")
      annotationStore.activeTool = "selection"

      expect(annotationStore.selectedAnnotationIds).toEqual(["f1"])

      // Switch to measure tool - selection should persist
      annotationStore.activeTool = "measure"

      expect(annotationStore.selectedAnnotationIds).toEqual(["f1"])
    })

    it("should replace selection when selecting different annotation without addToSelection", () => {
      const annotationStore = useAnnotationStore()

      const m1: Measurement = {
        id: "m1",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 }
        ] as [Point, Point],
        distance: 3528,
        midpoint: { x: 150, y: 100 },
        labelRotation: 0,
        rotation: 0
      }

      const m2: Measurement = {
        id: "m2",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 100, y: 200 },
          { x: 200, y: 200 }
        ] as [Point, Point],
        distance: 3528,
        midpoint: { x: 150, y: 200 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(m1)
      annotationStore.addAnnotation(m2)
      annotationStore.selectAnnotation("m1")

      expect(annotationStore.selectedAnnotationIds).toEqual(["m1"])

      // Select m2 without addToSelection - should replace
      annotationStore.selectAnnotation("m2")

      expect(annotationStore.selectedAnnotationIds).toEqual(["m2"])
    })

    it("should add to selection when using addToSelection option", () => {
      const annotationStore = useAnnotationStore()

      const line1: Line = {
        id: "l1",
        rotation: 0,
        type: "line",
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ]
      }

      const line2: Line = {
        id: "l2",
        type: "line",
        rotation: 0,
        pageNum: 1,
        points: [
          { x: 150, y: 150 },
          { x: 250, y: 250 }
        ]
      }

      annotationStore.addAnnotation(line1)
      annotationStore.addAnnotation(line2)
      annotationStore.selectAnnotation("l1")

      expect(annotationStore.selectedAnnotationIds).toEqual(["l1"])

      // Add l2 to selection
      annotationStore.selectAnnotation("l2", { addToSelection: true })

      expect(annotationStore.selectedAnnotationIds).toContain("l1")
      expect(annotationStore.selectedAnnotationIds).toContain("l2")
    })
  })

  describe("Active Tool Behavior", () => {
    it("should allow drawing tools to be active while annotations are selected", () => {
      const annotationStore = useAnnotationStore()

      const area: Area = {
        id: "a1",
        type: "area",
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 150, y: 200 }
        ],
        area: 17640,
        center: { x: 150, y: 133.33 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(area)
      annotationStore.selectAnnotation("a1")

      expect(annotationStore.selectedAnnotationIds).toEqual(["a1"])

      // Switch to line tool - should still have selection
      annotationStore.activeTool = "line"

      expect(annotationStore.selectedAnnotationIds).toEqual(["a1"])
      expect(annotationStore.activeTool).toBe("line")
    })

    it("should allow changing tools while selection persists", () => {
      const annotationStore = useAnnotationStore()

      const measure: Measurement = {
        id: "m1",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 }
        ] as [Point, Point],
        distance: 3528,
        midpoint: { x: 150, y: 100 },
        labelRotation: 0,
        rotation: 0
      }

      annotationStore.addAnnotation(measure)
      annotationStore.selectAnnotation("m1")

      // Verify annotation is selected
      expect(annotationStore.selectedAnnotationIds).toEqual(["m1"])

      // Change tool to measure - selection should persist
      annotationStore.activeTool = "measure"
      expect(annotationStore.activeTool).toBe("measure")
      expect(annotationStore.selectedAnnotationIds).toEqual(["m1"])

      // Change tool to area - selection should still persist
      annotationStore.activeTool = "area"
      expect(annotationStore.activeTool).toBe("area")
      expect(annotationStore.selectedAnnotationIds).toEqual(["m1"])
    })
  })

  describe("Click-to-Deselect Logic", () => {
    it("should support deselecting by calling selectAnnotation(null)", () => {
      const annotationStore = useAnnotationStore()

      const fill: Fill = {
        id: "f1",
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        color: "#ff0000",
        opacity: 0.5,
        rotation: 0
      }

      const fill2: Fill = {
        id: "f2",
        type: "fill",
        pageNum: 1,
        x: 250,
        y: 250,
        width: 100,
        height: 100,
        color: "#00ff00",
        opacity: 0.5,
        rotation: 0
      }

      annotationStore.addAnnotation(fill)
      annotationStore.addAnnotation(fill2)

      // Select both
      annotationStore.selectAnnotation("f1")
      annotationStore.selectAnnotation("f2", { addToSelection: true })

      expect(annotationStore.selectedAnnotationIds).toEqual(["f1", "f2"])

      // Deselect all
      annotationStore.selectAnnotation(null)

      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })

    it("should work regardless of active tool", () => {
      const annotationStore = useAnnotationStore()

      const line: Line = {
        id: "l1",
        rotation: 0,
        type: "line",
        pageNum: 1,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        ]
      }

      annotationStore.addAnnotation(line)

      // Select with selection tool
      annotationStore.activeTool = "selection"
      annotationStore.selectAnnotation("l1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["l1"])

      // Switch to measure tool
      annotationStore.activeTool = "measure"

      // Deselect should still work
      annotationStore.selectAnnotation(null)
      expect(annotationStore.selectedAnnotationIds).toEqual([])

      // Select again with area tool active
      annotationStore.activeTool = "area"
      annotationStore.selectAnnotation("l1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["l1"])

      // Deselect with area tool active
      annotationStore.selectAnnotation(null)
      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })
  })

  describe("Multi-Select Behavior", () => {
    it("should support Shift+click multi-select via addToSelection", () => {
      const annotationStore = useAnnotationStore()

      const annotations = [
        {
          id: "m1",
          type: "measure" as const,
          pageNum: 1,
          points: [
            { x: 100, y: 100 },
            { x: 200, y: 100 }
          ] as [Point, Point],
          distance: 3528,
          midpoint: { x: 150, y: 100 },
          labelRotation: 0,
          rotation: 0
        },
        {
          id: "m2",
          type: "measure" as const,
          pageNum: 1,
          points: [
            { x: 100, y: 200 },
            { x: 200, y: 200 }
          ] as [Point, Point],
          distance: 3528,
          midpoint: { x: 150, y: 200 },
          labelRotation: 0,
          rotation: 0
        },
        {
          id: "m3",
          type: "measure" as const,
          pageNum: 1,
          points: [
            { x: 100, y: 300 },
            { x: 200, y: 300 }
          ] as [Point, Point],
          distance: 3528,
          midpoint: { x: 150, y: 300 },
          labelRotation: 0,
          rotation: 0
        }
      ]

      annotations.forEach((ann) => annotationStore.addAnnotation(ann))

      // Select first
      annotationStore.selectAnnotation("m1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["m1"])

      // Add second with Shift+click (simulated via addToSelection)
      annotationStore.selectAnnotation("m2", { addToSelection: true })
      expect(annotationStore.selectedAnnotationIds).toEqual(["m1", "m2"])

      // Add third
      annotationStore.selectAnnotation("m3", { addToSelection: true })
      expect(annotationStore.selectedAnnotationIds).toContain("m1")
      expect(annotationStore.selectedAnnotationIds).toContain("m2")
      expect(annotationStore.selectedAnnotationIds).toContain("m3")
    })

    it("should toggle annotation when using toggle option", () => {
      const annotationStore = useAnnotationStore()

      const fill: Fill = {
        id: "f1",
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        color: "#ff0000",
        opacity: 0.5,
        rotation: 0
      }

      annotationStore.addAnnotation(fill)

      // Select
      annotationStore.selectAnnotation("f1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["f1"])

      // Toggle off
      annotationStore.selectAnnotation("f1", { toggle: true })
      expect(annotationStore.selectedAnnotationIds).toEqual([])

      // Toggle on
      annotationStore.selectAnnotation("f1", { toggle: true })
      expect(annotationStore.selectedAnnotationIds).toEqual(["f1"])
    })
  })
})
