import type { Line } from '~/types/annotations'
import type { Point } from '~/types'

export function useLineTool() {
  const tool = useDrawingTool<Line>({
    type: 'line',
    minPoints: 2,
    canClose: false,

    calculate: (points: Point[]) => ({
      points,
    }),

    onCreate: async (line) => {
      console.log('Line created:', line)
    },
  })

  return tool
}
