import { createInjectionState } from "@vueuse/core"
import { useCreateBaseTool } from "./useCreateBaseTool"
import { registerTool } from "@/composables/useToolRegistry"

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
  const tool = {
    ...base, // Inherit: stores, getRotationTransform, selectAnnotation
    ...drawing // Inherit: drawing behavior, events, state
  }

  // Register tool with full metadata and event handlers
  registerTool({
    type: "line",
    name: "Line",
    icon: "—",
    component: defineAsyncComponent(() => import("@/components/tools/Line.vue")),
    onClick: tool.handleClick,
    onMouseMove: tool.handleMove,
    onMouseLeave: tool.clearPreview,
    onKeyDown: tool.handleKeyDown
  })

  return tool
})

export { useLineTool, useLineToolState }
