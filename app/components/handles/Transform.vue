<script setup lang="ts">
import { TRANSFORM, COLORS } from "~/constants/ui"
import { isMeasurement, isArea, isPerimeter } from "~/types/annotations"
import { useTransformBase } from "~/composables/useTransformBase"

const annotationStore = useAnnotationStore()
const historyStore = useHistoryStore()

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
const originalAnnotationState = ref<any>(null)

// Calculate rotation center based on annotation type
// This matches the logic in annotationStore.getRotationTransform()
function getRotationCenter(annotation: any, fallbackBounds: Bounds): { x: number; y: number } {
  if (isMeasurement(annotation)) {
    return {
      x: (annotation.points[0].x + annotation.points[1].x) / 2,
      y: (annotation.points[0].y + annotation.points[1].y) / 2
    }
  } else if (isArea(annotation) || isPerimeter(annotation)) {
    return {
      x: annotation.center.x,
      y: annotation.center.y
    }
  } else if ("points" in annotation && Array.isArray(annotation.points)) {
    // Line or other point-based annotation - calculate centroid
    const sumX = annotation.points.reduce((sum: number, p: any) => sum + p.x, 0)
    const sumY = annotation.points.reduce((sum: number, p: any) => sum + p.y, 0)
    return {
      x: sumX / annotation.points.length,
      y: sumY / annotation.points.length
    }
  } else {
    // Fallback to bounds center
    return {
      x: fallbackBounds.x + fallbackBounds.width / 2,
      y: fallbackBounds.y + fallbackBounds.height / 2
    }
  }
}

// Calculate bounding box for selected annotation
const bounds = computed(() => {
  if (!selectedAnnotation.value) return null
  return calculateBounds(selectedAnnotation.value)
})

// Use original bounds during rotation to keep transformer stable
const displayBounds = computed(() => {
  // During rotation drag: use originalBounds to keep transformer stable
  if (transformBase.isDragging.value && transformBase.dragMode.value === "rotate" && transformBase.originalBounds.value) {
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

// Transform for rotating the entire transformer box
const transformerTransform = computed(() => {
  if (!displayBounds.value || !selectedAnnotation.value) return ""

  const storedRotation = (selectedAnnotation.value as any).rotation || 0
  const dragDelta = annotationStore.rotationDragDelta
  const totalRotation = storedRotation + dragDelta

  if (totalRotation === 0) return ""

  // Rotate around annotation's center
  const center = getRotationCenter(selectedAnnotation.value, displayBounds.value)
  const angleDeg = (totalRotation * 180) / Math.PI
  return `rotate(${angleDeg} ${center.x} ${center.y})`
})

function onStartDrag(e: MouseEvent, handle: string, mode: "resize" | "rotate" | "move") {
  if (!bounds.value || !selectedAnnotation.value) return

  transformBase.startDrag(e, handle, mode, bounds.value, (svgPoint) => {
    // Store COMPLETE annotation state for undo/redo (deep clone)
    originalAnnotationState.value = JSON.parse(JSON.stringify(selectedAnnotation.value))

    // Store original points for point-based annotations
    if ("points" in selectedAnnotation.value && Array.isArray(selectedAnnotation.value.points)) {
      originalPoints.value = selectedAnnotation.value.points.map((p) => ({ x: p.x, y: p.y }))
    }

    // For rotation, calculate the starting angle from center to mouse
    if (mode === "rotate" && transformBase.originalBounds.value) {
      const center = getRotationCenter(selectedAnnotation.value, transformBase.originalBounds.value)
      transformBase.startRotationAngle.value = Math.atan2(svgPoint.y - center.y, svgPoint.x - center.x)
    }
  })
}

function handleResize(deltaX: number, deltaY: number) {
  if (!selectedAnnotation.value || !transformBase.originalBounds.value || !transformBase.activeHandle.value) return

  const annotation = selectedAnnotation.value
  const handle = transformBase.activeHandle.value

  // Determine which corner is being dragged
  const isLeft = handle === "corner-0" || handle === "corner-3"
  const isTop = handle === "corner-0" || handle === "corner-1"
  const isRight = handle === "corner-1" || handle === "corner-2"
  const isBottom = handle === "corner-2" || handle === "corner-3"

  // Calculate original aspect ratio
  const originalAspectRatio = transformBase.originalBounds.value.width / transformBase.originalBounds.value.height

  // Calculate new bounds based on corner drag
  const newBounds = { ...transformBase.originalBounds.value }

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

  // Constrain aspect ratio if Shift is pressed
  if (transformBase.isShiftPressed.value) {
    const widthChangePct = Math.abs(newBounds.width - transformBase.originalBounds.value.width) / transformBase.originalBounds.value.width
    const heightChangePct = Math.abs(newBounds.height - transformBase.originalBounds.value.height) / transformBase.originalBounds.value.height

    if (widthChangePct > heightChangePct) {
      const newHeight = newBounds.width / originalAspectRatio
      const heightDiff = newHeight - newBounds.height
      newBounds.height = newHeight
      if (isTop) newBounds.y -= heightDiff
    } else {
      const newWidth = newBounds.height * originalAspectRatio
      const widthDiff = newWidth - newBounds.width
      newBounds.width = newWidth
      if (isLeft) newBounds.x -= widthDiff
    }
  }

  // Enforce minimum dimensions
  const minSize = TRANSFORM.MIN_BOUNDS
  if (newBounds.width < minSize) {
    if (isLeft) newBounds.x = transformBase.originalBounds.value.x + transformBase.originalBounds.value.width - minSize
    newBounds.width = minSize
  }
  if (newBounds.height < minSize) {
    if (isTop) newBounds.y = transformBase.originalBounds.value.y + transformBase.originalBounds.value.height - minSize
    newBounds.height = minSize
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

    const scaledPoints = originalPoints.value.map((p) => ({
      x: newBounds.x + (p.x - transformBase.originalBounds.value!.x) * scaleX,
      y: newBounds.y + (p.y - transformBase.originalBounds.value!.y) * scaleY
    }))

    annotationStore.updateAnnotation(annotation.id, { points: scaledPoints })
  }
}

function handleRotate(svgX: number, svgY: number) {
  if (!selectedAnnotation.value || !transformBase.originalBounds.value) return

  // Calculate center based on annotation type
  const center = getRotationCenter(selectedAnnotation.value, transformBase.originalBounds.value)

  // Calculate current angle from center to mouse
  const currentAngle = Math.atan2(svgY - center.y, svgX - center.x)

  // Calculate rotation delta from start
  const rotationDelta = currentAngle - transformBase.startRotationAngle.value
  transformBase.currentRotationDelta.value = rotationDelta

  // Update visual rotation delta for real-time feedback
  annotationStore.rotationDragDelta = rotationDelta
}

function handleMove(deltaX: number, deltaY: number) {
  if (!selectedAnnotation.value) return

  const annotation = selectedAnnotation.value

  if ("points" in annotation && originalPoints.value) {
    // Point-based annotation - translate all points
    const movedPoints = originalPoints.value.map((p) => ({
      x: p.x + deltaX,
      y: p.y + deltaY
    }))

    annotationStore.updateAnnotation(annotation.id, { points: movedPoints })
  } else if ("x" in annotation && "y" in annotation && transformBase.originalBounds.value) {
    // Text annotation - update x, y position
    annotationStore.updateAnnotation(annotation.id, {
      x: transformBase.originalBounds.value.x + deltaX,
      y: transformBase.originalBounds.value.y + deltaY
    })
  }
}

function handleEndDrag(mode: "resize" | "rotate" | "move" | null, moved: boolean) {
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

  const annotationId = selectedAnnotation.value.id

  // Commit rotation on release
  if (mode === "rotate" && transformBase.currentRotationDelta.value !== 0) {
    const existingRotation = (selectedAnnotation.value as any).rotation || 0
    const newRotation = existingRotation + transformBase.currentRotationDelta.value

    annotationStore.updateAnnotation(annotationId, {
      rotation: newRotation
    })
  }

  // Get final state AFTER all updates
  const finalState = annotationStore.getAnnotationById(annotationId)

  // TODO: Fix history recording - currently causing Pinia class instantiation error
  // For now, transformations won't be undo-able
  // if (finalState && JSON.stringify(originalAnnotationState.value) !== JSON.stringify(finalState)) {
  //   const UpdateAnnotationCommand = toRaw(historyStore.UpdateAnnotationCommand)
  //   const updateCommand = new UpdateAnnotationCommand(
  //     annotationId,
  //     originalAnnotationState.value,
  //     finalState,
  //     annotationStore
  //   )
  //   historyStore.executeCommand(updateCommand)
  // }

  // Clean up component-specific state
  originalPoints.value = null
  originalAnnotationState.value = null
}

// Set up event listeners with handlers
transformBase.setupEventListeners({
  onResize: handleResize,
  onRotate: handleRotate,
  onMove: handleMove,
  onEndDrag: handleEndDrag,
})
</script>
<template>
  <g v-if="selectedAnnotation && displayBounds" :ref="(el) => { transformBase.svgRef.value = el as SVGGElement | null }" class="transform-handles">
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
        :class="{ dragging: transformBase.isDragging && transformBase.activeHandle === `corner-${index}` }"
        :data-handle="`corner-${index}`"
        @mousedown.stop="onStartDrag($event, `corner-${index}`, 'resize')"
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
          :class="{ dragging: transformBase.isDragging && transformBase.activeHandle === 'rotate' }"
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
