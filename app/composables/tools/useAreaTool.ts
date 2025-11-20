import type { Area } from '~/types/annotations'
import type { Point } from '~/types'
import { calculatePolygonArea, calculateCentroid } from '~/utils/calculations'

export function useAreaTool() {
  const tool = useDrawingTool<Area>({
    type: 'area',
    minPoints: 3,
    canClose: true,

    calculate: (points: Point[]) => {
      const area = calculatePolygonArea(points, '1:100')
      const center = calculateCentroid(points)

      return {
        points,
        area,
        center,
      }
    },

    onCreate: async (area) => {
      console.log('Area created:', area)
    },
  })

  const previewArea = computed(() => {
    if (!tool.isDrawing.value || tool.points.value.length < 2) {
      return null
    }

    const previewPoints = [...tool.points.value]
    if (tool.tempEndPoint.value) {
      previewPoints.push(tool.tempEndPoint.value)
    }

    return calculatePolygonArea(previewPoints, '1:100')
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
    previewPolygon,
  }
}
