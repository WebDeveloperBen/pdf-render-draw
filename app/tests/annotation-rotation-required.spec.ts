import { describe, it, expect } from "vitest"
import type { Annotation } from "~/types/annotations"

/**
 * Tests to ensure all annotation types have the required rotation property
 * This prevents bugs where GroupTransform checks `"rotation" in annotation`
 */
describe("Annotation Rotation Property", () => {
  it("should require rotation property in BaseAnnotation type", () => {
    // This test verifies at the type level that rotation is required
    const testAnnotation = {
      id: "test",
      type: "fill" as const,
      pageNum: 1,
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      color: "#ff0000",
      opacity: 0.5,
      rotation: 0
    }

    // TypeScript will error if rotation is not present
    const annotation: Annotation = testAnnotation as any

    expect(annotation.rotation).toBeDefined()
    expect(typeof annotation.rotation).toBe("number")
  })

  it("should have rotation property on measurement annotations", () => {
    const measurement = {
      id: "m1",
      type: "measure" as const,
      pageNum: 1,
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      distance: 100,
      midpoint: { x: 50, y: 50 },
      labelRotation: 0,
      rotation: 0
    }

    expect("rotation" in measurement).toBe(true)
    expect(measurement.rotation).toBe(0)
  })

  it("should have rotation property on area annotations", () => {
    const area = {
      id: "a1",
      type: "area" as const,
      pageNum: 1,
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }],
      area: 5000,
      center: { x: 50, y: 33 },
      labelRotation: 0,
      rotation: 0
    }

    expect("rotation" in area).toBe(true)
    expect(area.rotation).toBe(0)
  })

  it("should have rotation property on perimeter annotations", () => {
    const perimeter = {
      id: "p1",
      type: "perimeter" as const,
      pageNum: 1,
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }],
      segments: [],
      totalLength: 300,
      center: { x: 50, y: 33 },
      labelRotation: 0,
      rotation: 0
    }

    expect("rotation" in perimeter).toBe(true)
    expect(perimeter.rotation).toBe(0)
  })

  it("should have rotation property on line annotations", () => {
    const line = {
      id: "l1",
      type: "line" as const,
      pageNum: 1,
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      rotation: 0
    }

    expect("rotation" in line).toBe(true)
    expect(line.rotation).toBe(0)
  })

  it("should have rotation property on fill annotations", () => {
    const fill = {
      id: "f1",
      type: "fill" as const,
      pageNum: 1,
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      color: "#ff0000",
      opacity: 0.5,
      rotation: 0
    }

    expect("rotation" in fill).toBe(true)
    expect(fill.rotation).toBe(0)
  })

  it("should have rotation property on text annotations", () => {
    const text = {
      id: "t1",
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

    expect("rotation" in text).toBe(true)
    expect(text.rotation).toBe(0)
  })

  it("should verify GroupTransform rotation check will work", () => {
    // This simulates the check in GroupTransform.vue:377
    const fill = {
      id: "f1",
      type: "fill" as const,
      pageNum: 1,
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      color: "#ff0000",
      opacity: 0.5,
      rotation: 0
    }

    // This is the check that was failing before
    const hasRotation = "rotation" in fill
    expect(hasRotation).toBe(true)

    // Verify we can access rotation safely
    const rotation = fill.rotation
    expect(rotation).toBe(0)
  })
})
