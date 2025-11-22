import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useAnnotationStore } from "~/stores/annotations"
import type { Fill, Measurement, Area, Perimeter, PerimeterSegment } from "~/types/annotations"
import { calculateBounds } from "~/utils/bounds"

// Mock UUID
vi.mock("uuid", () => ({
  v4: () => "test-uuid-123"
}))

describe("Fill Rotation - Basic Group Rotation", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // Helper: Create test fill
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

  // Helper: Create test measurement
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

  // Helper: Create test area
  function createArea(id: string, points: { x: number; y: number }[]): Area {
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

  // Helper: Create test perimeter
  function createPerimeter(id: string, points: { x: number; y: number }[]): Perimeter {
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

  // Helper: Calculate group center
  function calculateGroupCenter(annotations: any[]) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity

    for (const ann of annotations) {
      const bounds = calculateBounds(ann)!
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.width)
      maxY = Math.max(maxY, bounds.y + bounds.height)
    }

    return {
      x: minX + (maxX - minX) / 2,
      y: minY + (maxY - minY) / 2
    }
  }

  // Helper: Apply group rotation
  function applyGroupRotation(store: any, rotationRadians: number, groupCenter: { x: number; y: number }) {
    // This simulates what GroupTransform.vue does
    const selectedAnns = store.selectedAnnotations

    selectedAnns.forEach((ann: any) => {
      if (ann.type === "fill" || ann.type === "text") {
        // For fills: only update rotation property
        const currentRotation = ann.rotation || 0
        store.updateAnnotation(ann.id, {
          rotation: currentRotation + rotationRadians
        })
      } else if ("points" in ann && ann.points && Array.isArray(ann.points)) {
        // For point-based: rotate points around group center
        const cos = Math.cos(rotationRadians)
        const sin = Math.sin(rotationRadians)

        const rotatedPoints = ann.points.map((p: { x: number; y: number }) => ({
          x: groupCenter.x + (p.x - groupCenter.x) * cos - (p.y - groupCenter.y) * sin,
          y: groupCenter.y + (p.x - groupCenter.x) * sin + (p.y - groupCenter.y) * cos
        }))

        store.updateAnnotation(ann.id, { points: rotatedPoints })
      }
    })
  }

  describe("Test 1-6: Basic Group Rotation Scenarios", () => {
    it("Test 1: should rotate a group containing only fills", () => {
      const store = useAnnotationStore()

      const fill1 = createFill("f1", 100, 100, 50, 50)
      const fill2 = createFill("f2", 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.selectAnnotations(["f1", "f2"])

      const groupCenter = calculateGroupCenter([fill1, fill2])
      const rotationAngle = Math.PI / 4 // 45 degrees

      applyGroupRotation(store, rotationAngle, groupCenter)

      const updated1 = store.getAnnotationById("f1") as Fill
      const updated2 = store.getAnnotationById("f2") as Fill

      // Verify rotation property updated
      expect(updated1.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(updated2.rotation).toBeCloseTo(Math.PI / 4, 5)

      // Verify position hasn't changed (rotation transform handles it)
      expect(updated1.x).toBe(100)
      expect(updated1.y).toBe(100)
      expect(updated2.x).toBe(200)
      expect(updated2.y).toBe(100)
    })

    it("Test 2: should rotate a group containing only measurements", () => {
      const store = useAnnotationStore()

      const m1 = createMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const m2 = createMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(m1)
      store.addAnnotation(m2)
      store.selectAnnotations(["m1", "m2"])

      const groupCenter = calculateGroupCenter([m1, m2])
      const rotationAngle = Math.PI / 2 // 90 degrees

      applyGroupRotation(store, rotationAngle, groupCenter)

      const updated1 = store.getAnnotationById("m1") as Measurement
      const updated2 = store.getAnnotationById("m2") as Measurement

      // After 90° rotation around (150, 150):
      // m1 point (100, 100) -> (200, 100)
      // m1 point (200, 100) -> (200, 200)
      expect(updated1.points[0].x).toBeCloseTo(200, 1)
      expect(updated1.points[0].y).toBeCloseTo(100, 1)
      expect(updated1.points[1].x).toBeCloseTo(200, 1)
      expect(updated1.points[1].y).toBeCloseTo(200, 1)

      // m2 point (100, 200) -> (100, 100)
      // m2 point (200, 200) -> (100, 200)
      expect(updated2.points[0].x).toBeCloseTo(100, 1)
      expect(updated2.points[0].y).toBeCloseTo(100, 1)
      expect(updated2.points[1].x).toBeCloseTo(100, 1)
      expect(updated2.points[1].y).toBeCloseTo(200, 1)
    })

    it("Test 3: should rotate a mixed group (measurements + fills)", () => {
      const store = useAnnotationStore()

      const measurement = createMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 150 }
      ])
      const fill = createFill("f1", 150, 200, 100, 80)

      store.addAnnotation(measurement)
      store.addAnnotation(fill)
      store.selectAnnotations(["m1", "f1"])

      const groupCenter = calculateGroupCenter([measurement, fill])
      const rotationAngle = Math.PI / 6 // 30 degrees

      applyGroupRotation(store, rotationAngle, groupCenter)

      const updatedM = store.getAnnotationById("m1") as Measurement
      const updatedF = store.getAnnotationById("f1") as Fill

      // Measurement points should have rotated
      expect(updatedM.points[0].x).not.toBe(100)

      // Fill rotation should be set, position unchanged
      expect(updatedF.rotation).toBeCloseTo(Math.PI / 6, 5)
      expect(updatedF.x).toBe(150)
      expect(updatedF.y).toBe(200)
    })

    it("Test 4: should rotate a group with areas + fills", () => {
      const store = useAnnotationStore()

      const area = createArea("a1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 150, y: 200 }
      ])
      const fill = createFill("f1", 200, 150, 50, 50)

      store.addAnnotation(area)
      store.addAnnotation(fill)
      store.selectAnnotations(["a1", "f1"])

      const groupCenter = calculateGroupCenter([area, fill])
      const rotationAngle = Math.PI / 3 // 60 degrees

      applyGroupRotation(store, rotationAngle, groupCenter)

      const updatedA = store.getAnnotationById("a1") as Area
      const updatedF = store.getAnnotationById("f1") as Fill

      // Area points should have rotated
      expect(updatedA.points[0]!.x).not.toBe(100)

      // Fill rotation should be set
      expect(updatedF.rotation).toBeCloseTo(Math.PI / 3, 5)
    })

    it("Test 5: should rotate a group with perimeters + fills", () => {
      const store = useAnnotationStore()

      const perimeter = createPerimeter("p1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 }
      ])
      const fill = createFill("f1", 150, 150, 40, 40)

      store.addAnnotation(perimeter)
      store.addAnnotation(fill)
      store.selectAnnotations(["p1", "f1"])

      const groupCenter = calculateGroupCenter([perimeter, fill])
      const rotationAngle = Math.PI / 4 // 45 degrees

      applyGroupRotation(store, rotationAngle, groupCenter)

      const updatedP = store.getAnnotationById("p1") as Perimeter
      const updatedF = store.getAnnotationById("f1") as Fill

      // Perimeter points should have rotated
      expect(updatedP.points[0]!.x).not.toBe(100)

      // Fill rotation should be set
      expect(updatedF.rotation).toBeCloseTo(Math.PI / 4, 5)
    })

    it("Test 6: should rotate a group with all annotation types", () => {
      const store = useAnnotationStore()

      const measurement = createMeasurement("m1", [
        { x: 50, y: 50 },
        { x: 100, y: 50 }
      ])
      const area = createArea("a1", [
        { x: 150, y: 50 },
        { x: 200, y: 50 },
        { x: 175, y: 100 }
      ])
      const perimeter = createPerimeter("p1", [
        { x: 50, y: 150 },
        { x: 100, y: 150 },
        { x: 100, y: 200 }
      ])
      const fill = createFill("f1", 150, 150, 50, 50)

      store.addAnnotation(measurement)
      store.addAnnotation(area)
      store.addAnnotation(perimeter)
      store.addAnnotation(fill)
      store.selectAnnotations(["m1", "a1", "p1", "f1"])

      const groupCenter = calculateGroupCenter([measurement, area, perimeter, fill])
      const rotationAngle = Math.PI / 2 // 90 degrees

      applyGroupRotation(store, rotationAngle, groupCenter)

      const updatedM = store.getAnnotationById("m1") as Measurement
      const updatedA = store.getAnnotationById("a1") as Area
      const updatedP = store.getAnnotationById("p1") as Perimeter
      const updatedF = store.getAnnotationById("f1") as Fill

      // All point-based annotations should have rotated points
      expect(updatedM.points[0].x).not.toBe(50)
      expect(updatedA.points[0]!.x).not.toBe(150)
      expect(updatedP.points[0]!.x).not.toBe(50)

      // Fill should have rotation set
      expect(updatedF.rotation).toBeCloseTo(Math.PI / 2, 5)
      expect(updatedF.x).toBe(150) // Position unchanged
      expect(updatedF.y).toBe(150)
    })
  })
})
