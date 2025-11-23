import { useCreateBaseTool } from "./useCreateBaseTool"

/**
 * Line Tool - extends BaseTool
 */
const [useLineTool, useLineToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = useCreateBaseTool()

  // Add drawing behavior via composition
  const drawing = useDrawingTool<Line>({
    type: "line",
    minPoints: 2,
    canClose: false,

    calculate: (points: Point[]) => ({
      points,
      rotation: 0
    }),

    onCreate: async (line) => {
      console.log("Line created:", line)
    }
  })

  // Return composed tool (like extending multiple classes)
  const tool = {
    ...base, // Inherit: stores, getRotationTransform, selectAnnotation
    ...drawing // Inherit: drawing behavior, events, state
  }

  // Register tool with full metadata, event handlers, and transformation logic
  registerTool({
    type: "line",
    name: "Line",
    icon: "—",
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

      // Get rotation center - centroid of all points
      getCenter: (annotation) => {
        const line = annotation as Line
        const sumX = line.points.reduce((sum, p) => sum + p.x, 0)
        const sumY = line.points.reduce((sum, p) => sum + p.y, 0)
        return {
          x: sumX / line.points.length,
          y: sumY / line.points.length
        }
      },

      // Apply rotation - just update rotation property
      applyRotation: (annotation, rotationDelta) => {
        const currentRotation = annotation.rotation || 0
        return { rotation: currentRotation + rotationDelta }
      },

      // Apply move - translate all points (line has no derived values)
      applyMove: (annotation, deltaX, deltaY) => {
        const line = annotation as Line
        const movedPoints = line.points.map((p) => ({
          x: p.x + deltaX,
          y: p.y + deltaY
        }))
        return { points: movedPoints }
      },

      // Apply resize - scale points from original bounds (line has no derived values)
      applyResize: (annotation, newBounds, originalBounds) => {
        const line = annotation as Line
        const scaleX = newBounds.width / originalBounds.width
        const scaleY = newBounds.height / originalBounds.height

        const scaledPoints = line.points.map((p) => ({
          x: newBounds.x + (p.x - originalBounds.x) * scaleX,
          y: newBounds.y + (p.y - originalBounds.y) * scaleY
        }))

        return { points: scaledPoints }
      }
    }
  })

  return tool
})

export { useLineTool, useLineToolState }
