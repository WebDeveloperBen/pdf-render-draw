import { describe, it, expect, beforeEach } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useAnnotationStore } from "./annotations"

describe("Annotation Store", () => {
  beforeEach(() => {
    // Create a fresh pinia instance for each test
    setActivePinia(createPinia())
  })

  describe("Page Filtering", () => {
    it("should filter annotations by page number", () => {
      const store = useAnnotationStore()

      const page1Text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Page 1 text",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      const page2Text: TextAnnotation = {
        id: "text-2",
        type: "text",
        pageNum: 2,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Page 2 text",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(page1Text)
      store.addAnnotation(page2Text)

      // Get annotations for page 1
      const page1Annotations = store.getAnnotationsByTypeAndPage("text", 1)
      expect(page1Annotations).toHaveLength(1)
      expect(page1Annotations[0]?.id).toBe("text-1")

      // Get annotations for page 2
      const page2Annotations = store.getAnnotationsByTypeAndPage("text", 2)
      expect(page2Annotations).toHaveLength(1)
      expect(page2Annotations[0]?.id).toBe("text-2")
    })

    it("should return empty array for page with no annotations", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Page 1 text",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text)

      // Page 2 should have no annotations
      const page2Annotations = store.getAnnotationsByTypeAndPage("text", 2)
      expect(page2Annotations).toHaveLength(0)
    })

    it("should filter by both type and page", () => {
      const store = useAnnotationStore()

      const page1Text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Text",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      const page1Measure: Measurement = {
        id: "measure-1",
        rotation: 0,
        type: "measure",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 }
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0
      }

      store.addAnnotation(page1Text)
      store.addAnnotation(page1Measure)

      // Should only get text annotations
      const textAnnotations = store.getAnnotationsByTypeAndPage("text", 1)
      expect(textAnnotations).toHaveLength(1)
      expect(textAnnotations[0]?.type).toBe("text")

      // Should only get measure annotations
      const measureAnnotations = store.getAnnotationsByTypeAndPage("measure", 1)
      expect(measureAnnotations).toHaveLength(1)
      expect(measureAnnotations[0]?.type).toBe("measure")
    })
  })

  describe("Annotation CRUD Operations", () => {
    it("should add annotation", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text)

      expect(store.annotations).toHaveLength(1)
      expect(store.annotations[0]?.id).toBe("text-1")
    })

    it("should update annotation", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Original",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text)
      store.updateAnnotation("text-1", { content: "Updated" })

      const updated = store.getAnnotationById("text-1") as TextAnnotation
      expect(updated.content).toBe("Updated")
    })

    it("should delete annotation", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text)
      expect(store.annotations).toHaveLength(1)

      store.deleteAnnotation("text-1")
      expect(store.annotations).toHaveLength(0)
    })

    it("should get annotation by id", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text)

      const found = store.getAnnotationById("text-1")
      expect(found).toBeDefined()
      expect(found?.id).toBe("text-1")
    })
  })

  describe("Selection", () => {
    it("should select annotation", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text)
      store.selectAnnotation("text-1")

      expect(store.selectedAnnotationId).toBe("text-1")
      expect(store.selectedAnnotation?.id).toBe("text-1")
    })

    it("should deselect annotation", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text)
      store.selectAnnotation("text-1")
      expect(store.selectedAnnotationId).toBe("text-1")

      store.selectAnnotation(null)
      expect(store.selectedAnnotationId).toBeNull()
      expect(store.selectedAnnotation).toBeNull()
    })
  })

  describe("Derived Value Recalculation (Label Position Update)", () => {
    it("should recalculate distance and midpoint when measurement points are updated", () => {
      const store = useAnnotationStore()

      const measurement: Measurement = {
        id: "measure-1",
        rotation: 0,
        type: "measure",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        distance: 3528, // Calculated distance at 1:100 scale (100 PDF points = 3528mm)
        midpoint: { x: 50, y: 0 }, // Original midpoint
        labelRotation: 0
      }

      store.addAnnotation(measurement)

      // Simulate dragging the measurement to a new position (translate by +50, +50)
      const newPoints: [Point, Point] = [
        { x: 50, y: 50 },
        { x: 150, y: 50 }
      ]

      store.updateAnnotation(measurement.id, { points: newPoints })

      const updated = store.getAnnotationById(measurement.id) as Measurement

      // Distance should be recalculated but stay the same (same length line)
      expect(updated.distance).toBe(3528) // 100 PDF points at 1:100 scale

      // Midpoint should be updated to new position
      expect(updated.midpoint.x).toBe(100) // (50 + 150) / 2
      expect(updated.midpoint.y).toBe(50) // (50 + 50) / 2
    })

    it("should recalculate area and center when area points are updated", () => {
      const store = useAnnotationStore()

      const area: Area = {
        id: "area-1",
        rotation: 0,
        type: "area",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        area: 12.45, // Original area at 1:100 scale
        center: { x: 50, y: 50 }, // Original center
        labelRotation: 0
      }

      store.addAnnotation(area)

      // Simulate dragging the area to a new position (translate by +50, +50)
      const newPoints: Point[] = [
        { x: 50, y: 50 },
        { x: 150, y: 50 },
        { x: 150, y: 150 },
        { x: 50, y: 150 }
      ]

      store.updateAnnotation(area.id, { points: newPoints })

      const updated = store.getAnnotationById(area.id) as Area

      // Area should stay the same (same size polygon)
      expect(updated.area).toBe(12.45)

      // Center should be updated to new position
      expect(updated.center.x).toBe(100) // (50 + 150 + 150 + 50) / 4
      expect(updated.center.y).toBe(100) // (50 + 50 + 150 + 150) / 4
    })

    it("should recalculate segments, totalLength, and center when perimeter points are updated", () => {
      const store = useAnnotationStore()

      const perimeter: Perimeter = {
        id: "perimeter-1",
        rotation: 0,
        type: "perimeter",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 }
        ],
        segments: [
          {
            start: { x: 0, y: 0 },
            end: { x: 100, y: 0 },
            length: 3528,
            midpoint: { x: 50, y: 0 }
          },
          {
            start: { x: 100, y: 0 },
            end: { x: 100, y: 100 },
            length: 3528,
            midpoint: { x: 100, y: 50 }
          },
          {
            start: { x: 100, y: 100 },
            end: { x: 0, y: 0 },
            length: 4989, // Diagonal is longer
            midpoint: { x: 50, y: 50 }
          }
        ],
        totalLength: 12045,
        center: { x: 66.67, y: 33.33 },
        labelRotation: 0
      }

      store.addAnnotation(perimeter)

      // Simulate dragging the perimeter to a new position (translate by +100, +100)
      const newPoints: Point[] = [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 }
      ]

      store.updateAnnotation(perimeter.id, { points: newPoints })

      const updatedRaw = store.getAnnotationById(perimeter.id)
      expect(updatedRaw).toBeDefined()
      const updated = updatedRaw as Perimeter

      // Total length should be recalculated but stay the same (same size polygon)
      expect(updated.totalLength).toBe(12045)

      // Center should be updated to new position
      expect(updated.center.x).toBeCloseTo(166.67, 1) // (100 + 200 + 200) / 3
      expect(updated.center.y).toBeCloseTo(133.33, 1) // (100 + 100 + 200) / 3

      // Segments should be recalculated with new positions
      expect(updated.segments).toHaveLength(3)
      expect(updated.segments![0]!.midpoint.x).toBe(150) // (100 + 200) / 2
      expect(updated.segments![0]!.midpoint.y).toBe(100) // (100 + 100) / 2
    })

    it("should not recalculate derived values when non-point properties are updated", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
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

      store.addAnnotation(text)

      // Update non-point property (content)
      store.updateAnnotation(text.id, { content: "Updated" })

      const updated = store.getAnnotationById(text.id) as TextAnnotation

      // Text should be updated
      expect(updated.content).toBe("Updated")

      // Position should remain unchanged
      expect(updated.x).toBe(100)
      expect(updated.y).toBe(100)
    })
  })

  describe("Multi-Select Operations", () => {
    it("should add annotation to selection (multi-select)", () => {
      const store = useAnnotationStore()

      const text1: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "First",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      const text2: TextAnnotation = {
        id: "text-2",
        type: "text",
        pageNum: 1,
        x: 200,
        y: 200,
        width: 200,
        height: 50,
        content: "Second",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text1)
      store.addAnnotation(text2)

      // Select first annotation
      store.selectAnnotation("text-1")
      expect(store.selectedAnnotationIds).toHaveLength(1)
      expect(store.selectedAnnotationIds[0]).toBe("text-1")

      // Add second annotation to selection
      store.selectAnnotation("text-2", { addToSelection: true })
      expect(store.selectedAnnotationIds).toHaveLength(2)
      expect(store.selectedAnnotationIds).toContain("text-1")
      expect(store.selectedAnnotationIds).toContain("text-2")
      expect(store.selectedAnnotations).toHaveLength(2)
    })

    it("should remove annotation from selection", () => {
      const store = useAnnotationStore()

      const text1: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "First",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      const text2: TextAnnotation = {
        id: "text-2",
        type: "text",
        pageNum: 1,
        x: 200,
        y: 200,
        width: 200,
        height: 50,
        content: "Second",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text1)
      store.addAnnotation(text2)

      // Select both annotations
      store.selectAnnotations(["text-1", "text-2"])
      expect(store.selectedAnnotationIds).toHaveLength(2)

      // Toggle off text-1 (remove from selection)
      store.selectAnnotation("text-1", { toggle: true })
      expect(store.selectedAnnotationIds).toHaveLength(1)
      expect(store.selectedAnnotationIds[0]).toBe("text-2")
    })

    it("should toggle annotation selection", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text)

      // Toggle on
      store.selectAnnotation("text-1", { toggle: true })
      expect(store.selectedAnnotationIds).toContain("text-1")
      expect(store.isAnnotationSelected("text-1")).toBe(true)

      // Toggle off
      store.selectAnnotation("text-1", { toggle: true })
      expect(store.selectedAnnotationIds).not.toContain("text-1")
      expect(store.isAnnotationSelected("text-1")).toBe(false)
    })

    it("should select all annotations via array", () => {
      const store = useAnnotationStore()

      const annotations: TextAnnotation[] = [
        {
          id: "text-1",
          type: "text",
          pageNum: 1,
          x: 100,
          y: 100,
          width: 200,
          height: 50,
          content: "First",
          fontSize: 16,
          color: "#000",
          rotation: 0
        },
        {
          id: "text-2",
          type: "text",
          pageNum: 1,
          x: 200,
          y: 200,
          width: 200,
          height: 50,
          content: "Second",
          fontSize: 16,
          color: "#000",
          rotation: 0
        },
        {
          id: "text-3",
          type: "text",
          pageNum: 1,
          x: 300,
          y: 300,
          width: 200,
          height: 50,
          content: "Third",
          fontSize: 16,
          color: "#000",
          rotation: 0
        }
      ]

      annotations.forEach((ann) => store.addAnnotation(ann))

      // Select all
      store.selectAnnotations(["text-1", "text-2", "text-3"])
      expect(store.selectedAnnotationIds).toHaveLength(3)
      expect(store.selectedAnnotations).toHaveLength(3)
    })

    it("should clear all selections", () => {
      const store = useAnnotationStore()

      const text1: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "First",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      const text2: TextAnnotation = {
        id: "text-2",
        type: "text",
        pageNum: 1,
        x: 200,
        y: 200,
        width: 200,
        height: 50,
        content: "Second",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text1)
      store.addAnnotation(text2)

      // Select multiple
      store.selectAnnotations(["text-1", "text-2"])
      expect(store.selectedAnnotationIds).toHaveLength(2)

      // Clear all
      store.deselectAll()
      expect(store.selectedAnnotationIds).toHaveLength(0)
      expect(store.selectedAnnotation).toBeNull()
    })

    it("should select multiple annotations of different types", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Text",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      const measure: Measurement = {
        id: "measure-1",
        rotation: 0,
        type: "measure",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 }
        ],
        distance: 4989,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0
      }

      const area: Area = {
        id: "area-1",
        type: "area",
        rotation: 0,
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        area: 12.45,
        center: { x: 50, y: 50 },
        labelRotation: 0
      }

      store.addAnnotation(text)
      store.addAnnotation(measure)
      store.addAnnotation(area)

      // Select mixed types
      store.selectAnnotations(["text-1", "measure-1", "area-1"])

      expect(store.selectedAnnotationIds).toHaveLength(3)
      expect(store.selectedAnnotations).toHaveLength(3)

      const selectedTypes = store.selectedAnnotations.map((ann) => ann.type)
      expect(selectedTypes).toContain("text")
      expect(selectedTypes).toContain("measure")
      expect(selectedTypes).toContain("area")
    })

    it("should handle multi-select across different pages", () => {
      const store = useAnnotationStore()

      const page1Text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Page 1",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      const page2Text: TextAnnotation = {
        id: "text-2",
        type: "text",
        pageNum: 2,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Page 2",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(page1Text)
      store.addAnnotation(page2Text)

      // Select annotations from different pages
      store.selectAnnotations(["text-1", "text-2"])

      expect(store.selectedAnnotationIds).toHaveLength(2)
      const selectedPages = store.selectedAnnotations.map((ann) => ann.pageNum)
      expect(selectedPages).toContain(1)
      expect(selectedPages).toContain(2)
    })

    it("should remove deleted annotation from selection", () => {
      const store = useAnnotationStore()

      const text1: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "First",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      const text2: TextAnnotation = {
        id: "text-2",
        type: "text",
        pageNum: 1,
        x: 200,
        y: 200,
        width: 200,
        height: 50,
        content: "Second",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text1)
      store.addAnnotation(text2)

      // Select both
      store.selectAnnotations(["text-1", "text-2"])
      expect(store.selectedAnnotationIds).toHaveLength(2)

      // Delete one
      store.deleteAnnotation("text-1")

      // Should be removed from selection
      expect(store.selectedAnnotationIds).toHaveLength(1)
      expect(store.selectedAnnotationIds[0]).toBe("text-2")
      expect(store.selectedAnnotationIds).not.toContain("text-1")
    })

    it("should switch to selection tool when annotations are selected", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text)

      // Set to different tool
      store.setActiveTool("measure")
      expect(store.activeTool).toBe("measure")

      // Select annotation should switch to selection tool
      store.selectAnnotation("text-1")
      expect(store.activeTool).toBe("selection")
    })
  })

  describe("Rotation State Tracking", () => {
    it("should track rotation drag delta", () => {
      const store = useAnnotationStore()

      expect(store.rotationDragDelta).toBe(0)

      // Simulate rotation drag
      store.rotationDragDelta = Math.PI / 4 // 45 degrees
      expect(store.rotationDragDelta).toBe(Math.PI / 4)
    })

    it("should get rotation transform for measurement annotation", () => {
      const store = useAnnotationStore()

      const measurement: Measurement = {
        id: "measure-1",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        distance: 3528,
        midpoint: { x: 50, y: 0 },
        labelRotation: 0,
        rotation: Math.PI / 2 // 90 degrees
      }

      store.addAnnotation(measurement)

      const transform = store.getRotationTransform(measurement)

      // Should rotate 90 degrees around center (50, 0)
      expect(transform).toContain("rotate(90")
      expect(transform).toContain("50")
      expect(transform).toContain("0")
    })

    it("should get rotation transform for area annotation", () => {
      const store = useAnnotationStore()

      const area: Area = {
        id: "area-1",
        type: "area",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        area: 12.45,
        center: { x: 50, y: 50 },
        labelRotation: 0,
        rotation: Math.PI // 180 degrees
      }

      store.addAnnotation(area)

      const transform = store.getRotationTransform(area)

      // Should rotate 180 degrees around center (50, 50)
      expect(transform).toContain("rotate(180")
      expect(transform).toContain("50")
    })

    it("should include rotation drag delta in transform for selected annotation", () => {
      const store = useAnnotationStore()

      const measurement: Measurement = {
        id: "measure-1",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        distance: 3528,
        midpoint: { x: 50, y: 0 },
        labelRotation: 0,
        rotation: Math.PI / 4 // 45 degrees stored
      }

      store.addAnnotation(measurement)
      store.selectAnnotation("measure-1")

      // Add drag delta
      store.rotationDragDelta = Math.PI / 4 // +45 degrees

      const transform = store.getRotationTransform(measurement)

      // Should be 45 + 45 = 90 degrees total
      expect(transform).toContain("rotate(90")
    })

    it("should return empty string for zero rotation", () => {
      const store = useAnnotationStore()

      const measurement: Measurement = {
        id: "measure-1",
        type: "measure",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        distance: 3528,
        midpoint: { x: 50, y: 0 },
        labelRotation: 0,
        rotation: 0
      }

      store.addAnnotation(measurement)

      const transform = store.getRotationTransform(measurement)
      expect(transform).toBe("")
    })

    it("should reset rotation drag delta when deselecting all", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text)
      store.selectAnnotation("text-1")

      // Set drag delta
      store.rotationDragDelta = Math.PI / 2

      // Deselect should reset
      store.deselectAll()
      expect(store.rotationDragDelta).toBe(0)
    })
  })

  describe("Selection State Management", () => {
    it("should maintain backward compatibility with selectedAnnotationId", () => {
      const store = useAnnotationStore()

      const text1: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "First",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      const text2: TextAnnotation = {
        id: "text-2",
        type: "text",
        pageNum: 1,
        x: 200,
        y: 200,
        width: 200,
        height: 50,
        content: "Second",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text1)
      store.addAnnotation(text2)

      // Select multiple
      store.selectAnnotations(["text-1", "text-2"])

      // selectedAnnotationId should return first selected
      expect(store.selectedAnnotationId).toBe("text-1")

      // selectedAnnotation should return first selected annotation
      expect(store.selectedAnnotation?.id).toBe("text-1")
    })

    it("should return null for selectedAnnotationId when nothing selected", () => {
      const store = useAnnotationStore()

      expect(store.selectedAnnotationId).toBeNull()
      expect(store.selectedAnnotation).toBeNull()
    })

    it("should clear selection when setting active tool", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text)
      store.selectAnnotation("text-1")

      expect(store.selectedAnnotationIds).toHaveLength(1)

      // Setting active tool should clear selection
      store.setActiveTool("measure")
      expect(store.selectedAnnotationIds).toHaveLength(0)
      expect(store.activeTool).toBe("measure")
    })

    it("should not select non-existent annotation", () => {
      const store = useAnnotationStore()

      // Try to select annotation that doesn't exist
      store.selectAnnotation("non-existent-id")

      // Selection should remain empty
      expect(store.selectedAnnotationIds).toHaveLength(0)
    })

    it("should filter out undefined annotations from selectedAnnotations", () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000",
        rotation: 0
      }

      store.addAnnotation(text)

      // Manually set selectedAnnotationIds to include non-existent ID
      // (This simulates a race condition or data inconsistency)
      store.selectedAnnotationIds = ["text-1", "non-existent"]

      // selectedAnnotations should only include valid annotations
      expect(store.selectedAnnotations).toHaveLength(1)
      expect(store.selectedAnnotations[0]?.id).toBe("text-1")
    })
  })
})
