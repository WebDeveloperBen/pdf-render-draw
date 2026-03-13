import { useCreateBaseTool } from "./useCreateBaseTool"
/**
 * Measure Tool - extends BaseTool
 *
 * Hierarchy:
 *   BaseTool (stores, rotation, selection)
 *     ↓ extends
 *   DrawingTool (drawing logic, points, events)
 *     ↓ extends
 *   MeasureTool (measurement-specific calculations)
 */
const [useMeasureTool, useMeasureToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = useCreateBaseTool()
  const viewportStore = useViewportStore()

  // Add drawing behavior via composition
  const drawing = useDrawingTool<Measurement>({
    type: "measure",
    minPoints: 2,
    canClose: false,

    calculate: (points: Point[]) => {
      const start = points[0]!
      const end = points[1]!
      const distance = calculateDistance(start, end)
      const midpoint = calculateMidpoint(start, end)

      return {
        points: [start, end],
        distance,
        midpoint,
        labelRotation: -viewportStore.rotation, // Counter-rotate to appear upright in viewport
        rotation: 0
      }
    },

    onCreate: () => {}
  })

  // Tool-specific computed properties
  const previewDistance = computed(() => {
    if (!drawing.isDrawing.value || drawing.points.value.length !== 1 || !drawing.tempEndPoint.value) {
      return null
    }

    return calculateDistance(drawing.points.value[0]!, drawing.tempEndPoint.value)
  })

  // Return composed tool (like extending multiple classes)
  const tool = {
    ...base, // Inherit: stores, getRotationTransform, selectAnnotation
    ...drawing, // Inherit: drawing behavior, events, state
    previewDistance // Add: tool-specific features
  }

  // Register tool with full metadata and event handlers
  registerTool({
    type: "measure",
    name: "Measure",
    icon: "lucide:ruler",
    onClick: tool.handleClick,
    onMouseMove: tool.handleMove,
    onMouseLeave: tool.clearPreview,
    onKeyDown: tool.handleKeyDown
  })

  return tool
})

export { useMeasureTool, useMeasureToolState }
