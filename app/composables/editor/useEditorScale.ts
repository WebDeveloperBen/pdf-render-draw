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
  const annotationStore = useAnnotationStore()

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

    // Determine which sides are being scaled
    const isLeft = scaleHandle.value === "nw" || scaleHandle.value === "sw" || scaleHandle.value === "w"
    const isTop = scaleHandle.value === "nw" || scaleHandle.value === "ne" || scaleHandle.value === "n"
    const isRight = scaleHandle.value === "ne" || scaleHandle.value === "se" || scaleHandle.value === "e"
    const isBottom = scaleHandle.value === "sw" || scaleHandle.value === "se" || scaleHandle.value === "s"
    const isEdgeHandle = scaleHandle.value.length === 1 // n, s, e, w

    // Calculate new bounds by applying deltas (matching Transform.vue logic)
    const newBounds = { ...scaleOriginalBounds.value }

    if (rotation !== 0) {
      // With rotation: apply deltas to dimensions only (not position)
      if (isEdgeHandle) {
        if (scaleHandle.value === "n") newBounds.height -= localDeltaY
        else if (scaleHandle.value === "e") newBounds.width += localDeltaX
        else if (scaleHandle.value === "s") newBounds.height += localDeltaY
        else if (scaleHandle.value === "w") newBounds.width -= localDeltaX
      } else {
        // Corner handles
        if (isLeft) newBounds.width -= localDeltaX
        if (isRight) newBounds.width += localDeltaX
        if (isTop) newBounds.height -= localDeltaY
        if (isBottom) newBounds.height += localDeltaY
      }
    } else {
      // No rotation: apply deltas to both dimensions and position
      if (isEdgeHandle) {
        if (scaleHandle.value === "n") {
          newBounds.y += deltaY
          newBounds.height -= deltaY
        } else if (scaleHandle.value === "e") {
          newBounds.width += deltaX
        } else if (scaleHandle.value === "s") {
          newBounds.height += deltaY
        } else if (scaleHandle.value === "w") {
          newBounds.x += deltaX
          newBounds.width -= deltaX
        }
      } else {
        // Corner handles
        if (isLeft) {
          newBounds.x += deltaX
          newBounds.width -= deltaX
        }
        if (isRight) newBounds.width += deltaX
        if (isTop) {
          newBounds.y += deltaY
          newBounds.height -= deltaY
        }
        if (isBottom) newBounds.height += deltaY
      }
    }

    // Prevent scaling below minimum size
    const minSize = 10
    if (newBounds.width < minSize) {
      if (isLeft && rotation === 0) newBounds.x = scaleOriginalBounds.value.x + scaleOriginalBounds.value.width - minSize
      newBounds.width = minSize
    }
    if (newBounds.height < minSize) {
      if (isTop && rotation === 0) newBounds.y = scaleOriginalBounds.value.y + scaleOriginalBounds.value.height - minSize
      newBounds.height = minSize
    }

    // Calculate scale factors from bounds ratio
    const scaleX = newBounds.width / scaleOriginalBounds.value.width
    const scaleY = newBounds.height / scaleOriginalBounds.value.height

    // Get center of original bounds
    const centerX = scaleOriginalBounds.value.x + scaleOriginalBounds.value.width / 2
    const centerY = scaleOriginalBounds.value.y + scaleOriginalBounds.value.height / 2

    // Apply scaling to all selected annotations
    for (const annotation of selection.selectedAnnotations.value) {
      const updates: Partial<Annotation> = {}

      // Point-based annotations - scale points from original
      if (isPointBased(annotation)) {
        const originalPoints = scaleOriginalPoints.value.get(annotation.id)
        if (!originalPoints) continue

        let scaledPoints: Point[]

        // For single selection without rotation: scale using newBounds
        // For multi-selection or with rotation: scale from selection center
        if (!selection.isMultiSelection.value && bounds.selectionRotation.value === 0) {
          // Scale from newBounds (accounts for handle direction)
          scaledPoints = originalPoints.map((p) => ({
            x: newBounds.x + (p.x - scaleOriginalBounds.value.x) * Math.abs(scaleX),
            y: newBounds.y + (p.y - scaleOriginalBounds.value.y) * Math.abs(scaleY)
          }))
        } else {
          // Multi-select or with rotation: scale each point relative to selection center
          scaledPoints = originalPoints.map((p) => {
            const offsetX = p.x - centerX
            const offsetY = p.y - centerY
            return {
              x: centerX + offsetX * scaleX,
              y: centerY + offsetY * scaleY
            }
          })
        }

        updates.points = scaledPoints

        // Recalculate derived values (distance, area, etc.)
        const derived = recalculateDerivedValues({
          ...annotation,
          points: scaledPoints
        })
        Object.assign(updates, derived)
      }
      // Positioned annotations - scale dimensions and position
      else if ('x' in annotation && 'width' in annotation) {
        const original = scaleOriginalShapes.value.get(annotation.id)
        if (!original) continue

        // Calculate shape's center in original state
        const shapeCenterX = original.x + original.width / 2
        const shapeCenterY = original.y + original.height / 2

        // Scale dimensions
        const scaledWidth = original.width * Math.abs(scaleX)
        const scaledHeight = original.height * Math.abs(scaleY)

        // Scale position relative to selection center
        const offsetX = shapeCenterX - centerX
        const offsetY = shapeCenterY - centerY

        const newCenterX = centerX + offsetX * scaleX
        const newCenterY = centerY + offsetY * scaleY

        updates.width = scaledWidth
        updates.height = scaledHeight
        updates.x = newCenterX - scaledWidth / 2
        updates.y = newCenterY - scaledHeight / 2
      }

      // Update annotation in store
      if (Object.keys(updates).length > 0) {
        annotationStore.updateAnnotation(annotation.id, updates)
      }
    }

    // Update frozen bounds if they exist (from rotation) - scale the frozen bounds from center
    // This keeps the transformer stable if we're scaling after rotating
    if (bounds.frozenBounds.value) {
      bounds.updateFrozenBounds({
        x: centerX - (scaleOriginalBounds.value.width / 2) * Math.abs(scaleX),
        y: centerY - (scaleOriginalBounds.value.height / 2) * Math.abs(scaleY),
        width: scaleOriginalBounds.value.width * Math.abs(scaleX),
        height: scaleOriginalBounds.value.height * Math.abs(scaleY)
      })
    }
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
