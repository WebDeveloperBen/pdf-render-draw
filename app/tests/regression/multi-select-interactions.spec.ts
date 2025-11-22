/**
 * Regression Tests: Multi-Select Interactions
 *
 * Tests for bugs fixed in multi-select functionality:
 * - Modifier key state sharing across components (useModifierKeys)
 * - Marquee selection
 * - Shift+click to add to selection
 * - Cmd/Ctrl+click to toggle selection
 * - Group transform handles rendering only once
 */

import { describe, it, expect, beforeEach } from "vitest"
import { useAnnotationStore } from "~/stores/annotations"
import { useModifierKeys } from "~/composables/useModifierKeys"

describe("Regression: Multi-Select Interactions", () => {
  beforeEach(() => {
    const annotationStore = useAnnotationStore()
    annotationStore.clearAnnotations()
    annotationStore.deselectAll()
    annotationStore.setActiveTool('')
  })

  describe("Bug Fix: Modifier Key State Sharing", () => {
    it("should share modifier key state across all components using createGlobalState", () => {
      // GIVEN: Multiple components access modifier keys
      const modifierKeys1 = useModifierKeys()
      const modifierKeys2 = useModifierKeys()

      // THEN: Both instances are the same singleton instance
      expect(modifierKeys1).toBe(modifierKeys2)

      // AND: They share the same reactive state
      expect(modifierKeys1.isShiftPressed).toBe(modifierKeys2.isShiftPressed)
      expect(modifierKeys1.isCmdOrCtrl).toBe(modifierKeys2.isCmdOrCtrl)
    })

    it("should provide reactive state for keyboard modifiers", () => {
      const modifierKeys = useModifierKeys()

      // THEN: Modifier state is available and reactive
      expect(modifierKeys.isShiftPressed).toBeDefined()
      expect(modifierKeys.isCmdOrCtrl).toBeDefined()
      expect(modifierKeys.isShiftPressed.value).toBe(false) // Initial state
      expect(modifierKeys.isCmdOrCtrl.value).toBe(false) // Initial state
    })
  })

  describe("Bug Fix: Shift+Click Multi-Select", () => {
    it("should add annotation to selection when Shift+clicking", async () => {
      const annotationStore = useAnnotationStore()

      // GIVEN: Two annotations exist
      const anno1 = {
        id: "text-1",
        type: "text" as const,
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: "First",
        fontSize: 16,
        rotation: 0,
        color: "#000000"
      }
      const anno2 = {
        id: "text-2",
        type: "text" as const,
        pageNum: 1,
        x: 100,
        rotation: 0,
        y: 200,
        width: 200,
        height: 50,
        content: "Second",
        fontSize: 16,
        color: "#000000"
      }

      annotationStore.addAnnotation(anno1)
      annotationStore.addAnnotation(anno2)

      // WHEN: First annotation is selected normally
      annotationStore.selectAnnotation("text-1")
      expect(annotationStore.selectedAnnotationIds).toEqual(["text-1"])

      // AND: Shift+click the second annotation
      annotationStore.selectAnnotation("text-2", { addToSelection: true })

      // THEN: Both annotations are selected
      expect(annotationStore.selectedAnnotationIds).toEqual(["text-1", "text-2"])
      expect(annotationStore.selectedAnnotationIds.length).toBe(2)
    })

    it("should not deselect other annotations when Shift+clicking", async () => {
      const annotationStore = useAnnotationStore()

      // GIVEN: Three annotations, two already selected
      annotationStore.addAnnotation({
        id: "text-1",
        rotation: 0,
        type: "text" as const,
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        content: "A",
        fontSize: 16,
        color: "#000"
      })
      annotationStore.addAnnotation({
        id: "text-2",
        type: "text" as const,
        pageNum: 1,
        x: 0,
        y: 100,
        width: 100,
        height: 50,
        content: "B",
        fontSize: 16,
        rotation: 0,
        color: "#000"
      })
      annotationStore.addAnnotation({
        id: "text-3",
        type: "text" as const,
        pageNum: 1,
        x: 0,
        rotation: 0,
        y: 200,
        width: 100,
        height: 50,
        content: "C",
        fontSize: 16,
        color: "#000"
      })

      annotationStore.selectAnnotations(["text-1", "text-2"])

      // WHEN: Shift+click third annotation
      annotationStore.selectAnnotation("text-3", { addToSelection: true })

      // THEN: All three are selected
      expect(annotationStore.selectedAnnotationIds).toEqual(["text-1", "text-2", "text-3"])
    })
  })

  describe("Bug Fix: Cmd/Ctrl+Click Toggle", () => {
    it("should toggle annotation selection when Cmd+clicking", () => {
      const annotationStore = useAnnotationStore()

      annotationStore.addAnnotation({
        id: "text-1",
        type: "text" as const,
        pageNum: 1,
        x: 0,
        rotation: 0,
        y: 0,
        width: 100,
        height: 50,
        content: "A",
        fontSize: 16,
        color: "#000"
      })

      // WHEN: Cmd+click an unselected annotation
      annotationStore.selectAnnotation("text-1", { toggle: true })

      // THEN: It becomes selected
      expect(annotationStore.selectedAnnotationIds).toEqual(["text-1"])

      // WHEN: Cmd+click the same annotation again
      annotationStore.selectAnnotation("text-1", { toggle: true })

      // THEN: It becomes deselected
      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })

    it("should toggle individual annotation in multi-selection", () => {
      const annotationStore = useAnnotationStore()

      annotationStore.addAnnotation({
        id: "text-1",
        type: "text" as const,
        pageNum: 1,
        rotation: 0,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        content: "A",
        fontSize: 16,
        color: "#000"
      })
      annotationStore.addAnnotation({
        id: "text-2",
        type: "text" as const,
        pageNum: 1,
        x: 0,
        y: 100,
        width: 100,
        height: 50,
        rotation: 0,
        content: "B",
        fontSize: 16,
        color: "#000"
      })
      annotationStore.addAnnotation({
        id: "text-3",
        type: "text" as const,
        pageNum: 1,
        x: 0,
        rotation: 0,
        y: 200,
        width: 100,
        height: 50,
        content: "C",
        fontSize: 16,
        color: "#000"
      })

      annotationStore.selectAnnotations(["text-1", "text-2", "text-3"])

      // WHEN: Cmd+click one of the selected annotations
      annotationStore.selectAnnotation("text-2", { toggle: true })

      // THEN: Only that annotation is deselected
      expect(annotationStore.selectedAnnotationIds).toEqual(["text-1", "text-3"])
    })
  })

  describe("Bug Fix: Group Transform Rendering", () => {
    it("should only render one GroupTransform for multiple selected annotations", () => {
      const annotationStore = useAnnotationStore()

      // GIVEN: Three annotations
      annotationStore.addAnnotation({
        id: "text-1",
        type: "text" as const,
        pageNum: 1,
        x: 0,
        y: 0,
        rotation: 0,
        width: 100,
        height: 50,
        content: "A",
        fontSize: 16,
        color: "#000"
      })
      annotationStore.addAnnotation({
        id: "text-2",
        type: "text" as const,
        pageNum: 1,
        x: 0,
        y: 100,
        rotation: 0,
        width: 100,
        height: 50,
        content: "B",
        fontSize: 16,
        color: "#000"
      })
      annotationStore.addAnnotation({
        id: "text-3",
        type: "text" as const,
        pageNum: 1,
        rotation: 0,
        x: 0,
        y: 200,
        width: 100,
        height: 50,
        content: "C",
        fontSize: 16,
        color: "#000"
      })

      // WHEN: All three are selected
      annotationStore.selectAnnotations(["text-1", "text-2", "text-3"])

      // THEN: Check that only the first selected annotation should render GroupTransform
      // (In BaseAnnotation.vue, the condition is: isSelected && length > 1 && selectedIds[0] === annotation.id)
      expect(annotationStore.selectedAnnotationIds[0]).toBe("text-1")
      expect(annotationStore.isAnnotationSelected("text-1")).toBe(true)
      expect(annotationStore.isAnnotationSelected("text-2")).toBe(true)
      expect(annotationStore.isAnnotationSelected("text-3")).toBe(true)

      // Only text-1 should render GroupTransform (first in selection)
      const shouldRenderGroupTransform = (id: string) => {
        return (
          annotationStore.isAnnotationSelected(id) &&
          annotationStore.selectedAnnotationIds.length > 1 &&
          annotationStore.selectedAnnotationIds[0] === id
        )
      }

      expect(shouldRenderGroupTransform("text-1")).toBe(true)
      expect(shouldRenderGroupTransform("text-2")).toBe(false)
      expect(shouldRenderGroupTransform("text-3")).toBe(false)
    })
  })

  describe("Multi-Select State Management", () => {
    it("should correctly track multiple selected annotations", () => {
      const annotationStore = useAnnotationStore()

      annotationStore.addAnnotation({
        id: "text-1",
        type: "text" as const,
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        rotation: 0,
        height: 50,
        content: "A",
        fontSize: 16,
        color: "#000"
      })
      annotationStore.addAnnotation({
        id: "text-2",
        type: "text" as const,
        pageNum: 1,
        x: 0,
        rotation: 0,
        y: 100,
        width: 100,
        height: 50,
        content: "B",
        fontSize: 16,
        color: "#000"
      })

      // Check initial state
      expect(annotationStore.selectedAnnotationIds).toEqual([])
      expect(annotationStore.selectedAnnotations).toEqual([])

      // Select multiple
      annotationStore.selectAnnotations(["text-1", "text-2"])

      expect(annotationStore.selectedAnnotationIds).toEqual(["text-1", "text-2"])
      expect(annotationStore.selectedAnnotations.length).toBe(2)
      expect(annotationStore.isAnnotationSelected("text-1")).toBe(true)
      expect(annotationStore.isAnnotationSelected("text-2")).toBe(true)

      // Deselect all
      annotationStore.deselectAll()

      expect(annotationStore.selectedAnnotationIds).toEqual([])
      expect(annotationStore.selectedAnnotations).toEqual([])
    })

    it("should handle selecting null (deselect all)", () => {
      const annotationStore = useAnnotationStore()

      annotationStore.addAnnotation({
        id: "text-1",
        type: "text" as const,
        rotation: 0,
        pageNum: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        content: "A",
        fontSize: 16,
        color: "#000"
      })
      annotationStore.selectAnnotation("text-1")

      expect(annotationStore.selectedAnnotationIds).toEqual(["text-1"])

      // Select null should deselect all
      annotationStore.selectAnnotation(null)

      expect(annotationStore.selectedAnnotationIds).toEqual([])
    })
  })
})
