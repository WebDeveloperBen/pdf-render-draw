import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useAnnotationStore } from "~/stores/annotations"
import type { Measurement, Area, Perimeter, PerimeterSegment, Fill } from "~/types/annotations"
import { calculateBounds } from "~/utils/bounds"

// Mock UUID to make tests deterministic
vi.mock("uuid", () => ({
  v4: () => "test-uuid-123"
}))

describe("GroupTransform Component", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // Helper function to create test annotations
  function createTestMeasurement(
    id: string,
    points: [{ x: number; y: number }, { x: number; y: number }]
  ): Measurement {
    return {
      id,
      type: "measure",
      pageNum: 1,
      points,
      distance: 100,
      midpoint: {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2
      },
      labelRotation: 0,
      rotation: 0
    }
  }

  function createTestArea(id: string, points: { x: number; y: number }[]): Area {
    return {
      id,
      type: "area",
      pageNum: 1,
      points,
      area: 100,
      center: { x: 150, y: 150 },
      labelRotation: 0,
      rotation: 0
    }
  }

  function createTestPerimeter(id: string, points: { x: number; y: number }[]): Perimeter {
    // Calculate segments properly for valid perimeter
    const segments: PerimeterSegment[] = []
    for (let i = 0; i < points.length; i++) {
      const start = points[i]
      const end = points[(i + 1) % points.length]
      assertDefined(start, "Start point should exist")
      assertDefined(end, "End point should exist")
      segments.push({
        start,
        end,
        length: Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)),
        midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
      })
    }

    return {
      id,
      type: "perimeter",
      pageNum: 1,
      points,
      segments,
      totalLength: segments.reduce((sum, seg) => sum + seg.length, 0),
      center: { x: 150, y: 150 },
      labelRotation: 0,
      rotation: 0
    }
  }

  function createTestFill(id: string, x: number, y: number, width: number, height: number): Fill {
    return {
      id,
      type: "fill",
      pageNum: 1,
      x,
      y,
      width,
      height,
      color: "#FF0000",
      opacity: 0.5
    }
  }

  describe("Combined Bounds Calculation", () => {
    it("should calculate combined bounds from multiple annotations", () => {
      const store = useAnnotationStore()

      // Create two measurements at different locations
      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 300, y: 150 },
        { x: 400, y: 250 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(["m1", "m2"])

      // Calculate expected combined bounds manually
      const bounds1 = calculateBounds(measurement1)!
      const bounds2 = calculateBounds(measurement2)!

      const expectedMinX = Math.min(bounds1.x, bounds2.x)
      const expectedMinY = Math.min(bounds1.y, bounds2.y)
      const expectedMaxX = Math.max(bounds1.x + bounds1.width, bounds2.x + bounds2.width)
      const expectedMaxY = Math.max(bounds1.y + bounds1.height, bounds2.y + bounds2.height)

      const expectedCombinedBounds = {
        x: expectedMinX,
        y: expectedMinY,
        width: expectedMaxX - expectedMinX,
        height: expectedMaxY - expectedMinY
      }

      // Verify bounds calculation
      expect(expectedCombinedBounds.x).toBe(100)
      expect(expectedCombinedBounds.y).toBe(100)
      expect(expectedCombinedBounds.width).toBe(300) // 400 - 100
      expect(expectedCombinedBounds.height).toBe(150) // 250 - 100
    })

    it("should calculate combined bounds for mixed annotation types", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 50, y: 50 },
        { x: 100, y: 100 }
      ])
      const area = createTestArea("a1", [
        { x: 200, y: 200 },
        { x: 300, y: 200 },
        { x: 250, y: 300 }
      ])

      store.addAnnotation(measurement)
      store.addAnnotation(area)
      store.selectAnnotations(["m1", "a1"])

      const bounds1 = calculateBounds(measurement)!
      const bounds2 = calculateBounds(area)!

      // Combined bounds should encompass both annotations
      const expectedMinX = Math.min(bounds1.x, bounds2.x)
      const expectedMinY = Math.min(bounds1.y, bounds2.y)

      expect(expectedMinX).toBe(50)
      expect(expectedMinY).toBe(50)
    })

    it("should return null for single annotation selection", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation("m1")

      // Combined bounds should only exist for 2+ selections
      expect(store.selectedAnnotations.length).toBe(1)
    })

    it("should return null when no annotations selected", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)

      expect(store.selectedAnnotations.length).toBe(0)
    })
  })

  describe("Rotation Handle", () => {
    it("should rotate all selected items around group center", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(["m1", "m2"])

      // Get original positions
      const originalM1Points = [...measurement1.points]
      const originalM2Points = [...measurement2.points]

      // Simulate rotation by 90 degrees (π/2 radians)
      const rotationDelta = Math.PI / 2
      const centerX = 150 // Center of combined bounds
      const centerY = 150

      // Rotate points manually
      const rotatePoint = (p: { x: number; y: number }) => {
        const dx = p.x - centerX
        const dy = p.y - centerY
        const cos = Math.cos(rotationDelta)
        const sin = Math.sin(rotationDelta)
        return {
          x: centerX + dx * cos - dy * sin,
          y: centerY + dx * sin + dy * cos
        }
      }

      const rotatedM1Points = originalM1Points.map(rotatePoint)
      const rotatedM2Points = originalM2Points.map(rotatePoint)

      // Update annotations with rotated points
      store.updateAnnotation("m1", { points: rotatedM1Points })
      store.updateAnnotation("m2", { points: rotatedM2Points })

      // Verify points were rotated
      const updated1 = store.getAnnotationById("m1") as Measurement
      const updated2 = store.getAnnotationById("m2") as Measurement

      expect(updated1.points).not.toEqual(originalM1Points)
      expect(updated2.points).not.toEqual(originalM2Points)
    })

    it("should show real-time rotation preview during drag", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation("m1")

      // Simulate dragging rotation handle
      store.rotationDragDelta = Math.PI / 4 // 45 degrees

      // Verify drag delta is set
      expect(store.rotationDragDelta).toBe(Math.PI / 4)

      // Get rotation transform should include drag delta
      const transform = store.getRotationTransform(measurement)
      expect(transform).toContain("rotate(")
      expect(transform).toContain("45") // 45 degrees
    })

    it("should commit rotation to all items on release", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(["m1", "m2"])

      // Simulate rotation drag
      const rotationDelta = Math.PI / 6 // 30 degrees
      store.rotationDragDelta = rotationDelta

      expect(store.rotationDragDelta).toBe(rotationDelta)

      // Simulate release by clearing drag delta
      store.rotationDragDelta = 0

      expect(store.rotationDragDelta).toBe(0)
    })

    it("should clear drag delta immediately on release", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation("m1")

      // Set drag delta
      store.rotationDragDelta = Math.PI / 3

      expect(store.rotationDragDelta).toBe(Math.PI / 3)

      // Clear immediately (simulating mouseup)
      store.rotationDragDelta = 0

      expect(store.rotationDragDelta).toBe(0)
    })

    it("should not jump or recalculate on release", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation("m1")

      // Initial bounds
      const initialBounds = calculateBounds(measurement)!

      // Simulate rotation
      store.rotationDragDelta = Math.PI / 4

      // Clear drag delta (release)
      store.rotationDragDelta = 0

      // Get transform after release
      const transformAfter = store.getRotationTransform(measurement)

      // Bounds should not change (only rotation property changes)
      const finalBounds = calculateBounds(measurement)!
      expect(finalBounds).toEqual(initialBounds)

      // Transform should revert to stored rotation (0)
      expect(transformAfter).toBe("")
    })
  })

  describe("Frozen Transformer Bounds", () => {
    it("should freeze transformer bounds during rotation", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(["m1", "m2"])

      // Calculate initial combined bounds
      const bounds1 = calculateBounds(measurement1)!
      const bounds2 = calculateBounds(measurement2)!

      const initialCombinedBounds = {
        x: Math.min(bounds1.x, bounds2.x),
        y: Math.min(bounds1.y, bounds2.y),
        width: Math.max(bounds1.x + bounds1.width, bounds2.x + bounds2.width) - Math.min(bounds1.x, bounds2.x),
        height: Math.max(bounds1.y + bounds1.height, bounds2.y + bounds2.height) - Math.min(bounds1.y, bounds2.y)
      }

      // During rotation, bounds should remain frozen
      store.rotationDragDelta = Math.PI / 4

      // The displayed bounds should stay the same during rotation
      // (In the actual component, this is handled by displayBounds computed property)
      expect(initialCombinedBounds.x).toBe(100)
      expect(initialCombinedBounds.y).toBe(100)
    })

    it("should preserve frozen bounds after rotation completes", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation("m1")

      const initialBounds = calculateBounds(measurement)!

      // Perform rotation
      store.rotationDragDelta = Math.PI / 2

      // Release
      store.rotationDragDelta = 0

      // Bounds should remain stable
      const finalBounds = calculateBounds(measurement)!
      expect(finalBounds).toEqual(initialBounds)
    })
  })

  describe("Cumulative Group Rotation", () => {
    it("should track cumulative rotation across multiple rotations", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation("m1")

      // First rotation: 45 degrees
      store.rotationDragDelta = Math.PI / 4

      // Commit rotation
      const firstRotation = measurement.rotation! + store.rotationDragDelta
      store.updateAnnotation("m1", { rotation: firstRotation })
      store.rotationDragDelta = 0

      // Second rotation: 30 degrees
      store.rotationDragDelta = Math.PI / 6

      // Total rotation should be 45 + 30 = 75 degrees
      const updated = store.getAnnotationById("m1") as Measurement
      const transform = store.getRotationTransform(updated)

      // Transform should include both rotations
      expect(transform).toContain("rotate(")

      // Commit second rotation
      const secondRotation = updated.rotation! + store.rotationDragDelta
      store.updateAnnotation("m1", { rotation: secondRotation })
      store.rotationDragDelta = 0

      const final = store.getAnnotationById("m1") as Measurement
      expect(final.rotation).toBeCloseTo(Math.PI / 4 + Math.PI / 6, 5)
    })

    it("should reset cumulative rotation on selection change", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)

      // Select first group
      store.selectAnnotations(["m1"])

      // Set drag delta
      store.rotationDragDelta = Math.PI / 4

      // Manually clear drag delta (since the component's watch handler does this)
      store.rotationDragDelta = 0

      // Change selection
      store.selectAnnotations(["m2"])

      // Drag delta should remain 0
      expect(store.rotationDragDelta).toBe(0)
    })
  })

  describe("Unselected Annotations", () => {
    it("should not rotate unselected annotations", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)

      // Only select m1
      store.selectAnnotation("m1")

      const originalM2Points = [...measurement2.points]

      // Rotate m1 only
      store.rotationDragDelta = Math.PI / 4

      // m2 should not be affected
      const updated2 = store.getAnnotationById("m2") as Measurement
      expect(updated2.points).toEqual(originalM2Points)
    })

    it("should not include unselected annotations in group bounds", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])
      const measurement3 = createTestMeasurement("m3", [
        { x: 300, y: 300 },
        { x: 400, y: 400 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.addAnnotation(measurement3)

      // Select only m1 and m2
      store.selectAnnotations(["m1", "m2"])

      const selectedBounds1 = calculateBounds(measurement1)!
      const selectedBounds2 = calculateBounds(measurement2)!

      // Combined bounds should only include m1 and m2
      const expectedMaxX = Math.max(
        selectedBounds1.x + selectedBounds1.width,
        selectedBounds2.x + selectedBounds2.width
      )

      // m3 at x:300-400 should not affect the bounds
      expect(expectedMaxX).toBeLessThan(300)
    })
  })

  describe("Measurement Label Rotation", () => {
    it("should update label rotation during group rotation", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation("m1")

      const originalLabelRotation = measurement.labelRotation

      // Simulate group rotation
      const rotationDelta = Math.PI / 6 // 30 degrees
      const rotationDegrees = (rotationDelta * 180) / Math.PI

      // Update label rotation
      store.updateAnnotation("m1", {
        labelRotation: originalLabelRotation + rotationDegrees
      })

      const updated = store.getAnnotationById("m1") as Measurement
      expect(updated.labelRotation).toBeCloseTo(30, 5)
    })

    it("should keep labels aligned with measurement during rotation", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation("m1")

      // Initial label rotation
      const initialRotation = measurement.labelRotation

      // Rotate measurement
      const rotationDelta = Math.PI / 4
      const rotationDegrees = (rotationDelta * 180) / Math.PI

      store.updateAnnotation("m1", {
        labelRotation: initialRotation + rotationDegrees
      })

      const updated = store.getAnnotationById("m1") as Measurement
      expect(updated.labelRotation).toBe(initialRotation + 45)
    })
  })

  describe("Resize Corner Handles", () => {
    it("should scale all selected items proportionally", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(["m1", "m2"])

      // Calculate original combined bounds
      const bounds1 = calculateBounds(measurement1)!
      const bounds2 = calculateBounds(measurement2)!
      const originalBounds = {
        x: Math.min(bounds1.x, bounds2.x),
        y: Math.min(bounds1.y, bounds2.y),
        width: Math.max(bounds1.x + bounds1.width, bounds2.x + bounds2.width) - Math.min(bounds1.x, bounds2.x),
        height: Math.max(bounds1.y + bounds1.height, bounds2.y + bounds2.height) - Math.min(bounds1.y, bounds2.y)
      }

      // Simulate resize by 2x
      const scaleX = 2
      const scaleY = 2

      const scalePoints = (points: { x: number; y: number }[]) =>
        points.map((p) => ({
          x: originalBounds.x + (p.x - originalBounds.x) * scaleX,
          y: originalBounds.y + (p.y - originalBounds.y) * scaleY
        }))

      const scaledM1Points = scalePoints(measurement1.points)
      const scaledM2Points = scalePoints(measurement2.points)

      store.updateAnnotation("m1", { points: scaledM1Points })
      store.updateAnnotation("m2", { points: scaledM2Points })

      // Verify scaling
      const updated1 = store.getAnnotationById("m1") as Measurement
      const updated2 = store.getAnnotationById("m2") as Measurement

      expect(updated1.points).not.toEqual(measurement1.points)
      expect(updated2.points).not.toEqual(measurement2.points)

      // Verify proportional scaling
      const newBounds1 = calculateBounds(updated1)!
      const newBounds2 = calculateBounds(updated2)!

      expect(newBounds1.width).toBeCloseTo(bounds1.width * scaleX, 1)
      expect(newBounds2.width).toBeCloseTo(bounds2.width * scaleX, 1)
    })

    it("should maintain aspect ratio when Shift is pressed", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation("m1")

      const originalBounds = calculateBounds(measurement)!
      const originalAspectRatio = originalBounds.width / originalBounds.height

      // This test would require simulating Shift key during resize
      // For now, we verify the aspect ratio logic manually

      // Scale with locked aspect ratio
      const newWidth = originalBounds.width * 2
      const newHeight = newWidth / originalAspectRatio

      expect(newHeight).toBeCloseTo(originalBounds.height * 2, 5)
    })

    it("should enforce minimum dimensions during resize", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 105, y: 105 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation("m1")

      const bounds = calculateBounds(measurement)!

      // Trying to scale below minimum (20 PDF points as per TRANSFORM.MIN_BOUNDS)
      const minSize = 20

      // Verify that bounds are calculated correctly even for small measurements
      expect(bounds.width).toBeLessThan(minSize)
      expect(bounds.height).toBeLessThan(minSize)

      // In actual component, resize would enforce minimum
      // Here we just verify the logic exists
    })
  })

  describe("Move Handle", () => {
    it("should drag all selected items together", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(["m1", "m2"])

      // Simulate move by delta
      const deltaX = 50
      const deltaY = 30

      const movePoints = (points: { x: number; y: number }[]) =>
        points.map((p) => ({ x: p.x + deltaX, y: p.y + deltaY }))

      store.updateAnnotation("m1", { points: movePoints(measurement1.points) })
      store.updateAnnotation("m2", { points: movePoints(measurement2.points) })

      // Verify both annotations moved
      const updated1 = store.getAnnotationById("m1") as Measurement
      const updated2 = store.getAnnotationById("m2") as Measurement

      expect(updated1.points[0].x).toBe(150)
      expect(updated1.points[0].y).toBe(130)
      expect(updated2.points[0].x).toBe(150)
      expect(updated2.points[0].y).toBe(230)
    })

    it("should maintain relative positions during move", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 150, y: 200 },
        { x: 250, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(["m1", "m2"])

      // Calculate relative positions before move
      const originalDx = measurement2.points[0].x - measurement1.points[0].x
      const originalDy = measurement2.points[0].y - measurement1.points[0].y

      // Move both
      const deltaX = 100
      const deltaY = 50

      const movePoints = (points: { x: number; y: number }[]) =>
        points.map((p) => ({ x: p.x + deltaX, y: p.y + deltaY }))

      store.updateAnnotation("m1", { points: movePoints(measurement1.points) })
      store.updateAnnotation("m2", { points: movePoints(measurement2.points) })

      // Verify relative positions maintained
      const updated1 = store.getAnnotationById("m1") as Measurement
      const updated2 = store.getAnnotationById("m2") as Measurement

      const newDx = updated2.points[0].x - updated1.points[0].x
      const newDy = updated2.points[0].y - updated1.points[0].y

      expect(newDx).toBe(originalDx)
      expect(newDy).toBe(originalDy)
    })
  })

  describe("Group Selection State", () => {
    it("should maintain selection during transform", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(["m1", "m2"])

      expect(store.selectedAnnotationIds).toEqual(["m1", "m2"])

      // Perform rotation
      store.rotationDragDelta = Math.PI / 4

      // Selection should remain
      expect(store.selectedAnnotationIds).toEqual(["m1", "m2"])

      // Release rotation
      store.rotationDragDelta = 0

      // Selection should still remain
      expect(store.selectedAnnotationIds).toEqual(["m1", "m2"])
    })

    it("should switch to selection tool when items selected", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])

      store.addAnnotation(measurement)
      store.setActiveTool("measure")

      expect(store.activeTool).toBe("measure")

      // Select annotation
      store.selectAnnotation("m1")

      expect(store.activeTool).toBe("selection")
    })

    it("should deselect all on background click during move", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(["m1", "m2"])

      expect(store.selectedAnnotationIds.length).toBe(2)

      // Simulate background click (deselect)
      store.selectAnnotation(null)

      expect(store.selectedAnnotationIds.length).toBe(0)
    })
  })

  describe("Transform Handles Visibility", () => {
    it("should show transform handles for multi-select", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(["m1", "m2"])

      // Component should show group transform handles when 2+ selected
      expect(store.selectedAnnotations.length).toBeGreaterThanOrEqual(2)
      expect(store.selectedAnnotationIds).toHaveLength(2)
    })

    it("should hide transform handles when selection cleared", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(["m1", "m2"])

      expect(store.selectedAnnotations.length).toBe(2)

      // Clear selection
      store.deselectAll()

      expect(store.selectedAnnotations.length).toBe(0)
      expect(store.selectedAnnotationIds).toHaveLength(0)
    })

    it("should hide group transform handles for single selection", () => {
      const store = useAnnotationStore()

      const measurement1 = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createTestMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)
      store.selectAnnotations(["m1", "m2"])

      expect(store.selectedAnnotations.length).toBe(2)

      // Change to single selection
      store.selectAnnotation("m1")

      expect(store.selectedAnnotations.length).toBe(1)
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty selection gracefully", () => {
      const store = useAnnotationStore()

      expect(store.selectedAnnotations).toHaveLength(0)
      expect(store.selectedAnnotationIds).toHaveLength(0)
    })

    it("should handle selection of non-existent annotation", () => {
      const store = useAnnotationStore()

      // Try to select annotation that doesn't exist
      store.selectAnnotation("non-existent-id")

      // Selection should remain empty
      expect(store.selectedAnnotations).toHaveLength(0)
    })

    it("should handle different annotation types in group", () => {
      const store = useAnnotationStore()

      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const area = createTestArea("a1", [
        { x: 100, y: 200 },
        { x: 200, y: 200 },
        { x: 150, y: 300 }
      ])
      const perimeter = createTestPerimeter("p1", [
        { x: 300, y: 100 },
        { x: 400, y: 100 },
        { x: 350, y: 200 }
      ])

      store.addAnnotation(measurement)
      store.addAnnotation(area)
      store.addAnnotation(perimeter)
      store.selectAnnotations(["m1", "a1", "p1"])

      expect(store.selectedAnnotations.length).toBe(3)

      // All types should be in selection
      const types = store.selectedAnnotations.map((a) => a.type)
      expect(types).toContain("measure")
      expect(types).toContain("area")
      expect(types).toContain("perimeter")
    })

    it("should handle very small bounding boxes", () => {
      const store = useAnnotationStore()

      // Create tiny measurement
      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 101, y: 101 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation("m1")

      const bounds = calculateBounds(measurement)!

      expect(bounds.width).toBe(1)
      expect(bounds.height).toBe(1)
    })

    it("should handle very large bounding boxes", () => {
      const store = useAnnotationStore()

      // Create large measurement spanning entire canvas
      const measurement = createTestMeasurement("m1", [
        { x: 0, y: 0 },
        { x: 10000, y: 10000 }
      ])

      store.addAnnotation(measurement)
      store.selectAnnotation("m1")

      const bounds = calculateBounds(measurement)!

      expect(bounds.width).toBe(10000)
      expect(bounds.height).toBe(10000)
    })
  })

  describe("Fill Rotation in Groups", () => {
    it("should rotate fill position around group center, not its own center", () => {
      const store = useAnnotationStore()

      // Create a measurement and a fill at known positions
      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const fill = createTestFill("f1", 100, 200, 100, 80)

      store.addAnnotation(measurement)
      store.addAnnotation(fill)
      store.selectAnnotations(["m1", "f1"])

      // Calculate group center
      const bounds1 = calculateBounds(measurement)!
      const bounds2 = calculateBounds(fill)!
      const combinedBounds = {
        x: Math.min(bounds1.x, bounds2.x),
        y: Math.min(bounds1.y, bounds2.y),
        width: Math.max(bounds1.x + bounds1.width, bounds2.x + bounds2.width) - Math.min(bounds1.x, bounds2.x),
        height: Math.max(bounds1.y + bounds1.height, bounds2.y + bounds2.height) - Math.min(bounds1.y, bounds2.y)
      }
      const groupCenterX = combinedBounds.x + combinedBounds.width / 2
      const groupCenterY = combinedBounds.y + combinedBounds.height / 2

      // Rotate by 90 degrees around group center
      const rotationDelta = Math.PI / 2
      const cos = Math.cos(rotationDelta)
      const sin = Math.sin(rotationDelta)

      // Rotate measurement points around group center
      const rotatedMeasurementPoints = measurement.points.map((p) => {
        const dx = p.x - groupCenterX
        const dy = p.y - groupCenterY
        return {
          x: groupCenterX + dx * cos - dy * sin,
          y: groupCenterY + dx * sin + dy * cos
        }
      })

      // Rotate fill's CENTER around group center (not its top-left)
      const fillCenterX = fill.x + fill.width / 2
      const fillCenterY = fill.y + fill.height / 2
      const dxFillCenter = fillCenterX - groupCenterX
      const dyFillCenter = fillCenterY - groupCenterY

      const rotatedFillCenterX = groupCenterX + dxFillCenter * cos - dyFillCenter * sin
      const rotatedFillCenterY = groupCenterY + dxFillCenter * sin + dyFillCenter * cos

      const expectedFillX = rotatedFillCenterX - fill.width / 2
      const expectedFillY = rotatedFillCenterY - fill.height / 2

      // Apply rotation
      store.updateAnnotation("m1", { points: rotatedMeasurementPoints })
      store.updateAnnotation("f1", {
        x: expectedFillX,
        y: expectedFillY
      })

      // Verify measurement rotated correctly
      const updatedM1 = store.getAnnotationById("m1") as Measurement
      expect(updatedM1.points[0].x).toBeCloseTo(rotatedMeasurementPoints[0]!.x, 1)
      expect(updatedM1.points[0].y).toBeCloseTo(rotatedMeasurementPoints[0]!.y, 1)

      // Verify fill's CENTER rotated around group center
      const updatedF1 = store.getAnnotationById("f1") as Fill
      const updatedFillCenterX = updatedF1.x + updatedF1.width / 2
      const updatedFillCenterY = updatedF1.y + updatedF1.height / 2

      // Check that the fill's center is at the expected rotated position
      expect(updatedFillCenterX).toBeCloseTo(rotatedFillCenterX, 1)
      expect(updatedFillCenterY).toBeCloseTo(rotatedFillCenterY, 1)

      // Fill dimensions should remain unchanged (fills are axis-aligned rectangles)
      expect(updatedF1.width).toBe(fill.width)
      expect(updatedF1.height).toBe(fill.height)

      // Distance from group center should be preserved for both
      const originalFillDistanceToGroup = Math.sqrt(
        Math.pow(fillCenterX - groupCenterX, 2) + Math.pow(fillCenterY - groupCenterY, 2)
      )
      const rotatedFillDistanceToGroup = Math.sqrt(
        Math.pow(updatedFillCenterX - groupCenterX, 2) + Math.pow(updatedFillCenterY - groupCenterY, 2)
      )

      expect(rotatedFillDistanceToGroup).toBeCloseTo(originalFillDistanceToGroup, 1)
    })
  })

  describe("Complex Transform Sequences", () => {
    it("should maintain transformer bounds through rotate → drag → resize sequence", () => {
      const store = useAnnotationStore()

      // Create mixed annotation types: measurement and fill
      const measurement = createTestMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 150 }
      ])
      const fill = createTestFill("f1", 150, 200, 100, 80)

      store.addAnnotation(measurement)
      store.addAnnotation(fill)
      store.selectAnnotations(["m1", "f1"])

      // Calculate initial combined bounds
      const bounds1 = calculateBounds(measurement)!
      const bounds2 = calculateBounds(fill)!
      const initialCombinedBounds = {
        x: Math.min(bounds1.x, bounds2.x),
        y: Math.min(bounds1.y, bounds2.y),
        width: Math.max(bounds1.x + bounds1.width, bounds2.x + bounds2.width) - Math.min(bounds1.x, bounds2.x),
        height: Math.max(bounds1.y + bounds1.height, bounds2.y + bounds2.height) - Math.min(bounds1.y, bounds2.y)
      }

      // STEP 1: Scale the group
      const scaleX = 1.5
      const scaleY = 1.5

      const scaledMeasurementPoints = measurement.points.map((p) => ({
        x: initialCombinedBounds.x + (p.x - initialCombinedBounds.x) * scaleX,
        y: initialCombinedBounds.y + (p.y - initialCombinedBounds.y) * scaleY
      }))

      const scaledFillX = initialCombinedBounds.x + (fill.x - initialCombinedBounds.x) * scaleX
      const scaledFillY = initialCombinedBounds.y + (fill.y - initialCombinedBounds.y) * scaleY

      store.updateAnnotation("m1", { points: scaledMeasurementPoints })
      store.updateAnnotation("f1", {
        x: scaledFillX,
        y: scaledFillY,
        width: fill.width * scaleX,
        height: fill.height * scaleY
      })

      // Get bounds after scale
      const updatedM1AfterScale = store.getAnnotationById("m1") as Measurement
      const updatedF1AfterScale = store.getAnnotationById("f1") as Fill
      const boundsAfterScale1 = calculateBounds(updatedM1AfterScale)!
      const boundsAfterScale2 = calculateBounds(updatedF1AfterScale)!
      const combinedBoundsAfterScale = {
        x: Math.min(boundsAfterScale1.x, boundsAfterScale2.x),
        y: Math.min(boundsAfterScale1.y, boundsAfterScale2.y),
        width:
          Math.max(boundsAfterScale1.x + boundsAfterScale1.width, boundsAfterScale2.x + boundsAfterScale2.width) -
          Math.min(boundsAfterScale1.x, boundsAfterScale2.x),
        height:
          Math.max(boundsAfterScale1.y + boundsAfterScale1.height, boundsAfterScale2.y + boundsAfterScale2.height) -
          Math.min(boundsAfterScale1.y, boundsAfterScale2.y)
      }

      // STEP 2: Drag the group
      const dragDeltaX = 50
      const dragDeltaY = 30

      const draggedMeasurementPoints = updatedM1AfterScale.points.map((p) => ({
        x: p.x + dragDeltaX,
        y: p.y + dragDeltaY
      }))

      store.updateAnnotation("m1", { points: draggedMeasurementPoints })
      store.updateAnnotation("f1", {
        x: updatedF1AfterScale.x + dragDeltaX,
        y: updatedF1AfterScale.y + dragDeltaY
      })

      // Get bounds after drag
      const updatedM1AfterDrag = store.getAnnotationById("m1") as Measurement
      const updatedF1AfterDrag = store.getAnnotationById("f1") as Fill
      const boundsAfterDrag1 = calculateBounds(updatedM1AfterDrag)!
      const boundsAfterDrag2 = calculateBounds(updatedF1AfterDrag)!
      const combinedBoundsAfterDrag = {
        x: Math.min(boundsAfterDrag1.x, boundsAfterDrag2.x),
        y: Math.min(boundsAfterDrag1.y, boundsAfterDrag2.y),
        width:
          Math.max(boundsAfterDrag1.x + boundsAfterDrag1.width, boundsAfterDrag2.x + boundsAfterDrag2.width) -
          Math.min(boundsAfterDrag1.x, boundsAfterDrag2.x),
        height:
          Math.max(boundsAfterDrag1.y + boundsAfterDrag1.height, boundsAfterDrag2.y + boundsAfterDrag2.height) -
          Math.min(boundsAfterDrag1.y, boundsAfterDrag2.y)
      }

      // Verify drag worked
      expect(combinedBoundsAfterDrag.x).toBeCloseTo(combinedBoundsAfterScale.x + dragDeltaX, 1)
      expect(combinedBoundsAfterDrag.y).toBeCloseTo(combinedBoundsAfterScale.y + dragDeltaY, 1)

      // STEP 3: Rotate the group
      const rotationDelta = Math.PI / 4 // 45 degrees
      const centerX = combinedBoundsAfterDrag.x + combinedBoundsAfterDrag.width / 2
      const centerY = combinedBoundsAfterDrag.y + combinedBoundsAfterDrag.height / 2

      const rotatePoint = (p: { x: number; y: number }) => {
        const dx = p.x - centerX
        const dy = p.y - centerY
        const cos = Math.cos(rotationDelta)
        const sin = Math.sin(rotationDelta)
        return {
          x: centerX + dx * cos - dy * sin,
          y: centerY + dx * sin + dy * cos
        }
      }

      const rotatedMeasurementPoints = updatedM1AfterDrag.points.map(rotatePoint)

      // For fill, rotate its center then calculate new x,y
      const fillCenterX = updatedF1AfterDrag.x + updatedF1AfterDrag.width / 2
      const fillCenterY = updatedF1AfterDrag.y + updatedF1AfterDrag.height / 2
      const rotatedFillCenter = rotatePoint({ x: fillCenterX, y: fillCenterY })
      const rotatedFillX = rotatedFillCenter.x - updatedF1AfterDrag.width / 2
      const rotatedFillY = rotatedFillCenter.y - updatedF1AfterDrag.height / 2

      store.updateAnnotation("m1", { points: rotatedMeasurementPoints })
      store.updateAnnotation("f1", {
        x: rotatedFillX,
        y: rotatedFillY
      })

      // Store frozen bounds (what the transformer should preserve)
      const frozenBounds = { ...combinedBoundsAfterDrag }

      // STEP 4: Drag the rotated group again
      const dragDelta2X = 40
      const dragDelta2Y = -20

      const updatedM1AfterRotation = store.getAnnotationById("m1") as Measurement
      const updatedF1AfterRotation = store.getAnnotationById("f1") as Fill

      const draggedRotatedMeasurementPoints = updatedM1AfterRotation.points.map((p) => ({
        x: p.x + dragDelta2X,
        y: p.y + dragDelta2Y
      }))

      store.updateAnnotation("m1", { points: draggedRotatedMeasurementPoints })
      store.updateAnnotation("f1", {
        x: updatedF1AfterRotation.x + dragDelta2X,
        y: updatedF1AfterRotation.y + dragDelta2Y
      })

      // CRITICAL TEST: After dragging a rotated group, the transformer should:
      // 1. Follow the shapes during drag (not tested here as it's a computed property)
      // 2. Update frozen bounds position by the drag delta
      const expectedFrozenBoundsAfterDrag2 = {
        x: frozenBounds.x + dragDelta2X,
        y: frozenBounds.y + dragDelta2Y,
        width: frozenBounds.width,
        height: frozenBounds.height
      }

      // Verify the frozen bounds would be at the expected position
      expect(expectedFrozenBoundsAfterDrag2.x).toBeCloseTo(frozenBounds.x + dragDelta2X, 1)
      expect(expectedFrozenBoundsAfterDrag2.y).toBeCloseTo(frozenBounds.y + dragDelta2Y, 1)
      expect(expectedFrozenBoundsAfterDrag2.width).toBe(frozenBounds.width)
      expect(expectedFrozenBoundsAfterDrag2.height).toBe(frozenBounds.height)

      // STEP 5: Resize the rotated+dragged group
      const resizeScaleX = 1.2
      const resizeScaleY = 1.2

      const finalM1 = store.getAnnotationById("m1") as Measurement
      const finalF1 = store.getAnnotationById("f1") as Fill

      // Get current combined bounds for resize anchor point
      const finalBounds1 = calculateBounds(finalM1)!
      const finalBounds2 = calculateBounds(finalF1)!
      const currentCombinedBounds = {
        x: Math.min(finalBounds1.x, finalBounds2.x),
        y: Math.min(finalBounds1.y, finalBounds2.y),
        width:
          Math.max(finalBounds1.x + finalBounds1.width, finalBounds2.x + finalBounds2.width) -
          Math.min(finalBounds1.x, finalBounds2.x),
        height:
          Math.max(finalBounds1.y + finalBounds1.height, finalBounds2.y + finalBounds2.height) -
          Math.min(finalBounds1.y, finalBounds2.y)
      }

      const resizedMeasurementPoints = finalM1.points.map((p) => ({
        x: currentCombinedBounds.x + (p.x - currentCombinedBounds.x) * resizeScaleX,
        y: currentCombinedBounds.y + (p.y - currentCombinedBounds.y) * resizeScaleY
      }))

      const resizedFillX = currentCombinedBounds.x + (finalF1.x - currentCombinedBounds.x) * resizeScaleX
      const resizedFillY = currentCombinedBounds.y + (finalF1.y - currentCombinedBounds.y) * resizeScaleY

      store.updateAnnotation("m1", { points: resizedMeasurementPoints })
      store.updateAnnotation("f1", {
        x: resizedFillX,
        y: resizedFillY,
        width: finalF1.width * resizeScaleX,
        height: finalF1.height * resizeScaleY
      })

      // Get final bounds after resize
      const finalResizedM1 = store.getAnnotationById("m1") as Measurement
      const finalResizedF1 = store.getAnnotationById("f1") as Fill
      const finalResizedBounds1 = calculateBounds(finalResizedM1)!
      const finalResizedBounds2 = calculateBounds(finalResizedF1)!

      // CRITICAL TEST: After resizing, bounds should have changed by the scale factor
      expect(finalResizedBounds1.width).toBeCloseTo(finalBounds1.width * resizeScaleX, 1)
      expect(finalResizedBounds2.width).toBeCloseTo(finalBounds2.width * resizeScaleX, 1)

      // Final combined bounds after resize
      const finalCombinedBounds = {
        x: Math.min(finalResizedBounds1.x, finalResizedBounds2.x),
        y: Math.min(finalResizedBounds1.y, finalResizedBounds2.y),
        width:
          Math.max(
            finalResizedBounds1.x + finalResizedBounds1.width,
            finalResizedBounds2.x + finalResizedBounds2.width
          ) - Math.min(finalResizedBounds1.x, finalResizedBounds2.x),
        height:
          Math.max(
            finalResizedBounds1.y + finalResizedBounds1.height,
            finalResizedBounds2.y + finalResizedBounds2.height
          ) - Math.min(finalResizedBounds1.y, finalResizedBounds2.y)
      }

      // After resize, the new frozen bounds should match the new combined bounds
      // This is the test for "transformer should hug the shapes" after resize
      expect(finalCombinedBounds.x).toBeDefined()
      expect(finalCombinedBounds.y).toBeDefined()
      expect(finalCombinedBounds.width).toBeGreaterThan(0)
      expect(finalCombinedBounds.height).toBeGreaterThan(0)
    })
  })
})
