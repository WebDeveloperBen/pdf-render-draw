import { Minus } from "lucide-vue-next"
import { useCreateBaseTool } from "./useCreateBaseTool"

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
      points,
      rotation: 0
    }),

    onCreate: () => {}
  })

  // Return composed tool (like extending multiple classes)
  const tool = {
    ...base, // Inherit: stores, getRotationTransform, selectAnnotation
    ...drawing // Inherit: drawing behavior, events, state
  }

  // Register tool with full metadata, event handlers, and transformation logic
  registerTool({
    type: "line",
    name: "Line",
    icon: Minus,
    onClick: tool.handleClick,
    onMouseMove: tool.handleMove,
    onMouseLeave: tool.clearPreview,
    onKeyDown: tool.handleKeyDown
  })

  return tool
})

export { useLineTool, useLineToolState }
