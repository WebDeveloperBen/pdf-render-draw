/**
 * Regression Tests: Click Handling
 *
 * Tests for bugs fixed in click/double-click handling:
 * - Click prevention after drag (useDragState)
 * - Double-click debouncing to prevent interference with single-click
 * - Click outside to deselect
 * - Click timing and event ordering
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { useDragState } from "~/composables/useDragState"
import { useAnnotationStore } from "~/stores/annotations"
import { useTimeoutFn } from "@vueuse/core"

describe("Regression: Click Handling", () => {
  beforeEach(() => {
    const annotationStore = useAnnotationStore()
    annotationStore.clearAnnotations()
    annotationStore.deselectAll()
    annotationStore.setActiveTool('')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("Bug Fix: Click Prevention After Drag", () => {
    it("should prevent click handler from firing immediately after drag ends", () => {
      const dragState = useDragState()

      // GIVEN: Drag just finished
      dragState.markDragEnd()

      // WHEN: Checking if drag just finished
      // THEN: Should return true within the prevention window (100ms)
      expect(dragState.isDragJustFinished()).toBe(true)

      // WHEN: Time passes beyond prevention window
      vi.advanceTimersByTime(150)

      // THEN: Should return false
      expect(dragState.isDragJustFinished()).toBe(false)
    })

    it("should use shared drag state across components", () => {
      // GIVEN: Two instances of useDragState
      const dragState1 = useDragState()
      const dragState2 = useDragState()

      // THEN: They should be the same instance (singleton)
      expect(dragState1).toBe(dragState2)

      // WHEN: One marks drag end
      dragState1.markDragEnd()

      // THEN: Both see the state
      expect(dragState2.isDragJustFinished()).toBe(true)
    })

    it("should prevent selection changes when drag just finished", () => {
      const annotationStore = useAnnotationStore()
      const dragState = useDragState()

      annotationStore.addAnnotation({
        id: "text-1",
        rotation: 0,
        type: "text" as const,
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000"
      })

      // GIVEN: Drag just finished
      dragState.markDragEnd()

      // WHEN: Click handler checks if it should process
      const shouldProcess = !dragState.isDragJustFinished()

      // THEN: Should not process the click
      expect(shouldProcess).toBe(false)

      // WHEN: Time passes
      vi.advanceTimersByTime(150)

      // THEN: Click should now be processed
      expect(!dragState.isDragJustFinished()).toBe(true)
    })
  })

  describe("Bug Fix: Double-Click Debouncing", () => {
    it("should delay single-click to detect double-click", async () => {
      const selectionCallback = vi.fn()
      const CLICK_DELAY = 150

      // Create delayed selection function using useTimeoutFn
      const { start } = useTimeoutFn(selectionCallback, CLICK_DELAY, { immediate: false })

      // WHEN: Single click occurs
      start()

      // THEN: Callback should not fire immediately
      expect(selectionCallback).not.toHaveBeenCalled()

      // WHEN: Wait less than delay
      vi.advanceTimersByTime(100)

      // THEN: Still not called
      expect(selectionCallback).not.toHaveBeenCalled()

      // WHEN: Wait past delay
      vi.advanceTimersByTime(60)

      // THEN: Callback fires
      expect(selectionCallback).toHaveBeenCalledTimes(1)
    })

    it("should cancel single-click when double-click occurs", () => {
      const selectionCallback = vi.fn()
      const doubleClickCallback = vi.fn()
      const CLICK_DELAY = 150

      const { start, stop } = useTimeoutFn(selectionCallback, CLICK_DELAY, { immediate: false })

      // WHEN: First click
      start()

      // THEN: Selection not called yet
      expect(selectionCallback).not.toHaveBeenCalled()

      // WHEN: Second click (double-click) within delay
      vi.advanceTimersByTime(50)
      stop() // Cancel pending selection
      doubleClickCallback() // Execute double-click immediately

      // THEN: Double-click fires, single-click doesn't
      expect(doubleClickCallback).toHaveBeenCalledTimes(1)
      expect(selectionCallback).not.toHaveBeenCalled()

      // WHEN: Wait past delay
      vi.advanceTimersByTime(200)

      // THEN: Selection still not called (was cancelled)
      expect(selectionCallback).not.toHaveBeenCalled()
    })

    it("should allow single-click after double-click completes", () => {
      const selectionCallback = vi.fn()
      const doubleClickCallback = vi.fn()
      const CLICK_DELAY = 150

      const { start, stop } = useTimeoutFn(selectionCallback, CLICK_DELAY, { immediate: false })

      // WHEN: Double-click sequence
      start()
      vi.advanceTimersByTime(50)
      stop() // Cancel first click
      doubleClickCallback()

      // Reset for new click
      selectionCallback.mockClear()
      doubleClickCallback.mockClear()

      // WHEN: New single click after double-click
      vi.advanceTimersByTime(200)
      start()
      vi.advanceTimersByTime(CLICK_DELAY + 10)

      // THEN: Single-click fires normally
      expect(selectionCallback).toHaveBeenCalledTimes(1)
      expect(doubleClickCallback).not.toHaveBeenCalled()
    })
  })

  describe("Click Outside to Deselect", () => {
    it("should deselect annotation when clicking outside", () => {
      const annotationStore = useAnnotationStore()
      const dragState = useDragState()

      annotationStore.addAnnotation({
        id: "text-1",
        rotation: 0,
        type: "text" as const,
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000"
      })

      annotationStore.selectAnnotation("text-1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["text-1"])

      // Simulate clicking outside (not on annotation, not drag just finished, not drawing)
      const shouldDeselect = !dragState.isDragJustFinished() && !annotationStore.isDrawing

      if (shouldDeselect) {
        annotationStore.selectAnnotation(null)
      }

      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })

    it("should not deselect if drag just finished", () => {
      const annotationStore = useAnnotationStore()
      const dragState = useDragState()

      annotationStore.addAnnotation({
        id: "text-1",
        type: "text" as const,
        rotation: 0,
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000"
      })

      annotationStore.selectAnnotation("text-1")

      // Mark drag just finished
      dragState.markDragEnd()

      // Should not deselect
      const shouldDeselect = !dragState.isDragJustFinished() && !annotationStore.isDrawing

      expect(shouldDeselect).toBe(false)
      expect(annotationStore.selectedAnnotationIds).toEqual(["text-1"])
    })

    it("should not deselect if currently drawing", () => {
      const annotationStore = useAnnotationStore()
      const dragState = useDragState()

      annotationStore.addAnnotation({
        id: "text-1",
        type: "text" as const,
        pageNum: 1,
        rotation: 0,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000"
      })

      annotationStore.selectAnnotation("text-1")
      annotationStore.isDrawing = true

      // Should not deselect when drawing
      const shouldDeselect = !dragState.isDragJustFinished() && !annotationStore.isDrawing

      expect(shouldDeselect).toBe(false)
      expect(annotationStore.selectedAnnotationIds).toEqual(["text-1"])
    })
  })

  describe("Click Event Ordering", () => {
    it("should handle click → drag → release sequence correctly", () => {
      const dragState = useDragState()
      const clickHandler = vi.fn()

      // WHEN: Click (mousedown)
      // ... drag happens ...
      // AND: Release (mouseup + click event)
      dragState.markDragEnd()

      // THEN: Subsequent click should be ignored
      if (!dragState.isDragJustFinished()) {
        clickHandler()
      }

      expect(clickHandler).not.toHaveBeenCalled()

      // WHEN: Wait past prevention window
      vi.advanceTimersByTime(150)

      // THEN: Clicks are processed again
      if (!dragState.isDragJustFinished()) {
        clickHandler()
      }

      expect(clickHandler).toHaveBeenCalledTimes(1)
    })
  })
})
