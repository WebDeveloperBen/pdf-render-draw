import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useAnnotationStore } from "~/stores/annotations"
import type { Fill } from "~/types/annotations"
import { calculateBounds } from "~/utils/bounds"

vi.mock("uuid", () => ({
  v4: () => "test-uuid-123"
}))

describe("Fill Rotation - Rotation Transform Behavior", () => {
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

  describe("Test 23-26: Rotation Transform Behavior", () => {
    it("Test 23: single fill selected → verify getRotationTransform uses fill's own center", () => {
      const store = useAnnotationStore()

      const fill = createFill("f1", 100, 100, 60, 40)

      store.addAnnotation(fill)
      store.selectAnnotation("f1")

      const groupCenter = calculateGroupCenter([fill])
      applyGroupRotation(store, Math.PI / 4, groupCenter)

      const updated = store.getAnnotationById("f1") as Fill

      // Get rotation transform
      const transform = store.getRotationTransform(updated)

      // Calculate expected center (fill's own center)
      const expectedCenterX = fill.x + fill.width / 2 // 100 + 30 = 130
      const expectedCenterY = fill.y + fill.height / 2 // 100 + 20 = 120

      // Transform should use fill's own center
      // Format: rotate(45 130 120)
      const angleDeg = (Math.PI / 4) * (180 / Math.PI) // 45
      expect(transform).toBe(`rotate(${angleDeg} ${expectedCenterX} ${expectedCenterY})`)
    })

    it("Test 24: fill in multi-select → verify getRotationTransform uses own center", () => {
      const store = useAnnotationStore()

      const fill1 = createFill("f1", 100, 100, 50, 50)
      const fill2 = createFill("f2", 200, 200, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.selectAnnotations(["f1", "f2"])

      const groupCenter = calculateGroupCenter([fill1, fill2])
      applyGroupRotation(store, Math.PI / 2, groupCenter)

      const updated1 = store.getAnnotationById("f1") as Fill
      const updated2 = store.getAnnotationById("f2") as Fill

      // Get rotation transforms
      const transform1 = store.getRotationTransform(updated1)
      const transform2 = store.getRotationTransform(updated2)

      // Each fill should rotate around its OWN center (orbiting is handled by position updates)
      const fill1CenterX = fill1.x + fill1.width / 2 // 125
      const fill1CenterY = fill1.y + fill1.height / 2 // 125
      const fill2CenterX = fill2.x + fill2.width / 2 // 225
      const fill2CenterY = fill2.y + fill2.height / 2 // 225

      const angleDeg = (Math.PI / 2) * (180 / Math.PI) // 90
      expect(transform1).toBe(`rotate(${angleDeg} ${fill1CenterX} ${fill1CenterY})`)
      expect(transform2).toBe(`rotate(${angleDeg} ${fill2CenterX} ${fill2CenterY})`)
    })

    it("Test 25: verify rotation transform string format is correct", () => {
      const store = useAnnotationStore()

      const fill = createFill("f1", 150, 150, 40, 40)

      store.addAnnotation(fill)
      store.selectAnnotation("f1")

      const groupCenter = calculateGroupCenter([fill])

      // Test various rotation angles
      const testCases = [
        { radians: 0, degrees: 0 },
        { radians: Math.PI / 6, degrees: 30 },
        { radians: Math.PI / 4, degrees: 45 },
        { radians: Math.PI / 2, degrees: 90 },
        { radians: Math.PI, degrees: 180 },
        { radians: -Math.PI / 4, degrees: -45 }
      ]

      for (const testCase of testCases) {
        // Reset rotation
        store.updateAnnotation("f1", { rotation: 0 })

        if (testCase.radians !== 0) {
          applyGroupRotation(store, testCase.radians, groupCenter)
        }

        const updated = store.getAnnotationById("f1") as Fill
        const transform = store.getRotationTransform(updated)

        if (testCase.radians === 0) {
          // Zero rotation should return empty string
          expect(transform).toBe("")
        } else {
          // Non-zero rotation should match format: rotate(angle centerX centerY)
          const centerX = fill.x + fill.width / 2
          const centerY = fill.y + fill.height / 2

          // Extract angle from transform string
          const match = transform.match(/rotate\(([^ ]+) ([^ ]+) ([^ ]+)\)/)
          expect(match).not.toBeNull()
          const angle = parseFloat(match![1]!)
          const cx = parseFloat(match![2]!)
          const cy = parseFloat(match![3]!)

          expect(angle).toBeCloseTo(testCase.degrees, 1)
          expect(cx).toBe(centerX)
          expect(cy).toBe(centerY)
        }
      }
    })

    it("Test 26: verify rotation transform updates in real-time during drag", () => {
      const store = useAnnotationStore()

      const fill = createFill("f1", 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation("f1")

      // Initial state: no rotation
      let transform = store.getRotationTransform(fill)
      expect(transform).toBe("")

      // Simulate rotation drag in progress (using rotationDragDelta)
      store.rotationDragDelta = Math.PI / 6 // 30° temporary drag

      const fillWithDrag = store.getAnnotationById("f1") as Fill
      transform = store.getRotationTransform(fillWithDrag)

      // Should include drag delta
      const centerX = fill.x + fill.width / 2
      const centerY = fill.y + fill.height / 2

      // Extract and verify angle from transform
      let match = transform.match(/rotate\(([^ ]+) ([^ ]+) ([^ ]+)\)/)
      expect(match).not.toBeNull()
      let angle = parseFloat(match![1]!)
      expect(angle).toBeCloseTo(30, 1)
      expect(parseFloat(match![2]!)).toBe(centerX)
      expect(parseFloat(match![3]!)).toBe(centerY)

      // Simulate drag end: apply stored rotation, reset delta
      const groupCenter = calculateGroupCenter([fill])
      applyGroupRotation(store, store.rotationDragDelta, groupCenter)
      store.rotationDragDelta = 0

      const finalFill = store.getAnnotationById("f1") as Fill
      transform = store.getRotationTransform(finalFill)

      // Should show stored rotation, no drag delta
      match = transform.match(/rotate\(([^ ]+) ([^ ]+) ([^ ]+)\)/)
      expect(match).not.toBeNull()
      angle = parseFloat(match![1]!)
      expect(angle).toBeCloseTo(30, 1)
      expect(parseFloat(match![2]!)).toBe(centerX)
      expect(parseFloat(match![3]!)).toBe(centerY)
      expect(finalFill.rotation).toBeCloseTo(Math.PI / 6, 5)
    })
  })
})
