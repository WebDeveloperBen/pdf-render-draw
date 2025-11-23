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
        labelRotation: -rendererStore.rotation, // Counter-rotate to appear upright in viewport
        rotation: 0
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

  // Register tool with full metadata, event handlers, and transformation logic
  registerTool({
    type: "area",
    name: "Area",
    icon: "📐",
    onClick: tool.handleClick,
    onMouseMove: tool.handleMove,
    onMouseLeave: tool.clearPreview,
    onKeyDown: tool.handleKeyDown,
    transform: {
      // Get rotation center - stored center point
      getCenter: (annotation) => {
        const area = annotation as Area
        return { x: area.center.x, y: area.center.y }
      },

      // Apply rotation - just update rotation property
      applyRotation: (annotation, rotationDelta) => {
        const currentRotation = annotation.rotation || 0
        return { rotation: currentRotation + rotationDelta }
      },

      // Apply move - translate all points and recalculate derived values
      applyMove: (annotation, deltaX, deltaY) => {
        const area = annotation as Area
        const movedPoints = area.points.map((p) => ({
          x: p.x + deltaX,
          y: p.y + deltaY
        }))
        const updated = { ...area, points: movedPoints }
        const derived = recalculateDerivedValues(updated)
        return { points: movedPoints, ...derived } as Partial<Area>
      },

      // Apply resize - scale points and recalculate derived values
      applyResize: (annotation, newBounds, originalBounds) => {
        const area = annotation as Area
        const scaleX = newBounds.width / originalBounds.width
        const scaleY = newBounds.height / originalBounds.height

        const scaledPoints = area.points.map((p) => ({
          x: newBounds.x + (p.x - originalBounds.x) * scaleX,
          y: newBounds.y + (p.y - originalBounds.y) * scaleY
        }))

        const updated = { ...area, points: scaledPoints }
        const derived = recalculateDerivedValues(updated)
        return { points: scaledPoints, ...derived } as Partial<Area>
      }
    }
  })

  return tool
})

export { useAreaTool, useAreaToolState }
