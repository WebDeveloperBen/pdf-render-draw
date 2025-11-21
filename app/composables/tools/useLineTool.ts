import type { Line } from "~/types/annotations"
import type { Point } from "~/types"
import { createInjectionState } from "@vueuse/core"
import { createBaseTool } from "./useToolComponent"

/**
 * Line Tool - extends BaseTool
 *
 * Hierarchy:
 *   BaseTool (stores, rotation, selection)
 *     ↓ extends
 *   DrawingTool (drawing logic, points, events)
 *     ↓ extends
 *   LineTool (simple line drawing, no calculations)
 */
const [useProvideLineTool, useLineToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = createBaseTool()

  // Add drawing behavior via composition
  const drawing = useDrawingTool<Line>({
    type: "line",
    minPoints: 2,
    canClose: false,

    calculate: (points: Point[]) => ({
      points
    }),

    onCreate: async (line) => {
      console.log("Line created:", line)
    }
  })

  // Return composed tool (like extending multiple classes)
  return {
    ...base,      // Inherit: stores, getRotationTransform, selectAnnotation
    ...drawing    // Inherit: drawing behavior, events, state
  }
})

export { useProvideLineTool, useLineToolState }

// Keep the original export name for provider for backwards compatibility
export const useLineTool = useProvideLineTool
