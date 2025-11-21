import type { Area } from "~/types/annotations"
import type { Point } from "~/types"
import { createInjectionState } from "@vueuse/core"

const [useProvideAreaTool, useAreaToolState] = createInjectionState(() => {
  const settingsStore = useSettingStore()
  const rendererStore = useRendererStore()

  const tool = useDrawingTool<Area>({
    type: "area",
    minPoints: 3,
    canClose: true,

    calculate: (points: Point[]) => {
      const area = calculatePolygonArea(points, settingsStore.getPdfScale)
      const center = calculateCentroid(points)

      return {
        points,
        area,
        center,
        labelRotation: -rendererStore.rotation // Counter-rotate to appear upright in viewport
      }
    },

    onCreate: async (area) => {
      console.log("Area created:", area)
    }
  })

  const previewArea = computed(() => {
    if (!tool.isDrawing.value || tool.points.value.length < 2) {
      return null
    }

    const previewPoints = [...tool.points.value]
    if (tool.tempEndPoint.value) {
      previewPoints.push(tool.tempEndPoint.value)
    }

    return calculatePolygonArea(previewPoints, settingsStore.getPdfScale)
  })

  const previewPolygon = computed(() => {
    if (!tool.isDrawing.value || tool.points.value.length === 0) {
      return null
    }

    const points = [...tool.points.value]
    if (tool.tempEndPoint.value) {
      points.push(tool.tempEndPoint.value)
    }

    return tool.toSvgPoints(points)
  })

  return {
    ...tool,
    previewArea,
    previewPolygon
  }
})

export { useProvideAreaTool, useAreaToolState }

// Keep the original export name for provider for backwards compatibility
export const useAreaTool = useProvideAreaTool
