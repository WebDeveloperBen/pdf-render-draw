import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useAnnotationStore } from "~/stores/annotations"
import type { Fill } from "~/types/annotations"
import { calculateBounds } from "~/utils/bounds"

vi.mock("uuid", () => ({
  v4: () => "test-uuid-123"
}))

describe("Fill Rotation - Selection Changes", () => {
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

  describe("Test 49-52: Selection Changes", () => {
    it("Test 49: rotate group → deselect one fill → rotate again → verify independent behavior", () => {
      const store = useAnnotationStore()

      const fill1 = createFill("f1", 100, 100, 50, 50)
      const fill2 = createFill("f2", 200, 100, 50, 50)
      const fill3 = createFill("f3", 300, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.addAnnotation(fill3)

      // First rotation: all three fills
      store.selectAnnotations(["f1", "f2", "f3"])
      const groupCenter1 = calculateGroupCenter([fill1, fill2, fill3])
      applyGroupRotation(store, Math.PI / 4, groupCenter1) // 45°

      const afterFirst1 = store.getAnnotationById("f1") as Fill
      const afterFirst2 = store.getAnnotationById("f2") as Fill
      const afterFirst3 = store.getAnnotationById("f3") as Fill

      expect(afterFirst1.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(afterFirst2.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(afterFirst3.rotation).toBeCloseTo(Math.PI / 4, 5)

      // Deselect fill1
      store.selectAnnotations(["f2", "f3"])
      expect(store.selectedAnnotationIds).toEqual(["f2", "f3"])

      // Second rotation: only f2 and f3
      const groupCenter2 = calculateGroupCenter([afterFirst2, afterFirst3])
      applyGroupRotation(store, Math.PI / 6, groupCenter2) // +30°

      const final1 = store.getAnnotationById("f1") as Fill
      const final2 = store.getAnnotationById("f2") as Fill
      const final3 = store.getAnnotationById("f3") as Fill

      // f1 should still be at 45° (not rotated in second rotation)
      expect(final1.rotation).toBeCloseTo(Math.PI / 4, 5)

      // f2 and f3 should be at 75° (45° + 30°)
      expect(final2.rotation).toBeCloseTo(Math.PI / 4 + Math.PI / 6, 5)
      expect(final3.rotation).toBeCloseTo(Math.PI / 4 + Math.PI / 6, 5)
    })

    it("Test 50: rotate group → add fill to selection → rotate again → verify new fill included", () => {
      const store = useAnnotationStore()

      const fill1 = createFill("f1", 100, 100, 50, 50)
      const fill2 = createFill("f2", 200, 100, 50, 50)
      const fill3 = createFill("f3", 300, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.addAnnotation(fill3)

      // First rotation: only f1 and f2
      store.selectAnnotations(["f1", "f2"])
      const groupCenter1 = calculateGroupCenter([fill1, fill2])
      applyGroupRotation(store, Math.PI / 3, groupCenter1) // 60°

      const afterFirst1 = store.getAnnotationById("f1") as Fill
      const afterFirst2 = store.getAnnotationById("f2") as Fill
      const afterFirst3 = store.getAnnotationById("f3") as Fill

      expect(afterFirst1.rotation).toBeCloseTo(Math.PI / 3, 5)
      expect(afterFirst2.rotation).toBeCloseTo(Math.PI / 3, 5)
      expect(afterFirst3.rotation).toBe(0) // Not rotated yet

      // Add f3 to selection
      store.selectAnnotations(["f1", "f2", "f3"])
      expect(store.selectedAnnotationIds).toEqual(["f1", "f2", "f3"])

      // Second rotation: all three
      const groupCenter2 = calculateGroupCenter([afterFirst1, afterFirst2, afterFirst3])
      applyGroupRotation(store, Math.PI / 6, groupCenter2) // +30°

      const final1 = store.getAnnotationById("f1") as Fill
      const final2 = store.getAnnotationById("f2") as Fill
      const final3 = store.getAnnotationById("f3") as Fill

      // f1 and f2 should have cumulative rotation (60° + 30° = 90°)
      expect(final1.rotation).toBeCloseTo(Math.PI / 3 + Math.PI / 6, 5)
      expect(final2.rotation).toBeCloseTo(Math.PI / 3 + Math.PI / 6, 5)

      // f3 should only have the second rotation (30°)
      expect(final3.rotation).toBeCloseTo(Math.PI / 6, 5)
    })

    it("Test 51: individually rotate fill → add to group → rotate group → verify cumulative", () => {
      const store = useAnnotationStore()

      const fill1 = createFill("f1", 100, 100, 50, 50)
      const fill2 = createFill("f2", 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)

      // Individually rotate f1
      store.selectAnnotation("f1")
      const groupCenter1 = calculateGroupCenter([fill1])
      applyGroupRotation(store, Math.PI / 4, groupCenter1) // 45°

      const afterIndividual = store.getAnnotationById("f1") as Fill
      expect(afterIndividual.rotation).toBeCloseTo(Math.PI / 4, 5)

      // Add f1 to group with f2
      store.selectAnnotations(["f1", "f2"])
      expect(store.selectedAnnotationIds).toEqual(["f1", "f2"])

      const groupCenter2 = calculateGroupCenter([afterIndividual, fill2])
      applyGroupRotation(store, Math.PI / 6, groupCenter2) // +30°

      const final1 = store.getAnnotationById("f1") as Fill
      const final2 = store.getAnnotationById("f2") as Fill

      // f1 should have cumulative rotation (45° + 30° = 75°)
      expect(final1.rotation).toBeCloseTo(Math.PI / 4 + Math.PI / 6, 5)

      // f2 should only have group rotation (30°)
      expect(final2.rotation).toBeCloseTo(Math.PI / 6, 5)
    })

    it("Test 52: rotate group → clear selection → verify rotation persists", () => {
      const store = useAnnotationStore()

      const fill1 = createFill("f1", 100, 100, 50, 50)
      const fill2 = createFill("f2", 200, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)

      // Rotate group
      store.selectAnnotations(["f1", "f2"])
      const groupCenter = calculateGroupCenter([fill1, fill2])
      applyGroupRotation(store, Math.PI / 3, groupCenter) // 60°

      const afterRotate1 = store.getAnnotationById("f1") as Fill
      const afterRotate2 = store.getAnnotationById("f2") as Fill

      expect(afterRotate1.rotation).toBeCloseTo(Math.PI / 3, 5)
      expect(afterRotate2.rotation).toBeCloseTo(Math.PI / 3, 5)

      // Clear selection
      store.deselectAll()
      expect(store.selectedAnnotationIds.length).toBe(0)

      // Verify rotation persisted
      const afterClear1 = store.getAnnotationById("f1") as Fill
      const afterClear2 = store.getAnnotationById("f2") as Fill

      expect(afterClear1.rotation).toBeCloseTo(Math.PI / 3, 5)
      expect(afterClear2.rotation).toBeCloseTo(Math.PI / 3, 5)

      // Verify positions unchanged
      expect(afterClear1.x).toBe(100)
      expect(afterClear1.y).toBe(100)
      expect(afterClear2.x).toBe(200)
      expect(afterClear2.y).toBe(100)

      // Transforms should still work (using fill's own center now, not group center)
      const transform1 = store.getRotationTransform(afterClear1)
      const transform2 = store.getRotationTransform(afterClear2)

      const center1X = fill1.x + fill1.width / 2
      const center1Y = fill1.y + fill1.height / 2
      const center2X = fill2.x + fill2.width / 2
      const center2Y = fill2.y + fill2.height / 2

      // Extract and verify components from transforms
      const match1 = transform1.match(/rotate\(([^ ]+) ([^ ]+) ([^ ]+)\)/)
      const match2 = transform2.match(/rotate\(([^ ]+) ([^ ]+) ([^ ]+)\)/)

      expect(match1).not.toBeNull()
      expect(match2).not.toBeNull()

      // Both should have angle of ~60 degrees
      expect(parseFloat(match1![1]!)).toBeCloseTo(60, 1)
      expect(parseFloat(match2![1]!)).toBeCloseTo(60, 1)

      // Each should rotate around its own center
      expect(parseFloat(match1![2]!)).toBe(center1X)
      expect(parseFloat(match1![3]!)).toBe(center1Y)
      expect(parseFloat(match2![2]!)).toBe(center2X)
      expect(parseFloat(match2![3]!)).toBe(center2Y)
    })
  })
})
