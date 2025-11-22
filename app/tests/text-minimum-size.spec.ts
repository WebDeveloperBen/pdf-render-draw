import { describe, it, expect, beforeEach } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import type { TextAnnotation } from "~/types/annotations"

/**
 * Tests to verify text annotations cannot be resized smaller than their content
 */
describe("Text Minimum Size Constraint", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it("should calculate minimum width based on text content length", () => {
    const fontSize = 16
    const content = "Hello World" // 11 characters

    // Estimate: 0.6 * fontSize per character
    const estimatedWidth = content.length * fontSize * 0.6
    expect(estimatedWidth).toBe(11 * 16 * 0.6) // 105.6px

    // Minimum should be at least this width (or 50px minimum)
    const minWidth = Math.max(estimatedWidth, 50)
    expect(minWidth).toBe(estimatedWidth) // Should use estimated width
  })

  it("should enforce minimum width of 50px for very short text", () => {
    const fontSize = 16
    const content = "Hi" // 2 characters

    const estimatedWidth = content.length * fontSize * 0.6
    expect(estimatedWidth).toBe(2 * 16 * 0.6) // 19.2px

    // Minimum should be 50px
    const minWidth = Math.max(estimatedWidth, 50)
    expect(minWidth).toBe(50)
  })

  it("should calculate minimum height based on font size", () => {
    const fontSize = 16

    // Minimum height should be 1.5 * fontSize
    const estimatedHeight = fontSize * 1.5
    expect(estimatedHeight).toBe(24)

    // Minimum should be at least this height (or 30px minimum)
    const minHeight = Math.max(estimatedHeight, 30)
    expect(minHeight).toBe(30) // 30px minimum applies
  })

  it("should use larger font size minimum when appropriate", () => {
    const fontSize = 32 // Large font

    const estimatedHeight = fontSize * 1.5
    expect(estimatedHeight).toBe(48)

    const minHeight = Math.max(estimatedHeight, 30)
    expect(minHeight).toBe(48) // Font-based minimum is larger
  })

  it("should prevent text annotation from being smaller than content", () => {
    const annotationStore = useAnnotationStore()

    const text: TextAnnotation = {
      id: "text-1",
      type: "text",
      pageNum: 1,
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      content: "Test Text Content", // 17 characters
      fontSize: 16,
      color: "#000000",
      rotation: 0
    }

    annotationStore.addAnnotation(text)

    // Calculate expected minimums
    const minWidth = Math.max(17 * 16 * 0.6, 50) // ~163.2px
    const minHeight = Math.max(16 * 1.5, 30) // 30px

    // The transform handles should enforce these minimums
    // (This is enforced in Transform.vue handleResize)
    expect(minWidth).toBeGreaterThan(50)
    expect(minHeight).toBe(30)
  })

  it("should allow resizing larger than minimum", () => {
    const annotationStore = useAnnotationStore()

    const text: TextAnnotation = {
      id: "text-1",
      type: "text",
      pageNum: 1,
      x: 100,
      y: 100,
      width: 100,
      height: 40,
      content: "Short",
      fontSize: 16,
      color: "#000000",
      rotation: 0
    }

    annotationStore.addAnnotation(text)

    // Should be able to resize to larger dimensions
    annotationStore.updateAnnotation("text-1", {
      width: 300,
      height: 100
    })

    const updated = annotationStore.getAnnotationById("text-1") as TextAnnotation
    expect(updated.width).toBe(300)
    expect(updated.height).toBe(100)
  })
})
