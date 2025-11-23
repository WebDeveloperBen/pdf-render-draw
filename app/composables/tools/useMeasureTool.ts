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
        labelRotation: -rendererStore.rotation, // Counter-rotate to appear upright in viewport
        rotation: 0
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
  const tool = {
    ...base, // Inherit: stores, getRotationTransform, selectAnnotation
    ...drawing, // Inherit: drawing behavior, events, state
    previewDistance // Add: tool-specific features
  }

  // Register tool with full metadata, event handlers, and transformation logic
  registerTool({
    type: "measure",
    name: "Measure",
    icon: "📏",
    onClick: tool.handleClick,
    onMouseMove: tool.handleMove,
    onMouseLeave: tool.clearPreview,
    onKeyDown: tool.handleKeyDown,
    transform: {
      // Transform metadata
      structure: "point-based",
      groupRotation: "update-points",
      supportsGroupResize: true,
      supportsGroupMove: true,
      rotationCenter: "midpoint",

      // Get rotation center - midpoint of the line
      getCenter: (annotation) => {
        const measure = annotation as Measurement
        return {
          x: (measure.points[0].x + measure.points[1].x) / 2,
          y: (measure.points[0].y + measure.points[1].y) / 2
        }
      },

      // Apply rotation - just update rotation property
      applyRotation: (annotation, rotationDelta) => {
        const currentRotation = annotation.rotation || 0
        return { rotation: currentRotation + rotationDelta }
      },

      // Apply move - translate all points and recalculate derived values
      applyMove: (annotation, deltaX, deltaY) => {
        const measure = annotation as Measurement
        const movedPoints = measure.points.map((p) => ({
          x: p.x + deltaX,
          y: p.y + deltaY
        })) as [Point, Point]
        const updated = { ...measure, points: movedPoints }
        const derived = recalculateDerivedValues(updated)
        return { points: movedPoints, ...derived } as Partial<Measurement>
      },

      // Apply resize - scale points from original bounds and recalculate derived values
      applyResize: (annotation, newBounds, originalBounds) => {
        const measure = annotation as Measurement
        const scaleX = newBounds.width / originalBounds.width
        const scaleY = newBounds.height / originalBounds.height

        const scaledPoints = measure.points.map((p) => ({
          x: newBounds.x + (p.x - originalBounds.x) * scaleX,
          y: newBounds.y + (p.y - originalBounds.y) * scaleY
        })) as [Point, Point]

        const updated = { ...measure, points: scaledPoints }
        const derived = recalculateDerivedValues(updated)
        return { points: scaledPoints, ...derived } as Partial<Measurement>
      }
    }
  })

  return tool
})

export { useMeasureTool, useMeasureToolState }
