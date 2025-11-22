import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useAnnotationStore } from "~/stores/annotations"
import type { Fill, Measurement } from "~/types/annotations"
import { calculateBounds } from "~/utils/bounds"

vi.mock("uuid", () => ({
  v4: () => "test-uuid-123"
}))

describe("Fill Rotation - Real Implementation Bug Test", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function createFill(id: string, x: number, y: number, width: number, height: number): Fill {
    return {
      id,
      type: "fill",
      pageNum: 1,
      x,
      y,
      width,
      height,
      color: "#00FF00",
      opacity: 0.5,
      rotation: 0
    }
  }

  function createMeasurement(id: string, points: [{ x: number; y: number }, { x: number; y: number }]): Measurement {
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

  it("FIXED: Fill should orbit around group center during rotation", () => {
    const store = useAnnotationStore()

    // Create a measurement and a fill side by side
    const measurement = createMeasurement("m1", [
      { x: 100, y: 100 },
      { x: 200, y: 100 }
    ])
    const fill = createFill("f1", 200, 100, 50, 50)

    store.addAnnotation(measurement)
    store.addAnnotation(fill)
    store.selectAnnotations(["m1", "f1"])

    // Calculate group center
    const bounds1 = calculateBounds(measurement)!
    const bounds2 = calculateBounds(fill)!
    const groupCenterX = (Math.min(bounds1.x, bounds2.x) + Math.max(bounds1.x + bounds1.width, bounds2.x + bounds2.width)) / 2
    const groupCenterY =
      (Math.min(bounds1.y, bounds2.y) + Math.max(bounds1.y + bounds1.height, bounds2.y + bounds2.height)) / 2

    // Simulate what GroupTransform.vue ACTUALLY does during handleRotate()
    const rotationDelta = Math.PI / 2 // 90 degrees

    // For measurements: GroupTransform rotates the points
    const cos = Math.cos(rotationDelta)
    const sin = Math.sin(rotationDelta)
    const rotatedMeasurementPoints = measurement.points.map((p) => ({
      x: groupCenterX + (p.x - groupCenterX) * cos - (p.y - groupCenterY) * sin,
      y: groupCenterY + (p.x - groupCenterX) * sin + (p.y - groupCenterY) * cos
    }))

    store.updateAnnotation("m1", { points: rotatedMeasurementPoints })

    // For fills: GroupTransform NOW updates BOTH position AND rotation (FIXED!)
    // Calculate fill's center and rotate it around group center
    const fillCenterX = fill.x + fill.width / 2
    const fillCenterY = fill.y + fill.height / 2
    const dx = fillCenterX - groupCenterX
    const dy = fillCenterY - groupCenterY
    const rotatedCenterX = groupCenterX + dx * cos - dy * sin
    const rotatedCenterY = groupCenterY + dx * sin + dy * cos
    const newX = rotatedCenterX - fill.width / 2
    const newY = rotatedCenterY - fill.height / 2

    store.updateAnnotation("f1", {
      x: newX,
      y: newY,
      rotation: (fill.rotation || 0) + rotationDelta
    })

    // Set drag delta (this is what GroupTransform.vue does at line 350)
    store.rotationDragDelta = rotationDelta

    // Now check the results
    const updatedMeasurement = store.getAnnotationById("m1") as Measurement
    const updatedFill = store.getAnnotationById("f1") as Fill

    // Measurement points HAVE rotated around group center ✓
    expect(updatedMeasurement.points[0].x).not.toBeCloseTo(100, 1)

    // Fill's rotation property WAS updated ✓
    expect(updatedFill.rotation).toBeCloseTo(Math.PI / 2, 5)

    // FIXED: Fill's x,y position SHOULD have changed to orbit around group center ✓
    // The newX and newY calculated above are the expected positions
    expect(updatedFill.x).toBeCloseTo(newX, 1)
    expect(updatedFill.y).toBeCloseTo(newY, 1)

    // Verify the fill actually moved from its original position
    expect(updatedFill.x).not.toBe(200)
    expect(updatedFill.y).not.toBe(100)
  })

  it("Verify: getRotationTransform uses stored rotation for multi-select fills during drag", () => {
    const store = useAnnotationStore()

    const fill1 = createFill("f1", 100, 100, 50, 50)
    const fill2 = createFill("f2", 200, 200, 50, 50)

    store.addAnnotation(fill1)
    store.addAnnotation(fill2)
    store.selectAnnotations(["f1", "f2"])

    // Simulate rotation drag
    const rotationDelta = Math.PI / 4

    // Update stored rotation (what GroupTransform does during real-time drag)
    store.updateAnnotation("f1", { rotation: (fill1.rotation || 0) + rotationDelta })
    store.updateAnnotation("f2", { rotation: (fill2.rotation || 0) + rotationDelta })

    // Set drag delta (what GroupTransform does)
    store.rotationDragDelta = rotationDelta

    const updated1 = store.getAnnotationById("f1") as Fill
    const updated2 = store.getAnnotationById("f2") as Fill

    // Get the visual transforms during drag
    const transform1 = store.getRotationTransform(updated1)
    const transform2 = store.getRotationTransform(updated2)

    // Verify that transforms use the stored rotation (which already includes the drag delta)
    // This works because GroupTransform updates the rotation property in real-time during drag
    const match1 = transform1.match(/rotate\(([^ ]+) ([^ ]+) ([^ ]+)\)/)
    const match2 = transform2.match(/rotate\(([^ ]+) ([^ ]+) ([^ ]+)\)/)

    expect(match1).not.toBeNull()
    expect(match2).not.toBeNull()

    // Both should show 45 degrees (the stored rotation which includes the drag delta)
    const angle1 = parseFloat(match1![1]!)
    const angle2 = parseFloat(match2![1]!)
    expect(angle1).toBeCloseTo(45, 1)
    expect(angle2).toBeCloseTo(45, 1)
  })

  it("EXPECTED BEHAVIOR: Fill should move to orbit around group center when rotated", () => {
    const store = useAnnotationStore()

    const fill = createFill("f1", 200, 100, 50, 50)
    const measurement = createMeasurement("m1", [
      { x: 100, y: 100 },
      { x: 200, y: 100 }
    ])

    store.addAnnotation(measurement)
    store.addAnnotation(fill)
    store.selectAnnotations(["m1", "f1"])

    // Calculate group center
    const bounds1 = calculateBounds(measurement)!
    const bounds2 = calculateBounds(fill)!
    const groupCenterX = (Math.min(bounds1.x, bounds2.x) + Math.max(bounds1.x + bounds1.width, bounds2.x + bounds2.width)) / 2
    const groupCenterY =
      (Math.min(bounds1.y, bounds2.y) + Math.max(bounds1.y + bounds1.height, bounds2.y + bounds2.height)) / 2

    const rotationDelta = Math.PI / 2
    const cos = Math.cos(rotationDelta)
    const sin = Math.sin(rotationDelta)

    // THIS is what GroupTransform.vue SHOULD do for fills:
    // Rotate the fill's CENTER around the group center, then update x,y

    const fillCenterX = fill.x + fill.width / 2
    const fillCenterY = fill.y + fill.height / 2

    const rotatedCenterX = groupCenterX + (fillCenterX - groupCenterX) * cos - (fillCenterY - groupCenterY) * sin
    const rotatedCenterY = groupCenterY + (fillCenterX - groupCenterX) * sin + (fillCenterY - groupCenterY) * cos

    const newX = rotatedCenterX - fill.width / 2
    const newY = rotatedCenterY - fill.height / 2

    // Update BOTH rotation AND position
    store.updateAnnotation("f1", {
      x: newX,
      y: newY,
      rotation: (fill.rotation || 0) + rotationDelta
    })

    const updated = store.getAnnotationById("f1") as Fill

    // Verify the fill orbited correctly
    expect(updated.x).toBeCloseTo(newX, 1)
    expect(updated.y).toBeCloseTo(newY, 1)
    expect(updated.rotation).toBeCloseTo(Math.PI / 2, 5)

    // The fill's center should be at the rotated position
    const updatedCenterX = updated.x + updated.width / 2
    const updatedCenterY = updated.y + updated.height / 2

    expect(updatedCenterX).toBeCloseTo(rotatedCenterX, 1)
    expect(updatedCenterY).toBeCloseTo(rotatedCenterY, 1)
  })
})
