import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useAnnotationStore } from "~/stores/annotations"
import type { Fill, Measurement } from "~/types/annotations"
import { calculateBounds } from "~/utils/bounds"

vi.mock("uuid", () => ({
  v4: () => "test-uuid-123"
}))

describe("Fill Rotation - Individual vs Group Rotation Sequences", () => {
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

  function applyGroupRotation(store: any, rotationRadians: number, groupCenter: { x: number; y: number }) {
    const selectedAnns = store.selectedAnnotations

    selectedAnns.forEach((ann: any) => {
      if (ann.type === "fill" || ann.type === "text") {
        const currentRotation = ann.rotation || 0
        store.updateAnnotation(ann.id, {
          rotation: currentRotation + rotationRadians
        })
      } else if ("points" in ann) {
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

  describe("Test 7-10: Individual vs Group Rotation Sequences", () => {
    it("Test 7: group rotate → individually rotate fill → verify independence", () => {
      const store = useAnnotationStore()

      const fill1 = createFill("f1", 100, 100, 50, 50)
      const fill2 = createFill("f2", 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)

      // Step 1: Group rotate
      store.selectAnnotations(["f1", "f2"])
      const groupCenter = calculateGroupCenter([fill1, fill2])
      applyGroupRotation(store, Math.PI / 4, groupCenter) // 45°

      const afterGroup1 = store.getAnnotationById("f1") as Fill
      const afterGroup2 = store.getAnnotationById("f2") as Fill

      expect(afterGroup1.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(afterGroup2.rotation).toBeCloseTo(Math.PI / 4, 5)

      // Step 2: Individually rotate f1
      store.selectAnnotation("f1")
      store.updateAnnotation("f1", {
        rotation: (afterGroup1.rotation || 0) + Math.PI / 6 // +30°
      })

      const afterIndividual1 = store.getAnnotationById("f1") as Fill
      const afterIndividual2 = store.getAnnotationById("f2") as Fill

      // f1 should have cumulative rotation (45° + 30° = 75°)
      expect(afterIndividual1.rotation).toBeCloseTo(Math.PI / 4 + Math.PI / 6, 5)

      // f2 should still be at 45°
      expect(afterIndividual2.rotation).toBeCloseTo(Math.PI / 4, 5)
    })

    it("Test 8: group rotate → individually rotate measurement → verify independence", () => {
      const store = useAnnotationStore()

      const measurement1 = createMeasurement("m1", [
        { x: 100, y: 100 },
        { x: 200, y: 100 }
      ])
      const measurement2 = createMeasurement("m2", [
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ])

      store.addAnnotation(measurement1)
      store.addAnnotation(measurement2)

      // Group rotate
      store.selectAnnotations(["m1", "m2"])
      const groupCenter = calculateGroupCenter([measurement1, measurement2])
      applyGroupRotation(store, Math.PI / 4, groupCenter)

      const m1AfterGroup = store.getAnnotationById("m1") as Measurement
      const m2AfterGroup = store.getAnnotationById("m2") as Measurement
      const originalM1Points = [...m1AfterGroup.points]
      const m2PointsAfterGroup = [...m2AfterGroup.points] // Save m2's points after group rotation

      // Individually rotate m1 (rotate its points around its own center)
      store.selectAnnotation("m1")
      const m1Center = {
        x: (m1AfterGroup.points[0].x + m1AfterGroup.points[1].x) / 2,
        y: (m1AfterGroup.points[0].y + m1AfterGroup.points[1].y) / 2
      }

      const individualRotation = Math.PI / 6
      const cos = Math.cos(individualRotation)
      const sin = Math.sin(individualRotation)

      const individuallyRotatedPoints = m1AfterGroup.points.map((p: any) => ({
        x: m1Center.x + (p.x - m1Center.x) * cos - (p.y - m1Center.y) * sin,
        y: m1Center.y + (p.x - m1Center.x) * sin + (p.y - m1Center.y) * cos
      }))

      store.updateAnnotation("m1", { points: individuallyRotatedPoints })

      const m1Final = store.getAnnotationById("m1") as Measurement
      const m2Final = store.getAnnotationById("m2") as Measurement

      // m1 points should be different from after group rotation
      expect(m1Final.points[0].x).not.toBeCloseTo(originalM1Points[0]!.x, 1)

      // m2 should be unchanged from its group-rotated state (not affected by individual m1 rotation)
      expect(m2Final.points[0].x).toBeCloseTo(m2PointsAfterGroup[0]!.x, 1)
      expect(m2Final.points[0].y).toBeCloseTo(m2PointsAfterGroup[0]!.y, 1)
    })

    it("Test 9: individually rotate fill → then group rotate → verify cumulative", () => {
      const store = useAnnotationStore()

      const fill1 = createFill("f1", 100, 100, 50, 50)
      const fill2 = createFill("f2", 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)

      // Step 1: Individually rotate f1
      store.selectAnnotation("f1")
      store.updateAnnotation("f1", { rotation: Math.PI / 6 }) // 30°

      const afterIndividual = store.getAnnotationById("f1") as Fill
      expect(afterIndividual.rotation).toBeCloseTo(Math.PI / 6, 5)

      // Step 2: Group rotate both
      store.selectAnnotations(["f1", "f2"])
      const groupCenter = calculateGroupCenter([fill1, fill2])
      applyGroupRotation(store, Math.PI / 4, groupCenter) // +45°

      const final1 = store.getAnnotationById("f1") as Fill
      const final2 = store.getAnnotationById("f2") as Fill

      // f1 should have cumulative rotation (30° + 45° = 75°)
      expect(final1.rotation).toBeCloseTo(Math.PI / 6 + Math.PI / 4, 5)

      // f2 should only have group rotation (45°)
      expect(final2.rotation).toBeCloseTo(Math.PI / 4, 5)
    })

    it("Test 10: rotate group → deselect → reselect → rotate again → verify cumulative", () => {
      const store = useAnnotationStore()

      const fill1 = createFill("f1", 100, 100, 50, 50)
      const fill2 = createFill("f2", 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)

      // First group rotation
      store.selectAnnotations(["f1", "f2"])
      const groupCenter = calculateGroupCenter([fill1, fill2])
      applyGroupRotation(store, Math.PI / 4, groupCenter) // 45°

      const afterFirst1 = store.getAnnotationById("f1") as Fill
      const afterFirst2 = store.getAnnotationById("f2") as Fill

      expect(afterFirst1.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(afterFirst2.rotation).toBeCloseTo(Math.PI / 4, 5)

      // Deselect all
      store.deselectAll()
      expect(store.selectedAnnotationIds.length).toBe(0)

      // Reselect and rotate again
      store.selectAnnotations(["f1", "f2"])
      const newGroupCenter = calculateGroupCenter([afterFirst1, afterFirst2])
      applyGroupRotation(store, Math.PI / 6, newGroupCenter) // +30°

      const final1 = store.getAnnotationById("f1") as Fill
      const final2 = store.getAnnotationById("f2") as Fill

      // Both should have cumulative rotation (45° + 30° = 75°)
      expect(final1.rotation).toBeCloseTo(Math.PI / 4 + Math.PI / 6, 5)
      expect(final2.rotation).toBeCloseTo(Math.PI / 4 + Math.PI / 6, 5)
    })
  })
})
