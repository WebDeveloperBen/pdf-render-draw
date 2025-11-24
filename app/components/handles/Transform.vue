<script setup lang="ts">
import { TRANSFORM, COLORS } from "~/constants/ui"

defineProps<{
  annotation: Annotation
}>()

const annotationStore = useAnnotationStore()
const historyStore = useHistoryStore()
const toolRegistry = useToolRegistry()

const selectedAnnotation = computed(() => annotationStore.selectedAnnotation)

const handleSize = TRANSFORM.HANDLE_SIZE
const rotationHandleDistance = TRANSFORM.ROTATION_DISTANCE

// Expose colors for v-bind in styles
const colorBlueDark = COLORS.SELECTION_BLUE_DARK
const colorBlueDarker = COLORS.SELECTION_BLUE_DARKER

// Use base transform composable
const transformBase = useTransformBase()

// Component-specific state
const originalPoints = ref<Array<{ x: number; y: number }> | null>(null)
const originalAnnotationState = ref<Annotation | null>(null)

// Calculate rotation center - delegate to tool's registered transform function
function getRotationCenter(annotation: Annotation): { x: number; y: number } {
  const tool = toolRegistry.getTool(annotation.type)
  if (tool?.transform?.getCenter) {
    return tool.transform.getCenter(annotation)
  }
  // Fallback to utility function for tools that haven't registered yet
  return getAnnotationCenter(annotation)
}

// Calculate bounding box for selected annotation
// The calculateBounds function now handles rotation properly, so we just call it directly
const bounds = computed(() => {
  if (!selectedAnnotation.value) return null
  return calculateBounds(selectedAnnotation.value)
})

// Use original bounds during rotation to keep transformer stable
const displayBounds = computed(() => {
  // During rotation drag: use originalBounds to keep transformer stable
  if (transformBase.isDragging.value && transformBase.dragMode.value === "rotate") {
    return transformBase.originalBounds.value
  }
  return bounds.value
})

// Calculate corner positions
const corners = computed(() => {
  if (!displayBounds.value) return []

  const b = displayBounds.value
  return [
    { x: b.x, y: b.y }, // Top-left
    { x: b.x + b.width, y: b.y }, // Top-right
    { x: b.x + b.width, y: b.y + b.height }, // Bottom-right
    { x: b.x, y: b.y + b.height } // Bottom-left
  ]
})

// Calculate edge midpoints for edge handles
const edges = computed(() => {
  if (!displayBounds.value) return []

  const b = displayBounds.value
  return [
    { x: b.x + b.width / 2, y: b.y }, // Top edge
    { x: b.x + b.width, y: b.y + b.height / 2 }, // Right edge
    { x: b.x + b.width / 2, y: b.y + b.height }, // Bottom edge
    { x: b.x, y: b.y + b.height / 2 } // Left edge
  ]
})

// Transform for rotating the entire transformer box
const transformerTransform = computed(() => {
  // Transform handles inherit rotation from BaseAnnotation parent
  // No additional transform needed - handles rotate with the shape
  return ""
})

function onStartDrag(e: MouseEvent, handle: string, mode: "resize" | "rotate" | "move") {
  if (!bounds.value || !selectedAnnotation.value) return

  const annotation = selectedAnnotation.value

  transformBase.startDrag(e, handle, mode, bounds.value, (svgPoint) => {
    // Store COMPLETE annotation state for undo/redo (deep clone)
    originalAnnotationState.value = JSON.parse(JSON.stringify(annotation))

    // Store original points for point-based annotations
    if (hasPoints(annotation)) {
      originalPoints.value = annotation.points.map((p) => ({ x: p.x, y: p.y }))
    }

    // For rotation, calculate the starting angle from center to mouse
    if (mode === "rotate") {
      const center = getRotationCenter(annotation)
      transformBase.startRotationAngle.value = Math.atan2(svgPoint.y - center.y, svgPoint.x - center.x)
    }
  })
}

function handleResize(deltaX: number, deltaY: number) {
  if (!selectedAnnotation.value || !transformBase.originalBounds.value || !transformBase.activeHandle.value) return

  const annotation = selectedAnnotation.value
  const handle = transformBase.activeHandle.value

  // Get annotation rotation
  const rotation = (annotation as { rotation?: number }).rotation || 0

  // Determine which corner or edge is being dragged
  const isLeft = handle === "corner-0" || handle === "corner-3" || handle === "edge-3"
  const isTop = handle === "corner-0" || handle === "corner-1" || handle === "edge-0"
  const isRight = handle === "corner-1" || handle === "corner-2" || handle === "edge-1"
  const isBottom = handle === "corner-2" || handle === "corner-3" || handle === "edge-2"

  // For edge handles, only allow resizing in one dimension
  const isEdgeHandle = handle.startsWith("edge-")

  // Calculate original aspect ratio
  const originalAspectRatio = transformBase.originalBounds.value.width / transformBase.originalBounds.value.height

  // Calculate new bounds based on corner/edge drag
  // For rotated annotations, we need to work in global space
  const newBounds = { ...transformBase.originalBounds.value }

  if (rotation !== 0) {
    // For rotated annotations: convert mouse delta to local space to understand
    // how much to scale in width/height
    const cos = Math.cos(-rotation)
    const sin = Math.sin(-rotation)
    const localDeltaX = deltaX * cos - deltaY * sin
    const localDeltaY = deltaX * sin + deltaY * cos

    // Apply local deltas to dimensions only
    if (isEdgeHandle) {
      if (handle === "edge-0") {
        newBounds.height -= localDeltaY
      } else if (handle === "edge-1") {
        newBounds.width += localDeltaX
      } else if (handle === "edge-2") {
        newBounds.height += localDeltaY
      } else if (handle === "edge-3") {
        newBounds.width -= localDeltaX
      }
    } else {
      if (isLeft) newBounds.width -= localDeltaX
      if (isRight) newBounds.width += localDeltaX
      if (isTop) newBounds.height -= localDeltaY
      if (isBottom) newBounds.height += localDeltaY
    }
  } else {
    // No rotation - simple case, use global deltas directly
    if (isEdgeHandle) {
      if (handle === "edge-0") {
        newBounds.y += deltaY
        newBounds.height -= deltaY
      } else if (handle === "edge-1") {
        newBounds.width += deltaX
      } else if (handle === "edge-2") {
        newBounds.height += deltaY
      } else if (handle === "edge-3") {
        newBounds.x += deltaX
        newBounds.width -= deltaX
      }
    } else {
      if (isLeft) {
        newBounds.x += deltaX
        newBounds.width -= deltaX
      }
      if (isRight) {
        newBounds.width += deltaX
      }
      if (isTop) {
        newBounds.y += deltaY
        newBounds.height -= deltaY
      }
      if (isBottom) {
        newBounds.height += deltaY
      }
    }
  }

  // Constrain aspect ratio if Shift is pressed (only for corner handles)
  if (transformBase.isShiftPressed.value && !isEdgeHandle) {
    const widthChangePct =
      Math.abs(newBounds.width - transformBase.originalBounds.value.width) / transformBase.originalBounds.value.width
    const heightChangePct =
      Math.abs(newBounds.height - transformBase.originalBounds.value.height) / transformBase.originalBounds.value.height

    if (widthChangePct > heightChangePct) {
      const newHeight = newBounds.width / originalAspectRatio
      const heightDiff = newHeight - newBounds.height
      newBounds.height = newHeight
      if (isTop && rotation === 0) newBounds.y -= heightDiff
    } else {
      const newWidth = newBounds.height * originalAspectRatio
      const widthDiff = newWidth - newBounds.width
      newBounds.width = newWidth
      if (isLeft && rotation === 0) newBounds.x -= widthDiff
    }
  }

  // Enforce minimum dimensions
  // For text annotations, use content-based minimum size
  let minWidth: number = TRANSFORM.MIN_BOUNDS
  let minHeight: number = TRANSFORM.MIN_BOUNDS

  if (annotation.type === "text" && "content" in annotation && "fontSize" in annotation) {
    // Estimate minimum width based on text content
    // Average character width is roughly 0.6 * fontSize (for proportional fonts)
    const estimatedTextWidth = annotation.content.length * annotation.fontSize * 0.6
    minWidth = Math.max(estimatedTextWidth, 50) // At least 50px

    // Minimum height should accommodate the font size with padding
    minHeight = Math.max(annotation.fontSize * 1.5, 30)
  }

  if (newBounds.width < minWidth) {
    if (isLeft && rotation === 0)
      newBounds.x = transformBase.originalBounds.value.x + transformBase.originalBounds.value.width - minWidth
    newBounds.width = minWidth
  }
  if (newBounds.height < minHeight) {
    if (isTop && rotation === 0)
      newBounds.y = transformBase.originalBounds.value.y + transformBase.originalBounds.value.height - minHeight
    newBounds.height = minHeight
  }

  // Update annotation based on type
  if ("x" in annotation && "y" in annotation && "width" in annotation && "height" in annotation) {
    // Text annotation - update bounds directly
    annotationStore.updateAnnotation(annotation.id, {
      x: newBounds.x,
      y: newBounds.y,
      width: newBounds.width,
      height: newBounds.height
    })
  } else if (originalPoints.value && Array.isArray(originalPoints.value)) {
    // Point-based annotation - scale points from ORIGINAL points (not current!)
    const scaleX = newBounds.width / transformBase.originalBounds.value.width
    const scaleY = newBounds.height / transformBase.originalBounds.value.height

    if (rotation === 0) {
      // No rotation - simple case: scale in global space
      const scaledPoints = originalPoints.value.map((p) => ({
        x: newBounds.x + (p.x - transformBase.originalBounds.value!.x) * scaleX,
        y: newBounds.y + (p.y - transformBase.originalBounds.value!.y) * scaleY
      }))

      annotationStore.updateAnnotation(annotation.id, { points: scaledPoints })
    } else {
      // With rotation: Scale points around the center, not around top-left
      // This way the shape scales uniformly regardless of rotation
      const center = getRotationCenter(annotation)

      const scaledPoints = originalPoints.value.map((p) => {
        // Scale relative to center
        const relX = p.x - center.x
        const relY = p.y - center.y

        return {
          x: center.x + relX * scaleX,
          y: center.y + relY * scaleY
        }
      })

      annotationStore.updateAnnotation(annotation.id, { points: scaledPoints })
    }
  }
}

function handleRotate(svgX: number, svgY: number) {
  if (!selectedAnnotation.value) return

  // Calculate center based on annotation type
  const center = getRotationCenter(selectedAnnotation.value)

  // Calculate current angle from center to mouse
  const currentAngle = Math.atan2(svgY - center.y, svgX - center.x)

  // Calculate rotation delta from start
  const rotationDelta = currentAngle - transformBase.startRotationAngle.value
  transformBase.currentRotationDelta.value = rotationDelta

  // Update visual rotation delta for real-time feedback
  annotationStore.rotationDragDelta = rotationDelta
}

function handleMove(deltaX: number, deltaY: number) {
  if (!selectedAnnotation.value || !originalAnnotationState.value) return

  const annotation = selectedAnnotation.value
  const tool = toolRegistry.getTool(annotation.type)

  // Use tool's registered move handler if available
  // IMPORTANT: Pass the ORIGINAL annotation state, not the current reactive one
  // This prevents cumulative delta compounding on each mousemove
  if (tool?.transform?.applyMove) {
    const updates = tool.transform.applyMove(originalAnnotationState.value, deltaX, deltaY)
    annotationStore.updateAnnotation(annotation.id, updates)
    return
  }

  // Fallback for tools that haven't registered yet
  if ("points" in annotation && originalPoints.value) {
    // Point-based annotation - translate all points
    const movedPoints = originalPoints.value.map((p) => ({
      x: p.x + deltaX,
      y: p.y + deltaY
    }))

    annotationStore.updateAnnotation(annotation.id, { points: movedPoints })
  } else if ("x" in annotation && "y" in annotation && originalAnnotationState.value) {
    // Fill/text annotation - update x, y position from ORIGINAL state, not bounds
    // Use originalAnnotationState instead of originalBounds to ensure we have the exact original x,y
    const originalX = (originalAnnotationState.value as { x: number }).x
    const originalY = (originalAnnotationState.value as { y: number }).y

    annotationStore.updateAnnotation(annotation.id, {
      x: originalX + deltaX,
      y: originalY + deltaY
    })
  }
}

function handleEndDrag(mode: "resize" | "rotate" | "move" | null, moved: boolean) {
  const dragState = useDragState()

  if (!selectedAnnotation.value || !originalAnnotationState.value) {
    // Clean up component-specific state
    originalPoints.value = null
    originalAnnotationState.value = null
    return
  }

  // If mouse didn't move (just a click), deselect the annotation
  if (!moved && mode === "move") {
    annotationStore.selectAnnotation(null)
    originalPoints.value = null
    originalAnnotationState.value = null
    return
  }

  // Mark that drag just ended to prevent click handlers from firing
  if (moved) {
    dragState.markDragEnd()
  }

  const annotationId = selectedAnnotation.value.id

  // Commit rotation on release
  if (mode === "rotate" && transformBase.currentRotationDelta.value !== 0) {
    const tool = toolRegistry.getTool(selectedAnnotation.value.type)

    console.log("[Transform] Committing rotation:", {
      type: selectedAnnotation.value.type,
      currentRotation: selectedAnnotation.value.rotation,
      delta: transformBase.currentRotationDelta.value,
      newRotation: selectedAnnotation.value.rotation + transformBase.currentRotationDelta.value
    })

    // Use tool's registered rotation handler if available
    if (tool?.transform?.applyRotation) {
      const updates = tool.transform.applyRotation(selectedAnnotation.value, transformBase.currentRotationDelta.value)
      console.log("[Transform] Applying rotation updates:", updates)
      annotationStore.updateAnnotation(annotationId, updates)
    } else {
      // Fallback
      const existingRotation = (selectedAnnotation.value as { rotation?: number }).rotation || 0
      const newRotation = existingRotation + transformBase.currentRotationDelta.value

      annotationStore.updateAnnotation(annotationId, {
        rotation: newRotation
      })
    }

    // Clear rotation drag delta
    annotationStore.rotationDragDelta = 0
  }

  // Get final state AFTER all updates
  const finalState = annotationStore.getAnnotationById(annotationId)

  // Record history for the transformation
  if (finalState && originalAnnotationState.value) {
    // Calculate the updates that were made during transformation
    const updates: Record<string, unknown> = {}

    // Compare key properties that might have changed
    if (
      hasRotation(finalState) &&
      hasRotation(originalAnnotationState.value) &&
      finalState.rotation !== originalAnnotationState.value.rotation
    ) {
      updates.rotation = finalState.rotation
    }
    if (
      hasPoints(finalState) &&
      hasPoints(originalAnnotationState.value) &&
      JSON.stringify(finalState.points) !== JSON.stringify(originalAnnotationState.value.points)
    ) {
      updates.points = finalState.points
    }
    if (
      hasX(finalState) &&
      hasY(finalState) &&
      hasWidth(finalState) &&
      hasHeight(finalState) &&
      hasX(originalAnnotationState.value) &&
      hasY(originalAnnotationState.value) &&
      hasWidth(originalAnnotationState.value) &&
      hasHeight(originalAnnotationState.value)
    ) {
      const orig = originalAnnotationState.value
      const fin = finalState
      if (fin.x !== orig.x || fin.y !== orig.y || fin.width !== orig.width || fin.height !== orig.height) {
        updates.x = fin.x
        updates.y = fin.y
        updates.width = fin.width
        updates.height = fin.height
      }
    }

    // If any updates were made, record them in history
    if (Object.keys(updates).length > 0) {
      historyStore.updateAnnotationWithHistory(annotationId, updates)
    }
  }

  // Clean up component-specific state
  originalPoints.value = null
  originalAnnotationState.value = null
}

// Set up event listeners with handlers
transformBase.setupEventListeners({
  onResize: handleResize,
  onRotate: handleRotate,
  onMove: handleMove,
  onEndDrag: handleEndDrag
})
</script>
<template>
  <g
    v-if="selectedAnnotation && displayBounds"
    :ref="
      (el) => {
        transformBase.svgRef.value = el as SVGGElement | null
      }
    "
    class="transform-handles"
  >
    <!-- Apply rotation transform to entire transformer when rotating -->
    <g :transform="transformerTransform">
      <!-- Selection outline - draggable to move, click to deselect -->
      <rect
        :x="displayBounds.x"
        :y="displayBounds.y"
        :width="displayBounds.width"
        :height="displayBounds.height"
        fill="transparent"
        :stroke="COLORS.SELECTION_BLUE"
        stroke-width="2"
        stroke-dasharray="4 4"
        class="selection-outline moveable"
        @mousedown.stop="onStartDrag($event, 'move', 'move')"
      />

      <!-- Corner handles -->
      <rect
        v-for="(corner, index) in corners"
        :key="`corner-${index}`"
        :x="corner.x - handleSize / 2"
        :y="corner.y - handleSize / 2"
        :width="handleSize"
        :height="handleSize"
        fill="white"
        :stroke="COLORS.SELECTION_BLUE"
        stroke-width="2"
        class="corner-handle"
        :class="{ dragging: transformBase.isDragging && transformBase.activeHandle.value === `corner-${index}` }"
        :data-handle="`corner-${index}`"
        @mousedown.stop="onStartDrag($event, `corner-${index}`, 'resize')"
      />

      <!-- Edge handles for horizontal/vertical resizing -->
      <rect
        v-for="(edge, index) in edges"
        :key="`edge-${index}`"
        :x="edge.x - handleSize / 2"
        :y="edge.y - handleSize / 2"
        :width="handleSize"
        :height="handleSize"
        fill="white"
        :stroke="COLORS.SELECTION_BLUE"
        stroke-width="2"
        class="edge-handle"
        :class="{ dragging: transformBase.isDragging && transformBase.activeHandle.value === `edge-${index}` }"
        :data-handle="`edge-${index}`"
        @mousedown.stop="onStartDrag($event, `edge-${index}`, 'resize')"
      />

      <!-- Rotation handle -->
      <g class="rotation-handle-group">
        <!-- Line connecting to rotation handle -->
        <line
          :x1="displayBounds.x + displayBounds.width / 2"
          :y1="displayBounds.y"
          :x2="displayBounds.x + displayBounds.width / 2"
          :y2="displayBounds.y - rotationHandleDistance"
          :stroke="COLORS.SELECTION_BLUE"
          stroke-width="2"
          stroke-dasharray="2 2"
        />

        <!-- Rotation handle - larger circle with icon -->
        <circle
          :cx="displayBounds.x + displayBounds.width / 2"
          :cy="displayBounds.y - rotationHandleDistance"
          :r="handleSize * 0.8"
          fill="white"
          :stroke="COLORS.SELECTION_BLUE"
          stroke-width="2"
          class="rotation-handle"
          :class="{ dragging: transformBase.isDragging && transformBase.activeHandle.value === 'rotate' }"
          @mousedown.stop="onStartDrag($event, 'rotate', 'rotate')"
        />

        <!-- Rotation icon (curved arrow hint) -->
        <path
          :d="`M ${displayBounds.x + displayBounds.width / 2 - 3} ${displayBounds.y - rotationHandleDistance - 2}
               A 3 3 0 1 1 ${displayBounds.x + displayBounds.width / 2 + 3} ${displayBounds.y - rotationHandleDistance - 2}`"
          :stroke="COLORS.SELECTION_BLUE"
          stroke-width="1.5"
          fill="none"
          pointer-events="none"
        />
      </g>
    </g>
  </g>
</template>

<style scoped>
.transform-handles {
  pointer-events: none;
}

.corner-handle,
.edge-handle,
.rotation-handle {
  cursor: pointer;
  pointer-events: all;
  /* Remove transform transition - causes jumping */
}

.corner-handle:hover {
  fill: v-bind(colorBlueDark);
  stroke-width: 3;
}

.corner-handle.dragging {
  fill: v-bind(colorBlueDarker);
  stroke-width: 3;
}

.edge-handle:hover {
  fill: v-bind(colorBlueDark);
  stroke-width: 3;
}

.edge-handle.dragging {
  fill: v-bind(colorBlueDarker);
  stroke-width: 3;
}

.rotation-handle:hover {
  fill: v-bind(colorBlueDark);
  stroke-width: 3;
}

.rotation-handle.dragging {
  fill: v-bind(colorBlueDarker);
  stroke-width: 3;
}

.selection-outline {
  pointer-events: none;
}

.selection-outline.moveable {
  /* Allow events on both stroke and fill for easier dragging */
  pointer-events: all;
  cursor: move;
}

.selection-outline.moveable:active {
  cursor: grabbing;
}

.rotation-handle-group {
  pointer-events: none;
}

.rotation-handle-group .rotation-handle {
  pointer-events: all;
}
</style>
