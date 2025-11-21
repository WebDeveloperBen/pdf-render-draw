import type { Annotation } from "~/types/annotations"

/**
 * Base tool factory - acts like a base class for all annotation tools
 *
 * This composable provides common functionality that all tools inherit:
 * - Store access (settings, annotations)
 * - Rotation transform helpers
 * - Selection handlers
 *
 * Tools "extend" this by calling createBaseTool() and spreading the result
 *
 * @example
 * // In a tool composable:
 * export function createMeasureTool() {
 *   const base = createBaseTool()
 *   const tool = useDrawingTool({ ... })
 *
 *   return {
 *     ...base,      // Inherit base functionality
 *     ...tool,      // Add tool-specific behavior
 *     // Override or add methods
 *   }
 * }
 */
export function createBaseTool() {
  const settings = useSettingStore()
  const annotationStore = useAnnotationStore()

  /**
   * Get rotation transform string for an annotation
   * Delegates to annotation store's centralized rotation logic
   */
  function getRotationTransform(annotation: Annotation): string {
    return annotationStore.getRotationTransform(annotation)
  }

  /**
   * Select an annotation by ID
   * Common action across all tools
   */
  function selectAnnotation(id: string) {
    annotationStore.selectAnnotation(id)
  }

  // Base "class" interface
  return {
    // Stores (protected-like access)
    settings,
    annotationStore,

    // Shared methods (public interface)
    getRotationTransform,
    selectAnnotation
  }
}

/**
 * @deprecated Use createBaseTool instead
 * Kept for backwards compatibility
 */
export const useToolComponent = createBaseTool
