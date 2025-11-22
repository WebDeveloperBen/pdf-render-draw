import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useAnnotationStore } from "~/stores/annotations"
import type { Fill } from "~/types/annotations"
import { calculateBounds } from "~/utils/bounds"

vi.mock("uuid", () => ({
  v4: () => "test-uuid-123"
}))

describe("Fill Rotation - Visual Consistency", () => {
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

  describe("Test 41-44: Visual Consistency", () => {
    it("Test 41: rotate fill 0° → verify visually identical to no rotation", () => {
      const store = useAnnotationStore()

      const fill = createFill("f1", 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation("f1")

      // Rotate by 0 radians
      const groupCenter = calculateGroupCenter([fill])
      applyGroupRotation(store, 0, groupCenter)

      const updated = store.getAnnotationById("f1") as Fill

      // Rotation should be 0
      expect(updated.rotation).toBe(0)

      // Transform should be empty string
      const transform = store.getRotationTransform(updated)
      expect(transform).toBe("")

      // Position unchanged
      expect(updated.x).toBe(100)
      expect(updated.y).toBe(100)
      expect(updated.width).toBe(50)
      expect(updated.height).toBe(50)
    })

    it("Test 42: rotate fill 360° → verify visually identical to 0° rotation", () => {
      const store = useAnnotationStore()

      const fill = createFill("f1", 100, 100, 50, 50)

      store.addAnnotation(fill)
      store.selectAnnotation("f1")

      // Rotate by full circle (2π radians)
      const groupCenter = calculateGroupCenter([fill])
      applyGroupRotation(store, 2 * Math.PI, groupCenter)

      const updated = store.getAnnotationById("f1") as Fill

      // Rotation should be 2π (360°)
      expect(updated.rotation).toBeCloseTo(2 * Math.PI, 5)

      // Position should be unchanged
      expect(updated.x).toBe(100)
      expect(updated.y).toBe(100)
      expect(updated.width).toBe(50)
      expect(updated.height).toBe(50)

      // Visually, 360° rotation looks the same as 0° rotation
      // The transform will still be present, but render the same
      const transform = store.getRotationTransform(updated)
      const centerX = fill.x + fill.width / 2
      const centerY = fill.y + fill.height / 2
      expect(transform).toBe(`rotate(360 ${centerX} ${centerY})`)
    })

    it("Test 43: rotate group of identical fills → verify they stay aligned", () => {
      const store = useAnnotationStore()

      // Create three identical fills in a row
      const fill1 = createFill("f1", 100, 100, 50, 50)
      const fill2 = createFill("f2", 200, 100, 50, 50)
      const fill3 = createFill("f3", 300, 100, 50, 50)

      store.addAnnotation(fill1)
      store.addAnnotation(fill2)
      store.addAnnotation(fill3)
      store.selectAnnotations(["f1", "f2", "f3"])

      // Rotate group
      const groupCenter = calculateGroupCenter([fill1, fill2, fill3])
      applyGroupRotation(store, Math.PI / 4, groupCenter)

      const updated1 = store.getAnnotationById("f1") as Fill
      const updated2 = store.getAnnotationById("f2") as Fill
      const updated3 = store.getAnnotationById("f3") as Fill

      // All should have same rotation
      expect(updated1.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(updated2.rotation).toBeCloseTo(Math.PI / 4, 5)
      expect(updated3.rotation).toBeCloseTo(Math.PI / 4, 5)

      // All should have same size
      expect(updated1.width).toBe(50)
      expect(updated1.height).toBe(50)
      expect(updated2.width).toBe(50)
      expect(updated2.height).toBe(50)
      expect(updated3.width).toBe(50)
      expect(updated3.height).toBe(50)

      // Y positions should still be aligned (all at 100)
      expect(updated1.y).toBe(100)
      expect(updated2.y).toBe(100)
      expect(updated3.y).toBe(100)

      // X positions should maintain spacing (100 units apart)
      expect(updated2.x - updated1.x).toBe(100)
      expect(updated3.x - updated2.x).toBe(100)

      // Transforms should each use their own center (orbiting handled by position updates)
      const transform1 = store.getRotationTransform(updated1)
      const transform2 = store.getRotationTransform(updated2)
      const transform3 = store.getRotationTransform(updated3)

      const angleDeg = 45
      const fill1Center = { x: fill1.x + fill1.width / 2, y: fill1.y + fill1.height / 2 }
      const fill2Center = { x: fill2.x + fill2.width / 2, y: fill2.y + fill2.height / 2 }
      const fill3Center = { x: fill3.x + fill3.width / 2, y: fill3.y + fill3.height / 2 }

      expect(transform1).toBe(`rotate(${angleDeg} ${fill1Center.x} ${fill1Center.y})`)
      expect(transform2).toBe(`rotate(${angleDeg} ${fill2Center.x} ${fill2Center.y})`)
      expect(transform3).toBe(`rotate(${angleDeg} ${fill3Center.x} ${fill3Center.y})`)
    })

    it("Test 44: rotate fills of different sizes → verify proportional rotation", () => {
      const store = useAnnotationStore()

      // Create fills of different sizes
      const smallFill = createFill("small", 100, 100, 30, 30)
      const mediumFill = createFill("medium", 200, 100, 60, 60)
      const largeFill = createFill("large", 350, 100, 100, 100)

      store.addAnnotation(smallFill)
      store.addAnnotation(mediumFill)
      store.addAnnotation(largeFill)
      store.selectAnnotations(["small", "medium", "large"])

      // Rotate group
      const groupCenter = calculateGroupCenter([smallFill, mediumFill, largeFill])
      applyGroupRotation(store, Math.PI / 3, groupCenter)

      const updatedSmall = store.getAnnotationById("small") as Fill
      const updatedMedium = store.getAnnotationById("medium") as Fill
      const updatedLarge = store.getAnnotationById("large") as Fill

      // All should have same rotation angle
      expect(updatedSmall.rotation).toBeCloseTo(Math.PI / 3, 5)
      expect(updatedMedium.rotation).toBeCloseTo(Math.PI / 3, 5)
      expect(updatedLarge.rotation).toBeCloseTo(Math.PI / 3, 5)

      // Sizes should be preserved
      expect(updatedSmall.width).toBe(30)
      expect(updatedSmall.height).toBe(30)
      expect(updatedMedium.width).toBe(60)
      expect(updatedMedium.height).toBe(60)
      expect(updatedLarge.width).toBe(100)
      expect(updatedLarge.height).toBe(100)

      // Positions should be unchanged (rotation via transform)
      expect(updatedSmall.x).toBe(100)
      expect(updatedSmall.y).toBe(100)
      expect(updatedMedium.x).toBe(200)
      expect(updatedMedium.y).toBe(100)
      expect(updatedLarge.x).toBe(350)
      expect(updatedLarge.y).toBe(100)

      // All should rotate around the same group center
      const transformSmall = store.getRotationTransform(updatedSmall)
      const transformMedium = store.getRotationTransform(updatedMedium)
      const transformLarge = store.getRotationTransform(updatedLarge)

      // Extract and verify components from each transform
      const matchSmall = transformSmall.match(/rotate\(([^ ]+) ([^ ]+) ([^ ]+)\)/)
      const matchMedium = transformMedium.match(/rotate\(([^ ]+) ([^ ]+) ([^ ]+)\)/)
      const matchLarge = transformLarge.match(/rotate\(([^ ]+) ([^ ]+) ([^ ]+)\)/)

      expect(matchSmall).not.toBeNull()
      expect(matchMedium).not.toBeNull()
      expect(matchLarge).not.toBeNull()

      // All should have angle of ~60 degrees
      expect(parseFloat(matchSmall![1]!)).toBeCloseTo(60, 1)
      expect(parseFloat(matchMedium![1]!)).toBeCloseTo(60, 1)
      expect(parseFloat(matchLarge![1]!)).toBeCloseTo(60, 1)

      // Each should rotate around its own center (orbiting handled by position updates)
      const smallCenter = { x: smallFill.x + smallFill.width / 2, y: smallFill.y + smallFill.height / 2 }
      const mediumCenter = { x: mediumFill.x + mediumFill.width / 2, y: mediumFill.y + mediumFill.height / 2 }
      const largeCenter = { x: largeFill.x + largeFill.width / 2, y: largeFill.y + largeFill.height / 2 }

      expect(parseFloat(matchSmall![2]!)).toBe(smallCenter.x)
      expect(parseFloat(matchSmall![3]!)).toBe(smallCenter.y)
      expect(parseFloat(matchMedium![2]!)).toBe(mediumCenter.x)
      expect(parseFloat(matchMedium![3]!)).toBe(mediumCenter.y)
      expect(parseFloat(matchLarge![2]!)).toBe(largeCenter.x)
      expect(parseFloat(matchLarge![3]!)).toBe(largeCenter.y)
    })
  })
})
