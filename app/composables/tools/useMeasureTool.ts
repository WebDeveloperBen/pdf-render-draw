import type { Measurement } from '~/types/annotations'
import type { Point } from '~/types'
import { calculateDistance, calculateMidpoint } from '~/utils/calculations'

export function useMeasureTool() {
  const rendererStore = useRendererStore()

  const tool = useDrawingTool<Measurement>({
    type: 'measure',
    minPoints: 2,
    canClose: false,

    calculate: (points: Point[]) => {
      const [start, end] = points
      const distance = calculateDistance(
        start,
        end,
        '1:100' // TODO: Get from PDF metadata
      )
      const midpoint = calculateMidpoint(start, end)

      return {
        points: [start, end],
        distance,
        midpoint,
      }
    },

    onCreate: async (measurement) => {
      console.log('Measurement created:', measurement)
    },
  })

  // Computed for preview
  const previewDistance = computed(() => {
    if (!tool.isDrawing.value || tool.points.value.length !== 1 || !tool.tempEndPoint.value) {
      return null
    }

    return calculateDistance(
      tool.points.value[0],
      tool.tempEndPoint.value,
      '1:100' // TODO: Get from PDF metadata
    )
  })

  return {
    ...tool,
    previewDistance,
  }
}
