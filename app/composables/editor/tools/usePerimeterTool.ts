import { useCreateBaseTool } from "./useCreateBaseTool"

/**
 * Perimeter Tool - extends BaseTool
 */
const [usePerimeterTool, usePerimeterToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = useCreateBaseTool()
  const viewportStore = useViewportStore()

  // Add drawing behavior via composition
  const drawing = useDrawingTool<Perimeter>({
    type: "perimeter",
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
          length: calculateDistance(start, end),
          midpoint: calculateMidpoint(start, end)
        })
      }

      const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0)
      const center = calculateCentroid(points)

      return {
        points,
        segments,
        totalLength,
        center,
        labelRotation: -viewportStore.rotation, // Counter-rotate to appear upright in viewport
        rotation: 0
      }
    },

    onCreate: async (perimeter) => {
      console.log("Perimeter created:", perimeter)
    }
  })

  // Tool-specific computed properties
  const previewSegments = computed((): PerimeterSegment[] => {
    if (!drawing.isDrawing.value || drawing.points.value.length < 1) {
      return []
    }

    const segments: PerimeterSegment[] = []

    // Completed segments
    for (let i = 0; i < drawing.points.value.length - 1; i++) {
      const start = drawing.points.value[i]!
      const end = drawing.points.value[i + 1]!

      segments.push({
        start,
        end,
        length: calculateDistance(start, end),
        midpoint: calculateMidpoint(start, end)
      })
    }

    // Temp segment to cursor
    if (drawing.tempEndPoint.value) {
      const lastPoint = drawing.points.value[drawing.points.value.length - 1]!
      segments.push({
        start: lastPoint,
        end: drawing.tempEndPoint.value,
        length: calculateDistance(lastPoint, drawing.tempEndPoint.value),
        midpoint: calculateMidpoint(lastPoint, drawing.tempEndPoint.value)
      })
    }

    return segments
  })

  // Return composed tool (like extending multiple classes)
  const tool = {
    ...base, // Inherit: stores, getRotationTransform, selectAnnotation
    ...drawing, // Inherit: drawing behavior, events, state
    previewSegments // Add: tool-specific features
  }

  // Register tool with full metadata and event handlers
  registerTool({
    type: "perimeter",
    name: "Perimeter",
    icon: "lucide:hexagon",
    onClick: tool.handleClick,
    onMouseMove: tool.handleMove,
    onMouseLeave: tool.clearPreview,
    onKeyDown: tool.handleKeyDown
  })

  return tool
})

export { usePerimeterTool, usePerimeterToolState }
