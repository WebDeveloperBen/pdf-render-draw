import type { Perimeter, PerimeterSegment } from "~/types/annotations"
import type { Point } from "~/types"
import { createInjectionState } from "@vueuse/core"
import { createBaseTool } from "./useToolComponent"

/**
 * Perimeter Tool - extends BaseTool
 *
 * Hierarchy:
 *   BaseTool (stores, rotation, selection)
 *     ↓ extends
 *   DrawingTool (drawing logic, points, events)
 *     ↓ extends
 *   PerimeterTool (segment-by-segment perimeter calculations)
 */
const [useProvidePerimeterTool, usePerimeterToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = createBaseTool()
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
        labelRotation: -rendererStore.rotation // Counter-rotate to appear upright in viewport
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
  return {
    ...base,      // Inherit: stores, getRotationTransform, selectAnnotation
    ...drawing,   // Inherit: drawing behavior, events, state
    previewSegments // Add: tool-specific features
  }
})

export { useProvidePerimeterTool, usePerimeterToolState }

// Keep the original export name for provider for backwards compatibility
export const usePerimeterTool = useProvidePerimeterTool
