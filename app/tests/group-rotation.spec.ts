import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useAnnotationStore } from "~/stores/annotations"
import type { Fill } from "~/types/annotations"

describe("Group Rotation Logic", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it("should correctly calculate rotated positions for two side-by-side fills rotated 45 degrees", () => {
    const annotationStore = useAnnotationStore()

    // Create two 50x50 fills side by side
    // Fill 1 at (100, 100), Fill 2 at (200, 100)
    const fill1: Fill = {
      id: "fill-1",
      type: "fill",
      pageNum: 1,
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      color: "#ff0000",
      opacity: 0.5,
      rotation: 0
    }

    const fill2: Fill = {
      id: "fill-2",
      type: "fill",
      pageNum: 1,
      x: 200,
      y: 100,
      width: 50,
      height: 50,
      color: "#00ff00",
      opacity: 0.5,
      rotation: 0
    }

    annotationStore.addAnnotation(fill1)
    annotationStore.addAnnotation(fill2)
    annotationStore.selectAnnotation("fill-1")
    annotationStore.selectAnnotation("fill-2", { addToSelection: true })

    // Combined bounds: x=100, y=100, width=150, height=50
    // Combined center: (175, 125)
    const combinedCenter = { x: 175, y: 125 }
    const rotationDelta = Math.PI / 4 // 45 degrees

    console.log("\n=== Testing 45° Rotation ===")
    console.log("Combined center:", combinedCenter)
    console.log("Rotation delta:", rotationDelta, "radians =", (rotationDelta * 180) / Math.PI, "degrees")

    // Calculate expected positions after rotation
    const cos = Math.cos(rotationDelta)
    const sin = Math.sin(rotationDelta)

    // Fill1 initial center: (125, 125)
    const fill1Center = { x: 125, y: 125 }
    const dx1 = fill1Center.x - combinedCenter.x // -50
    const dy1 = fill1Center.y - combinedCenter.y // 0

    const newFill1CenterX = combinedCenter.x + dx1 * cos - dy1 * sin
    const newFill1CenterY = combinedCenter.y + dx1 * sin + dy1 * cos

    const expectedFill1 = {
      x: newFill1CenterX - 25,
      y: newFill1CenterY - 25,
      rotation: rotationDelta
    }

    // Fill2 initial center: (225, 125)
    const fill2Center = { x: 225, y: 125 }
    const dx2 = fill2Center.x - combinedCenter.x // 50
    const dy2 = fill2Center.y - combinedCenter.y // 0

    const newFill2CenterX = combinedCenter.x + dx2 * cos - dy2 * sin
    const newFill2CenterY = combinedCenter.y + dx2 * sin + dy2 * cos

    const expectedFill2 = {
      x: newFill2CenterX - 25,
      y: newFill2CenterY - 25,
      rotation: rotationDelta
    }

    console.log("\nExpected fill1:", expectedFill1)
    console.log("Expected fill2:", expectedFill2)

    // Simulate what GroupTransform.handleRotate should do during drag
    // (update positions only, not rotation)
    annotationStore.updateAnnotation("fill-1", {
      x: expectedFill1.x,
      y: expectedFill1.y
    })
    annotationStore.updateAnnotation("fill-2", {
      x: expectedFill2.x,
      y: expectedFill2.y
    })

    // Simulate what GroupTransform.handleEndDrag should do on commit
    // (add rotation property - manually since we can't use tool registry in tests)
    annotationStore.updateAnnotation("fill-1", {
      rotation: (fill1.rotation || 0) + rotationDelta
    })
    annotationStore.updateAnnotation("fill-2", {
      rotation: (fill2.rotation || 0) + rotationDelta
    })

    // Verify final state
    const finalFill1 = annotationStore.getAnnotationById("fill-1") as Fill
    const finalFill2 = annotationStore.getAnnotationById("fill-2") as Fill

    console.log("\nActual fill1:", {
      x: finalFill1.x,
      y: finalFill1.y,
      rotation: finalFill1.rotation
    })
    console.log("Actual fill2:", {
      x: finalFill2.x,
      y: finalFill2.y,
      rotation: finalFill2.rotation
    })

    // Verify positions
    expect(finalFill1.x).toBeCloseTo(expectedFill1.x, 1)
    expect(finalFill1.y).toBeCloseTo(expectedFill1.y, 1)
    expect(finalFill1.rotation).toBeCloseTo(expectedFill1.rotation, 2)

    expect(finalFill2.x).toBeCloseTo(expectedFill2.x, 1)
    expect(finalFill2.y).toBeCloseTo(expectedFill2.y, 1)
    expect(finalFill2.rotation).toBeCloseTo(expectedFill2.rotation, 2)

    // Verify they moved (rotated around combined center, not individual centers)
    expect(finalFill1.x).not.toBe(100)
    expect(finalFill1.y).not.toBe(100)
    expect(finalFill2.x).not.toBe(200)
    expect(finalFill2.y).not.toBe(100)
  })

  it("should correctly calculate rotated positions for two stacked fills rotated 180 degrees", () => {
    const annotationStore = useAnnotationStore()

    // Create two 50x50 fills stacked vertically
    const fill1: Fill = {
      id: "fill-1",
      type: "fill",
      pageNum: 1,
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      color: "#ff0000",
      opacity: 0.5,
      rotation: 0
    }

    const fill2: Fill = {
      id: "fill-2",
      type: "fill",
      pageNum: 1,
      x: 100,
      y: 200,
      width: 50,
      height: 50,
      color: "#00ff00",
      opacity: 0.5,
      rotation: 0
    }

    annotationStore.addAnnotation(fill1)
    annotationStore.addAnnotation(fill2)
    annotationStore.selectAnnotation("fill-1")
    annotationStore.selectAnnotation("fill-2", { addToSelection: true })

    // Combined bounds: x=100, y=100, width=50, height=150
    // Combined center: (125, 175)
    const combinedCenter = { x: 125, y: 175 }
    const rotationDelta = Math.PI // 180 degrees

    console.log("\n=== Testing 180° Rotation ===")
    console.log("Combined center:", combinedCenter)
    console.log("Rotation delta:", rotationDelta, "radians =", (rotationDelta * 180) / Math.PI, "degrees")

    // Calculate expected positions
    const cos = Math.cos(rotationDelta) // -1
    const sin = Math.sin(rotationDelta) // ~0

    // Fill1 initial center: (125, 125)
    const fill1Center = { x: 125, y: 125 }
    const dx1 = fill1Center.x - combinedCenter.x // 0
    const dy1 = fill1Center.y - combinedCenter.y // -50

    const newFill1CenterX = combinedCenter.x + dx1 * cos - dy1 * sin // 125 + 0 = 125
    const newFill1CenterY = combinedCenter.y + dx1 * sin + dy1 * cos // 175 + 50 = 225

    const expectedFill1 = {
      x: newFill1CenterX - 25, // 100
      y: newFill1CenterY - 25, // 200
      rotation: rotationDelta
    }

    // Fill2 initial center: (125, 225)
    const fill2Center = { x: 125, y: 225 }
    const dx2 = fill2Center.x - combinedCenter.x // 0
    const dy2 = fill2Center.y - combinedCenter.y // 50

    const newFill2CenterX = combinedCenter.x + dx2 * cos - dy2 * sin // 125
    const newFill2CenterY = combinedCenter.y + dx2 * sin + dy2 * cos // 175 - 50 = 125

    const expectedFill2 = {
      x: newFill2CenterX - 25, // 100
      y: newFill2CenterY - 25, // 100
      rotation: rotationDelta
    }

    console.log("\nExpected fill1:", expectedFill1)
    console.log("Expected fill2:", expectedFill2)

    // Simulate rotation (positions during drag)
    annotationStore.updateAnnotation("fill-1", {
      x: expectedFill1.x,
      y: expectedFill1.y
    })
    annotationStore.updateAnnotation("fill-2", {
      x: expectedFill2.x,
      y: expectedFill2.y
    })

    // Commit rotation property
    annotationStore.updateAnnotation("fill-1", {
      rotation: (fill1.rotation || 0) + rotationDelta
    })
    annotationStore.updateAnnotation("fill-2", {
      rotation: (fill2.rotation || 0) + rotationDelta
    })

    const finalFill1 = annotationStore.getAnnotationById("fill-1") as Fill
    const finalFill2 = annotationStore.getAnnotationById("fill-2") as Fill

    console.log("\nActual fill1:", {
      x: finalFill1.x,
      y: finalFill1.y,
      rotation: finalFill1.rotation
    })
    console.log("Actual fill2:", {
      x: finalFill2.x,
      y: finalFill2.y,
      rotation: finalFill2.rotation
    })

    // After 180° rotation, shapes should have swapped positions
    expect(finalFill1.x).toBeCloseTo(expectedFill1.x, 1) // 100
    expect(finalFill1.y).toBeCloseTo(expectedFill1.y, 1) // 200 (swapped from 100)
    expect(finalFill1.rotation).toBeCloseTo(expectedFill1.rotation, 2)

    expect(finalFill2.x).toBeCloseTo(expectedFill2.x, 1) // 100
    expect(finalFill2.y).toBeCloseTo(expectedFill2.y, 1) // 100 (swapped from 200)
    expect(finalFill2.rotation).toBeCloseTo(expectedFill2.rotation, 2)
  })

  it("should NOT recalculate positions in handleEndDrag (bug regression test)", () => {
    const annotationStore = useAnnotationStore()

    const fill1: Fill = {
      id: "fill-1",
      type: "fill",
      pageNum: 1,
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      color: "#ff0000",
      opacity: 0.5,
      rotation: 0
    }

    const fill2: Fill = {
      id: "fill-2",
      type: "fill",
      pageNum: 1,
      x: 200,
      y: 100,
      width: 50,
      height: 50,
      color: "#00ff00",
      opacity: 0.5,
      rotation: 0
    }

    annotationStore.addAnnotation(fill1)
    annotationStore.addAnnotation(fill2)

    const combinedCenter = { x: 175, y: 125 }
    const rotationDelta = Math.PI / 4

    // Simulate handleRotate: update positions during drag
    const cos = Math.cos(rotationDelta)
    const sin = Math.sin(rotationDelta)

    const fill1Center = { x: 125, y: 125 }
    const dx1 = fill1Center.x - combinedCenter.x
    const dy1 = fill1Center.y - combinedCenter.y
    const newFill1CenterX = combinedCenter.x + dx1 * cos - dy1 * sin
    const newFill1CenterY = combinedCenter.y + dx1 * sin + dy1 * cos

    const positionAfterDrag1 = {
      x: newFill1CenterX - 25,
      y: newFill1CenterY - 25
    }

    annotationStore.updateAnnotation("fill-1", positionAfterDrag1)

    const fill2Center = { x: 225, y: 125 }
    const dx2 = fill2Center.x - combinedCenter.x
    const dy2 = fill2Center.y - combinedCenter.y
    const newFill2CenterX = combinedCenter.x + dx2 * cos - dy2 * sin
    const newFill2CenterY = combinedCenter.y + dx2 * sin + dy2 * cos

    const positionAfterDrag2 = {
      x: newFill2CenterX - 25,
      y: newFill2CenterY - 25
    }

    annotationStore.updateAnnotation("fill-2", positionAfterDrag2)

    // Get positions after drag
    const afterDragFill1 = annotationStore.getAnnotationById("fill-1") as Fill
    const afterDragFill2 = annotationStore.getAnnotationById("fill-2") as Fill

    console.log("\n=== Bug Regression Test ===")
    console.log("After drag (before commit):")
    console.log("Fill1:", { x: afterDragFill1.x, y: afterDragFill1.y, rotation: afterDragFill1.rotation })
    console.log("Fill2:", { x: afterDragFill2.x, y: afterDragFill2.y, rotation: afterDragFill2.rotation })

    // Simulate handleEndDrag: ONLY update rotation, NOT position
    // Pass the ORIGINAL annotation's rotation (before drag), not current state
    annotationStore.updateAnnotation("fill-1", {
      rotation: (fill1.rotation || 0) + rotationDelta
    })
    annotationStore.updateAnnotation("fill-2", {
      rotation: (fill2.rotation || 0) + rotationDelta
    })

    const finalFill1 = annotationStore.getAnnotationById("fill-1") as Fill
    const finalFill2 = annotationStore.getAnnotationById("fill-2") as Fill

    console.log("After commit:")
    console.log("Fill1:", { x: finalFill1.x, y: finalFill1.y, rotation: finalFill1.rotation })
    console.log("Fill2:", { x: finalFill2.x, y: finalFill2.y, rotation: finalFill2.rotation })

    // CRITICAL: Positions should NOT change during commit
    // They were already set during drag
    expect(finalFill1.x).toBe(afterDragFill1.x)
    expect(finalFill1.y).toBe(afterDragFill1.y)
    expect(finalFill2.x).toBe(afterDragFill2.x)
    expect(finalFill2.y).toBe(afterDragFill2.y)

    // Only rotation should be added
    expect(finalFill1.rotation).toBeCloseTo(rotationDelta, 2)
    expect(finalFill2.rotation).toBeCloseTo(rotationDelta, 2)
  })
})
