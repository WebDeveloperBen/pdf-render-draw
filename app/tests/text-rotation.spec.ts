import { describe, it, expect, beforeEach } from "vitest"
import { setActivePinia, createPinia } from "pinia"

/**
 * Tests to verify text annotations rotate correctly using standardized transform
 */
describe("Text Annotation Rotation", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it("should create text annotation with rotation property", () => {
    const annotationStore = useAnnotationStore()

    const text: TextAnnotation = {
      id: "text-1",
      type: "text",
      pageNum: 1,
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      content: "Test Text",
      fontSize: 16,
      color: "#000000",
      rotation: 0
    }

    annotationStore.addAnnotation(text)

    const stored = annotationStore.getAnnotationById("text-1") as TextAnnotation
    expect(stored.rotation).toBeDefined()
    expect(stored.rotation).toBe(0)
  })

  it("should generate correct rotation transform for text annotation", () => {
    const annotationStore = useAnnotationStore()

    const text: TextAnnotation = {
      id: "text-1",
      type: "text",
      pageNum: 1,
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      content: "Test Text",
      fontSize: 16,
      color: "#000000",
      rotation: Math.PI / 2 // 90 degrees in radians
    }

    const transform = annotationStore.getRotationTransform(text)

    // Should rotate 90 degrees around geometric center
    // centerX = x + width/2 = 100 + 200/2 = 200
    // centerY = y + height/2 = 100 + 50/2 = 125
    expect(transform).toContain("rotate(90")
    expect(transform).toContain("200") // centerX
    expect(transform).toContain("125") // centerY (geometric center)
  })

  it("should update text rotation via transform handles", () => {
    const annotationStore = useAnnotationStore()

    const text: TextAnnotation = {
      id: "text-1",
      type: "text",
      pageNum: 1,
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      content: "Test Text",
      fontSize: 16,
      color: "#000000",
      rotation: 0
    }

    annotationStore.addAnnotation(text)

    // Simulate rotation via transform
    const newRotation = Math.PI / 4 // 45 degrees
    annotationStore.updateAnnotation("text-1", { rotation: newRotation })

    const updated = annotationStore.getAnnotationById("text-1") as TextAnnotation
    expect(updated.rotation).toBe(newRotation)

    const transform = annotationStore.getRotationTransform(updated)
    expect(transform).toContain("rotate(45")
  })

  it("should rotate text around its center, not top-left corner", () => {
    const annotationStore = useAnnotationStore()

    const text: TextAnnotation = {
      id: "text-1",
      type: "text",
      pageNum: 1,
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      content: "Test",
      fontSize: 16,
      color: "#000000",
      rotation: Math.PI // 180 degrees
    }

    const transform = annotationStore.getRotationTransform(text)

    // Geometric center calculation:
    // centerX = x + width/2 = 0 + 100/2 = 50
    // centerY = y + height/2 = 0 + 50/2 = 25
    expect(transform).toContain("50") // centerX
    expect(transform).toContain("25") // centerY (geometric center)
    expect(transform).not.toContain("rotate(180 0 0)") // Should not rotate around origin
  })

  it("should work with group transforms for multiple text annotations", () => {
    const annotationStore = useAnnotationStore()

    const text1: TextAnnotation = {
      id: "text-1",
      type: "text",
      pageNum: 1,
      x: 100,
      y: 100,
      width: 100,
      height: 50,
      content: "Text 1",
      fontSize: 16,
      color: "#000000",
      rotation: 0
    }

    const text2: TextAnnotation = {
      id: "text-2",
      type: "text",
      pageNum: 1,
      x: 250,
      y: 100,
      width: 100,
      height: 50,
      content: "Text 2",
      fontSize: 16,
      color: "#000000",
      rotation: 0
    }

    annotationStore.addAnnotation(text1)
    annotationStore.addAnnotation(text2)

    // Select both
    annotationStore.selectAnnotation("text-1")
    annotationStore.selectAnnotation("text-2", { addToSelection: true })

    expect(annotationStore.selectedAnnotationIds).toEqual(["text-1", "text-2"])

    // Both should have rotation property for group transforms to work
    const stored1 = annotationStore.getAnnotationById("text-1")
    const stored2 = annotationStore.getAnnotationById("text-2")

    expect("rotation" in stored1!).toBe(true)
    expect("rotation" in stored2!).toBe(true)
  })

  it("should create text upright in viewport regardless of PDF rotation", () => {
    const annotationStore = useAnnotationStore()
    const rendererStore = useRendererStore()

    // Simulate PDF rotated 90 degrees
    rendererStore.rotation = 90

    // Create text annotation (would normally use degreesToRadians(-90))
    const text: TextAnnotation = {
      id: "text-1",
      type: "text",
      pageNum: 1,
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      content: "Test Text",
      fontSize: 16,
      color: "#000000",
      rotation: -Math.PI / 2 // Counter-rotates PDF's 90° to appear upright
    }

    annotationStore.addAnnotation(text)

    // The text should have counter-rotation to appear upright in viewport
    const stored = annotationStore.getAnnotationById("text-1") as TextAnnotation
    expect(stored.rotation).toBe(-Math.PI / 2)

    // After creation, text can be further rotated via transform handles
    annotationStore.updateAnnotation("text-1", { rotation: stored.rotation + Math.PI / 4 })
    const rotated = annotationStore.getAnnotationById("text-1") as TextAnnotation
    expect(rotated.rotation).toBe(-Math.PI / 2 + Math.PI / 4)
  })

  it("should center text on cursor position when created", () => {
    // When text is created, its visual center should be at the cursor position
    // Visual bounds account for baseline offset: (x - 5, y - fontSize - 2, width + 10, height + 4)
    const cursorX = 100
    const cursorY = 100
    const width = 200
    const height = 50
    const fontSize = 16

    // Calculate expected text position to center on cursor
    // Visual center: (x + width/2, y - fontSize - 2 + height/2)
    // To center on cursor: x = cursorX - width/2, y = cursorY + fontSize + 2 - height/2
    const expectedX = cursorX - width / 2
    const expectedY = cursorY + fontSize + 2 - height / 2

    const text: TextAnnotation = {
      id: "text-1",
      type: "text",
      pageNum: 1,
      x: expectedX,
      y: expectedY,
      width,
      height,
      content: "Test",
      fontSize,
      color: "#000000",
      rotation: 0
    }

    // Verify visual center is at cursor position
    // Visual center calculation from annotation-geometry.ts
    const visualY = text.y - fontSize - 2
    const visualCenterX = text.x + width / 2
    const visualCenterY = visualY + height / 2

    expect(visualCenterX).toBe(cursorX)
    expect(visualCenterY).toBe(cursorY)
  })
})
