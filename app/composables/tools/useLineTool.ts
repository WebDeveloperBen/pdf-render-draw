import type { Line } from "~/types/annotations"
import type { Point } from "~/types"
import { createInjectionState } from "@vueuse/core"

const [useProvideLineTool, useLineToolState] = createInjectionState(() => {
  const tool = useDrawingTool<Line>({
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

  return tool
})

export { useProvideLineTool, useLineToolState }

// Keep the original export name for provider for backwards compatibility
export const useLineTool = useProvideLineTool
