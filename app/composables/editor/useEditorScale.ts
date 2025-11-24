/**
 * useEditorScale - Scaling/resizing logic
 * Extracted from DebugEditor.vue
 *
 * Handles scaling of selected shapes from corner/edge handles
 * Supports rotated shapes by projecting mouse deltas into local space
 */

import type { Point, Bounds, ScaleHandle } from "~/types/editor"
import type { Annotation } from "~/types/annotations"
import { projectDeltaToLocalSpace } from "~/utils/editor/transform"
import { recalculateDerivedValues, isPointBased } from "~/utils/editor/derived-values"
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
  const scaleOriginalPoints = ref<Map<string, Point[]>>(new Map())

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

    // Store original annotation data
    scaleOriginalShapes.value.clear()
    scaleOriginalPoints.value.clear()

    for (const annotation of selection.selectedAnnotations.value) {
      // Point-based annotations - store points array
      if (isPointBased(annotation)) {
        scaleOriginalPoints.value.set(annotation.id, JSON.parse(JSON.stringify(annotation.points)))
      }
      // Positioned annotations - store x, y, width, height
      else if ('x' in annotation && 'width' in annotation) {
        scaleOriginalShapes.value.set(annotation.id, {
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height
        })
      }
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
    // For single selection without rotation: scale from corner (1x delta)
    // For multi-selection or rotation: scale from center (2x delta because both sides move)
    const isCenterScaling = selection.isMultiSelection.value || rotation !== 0
    const deltaMultiplier = isCenterScaling ? 2 : 1

    let scaleX = 1
    let scaleY = 1

    switch (scaleHandle.value) {
      case "se":
        scaleX = 1 + (deltaMultiplier * localDeltaX) / scaleOriginalBounds.value.width
        scaleY = 1 + (deltaMultiplier * localDeltaY) / scaleOriginalBounds.value.height
        break
      case "sw":
        scaleX = 1 - (deltaMultiplier * localDeltaX) / scaleOriginalBounds.value.width
        scaleY = 1 + (deltaMultiplier * localDeltaY) / scaleOriginalBounds.value.height
        break
      case "ne":
        scaleX = 1 + (deltaMultiplier * localDeltaX) / scaleOriginalBounds.value.width
        scaleY = 1 - (deltaMultiplier * localDeltaY) / scaleOriginalBounds.value.height
        break
      case "nw":
        scaleX = 1 - (deltaMultiplier * localDeltaX) / scaleOriginalBounds.value.width
        scaleY = 1 - (deltaMultiplier * localDeltaY) / scaleOriginalBounds.value.height
        break
      case "e":
        scaleX = 1 + (deltaMultiplier * localDeltaX) / scaleOriginalBounds.value.width
        scaleY = 1
        break
      case "w":
        scaleX = 1 - (deltaMultiplier * localDeltaX) / scaleOriginalBounds.value.width
        scaleY = 1
        break
      case "s":
        scaleX = 1
        scaleY = 1 + (deltaMultiplier * localDeltaY) / scaleOriginalBounds.value.height
        break
      case "n":
        scaleX = 1
        scaleY = 1 - (deltaMultiplier * localDeltaY) / scaleOriginalBounds.value.height
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

    // Calculate new bounds based on handle and scale factors
    // This accounts for which corner/edge is being dragged
    const newBounds = { ...scaleOriginalBounds.value }

    // Determine which sides are being scaled
    const isLeft = scaleHandle.value === "nw" || scaleHandle.value === "sw" || scaleHandle.value === "w"
    const isTop = scaleHandle.value === "nw" || scaleHandle.value === "ne" || scaleHandle.value === "n"
    const isRight = scaleHandle.value === "ne" || scaleHandle.value === "se" || scaleHandle.value === "e"
    const isBottom = scaleHandle.value === "sw" || scaleHandle.value === "se" || scaleHandle.value === "s"

    // Calculate new width and height
    newBounds.width = scaleOriginalBounds.value.width * Math.abs(scaleX)
    newBounds.height = scaleOriginalBounds.value.height * Math.abs(scaleY)

    // Adjust x and y based on which handle is being dragged
    if (isLeft) {
      // Left edge moved - adjust x position
      newBounds.x = scaleOriginalBounds.value.x + scaleOriginalBounds.value.width * (1 - Math.abs(scaleX))
    }
    if (isTop) {
      // Top edge moved - adjust y position
      newBounds.y = scaleOriginalBounds.value.y + scaleOriginalBounds.value.height * (1 - Math.abs(scaleY))
    }

    // Get center of original bounds
    const centerX = scaleOriginalBounds.value.x + scaleOriginalBounds.value.width / 2
    const centerY = scaleOriginalBounds.value.y + scaleOriginalBounds.value.height / 2

    // Apply scaling to all selected annotations
    for (const annotation of selection.selectedAnnotations.value) {
      // Point-based annotations - scale points from original
      if (isPointBased(annotation)) {
        const originalPoints = scaleOriginalPoints.value.get(annotation.id)
        if (!originalPoints) continue

        // For single selection without rotation: scale using newBounds
        // For multi-selection or with rotation: scale from center
        if (!selection.isMultiSelection.value && bounds.selectionRotation.value === 0) {
          // Scale from newBounds (accounts for handle direction)
          const scaledPoints = originalPoints.map((p) => ({
            x: newBounds.x + (p.x - scaleOriginalBounds.value.x) * Math.abs(scaleX),
            y: newBounds.y + (p.y - scaleOriginalBounds.value.y) * Math.abs(scaleY)
          }))

          annotation.points = scaledPoints
        } else {
          // Scale from center (for rotation or multi-select)
          const scaledPoints = originalPoints.map((p) => ({
            x: centerX + (p.x - centerX) * scaleX,
            y: centerY + (p.y - centerY) * scaleY
          }))

          annotation.points = scaledPoints
        }

        // Recalculate derived values (distance, area, etc.)
        const derived = recalculateDerivedValues(annotation)
        Object.assign(annotation, derived)
      }
      // Positioned annotations - scale dimensions and position
      else if ('x' in annotation && 'width' in annotation) {
        const original = scaleOriginalShapes.value.get(annotation.id)
        if (!original) continue

        // Calculate shape's center in original state
        const shapeCenterX = original.x + original.width / 2
        const shapeCenterY = original.y + original.height / 2

        // Scale dimensions
        annotation.width = original.width * Math.abs(scaleX)
        annotation.height = original.height * Math.abs(scaleY)

        // Scale position relative to selection center
        const offsetX = shapeCenterX - centerX
        const offsetY = shapeCenterY - centerY

        const newCenterX = centerX + offsetX * scaleX
        const newCenterY = centerY + offsetY * scaleY

        annotation.x = newCenterX - annotation.width / 2
        annotation.y = newCenterY - annotation.height / 2
      }
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
    scaleOriginalPoints.value.clear()
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
