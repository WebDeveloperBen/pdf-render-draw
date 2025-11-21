import type { Perimeter, PerimeterSegment } from '~/types/annotations'
import type { Point } from '~/types'
import { calculateDistance, calculateMidpoint, calculateCentroid } from '~/utils/calculations'
import { createInjectionState } from '@vueuse/core'

const [useProvidePerimeterTool, usePerimeterToolState] = createInjectionState(() => {
  const settingsStore = useSettingStore()

  const tool = useDrawingTool<Perimeter>({
    type: 'perimeter',
    minPoints: 3,
    canClose: true,

    calculate: (points: Point[]) => {
      // Calculate segments for closed perimeter
      const segments: PerimeterSegment[] = []
      for (let i = 0; i < points.length; i++) {
        const start = points[i]!
        const end = points[(i + 1) % points.length]!

        segments.push({
          start,
          end,
          length: calculateDistance(start, end, settingsStore.getPdfScale),
          midpoint: calculateMidpoint(start, end),
        })
      }

      const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0)
      const center = calculateCentroid(points)

      return {
        points,
        segments,
        totalLength,
        center,
      }
    },

    onCreate: async (perimeter) => {
      console.log('Perimeter created:', perimeter)
    },
  })

  // Preview segments while drawing
  const previewSegments = computed((): PerimeterSegment[] => {
    if (!tool.isDrawing.value || tool.points.value.length < 1) {
      return []
    }

    const segments: PerimeterSegment[] = []

    // Completed segments
    for (let i = 0; i < tool.points.value.length - 1; i++) {
      const start = tool.points.value[i]!
      const end = tool.points.value[i + 1]!

      segments.push({
        start,
        end,
        length: calculateDistance(start, end, settingsStore.getPdfScale),
        midpoint: calculateMidpoint(start, end),
      })
    }

    // Temp segment to cursor
    if (tool.tempEndPoint.value) {
      const lastPoint = tool.points.value[tool.points.value.length - 1]!
      segments.push({
        start: lastPoint,
        end: tool.tempEndPoint.value,
        length: calculateDistance(lastPoint, tool.tempEndPoint.value, settingsStore.getPdfScale),
        midpoint: calculateMidpoint(lastPoint, tool.tempEndPoint.value),
      })
    }

    return segments
  })

  return {
    ...tool,
    previewSegments,
  }
})

export { useProvidePerimeterTool, usePerimeterToolState }

// Keep the original export name for provider for backwards compatibility
export const usePerimeterTool = useProvidePerimeterTool
