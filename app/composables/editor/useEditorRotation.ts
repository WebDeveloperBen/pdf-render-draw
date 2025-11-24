/**
 * useEditorRotation - Rotation logic
 * Extracted from DebugEditor.vue
 *
 * Handles rotation of selected annotations around selection center
 * Implements frozen bounds pattern to prevent transformer jumping
 * Supports both point-based and positioned annotations
 */

import type { Point } from "~/types/editor"
import type { Annotation } from "~/types/annotations"
import { rotatePointsAroundCenter, rotatePointAroundCenter } from "~/utils/editor/transform"
import { recalculateDerivedValues, isPointBased, getAnnotationCenter } from "~/utils/editor/derived-values"
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

    for (const annotation of selection.selectedAnnotations.value) {
      rotationOriginalAngles.value.set(annotation.id, annotation.rotation)

      // For positioned annotations, store x,y for orbit
      if ('x' in annotation && 'y' in annotation) {
        rotationOriginalPositions.value.set(annotation.id, { x: annotation.x, y: annotation.y })
      }
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

    // Apply rotation to all selected annotations
    for (const annotation of selection.selectedAnnotations.value) {
      const originalRotation = rotationOriginalAngles.value.get(annotation.id) || 0

      // Point-based annotations - update rotation property (CSS for now)
      if (isPointBased(annotation)) {
        annotation.rotation = originalRotation + rotationDelta
      }
      // Positioned annotations - update rotation property
      else if ('x' in annotation && 'width' in annotation) {
        annotation.rotation = originalRotation + rotationDelta

        // Orbit for multi-select
        if (selection.isMultiSelection.value) {
          const originalPos = rotationOriginalPositions.value.get(annotation.id)
          if (!originalPos) continue

          const shapeCenterX = originalPos.x + annotation.width / 2
          const shapeCenterY = originalPos.y + annotation.height / 2

          const rotatedCenter = rotatePointAroundCenter(
            { x: shapeCenterX, y: shapeCenterY },
            rotationCenter.value,
            rotationDelta
          )

          annotation.x = rotatedCenter.x - annotation.width / 2
          annotation.y = rotatedCenter.y - annotation.height / 2
        }
      }
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
