/**
 * useEditorScale - Scaling/resizing logic
 * Extracted from DebugEditor.vue
 *
 * Handles scaling of selected shapes from corner/edge handles
 * Supports rotated shapes by projecting mouse deltas into local space
 */

import type { Point, Bounds, ScaleHandle } from "~/types/editor"
import { projectDeltaToLocalSpace } from "~/utils/editor/transform"
import { useEditorSelection } from "./useEditorSelection"
import { useEditorBounds } from "./useEditorBounds"
import { useEditorCoordinates } from "./useEditorCoordinates"

export const useEditorScale = createSharedComposable(() => {
  const selection = useEditorSelection()
  const bounds = useEditorBounds()
  const coordinates = useEditorCoordinates()
  const cursor = useCursor()

  // Scaling state
  const isScaling = ref(false)
  const scaleHandle = ref<ScaleHandle | null>(null)
  const scaleStartPoint = ref<Point | null>(null)
  const scaleOriginalBounds = ref<Bounds | null>(null)
  const scaleOriginalShapes = ref<
    Map<string, { x: number; y: number; width: number; height: number }>
  >(new Map())

  /**
   * Start scaling
   */
  function startScale(event: MouseEvent, handle: ScaleHandle) {
    if (!selection.hasSelection.value || !bounds.selectionBounds.value) return

    const svg = getRootSVG(event.currentTarget)
    if (!svg) return

    coordinates.cacheSvg(svg)
    const svgPoint = coordinates.convertToSvgPoint(event, svg)
    if (!svgPoint) return

    isScaling.value = true
    scaleHandle.value = handle
    scaleStartPoint.value = svgPoint
    cursor.set("grabbing")

    // ALWAYS use the visual bounds (AABB) that the user sees
    // This ensures handles are where the user clicked
    scaleOriginalBounds.value = { ...bounds.selectionBounds.value }

    // Store original shape dimensions
    scaleOriginalShapes.value.clear()
    for (const shape of selection.selectedShapes.value) {
      scaleOriginalShapes.value.set(shape.id, {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height
      })
    }

    event.stopPropagation()
  }

  /**
   * Update scale as mouse moves
   */
  function updateScale(event: MouseEvent) {
    if (
      !isScaling.value ||
      !scaleStartPoint.value ||
      !scaleOriginalBounds.value ||
      !scaleHandle.value
    )
      return

    const svgPoint = coordinates.convertToSvgPoint(event)
    if (!svgPoint) return

    const deltaX = svgPoint.x - scaleStartPoint.value.x
    const deltaY = svgPoint.y - scaleStartPoint.value.y

    // Get rotation angle
    const rotation = bounds.selectionRotation.value

    // Project mouse delta into rotated coordinate system
    const { localDeltaX, localDeltaY } = projectDeltaToLocalSpace(deltaX, deltaY, rotation)

    // Calculate scale factors based on handle
    let scaleX = 1
    let scaleY = 1

    switch (scaleHandle.value) {
      case "se":
        scaleX = 1 + (2 * localDeltaX) / scaleOriginalBounds.value.width
        scaleY = 1 + (2 * localDeltaY) / scaleOriginalBounds.value.height
        break
      case "sw":
        scaleX = 1 - (2 * localDeltaX) / scaleOriginalBounds.value.width
        scaleY = 1 + (2 * localDeltaY) / scaleOriginalBounds.value.height
        break
      case "ne":
        scaleX = 1 + (2 * localDeltaX) / scaleOriginalBounds.value.width
        scaleY = 1 - (2 * localDeltaY) / scaleOriginalBounds.value.height
        break
      case "nw":
        scaleX = 1 - (2 * localDeltaX) / scaleOriginalBounds.value.width
        scaleY = 1 - (2 * localDeltaY) / scaleOriginalBounds.value.height
        break
      case "e":
        scaleX = 1 + (2 * localDeltaX) / scaleOriginalBounds.value.width
        scaleY = 1
        break
      case "w":
        scaleX = 1 - (2 * localDeltaX) / scaleOriginalBounds.value.width
        scaleY = 1
        break
      case "s":
        scaleX = 1
        scaleY = 1 + (2 * localDeltaY) / scaleOriginalBounds.value.height
        break
      case "n":
        scaleX = 1
        scaleY = 1 - (2 * localDeltaY) / scaleOriginalBounds.value.height
        break
    }

    // Prevent scaling below minimum size
    const minSize = 10
    if (Math.abs(scaleX * scaleOriginalBounds.value.width) < minSize) {
      scaleX = (minSize / scaleOriginalBounds.value.width) * Math.sign(scaleX)
    }
    if (Math.abs(scaleY * scaleOriginalBounds.value.height) < minSize) {
      scaleY = (minSize / scaleOriginalBounds.value.height) * Math.sign(scaleY)
    }

    // Get center of original bounds
    const centerX = scaleOriginalBounds.value.x + scaleOriginalBounds.value.width / 2
    const centerY = scaleOriginalBounds.value.y + scaleOriginalBounds.value.height / 2

    // Apply scaling to all selected shapes from center
    for (const shape of selection.selectedShapes.value) {
      const original = scaleOriginalShapes.value.get(shape.id)
      if (!original) continue

      // Calculate shape's center in original state
      const shapeCenterX = original.x + original.width / 2
      const shapeCenterY = original.y + original.height / 2

      // Scale dimensions
      shape.width = original.width * Math.abs(scaleX)
      shape.height = original.height * Math.abs(scaleY)

      // Scale position relative to selection center
      const offsetX = shapeCenterX - centerX
      const offsetY = shapeCenterY - centerY

      const newCenterX = centerX + offsetX * scaleX
      const newCenterY = centerY + offsetY * scaleY

      shape.x = newCenterX - shape.width / 2
      shape.y = newCenterY - shape.height / 2
    }

    // Update frozen bounds
    bounds.updateFrozenBounds({
      x: centerX - (scaleOriginalBounds.value.width / 2) * Math.abs(scaleX),
      y: centerY - (scaleOriginalBounds.value.height / 2) * Math.abs(scaleY),
      width: scaleOriginalBounds.value.width * Math.abs(scaleX),
      height: scaleOriginalBounds.value.height * Math.abs(scaleY)
    })
  }

  /**
   * End scaling
   */
  function endScale() {
    if (!isScaling.value) return

    isScaling.value = false
    scaleHandle.value = null
    scaleStartPoint.value = null
    scaleOriginalBounds.value = null
    scaleOriginalShapes.value.clear()
    cursor.reset()
    coordinates.clearSvgCache()
  }

  return {
    // State
    isScaling: readonly(isScaling),
    scaleHandle: readonly(scaleHandle),

    // Methods
    startScale,
    updateScale,
    endScale
  }
})
