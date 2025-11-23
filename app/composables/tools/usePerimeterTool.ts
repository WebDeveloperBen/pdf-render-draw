import { useCreateBaseTool } from "./useCreateBaseTool"

/**
 * Perimeter Tool - extends BaseTool
 */
const [usePerimeterTool, usePerimeterToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = useCreateBaseTool()
  const settingsStore = base.settings
  const rendererStore = useRendererStore()

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
          length: calculateDistance(start, end, settingsStore.getPdfScale),
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
        labelRotation: -rendererStore.rotation, // Counter-rotate to appear upright in viewport
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
        length: calculateDistance(start, end, settingsStore.getPdfScale),
        midpoint: calculateMidpoint(start, end)
      })
    }

    // Temp segment to cursor
    if (drawing.tempEndPoint.value) {
      const lastPoint = drawing.points.value[drawing.points.value.length - 1]!
      segments.push({
        start: lastPoint,
        end: drawing.tempEndPoint.value,
        length: calculateDistance(lastPoint, drawing.tempEndPoint.value, settingsStore.getPdfScale),
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

  // Register tool with full metadata, event handlers, and transformation logic
  registerTool({
    type: "perimeter",
    name: "Perimeter",
    icon: "⬡",
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
      rotationCenter: "centroid",

      // Get rotation center - stored center point
      getCenter: (annotation) => {
        const perimeter = annotation as Perimeter
        return { x: perimeter.center.x, y: perimeter.center.y }
      },

      // Apply rotation - just update rotation property
      applyRotation: (annotation, rotationDelta) => {
        const currentRotation = annotation.rotation || 0
        return { rotation: currentRotation + rotationDelta }
      },

      // Apply move - translate all points and recalculate derived values
      applyMove: (annotation, deltaX, deltaY) => {
        const perimeter = annotation as Perimeter
        const movedPoints = perimeter.points.map((p) => ({
          x: p.x + deltaX,
          y: p.y + deltaY
        }))
        const updated = { ...perimeter, points: movedPoints }
        const derived = recalculateDerivedValues(updated)
        return { points: movedPoints, ...derived } as Partial<Perimeter>
      },

      // Apply resize - scale points and recalculate derived values
      applyResize: (annotation, newBounds, originalBounds) => {
        const perimeter = annotation as Perimeter
        const scaleX = newBounds.width / originalBounds.width
        const scaleY = newBounds.height / originalBounds.height

        const scaledPoints = perimeter.points.map((p) => ({
          x: newBounds.x + (p.x - originalBounds.x) * scaleX,
          y: newBounds.y + (p.y - originalBounds.y) * scaleY
        }))

        const updated = { ...perimeter, points: scaledPoints }
        const derived = recalculateDerivedValues(updated)
        return { points: scaledPoints, ...derived } as Partial<Perimeter>
      }
    }
  })

  return tool
})

export { usePerimeterTool, usePerimeterToolState }
