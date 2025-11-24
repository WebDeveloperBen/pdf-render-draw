/**
 * useEditorRotation - Rotation logic
 * Extracted from DebugEditor.vue
 *
 * Handles rotation of selected shapes around selection center
 * Implements frozen bounds pattern to prevent transformer jumping
 */

import type { Point } from "~/types/editor"
import { rotatePointAroundCenter } from "~/utils/editor/transform"
import { useEditorSelection } from "./useEditorSelection"
import { useEditorBounds } from "./useEditorBounds"
import { useEditorCoordinates } from "./useEditorCoordinates"

export const useEditorRotation = createSharedComposable(() => {
  const selection = useEditorSelection()
  const bounds = useEditorBounds()
  const coordinates = useEditorCoordinates()
  const cursor = useCursor()

  // Rotation state
  const isRotating = ref(false)
  const rotationStartAngle = ref(0)
  const rotationStartSelectionAngle = ref(0)
  const rotationCenter = ref<Point | null>(null)

  // Original state (before rotation started)
  const rotationOriginalAngles = ref<Map<string, number>>(new Map())
  const rotationOriginalPositions = ref<Map<string, { x: number; y: number }>>(new Map())

  /**
   * Start rotating
   */
  function startRotation(event: MouseEvent) {
    if (!selection.hasSelection.value || !bounds.selectionBounds.value) return

    const svg = getRootSVG(event.currentTarget)
    if (!svg) return

    coordinates.cacheSvg(svg)
    const svgPoint = coordinates.convertToSvgPoint(event, svg)
    if (!svgPoint) return

    // Lock the current visible bounding box (already calculated AABB)
    // This prevents the bounds from changing when isRotating becomes true
    bounds.freezeBounds()

    // Calculate center of selection
    const center = bounds.selectionCenter.value
    if (!center) return

    rotationCenter.value = center

    // Calculate starting angle from center to mouse
    const dx = svgPoint.x - center.x
    const dy = svgPoint.y - center.y
    rotationStartAngle.value = Math.atan2(dy, dx)

    // Store the current selection rotation (for accumulating multiple rotations)
    rotationStartSelectionAngle.value = bounds.selectionRotation.value

    // Store original rotations and positions
    rotationOriginalAngles.value.clear()
    rotationOriginalPositions.value.clear()

    for (const shape of selection.selectedShapes.value) {
      rotationOriginalAngles.value.set(shape.id, shape.rotation)
      rotationOriginalPositions.value.set(shape.id, { x: shape.x, y: shape.y })
    }

    isRotating.value = true
    cursor.set("grabbing")

    event.stopPropagation()
  }

  /**
   * Update rotation as mouse moves
   */
  function updateRotation(event: MouseEvent) {
    if (!isRotating.value || !rotationCenter.value) return

    const svgPoint = coordinates.convertToSvgPoint(event)
    if (!svgPoint) return

    // Calculate current angle from center to mouse
    const dx = svgPoint.x - rotationCenter.value.x
    const dy = svgPoint.y - rotationCenter.value.y
    const currentAngle = Math.atan2(dy, dx)

    // Calculate rotation delta from when we started THIS rotation
    const rotationDelta = currentAngle - rotationStartAngle.value

    // Update selection group rotation (accumulate with previous rotation)
    bounds.setSelectionRotation(rotationStartSelectionAngle.value + rotationDelta)

    // Apply rotation to all selected shapes
    for (const shape of selection.selectedShapes.value) {
      const originalRotation = rotationOriginalAngles.value.get(shape.id) || 0
      const originalPos = rotationOriginalPositions.value.get(shape.id)

      if (!originalPos) continue

      // Update shape rotation
      shape.rotation = originalRotation + rotationDelta

      // Rotate the shape's position around the selection center
      const shapeCenterX = originalPos.x + shape.width / 2
      const shapeCenterY = originalPos.y + shape.height / 2

      // Rotate center point
      const rotatedCenter = rotatePointAroundCenter(
        { x: shapeCenterX, y: shapeCenterY },
        rotationCenter.value,
        rotationDelta
      )

      // Update shape position (top-left corner)
      shape.x = rotatedCenter.x - shape.width / 2
      shape.y = rotatedCenter.y - shape.height / 2
    }
  }

  /**
   * End rotation
   */
  function endRotation() {
    if (!isRotating.value) return

    isRotating.value = false
    rotationStartAngle.value = 0
    rotationOriginalAngles.value.clear()
    rotationOriginalPositions.value.clear()
    rotationCenter.value = null
    cursor.reset()
    coordinates.clearSvgCache()

    // Keep frozen bounds and selection rotation until selection changes
  }

  return {
    // State
    isRotating: readonly(isRotating),

    // Methods
    startRotation,
    updateRotation,
    endRotation
  }
})
