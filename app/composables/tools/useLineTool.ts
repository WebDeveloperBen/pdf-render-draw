import { createInjectionState } from "@vueuse/core"
import { useCreateBaseTool } from "./useCreateBaseTool"
import { registerTool } from "~/composables/useToolRegistry"

// Register line tool metadata immediately when module loads
registerTool({
  type: "line",
  name: "Line",
  icon: "—"
})

/**
 * Line Tool - extends BaseTool
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
