import { useCreateBaseTool } from "./useCreateBaseTool"

/**
 * Area Tool - extends BaseTool
 */
const [useAreaTool, useAreaToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = useCreateBaseTool()
  const settingsStore = base.settings
  const rendererStore = useRendererStore()

  // Add drawing behavior via composition
  const drawing = useDrawingTool<Area>({
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

  // Tool-specific computed properties
  const previewArea = computed(() => {
    if (!drawing.isDrawing.value || drawing.points.value.length < 2) {
      return null
    }

    const previewPoints = [...drawing.points.value]
    if (drawing.tempEndPoint.value) {
      previewPoints.push(drawing.tempEndPoint.value)
    }

    return calculatePolygonArea(previewPoints, settingsStore.getPdfScale)
  })

  const previewPolygon = computed(() => {
    if (!drawing.isDrawing.value || drawing.points.value.length === 0) {
      return null
    }

    const points = [...drawing.points.value]
    if (drawing.tempEndPoint.value) {
      points.push(drawing.tempEndPoint.value)
    }

    return drawing.toSvgPoints(points)
  })

  // Return composed tool (like extending multiple classes)
  const tool = {
    ...base, // Inherit: stores, getRotationTransform, selectAnnotation
    ...drawing, // Inherit: drawing behavior, events, state
    previewArea, // Add: tool-specific features
    previewPolygon
  }

  // Register tool with full metadata and event handlers
  registerTool({
    type: "area",
    name: "Area",
    icon: "📐",
    onClick: tool.handleClick,
    onMouseMove: tool.handleMove,
    onMouseLeave: tool.clearPreview,
    onKeyDown: tool.handleKeyDown
  })

  return tool
})

export { useAreaTool, useAreaToolState }
