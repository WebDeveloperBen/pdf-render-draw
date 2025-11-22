/**
 * Regression Tests: Transform Handles
 *
 * Tests for bugs fixed in transform handle behavior:
 * - Rotation-aware resize (deltas converted to local coordinate space)
 * - Group transform rendering only once for multi-select
 * - Transform handles following cursor on rotated annotations
 */

import { describe, it, expect, beforeEach } from "vitest"
import { useAnnotationStore } from "~/stores/annotations"
import type { TextAnnotation } from "~/types/annotations"

describe("Regression: Transform Handles", () => {
  beforeEach(() => {
    const annotationStore = useAnnotationStore()
    annotationStore.clearAnnotations()
    annotationStore.deselectAll()
    annotationStore.setActiveTool('')
  })

  describe("Bug Fix: Rotation-Aware Resize", () => {
    it("should convert mouse deltas to local coordinate space when annotation is rotated", () => {
      // Test the rotation matrix transformation used in handleResize

      // GIVEN: An annotation rotated 90 degrees (π/2 radians)
      const rotation = Math.PI / 2 // 90 degrees
      const deltaX = 100 // Mouse moved 100px right
      const deltaY = 0

      // WHEN: Converting to local space (rotating by -rotation)
      const cos = Math.cos(-rotation)
      const sin = Math.sin(-rotation)
      const localDeltaX = deltaX * cos - deltaY * sin
      const localDeltaY = deltaX * sin + deltaY * cos

      // THEN: Moving right in global space → moving down in local space (for 90° rotation)
      // cos(-90°) ≈ 0, sin(-90°) ≈ -1
      expect(localDeltaX).toBeCloseTo(0, 10)
      expect(localDeltaY).toBeCloseTo(-100, 10)
    })

    it("should convert mouse deltas correctly for 45-degree rotation", () => {
      // GIVEN: Annotation rotated 45 degrees
      const rotation = Math.PI / 4 // 45 degrees
      const deltaX = 100
      const deltaY = 0

      // WHEN: Converting to local space
      const cos = Math.cos(-rotation)
      const sin = Math.sin(-rotation)
      const localDeltaX = deltaX * cos - deltaY * sin
      const localDeltaY = deltaX * sin + deltaY * cos

      // THEN: Should split movement between X and Y
      // cos(45°) ≈ sin(45°) ≈ 0.707
      expect(localDeltaX).toBeCloseTo(70.7, 0)
      expect(localDeltaY).toBeCloseTo(-70.7, 0)
    })

    it("should not modify deltas for non-rotated annotation", () => {
      // GIVEN: No rotation
      const rotation = 0
      const deltaX = 100
      const deltaY = 50

      // WHEN: Converting to local space
      const cos = Math.cos(-rotation)
      const sin = Math.sin(-rotation)
      const localDeltaX = deltaX * cos - deltaY * sin
      const localDeltaY = deltaX * sin + deltaY * cos

      // THEN: Deltas unchanged (identity transformation)
      expect(localDeltaX).toBe(100)
      expect(localDeltaY).toBe(50)
    })

    it("should handle negative rotation angles", () => {
      // GIVEN: Annotation rotated -45 degrees (clockwise)
      const rotation = -Math.PI / 4
      const deltaX = 100
      const deltaY = 0

      // WHEN: Converting to local space
      const cos = Math.cos(-rotation)
      const sin = Math.sin(-rotation)
      const localDeltaX = deltaX * cos - deltaY * sin
      const localDeltaY = deltaX * sin + deltaY * cos

      // THEN: Should correctly handle negative rotation
      expect(localDeltaX).toBeCloseTo(70.7, 0)
      expect(localDeltaY).toBeCloseTo(70.7, 0)
    })

    it("should handle 180-degree rotation", () => {
      // GIVEN: Annotation rotated 180 degrees (upside down)
      const rotation = Math.PI
      const deltaX = 100
      const deltaY = 50

      // WHEN: Converting to local space
      const cos = Math.cos(-rotation)
      const sin = Math.sin(-rotation)
      const localDeltaX = deltaX * cos - deltaY * sin
      const localDeltaY = deltaX * sin + deltaY * cos

      // THEN: Deltas should be inverted
      expect(localDeltaX).toBeCloseTo(-100, 10)
      expect(localDeltaY).toBeCloseTo(-50, 10)
    })
  })

  describe("Bug Fix: Single Group Transform Rendering", () => {
    it("should only render GroupTransform on first selected annotation", () => {
      const annotationStore = useAnnotationStore()

      // GIVEN: Multiple annotations selected
      const annotations: TextAnnotation[] = [
        {
          id: "text-1",
          type: "text",
          rotation: 0,
          pageNum: 1,
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          content: "A",
          fontSize: 16,
          color: "#000"
        },
        {
          id: "text-2",
          type: "text",
          pageNum: 1,
          x: 0,
          rotation: 0,
          y: 100,
          width: 100,
          height: 50,
          content: "B",
          fontSize: 16,
          color: "#000"
        },
        {
          id: "text-3",
          type: "text",
          pageNum: 1,
          x: 0,
          y: 200,
          rotation: 0,
          width: 100,
          height: 50,
          content: "C",
          fontSize: 16,
          color: "#000"
        }
      ]

      annotations.forEach((a) => annotationStore.addAnnotation(a))
      annotationStore.selectAnnotations(["text-1", "text-2", "text-3"])

      // WHEN: Checking which annotations should render GroupTransform
      const shouldRenderGroupTransform = (id: string) => {
        return (
          annotationStore.isAnnotationSelected(id) &&
          annotationStore.selectedAnnotationIds.length > 1 &&
          annotationStore.selectedAnnotationIds[0] === id
        )
      }

      // THEN: Only the first annotation should render it
      expect(shouldRenderGroupTransform("text-1")).toBe(true)
      expect(shouldRenderGroupTransform("text-2")).toBe(false)
      expect(shouldRenderGroupTransform("text-3")).toBe(false)
    })

    it("should not render GroupTransform when only one annotation selected", () => {
      const annotationStore = useAnnotationStore()

      annotationStore.addAnnotation({
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 0,
        rotation: 0,
        y: 0,
        width: 100,
        height: 50,
        content: "A",
        fontSize: 16,
        color: "#000"
      })

      annotationStore.selectAnnotation("text-1")

      const shouldRenderGroupTransform = (id: string) => {
        return (
          annotationStore.isAnnotationSelected(id) &&
          annotationStore.selectedAnnotationIds.length > 1 &&
          annotationStore.selectedAnnotationIds[0] === id
        )
      }

      // Single selection should render individual Transform, not GroupTransform
      expect(shouldRenderGroupTransform("text-1")).toBe(false)
      expect(annotationStore.selectedAnnotationIds.length).toBe(1)
    })

    it("should update GroupTransform when selection order changes", () => {
      const annotationStore = useAnnotationStore()

      annotationStore.addAnnotation({
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        rotation: 0,
        height: 50,
        content: "A",
        fontSize: 16,
        color: "#000"
      })
      annotationStore.addAnnotation({
        id: "text-2",
        type: "text",
        pageNum: 1,
        x: 0,
        y: 100,
        width: 100,
        rotation: 0,
        height: 50,
        content: "B",
        fontSize: 16,
        color: "#000"
      })

      // Select in order: text-1, text-2
      annotationStore.selectAnnotations(["text-1", "text-2"])

      const shouldRenderGroupTransform = (id: string) => {
        return (
          annotationStore.isAnnotationSelected(id) &&
          annotationStore.selectedAnnotationIds.length > 1 &&
          annotationStore.selectedAnnotationIds[0] === id
        )
      }

      expect(shouldRenderGroupTransform("text-1")).toBe(true)
      expect(shouldRenderGroupTransform("text-2")).toBe(false)

      // Change order: text-2, text-1
      annotationStore.selectAnnotations(["text-2", "text-1"])

      expect(shouldRenderGroupTransform("text-1")).toBe(false)
      expect(shouldRenderGroupTransform("text-2")).toBe(true)
    })
  })

  describe("Transform Handle Coordinate System", () => {
    it("should apply rotation transform to annotation group", () => {
      const annotationStore = useAnnotationStore()

      const annotation: TextAnnotation = {
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
        rotation: Math.PI / 4 // 45 degrees
      }

      annotationStore.addAnnotation(annotation)

      // Get rotation transform for rendering
      const transform = annotationStore.getRotationTransform(annotation)

      // Should include rotation around annotation center
      expect(transform).toContain("rotate")
      expect(transform).toContain("45") // degrees
    })

    it("should calculate correct rotation center for text annotations", () => {
      // For text: center is (x + width/2, y + height/2)
      const x = 100
      const y = 100
      const width = 200
      const height = 50

      const centerX = x + width / 2
      const centerY = y + height / 2

      expect(centerX).toBe(200)
      expect(centerY).toBe(125)
    })
  })

  describe("Resize Delta Application", () => {
    it("should apply local deltas to bounds for edge handles", () => {
      // Simulating edge-1 (right edge) resize
      const originalBounds = { x: 100, y: 100, width: 200, height: 50 }
      const localDeltaX = 50 // Resize right edge 50px wider

      const newBounds = { ...originalBounds }
      newBounds.width += localDeltaX

      expect(newBounds).toEqual({ x: 100, y: 100, width: 250, height: 50 })
    })

    it("should apply local deltas to bounds for corner handles", () => {
      // Simulating corner-2 (bottom-right) resize
      const originalBounds = { x: 100, y: 100, width: 200, height: 50 }
      const localDeltaX = 50
      const localDeltaY = 25

      const newBounds = { ...originalBounds }
      newBounds.width += localDeltaX // Right side
      newBounds.height += localDeltaY // Bottom side

      expect(newBounds).toEqual({ x: 100, y: 100, width: 250, height: 75 })
    })

    it("should apply local deltas for left/top handles correctly", () => {
      // Simulating corner-0 (top-left) resize - moves position AND changes size
      const originalBounds = { x: 100, y: 100, width: 200, height: 50 }
      const localDeltaX = 20 // Dragged 20px right
      const localDeltaY = 10 // Dragged 10px down

      const newBounds = { ...originalBounds }
      newBounds.x += localDeltaX // Position moves
      newBounds.width -= localDeltaX // Width shrinks
      newBounds.y += localDeltaY // Position moves
      newBounds.height -= localDeltaY // Height shrinks

      expect(newBounds).toEqual({ x: 120, y: 110, width: 180, height: 40 })
    })
  })
})
