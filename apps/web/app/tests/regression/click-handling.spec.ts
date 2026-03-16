/**
 * Regression Tests: Click Handling
 *
 * Tests for bugs fixed in click/double-click handling:
 * - Click prevention after interaction (useInteractionMode cooldown)
 * - Double-click debouncing to prevent interference with single-click
 * - Click outside to deselect
 * - Click timing and event ordering
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"

describe("Regression: Click Handling", () => {
  beforeEach(() => {
    const annotationStore = useAnnotationStore()
    annotationStore.clearAnnotations()
    annotationStore.deselectAll()
    annotationStore.setActiveTool("")
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("Bug Fix: Click Prevention After Interaction", () => {
    it("should prevent click handler from firing immediately after interaction ends", () => {
      const interactionMode = useInteractionMode()

      // GIVEN: Transition to selected → dragging → cooldown
      interactionMode.transition("selected")
      interactionMode.transition("dragging")
      interactionMode.endInteraction("selected")

      // WHEN: Checking if locked (interaction just finished → cooldown)
      // THEN: Should be locked within the prevention window (100ms)
      expect(interactionMode.isLocked.value).toBe(true)
      expect(interactionMode.mode.value).toBe("cooldown")

      // WHEN: Time passes beyond prevention window
      vi.advanceTimersByTime(100)

      // THEN: Should return to selected and no longer be locked
      expect(interactionMode.isLocked.value).toBe(false)
      expect(interactionMode.mode.value).toBe("selected")
    })

    it("should use shared interaction mode across components", () => {
      // GIVEN: Two instances of useInteractionMode
      const mode1 = useInteractionMode()
      const mode2 = useInteractionMode()

      // THEN: They should be the same instance (singleton)
      expect(mode1).toBe(mode2)

      // WHEN: One transitions
      mode1.transition("selected")

      // THEN: Both see the state
      expect(mode2.mode.value).toBe("selected")
    })

    it("should prevent selection changes when interaction just finished", () => {
      const annotationStore = useAnnotationStore()
      const interactionMode = useInteractionMode()

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

      // GIVEN: An interaction just finished (in cooldown)
      interactionMode.transition("selected")
      interactionMode.transition("dragging")
      interactionMode.endInteraction("selected")

      // WHEN: Click handler checks if it should process
      const shouldProcess = !interactionMode.isLocked.value

      // THEN: Should not process the click
      expect(shouldProcess).toBe(false)

      // WHEN: Time passes
      vi.advanceTimersByTime(100)

      // THEN: Click should now be processed
      expect(!interactionMode.isLocked.value).toBe(true)
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
      const interactionMode = useInteractionMode()

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

      // Simulate clicking outside (not locked, not drawing)
      const shouldDeselect = !interactionMode.shouldSuppressClick.value

      if (shouldDeselect) {
        annotationStore.selectAnnotation(null)
      }

      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })

    it("should not deselect if interaction just finished", () => {
      const annotationStore = useAnnotationStore()
      const interactionMode = useInteractionMode()

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

      // Mark interaction just finished (in cooldown)
      interactionMode.transition("selected")
      interactionMode.transition("dragging")
      interactionMode.endInteraction("selected")

      // Should not deselect
      const shouldDeselect = !interactionMode.shouldSuppressClick.value

      expect(shouldDeselect).toBe(false)
      expect(annotationStore.selectedAnnotationIds).toEqual(["text-1"])
    })

    it("should not deselect if currently drawing", () => {
      const annotationStore = useAnnotationStore()
      const interactionMode = useInteractionMode()

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
      const shouldDeselect = !interactionMode.shouldSuppressClick.value

      expect(shouldDeselect).toBe(false)
      expect(annotationStore.selectedAnnotationIds).toEqual(["text-1"])
    })
  })

  describe("Click Event Ordering", () => {
    it("should handle click → drag → release sequence correctly", () => {
      const interactionMode = useInteractionMode()
      const clickHandler = vi.fn()

      // WHEN: Start drag interaction
      interactionMode.transition("selected")
      interactionMode.transition("dragging")

      // AND: Release (mouseup → endInteraction → cooldown)
      interactionMode.endInteraction("selected")

      // THEN: Subsequent click should be ignored (locked during cooldown)
      if (!interactionMode.isLocked.value) {
        clickHandler()
      }

      expect(clickHandler).not.toHaveBeenCalled()

      // WHEN: Wait past prevention window
      vi.advanceTimersByTime(100)

      // THEN: Clicks are processed again
      if (!interactionMode.isLocked.value) {
        clickHandler()
      }

      expect(clickHandler).toHaveBeenCalledTimes(1)
    })
  })
})
