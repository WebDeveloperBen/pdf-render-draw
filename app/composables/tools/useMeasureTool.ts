import { useCreateBaseTool } from "./useCreateBaseTool"
import { registerTool } from "~/composables/useToolRegistry"

// Register measure tool metadata immediately when module loads
registerTool({
  type: "measure",
  name: "Measure",
  icon: "📏"
})

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
  const settingsStore = base.settings
  const rendererStore = useRendererStore()

  // Add drawing behavior via composition
  const drawing = useDrawingTool<Measurement>({
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
        midpoint,
        labelRotation: -rendererStore.rotation // Counter-rotate to appear upright in viewport
      }
    },

    onCreate: async (measurement) => {
      console.log("Measurement created:", measurement)
    }
  })

  // Tool-specific computed properties
  const previewDistance = computed(() => {
    if (!drawing.isDrawing.value || drawing.points.value.length !== 1 || !drawing.tempEndPoint.value) {
      return null
    }

    return calculateDistance(drawing.points.value[0]!, drawing.tempEndPoint.value, settingsStore.getPdfScale)
  })

  // Return composed tool (like extending multiple classes)
  return {
    ...base, // Inherit: stores, getRotationTransform, selectAnnotation
    ...drawing, // Inherit: drawing behavior, events, state
    previewDistance // Add: tool-specific features
  }
})

export { useMeasureTool, useMeasureToolState }
