/**
 * Integration Tests for Rotated Element Bounding Boxes
 *
 * Tests that verify bounding box calculations for rotated elements
 * and multi-select with rotated elements work correctly.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { setActivePinia, createPinia } from "pinia"

describe("Rotated Element Bounding Boxes", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe("Single Rotated Element", () => {
    it("should calculate correct bounds for 90-degree rotated fill", () => {
      const store = useAnnotationStore()

      // Create a fill annotation at (100, 100) with size 50x30
      const fill: Fill = {
        id: "fill-1",
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 30,
        rotation: Math.PI / 2, // 90 degrees
        color: "#ff0000",
        opacity: 0.5
      }

      store.addAnnotation(fill)

      // Calculate bounds
      const bounds = calculateBounds(fill)

      expect(bounds).not.toBeNull()
      expect(bounds).toBeDefined()

      // After 90° rotation, a 50x30 rectangle should become 30x50
      // The bounding box should expand to contain the rotated rectangle
      expect(bounds!.width).toBeCloseTo(30, 1)
      expect(bounds!.height).toBeCloseTo(50, 1)
    })

    it("should calculate correct bounds for 45-degree rotated fill", () => {
      const fill: Fill = {
        id: "fill-2",
        type: "fill",
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: Math.PI / 4, // 45 degrees
        color: "#00ff00",
        opacity: 0.5
      }

      const bounds = calculateBounds(fill)

      expect(bounds).not.toBeNull()

      // A 100x100 square rotated 45° should have bounds of sqrt(2)*100 ≈ 141.42
      const expectedSize = Math.sqrt(2) * 100
      expect(bounds!.width).toBeCloseTo(expectedSize, 1)
      expect(bounds!.height).toBeCloseTo(expectedSize, 1)
    })

    it("should not change bounds for non-rotated element", () => {
      const fill: Fill = {
        id: "fill-3",
        type: "fill",
        pageNum: 1,
        x: 50,
        y: 75,
        width: 100,
        height: 80,
        rotation: 0,
        color: "#0000ff",
        opacity: 0.5
      }

      const bounds = calculateBounds(fill)

      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBe(50)
      expect(bounds!.y).toBe(75)
      expect(bounds!.width).toBe(100)
      expect(bounds!.height).toBe(80)
    })

    it("should ignore rotation when ignoreRotation flag is true", () => {
      const fill: Fill = {
        id: "fill-4",
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 30,
        rotation: Math.PI / 2, // 90 degrees
        color: "#ff00ff",
        opacity: 0.5
      }

      const bounds = calculateBounds(fill, true) // ignoreRotation = true

      expect(bounds).not.toBeNull()
      // Should return original bounds without rotation
      expect(bounds!.x).toBe(100)
      expect(bounds!.y).toBe(100)
      expect(bounds!.width).toBe(50)
      expect(bounds!.height).toBe(30)
    })
  })

  describe("Multi-Select with Rotated Elements", () => {
    it("should calculate correct union bounds for two non-rotated fills", () => {
      const store = useAnnotationStore()

      const fill1: Fill = {
        id: "fill-1",
        type: "fill",
        pageNum: 1,
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        rotation: 0,
        color: "#ff0000",
        opacity: 0.5
      }

      const fill2: Fill = {
        id: "fill-2",
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        rotation: 0,
        color: "#00ff00",
        opacity: 0.5
      }

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)

      const bounds1 = calculateBounds(fill1)
      const bounds2 = calculateBounds(fill2)

      expect(bounds1).not.toBeNull()
      expect(bounds2).not.toBeNull()

      const unionBounds = getUnionBounds([bounds1!, bounds2!])

      expect(unionBounds).not.toBeNull()
      expect(unionBounds!.x).toBe(0)
      expect(unionBounds!.y).toBe(0)
      expect(unionBounds!.width).toBe(150) // From 0 to 150
      expect(unionBounds!.height).toBe(150) // From 0 to 150
    })

    it("should calculate correct union bounds for two rotated fills", () => {
      const fill1: Fill = {
        id: "fill-1",
        type: "fill",
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        rotation: Math.PI / 4, // 45 degrees
        color: "#ff0000",
        opacity: 0.5
      }

      const fill2: Fill = {
        id: "fill-2",
        type: "fill",
        pageNum: 1,
        x: 200,
        y: 200,
        width: 100,
        height: 50,
        rotation: -Math.PI / 4, // -45 degrees
        color: "#00ff00",
        opacity: 0.5
      }

      const bounds1 = calculateBounds(fill1)
      const bounds2 = calculateBounds(fill2)

      expect(bounds1).not.toBeNull()
      expect(bounds2).not.toBeNull()

      const unionBounds = getUnionBounds([bounds1!, bounds2!])

      expect(unionBounds).not.toBeNull()
      // Union should encompass both rotated rectangles
      expect(unionBounds!.x).toBeLessThan(bounds1!.x + 1)
      expect(unionBounds!.y).toBeLessThan(bounds1!.y + 1)
      expect(unionBounds!.x + unionBounds!.width).toBeGreaterThan(bounds2!.x + bounds2!.width - 1)
      expect(unionBounds!.y + unionBounds!.height).toBeGreaterThan(bounds2!.y + bounds2!.height - 1)
    })

    it("should calculate correct union bounds for one rotated and one non-rotated fill", () => {
      const fill1: Fill = {
        id: "fill-1",
        type: "fill",
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        color: "#ff0000",
        opacity: 0.5
      }

      const fill2: Fill = {
        id: "fill-2",
        type: "fill",
        pageNum: 1,
        x: 150,
        y: 150,
        width: 80,
        height: 60,
        rotation: Math.PI / 2, // 90 degrees
        color: "#00ff00",
        opacity: 0.5
      }

      const bounds1 = calculateBounds(fill1)
      const bounds2 = calculateBounds(fill2)

      expect(bounds1).not.toBeNull()
      expect(bounds2).not.toBeNull()

      const unionBounds = getUnionBounds([bounds1!, bounds2!])

      expect(unionBounds).not.toBeNull()
      // Should encompass both elements
      expect(unionBounds!.x).toBe(0)
      expect(unionBounds!.y).toBe(0)
    })
  })

  describe("Transform Math Utilities", () => {
    it("should calculate rotated rect bounds correctly", () => {
      // Test the direct utility function
      const bounds = getRotatedRectBounds(0, 0, 100, 50, Math.PI / 2)

      expect(bounds.width).toBeCloseTo(50, 1)
      expect(bounds.height).toBeCloseTo(100, 1)
    })

    it("should handle 180-degree rotation", () => {
      const bounds = getRotatedRectBounds(100, 100, 50, 30, Math.PI)

      // 180° rotation shouldn't change dimensions, just flip position
      expect(bounds.width).toBeCloseTo(50, 1)
      expect(bounds.height).toBeCloseTo(30, 1)
    })

    it("should handle negative rotation", () => {
      const bounds1 = getRotatedRectBounds(0, 0, 100, 50, Math.PI / 4)
      const bounds2 = getRotatedRectBounds(0, 0, 100, 50, -Math.PI / 4)

      // Positive and negative 45° should give same dimensions
      expect(bounds1.width).toBeCloseTo(bounds2.width, 1)
      expect(bounds1.height).toBeCloseTo(bounds2.height, 1)
    })

    it("should handle full 360-degree rotation (should be same as 0)", () => {
      const boundsOriginal = getRotatedRectBounds(50, 50, 100, 80, 0)
      const bounds360 = getRotatedRectBounds(50, 50, 100, 80, 2 * Math.PI)

      expect(bounds360.x).toBeCloseTo(boundsOriginal.x, 1)
      expect(bounds360.y).toBeCloseTo(boundsOriginal.y, 1)
      expect(bounds360.width).toBeCloseTo(boundsOriginal.width, 1)
      expect(bounds360.height).toBeCloseTo(boundsOriginal.height, 1)
    })
  })

  describe("Bounds Stability During Rotation", () => {
    it("should maintain original bounds during rotation drag", () => {
      const store = useAnnotationStore()

      const fill: Fill = {
        id: "fill-1",
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 50,
        height: 30,
        rotation: 0,
        color: "#ff0000",
        opacity: 0.5
      }

      store.addAnnotation(fill)

      // Calculate initial bounds
      const initialBounds = calculateBounds(fill)
      expect(initialBounds).not.toBeNull()

      // Simulate rotation drag by setting rotationDragDelta
      store.rotationDragDelta = Math.PI / 4 // 45 degrees

      // Bounds calculation should NOT include the drag delta
      // (only the stored rotation property)
      const boundsWithDragDelta = calculateBounds(fill)

      expect(boundsWithDragDelta).not.toBeNull()
      expect(boundsWithDragDelta!.x).toBeCloseTo(initialBounds!.x, 5)
      expect(boundsWithDragDelta!.y).toBeCloseTo(initialBounds!.y, 5)
      expect(boundsWithDragDelta!.width).toBeCloseTo(initialBounds!.width, 5)
      expect(boundsWithDragDelta!.height).toBeCloseTo(initialBounds!.height, 5)

      // Clean up
      store.rotationDragDelta = 0
    })

    it("should update bounds after rotation is committed", () => {
      const store = useAnnotationStore()

      const fill: Fill = {
        id: "fill-1",
        type: "fill",
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        rotation: 0,
        color: "#ff0000",
        opacity: 0.5
      }

      store.addAnnotation(fill)

      const initialBounds = calculateBounds(fill)
      expect(initialBounds!.width).toBe(100)
      expect(initialBounds!.height).toBe(50)

      // Commit rotation (update the actual rotation property)
      store.updateAnnotation("fill-1", { rotation: Math.PI / 2 })

      const updatedFill = store.getAnnotationById("fill-1") as Fill
      const rotatedBounds = calculateBounds(updatedFill)

      // After 90° rotation, bounds should swap width/height
      expect(rotatedBounds!.width).toBeCloseTo(50, 1)
      expect(rotatedBounds!.height).toBeCloseTo(100, 1)
    })
  })
})
