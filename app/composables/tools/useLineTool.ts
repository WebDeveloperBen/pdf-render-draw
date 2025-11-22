import { createInjectionState } from "@vueuse/core"
import { useCreateBaseTool } from "./useCreateBaseTool"

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
const [useLineTool, useLineToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = useCreateBaseTool()

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
    ...base, // Inherit: stores, getRotationTransform, selectAnnotation
    ...drawing // Inherit: drawing behavior, events, state
  }
})

export { useLineTool, useLineToolState }

// Register line tool in the plugin system
registerTool({
  type: "line",
  component: defineAsyncComponent(() => import("~/components/tools/Line.vue"))
})
