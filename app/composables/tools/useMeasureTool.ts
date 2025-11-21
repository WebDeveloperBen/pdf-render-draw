import type { Measurement } from "~/types/annotations"
import type { Point } from "~/types"
import { createInjectionState } from "@vueuse/core"

const [useProvideMeasureTool, useMeasureToolState] = createInjectionState(() => {
  const settingsStore = useSettingStore()

  const tool = useDrawingTool<Measurement>({
    type: "measure",
    minPoints: 2,
    canClose: false,

    calculate: (points: Point[]) => {
      const start = points[0]!
      const end = points[1]!
      const distance = calculateDistance(start, end, settingsStore.getPdfScale)
      const midpoint = calculateMidpoint(start, end)

      return {
        points: [start, end],
        distance,
        midpoint
      }
    },

    onCreate: async (measurement) => {
      console.log("Measurement created:", measurement)
    }
  })

  // Computed for preview
  const previewDistance = computed(() => {
    if (!tool.isDrawing.value || tool.points.value.length !== 1 || !tool.tempEndPoint.value) {
      return null
    }

    return calculateDistance(tool.points.value[0]!, tool.tempEndPoint.value, settingsStore.getPdfScale)
  })

  return {
    ...tool,
    previewDistance
  }
})

export { useProvideMeasureTool, useMeasureToolState }

// Keep the original export name for provider for backwards compatibility
export const useMeasureTool = useProvideMeasureTool
