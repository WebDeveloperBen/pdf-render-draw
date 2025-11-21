<script setup lang="ts">
import { TRANSFORM, COLORS } from "~/constants/ui"
import { useSvgCoordinates } from "@/composables/useSvgCoordinates"
import { debugLog } from "~/utils/debug"

const annotationStore = useAnnotationStore()
const { getSvgPoint: getSvgPointUtil } = useSvgCoordinates()

const selectedAnnotation = computed(() => annotationStore.selectedAnnotation)
const svgRef = ref<SVGGElement | null>(null)

const handleSize = TRANSFORM.HANDLE_SIZE
const rotationHandleDistance = TRANSFORM.ROTATION_DISTANCE

// Expose colors for v-bind in styles
const colorBlueDark = COLORS.SELECTION_BLUE_DARK
const colorBlueDarker = COLORS.SELECTION_BLUE_DARKER

const isDragging = ref(false)
const activeHandle = ref<string | null>(null)
const dragMode = ref<"resize" | "rotate" | "move" | null>(null)
const dragStart = ref<{ x: number; y: number } | null>(null)
const originalBounds = ref<Bounds | null>(null)
const originalPoints = ref<Array<{ x: number; y: number }> | null>(null)
const startRotationAngle = ref(0)
const currentRotationDelta = ref(0)
const cumulativeRotation = ref(0) // Persists after drag, resets on deselect
const rotationCenter = ref<{ x: number; y: number } | null>(null) // Persists after drag
const persistedBounds = ref<Bounds | null>(null) // Keep original bounds after rotation

// Set up event listeners with auto-cleanup
useEventListener(window, "mousemove", handleDrag, { passive: false })
useEventListener(window, "mouseup", endDrag)

// Reset cumulative rotation when annotation changes
watch(selectedAnnotation, () => {
  cumulativeRotation.value = 0
  rotationCenter.value = null
  persistedBounds.value = null
})

// Convert screen coordinates to SVG coordinates
function getSvgPoint(e: MouseEvent): { x: number; y: number } | null {
  const svg = svgRef.value?.ownerSVGElement
  if (!svg) return null
  return getSvgPointUtil(e, svg)
}

// Calculate bounding box for selected annotation
const bounds = computed(() => {
  if (!selectedAnnotation.value) return null
  return calculateBounds(selectedAnnotation.value)
})

// Use original bounds during rotation to keep transformer stable
// After rotation, keep using persisted bounds so transformer doesn't snap
// Otherwise use live bounds for real-time updates during resize/move
const displayBounds = computed(() => {
  // During rotation drag: use originalBounds
  if (isDragging.value && dragMode.value === "rotate" && originalBounds.value) {
    return originalBounds.value
  }
  // After rotation (has cumulative rotation): use persistedBounds
  if (cumulativeRotation.value !== 0 && persistedBounds.value) {
    return persistedBounds.value
  }
  // Default: use live bounds
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

// Transform for rotating the entire transformer with the shape
const transformerTransform = computed(() => {
  if (!displayBounds.value) return ""

  // During drag: use current rotation delta and original bounds center
  // After drag: use cumulative rotation and stored center
  const rotation =
    isDragging.value && dragMode.value === "rotate" ? currentRotationDelta.value : cumulativeRotation.value

  if (rotation === 0) return ""

  // Use stored rotation center if available, otherwise calculate from current bounds
  let centerX, centerY
  if (rotationCenter.value) {
    centerX = rotationCenter.value.x
    centerY = rotationCenter.value.y
  } else {
    centerX = displayBounds.value.x + displayBounds.value.width / 2
    centerY = displayBounds.value.y + displayBounds.value.height / 2
  }

  const angleDeg = (rotation * 180) / Math.PI

  return `rotate(${angleDeg} ${centerX} ${centerY})`
})

function startDrag(e: MouseEvent, handle: string, mode: "resize" | "rotate" | "move") {
  if (!bounds.value || !selectedAnnotation.value) return

  const svgPoint = getSvgPoint(e)
  if (!svgPoint) return

  debugLog("TransformHandles", `Starting drag - Handle: ${handle}, Mode: ${mode}`)

  isDragging.value = true
  activeHandle.value = handle
  dragMode.value = mode
  dragStart.value = svgPoint
  originalBounds.value = bounds.value ? { ...bounds.value } : null

  // Store original points for point-based annotations
  if ("points" in selectedAnnotation.value && Array.isArray(selectedAnnotation.value.points)) {
    // Manual clone to avoid issues with reactive proxies
    originalPoints.value = selectedAnnotation.value.points.map((p) => ({ x: p.x, y: p.y }))
    debugLog("TransformHandles", `Stored ${originalPoints.value.length} original points`)
  }

  // For rotation, calculate the starting angle from center to mouse
  if (mode === "rotate" && originalBounds.value) {
    const centerX = originalBounds.value.x + originalBounds.value.width / 2
    const centerY = originalBounds.value.y + originalBounds.value.height / 2
    startRotationAngle.value = Math.atan2(svgPoint.y - centerY, svgPoint.x - centerX)
  }

  e.preventDefault()
  e.stopPropagation()
}

function handleDrag(e: MouseEvent) {
  if (!isDragging.value || !dragStart.value || !originalBounds.value || !selectedAnnotation.value) return

  const svgPoint = getSvgPoint(e)
  if (!svgPoint) return

  const deltaX = svgPoint.x - dragStart.value.x
  const deltaY = svgPoint.y - dragStart.value.y

  if (dragMode.value === "resize") {
    handleResize(deltaX, deltaY)
  } else if (dragMode.value === "rotate") {
    handleRotate(svgPoint.x, svgPoint.y)
  } else if (dragMode.value === "move") {
    handleMove(deltaX, deltaY)
  }
}

function handleResize(deltaX: number, deltaY: number) {
  if (!selectedAnnotation.value || !originalBounds.value || !activeHandle.value) return

  const annotation = selectedAnnotation.value
  const handle = activeHandle.value

  // Determine which corner is being dragged
  const isLeft = handle === "corner-0" || handle === "corner-3"
  const isTop = handle === "corner-0" || handle === "corner-1"
  const isRight = handle === "corner-1" || handle === "corner-2"
  const isBottom = handle === "corner-2" || handle === "corner-3"

  // Calculate new bounds based on corner drag
  const newBounds = { ...originalBounds.value }

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

  // Enforce minimum dimensions
  const minSize = TRANSFORM.MIN_BOUNDS
  if (newBounds.width < minSize) {
    if (isLeft) newBounds.x = originalBounds.value.x + originalBounds.value.width - minSize
    newBounds.width = minSize
  }
  if (newBounds.height < minSize) {
    if (isTop) newBounds.y = originalBounds.value.y + originalBounds.value.height - minSize
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
    const scaleX = newBounds.width / originalBounds.value.width
    const scaleY = newBounds.height / originalBounds.value.height

    // CRITICAL FIX: Use originalPoints, not annotation.points!
    const scaledPoints = originalPoints.value.map((p) => ({
      x: newBounds.x + (p.x - originalBounds.value!.x) * scaleX,
      y: newBounds.y + (p.y - originalBounds.value!.y) * scaleY
    }))

    annotationStore.updateAnnotation(annotation.id, { points: scaledPoints })
  }
}

function handleRotate(svgX: number, svgY: number) {
  if (!selectedAnnotation.value || !originalBounds.value || !originalPoints.value) {
    return
  }

  // Calculate center of original bounds
  const centerX = originalBounds.value.x + originalBounds.value.width / 2
  const centerY = originalBounds.value.y + originalBounds.value.height / 2

  // Calculate current angle from center to mouse
  const currentAngle = Math.atan2(svgY - centerY, svgX - centerX)

  // Calculate rotation delta from start
  const rotationDelta = currentAngle - startRotationAngle.value
  currentRotationDelta.value = rotationDelta

  // Set visual rotation state so annotation components can render the rotation
  annotationStore.visualRotation = {
    annotationId: selectedAnnotation.value.id,
    centerX,
    centerY,
    rotationDelta
  }
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
  } else if ("x" in annotation && "y" in annotation && originalBounds.value) {
    // Text annotation - update x, y position
    annotationStore.updateAnnotation(annotation.id, {
      x: originalBounds.value.x + deltaX,
      y: originalBounds.value.y + deltaY
    })
  }
}

function endDrag() {
  // If we were rotating, apply the final rotation now
  if (
    dragMode.value === "rotate" &&
    selectedAnnotation.value &&
    originalBounds.value &&
    originalPoints.value &&
    currentRotationDelta.value !== 0
  ) {
    const annotation = selectedAnnotation.value
    const centerX = originalBounds.value.x + originalBounds.value.width / 2
    const centerY = originalBounds.value.y + originalBounds.value.height / 2
    const rotationDelta = currentRotationDelta.value

    // Apply final rotation to points
    if ("points" in annotation && originalPoints.value) {
      const cos = Math.cos(rotationDelta)
      const sin = Math.sin(rotationDelta)

      const rotatedPoints = originalPoints.value.map((p) => {
        // Translate to origin
        const translatedX = p.x - centerX
        const translatedY = p.y - centerY

        // Rotate
        const rotatedX = translatedX * cos - translatedY * sin
        const rotatedY = translatedX * sin + translatedY * cos

        // Translate back
        return {
          x: rotatedX + centerX,
          y: rotatedY + centerY
        }
      })

      debugLog("Transform", "Rotation complete", {
        rotationDelta: (rotationDelta * 180) / Math.PI + "°",
        center: { centerX, centerY },
        originalBounds: originalBounds.value,
        rotatedPoints
      })

      // Store cumulative rotation, center, and bounds so transformer stays rotated
      cumulativeRotation.value += rotationDelta
      rotationCenter.value = { x: centerX, y: centerY }
      persistedBounds.value = { ...originalBounds.value }

      // Batch updates to prevent visual jump
      annotationStore.visualRotation = null
      annotationStore.updateAnnotation(annotation.id, { points: rotatedPoints })
    }
  } else {
    // Clear visual rotation for non-rotation drags too
    annotationStore.visualRotation = null
  }

  isDragging.value = false
  activeHandle.value = null
  dragMode.value = null
  dragStart.value = null
  originalBounds.value = null
  originalPoints.value = null
  startRotationAngle.value = 0
  currentRotationDelta.value = 0
}
</script>
<template>
  <g v-if="selectedAnnotation && displayBounds" ref="svgRef" class="transform-handles">
    <!-- Apply rotation transform to entire transformer when rotating -->
    <g :transform="transformerTransform">
      <!-- Selection outline - draggable to move -->
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
        @mousedown.stop="startDrag($event, 'move', 'move')"
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
        :class="{ dragging: isDragging && activeHandle === `corner-${index}` }"
        :data-handle="`corner-${index}`"
        @mousedown.stop="startDrag($event, `corner-${index}`, 'resize')"
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
          :class="{ dragging: isDragging && activeHandle === 'rotate' }"
          @mousedown.stop="startDrag($event, 'rotate', 'rotate')"
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
