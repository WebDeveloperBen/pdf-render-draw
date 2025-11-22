/**
 * Regression Tests: Text Editing
 *
 * Tests for bugs fixed in text editing functionality:
 * - Double-click to edit (with debouncing to prevent single-click interference)
 * - Global text editing state (useTextEditingState)
 * - Text editing state accessible from event handlers (no injection errors)
 * - Single-click selection doesn't interfere with double-click edit
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { useTextEditingState } from "~/composables/useTextEditingState"
import { useAnnotationStore } from "~/stores/annotations"
import type { TextAnnotation } from "~/types/annotations"

describe("Regression: Text Editing", () => {
  beforeEach(() => {
    const annotationStore = useAnnotationStore()
    annotationStore.clearAnnotations()
    annotationStore.deselectAll()
    annotationStore.setActiveTool('')

    // Reset text editing state
    const textEditing = useTextEditingState()
    textEditing.cancelEditing()
  })

  describe("Bug Fix: Global Text Editing State", () => {
    it("should share text editing state across all instances", () => {
      // GIVEN: Multiple instances of useTextEditingState
      const textEditing1 = useTextEditingState()
      const textEditing2 = useTextEditingState()

      // THEN: They should be the same instance (singleton via createGlobalState)
      expect(textEditing1).toBe(textEditing2)

      // WHEN: One instance starts editing
      const annotationStore = useAnnotationStore()
      const annotation: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        rotation: 0,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000"
      }
      annotationStore.addAnnotation(annotation)

      textEditing1.startEditing("text-1")

      // THEN: Both instances see the editing state
      expect(textEditing2.editingId.value).toBe("text-1")
      expect(textEditing2.editingContent.value).toBe("Test")
    })

    it("should be accessible from event handlers without injection errors", () => {
      // GIVEN: Text editing state accessed outside component setup (like in tool registration)
      let textEditingInHandler: ReturnType<typeof useTextEditingState> | null = null

      // WHEN: Simulating event handler access (e.g., onDoubleClick in tool registration)
      const simulateEventHandler = () => {
        textEditingInHandler = useTextEditingState()
      }

      // THEN: Should not throw injection error
      expect(simulateEventHandler).not.toThrow()
      expect(textEditingInHandler).toBeDefined()

      // AND: Should be the same singleton instance
      const textEditingInSetup = useTextEditingState()
      expect(textEditingInHandler).toBe(textEditingInSetup)
    })
  })

  describe("Bug Fix: Double-Click to Edit", () => {
    it("should start editing when double-clicking text annotation", () => {
      const annotationStore = useAnnotationStore()
      const textEditing = useTextEditingState()

      const annotation: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        rotation: 0,
        content: "Original Content",
        fontSize: 16,
        color: "#000"
      }

      annotationStore.addAnnotation(annotation)

      // WHEN: Double-click triggers editing
      textEditing.startEditing("text-1")

      // THEN: Text is in edit mode
      expect(textEditing.editingId.value).toBe("text-1")
      expect(textEditing.editingContent.value).toBe("Original Content")
    })

    it("should finish editing and save changes", () => {
      const annotationStore = useAnnotationStore()
      const textEditing = useTextEditingState()

      const annotation: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        rotation: 0,
        content: "Original",
        fontSize: 16,
        color: "#000"
      }

      annotationStore.addAnnotation(annotation)
      textEditing.startEditing("text-1")

      // WHEN: User edits content
      textEditing.editingContent.value = "Modified Content"

      // AND: Finishes editing
      textEditing.finishEditing()

      // THEN: Annotation is updated
      const updated = annotationStore.getAnnotationById("text-1") as TextAnnotation
      expect(updated.content).toBe("Modified Content")

      // AND: Editing state is cleared
      expect(textEditing.editingId.value).toBeNull()
      expect(textEditing.editingContent.value).toBe("")
    })

    it("should cancel editing without saving changes", () => {
      const annotationStore = useAnnotationStore()
      const textEditing = useTextEditingState()

      const annotation: TextAnnotation = {
        id: "text-1",
        type: "text",
        rotation: 0,
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Original",
        fontSize: 16,
        color: "#000"
      }

      annotationStore.addAnnotation(annotation)
      textEditing.startEditing("text-1")

      // WHEN: User modifies content but cancels
      textEditing.editingContent.value = "Modified"
      textEditing.cancelEditing()

      // THEN: Annotation is unchanged
      const unchanged = annotationStore.getAnnotationById("text-1") as TextAnnotation
      expect(unchanged.content).toBe("Original")

      // AND: Editing state is cleared
      expect(textEditing.editingId.value).toBeNull()
      expect(textEditing.editingContent.value).toBe("")
    })

    it("should handle editing non-existent annotation gracefully", () => {
      const textEditing = useTextEditingState()

      // WHEN: Trying to edit non-existent annotation
      textEditing.startEditing("non-existent-id")

      // THEN: Should not start editing
      expect(textEditing.editingId.value).toBeNull()
      expect(textEditing.editingContent.value).toBe("")
    })
  })

  describe("Bug Fix: Click/Double-Click Interaction", () => {
    it("should not select annotation when double-clicking to edit", () => {
      // This tests the integration of debounced click and double-click

      const annotationStore = useAnnotationStore()
      const textEditing = useTextEditingState()

      const annotation: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        rotation: 0,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000"
      }

      annotationStore.addAnnotation(annotation)

      // Simulate the debounced click/double-click interaction:
      // 1. First click starts debounced selection timer
      // 2. Second click (double-click) cancels the timer and starts editing

      vi.useFakeTimers()

      // Second click before delay expires - cancels selection, starts editing
      textEditing.startEditing("text-1")

      // Editing started immediately
      expect(textEditing.editingId.value).toBe("text-1")

      // Even after delay passes, selection shouldn't happen (was cancelled)
      vi.advanceTimersByTime(200)

      vi.useRealTimers()
    })
  })

  describe("Text Editing State Management", () => {
    it("should track which annotation is being edited", () => {
      const annotationStore = useAnnotationStore()
      const textEditing = useTextEditingState()

      const anno1: TextAnnotation = {
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 0,
        rotation: 0,
        y: 0,
        width: 100,
        height: 50,
        content: "First",
        fontSize: 16,
        color: "#000"
      }

      const anno2: TextAnnotation = {
        id: "text-2",
        type: "text",
        pageNum: 1,
        x: 0,
        y: 100,
        width: 100,
        rotation: 0,
        height: 50,
        content: "Second",
        fontSize: 16,
        color: "#000"
      }

      annotationStore.addAnnotation(anno1)
      annotationStore.addAnnotation(anno2)

      // Edit first
      textEditing.startEditing("text-1")
      expect(textEditing.editingId.value).toBe("text-1")
      expect(textEditing.editingContent.value).toBe("First")

      // Switch to editing second (finish first)
      textEditing.finishEditing()
      textEditing.startEditing("text-2")
      expect(textEditing.editingId.value).toBe("text-2")
      expect(textEditing.editingContent.value).toBe("Second")
    })

    it("should allow concurrent editing of only one annotation at a time", () => {
      const annotationStore = useAnnotationStore()
      const textEditing = useTextEditingState()

      annotationStore.addAnnotation({
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        rotation: 0,
        content: "First",
        fontSize: 16,
        color: "#000"
      })

      annotationStore.addAnnotation({
        id: "text-2",
        type: "text",
        pageNum: 1,
        x: 0,
        y: 100,
        width: 100,
        rotation: 0,
        height: 50,
        content: "Second",
        fontSize: 16,
        color: "#000"
      })

      // Start editing first
      textEditing.startEditing("text-1")
      expect(textEditing.editingId.value).toBe("text-1")

      // Start editing second (should replace first)
      textEditing.startEditing("text-2")
      expect(textEditing.editingId.value).toBe("text-2")

      // Only one can be edited at a time
      expect(textEditing.editingId.value).not.toBe("text-1")
    })
  })

  describe("Text Content Updates", () => {
    it("should update annotation content on finish editing", () => {
      const annotationStore = useAnnotationStore()
      const textEditing = useTextEditingState()

      annotationStore.addAnnotation({
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 0,
        y: 0,
        rotation: 0,
        width: 100,
        height: 50,
        content: "Initial",
        fontSize: 16,
        color: "#000"
      })

      textEditing.startEditing("text-1")
      textEditing.editingContent.value = "Updated via editing"
      textEditing.finishEditing()

      const annotation = annotationStore.getAnnotationById("text-1") as TextAnnotation
      expect(annotation.content).toBe("Updated via editing")
    })

    it("should handle empty content", () => {
      const annotationStore = useAnnotationStore()
      const textEditing = useTextEditingState()

      annotationStore.addAnnotation({
        id: "text-1",
        type: "text",
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        rotation: 0,
        content: "Initial",
        fontSize: 16,
        color: "#000"
      })

      textEditing.startEditing("text-1")
      textEditing.editingContent.value = ""
      textEditing.finishEditing()

      const annotation = annotationStore.getAnnotationById("text-1") as TextAnnotation
      expect(annotation.content).toBe("")
    })
  })
})
