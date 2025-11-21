<template>
  <g v-if="selectedAnnotation && displayBounds" ref="svgRef" class="transform-handles">
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
</template>

<script setup lang="ts">
import type { Annotation } from "~/types/annotations"
import { TRANSFORM, COLORS } from "~/constants/ui"
import { calculateBounds, type Bounds } from "~/utils/bounds"
import { useSvgCoordinates } from "~/composables/useSvgCoordinates"
import { debugLog } from "~/utils/debug"

const annotationStore = useAnnotationStore()
const rendererStore = useRendererStore()
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

// Always use live bounds so handles follow the shape in real-time
// Note: During rotation, the bounding box will shift slightly as the shape rotates
// This is expected behavior - an axis-aligned box around a rotated shape changes size
const displayBounds = computed(() => bounds.value)

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
    originalPoints.value = selectedAnnotation.value.points.map(p => ({ x: p.x, y: p.y }))
    debugLog("TransformHandles", `Stored ${originalPoints.value.length} original points`)
  }

  window.addEventListener("mousemove", handleDrag)
  window.addEventListener("mouseup", endDrag)

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
  let newBounds = { ...originalBounds.value }

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
  if (!selectedAnnotation.value || !originalBounds.value || !originalPoints.value || !dragStart.value) {
    debugLog("TransformHandles", "handleRotate early return:", {
      hasAnnotation: !!selectedAnnotation.value,
      hasBounds: !!originalBounds.value,
      hasPoints: !!originalPoints.value,
      hasDragStart: !!dragStart.value
    })
    return
  }

  const annotation = selectedAnnotation.value
  const bounds = originalBounds.value

  // Calculate center of bounds
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2

  // Calculate angle from center to current mouse position
  const currentAngle = Math.atan2(svgY - centerY, svgX - centerX)

  // Calculate angle from center to drag start position
  const startAngle = Math.atan2(dragStart.value.y - centerY, dragStart.value.x - centerX)

  // Calculate rotation delta
  const rotationDelta = currentAngle - startAngle

  debugLog("TransformHandles", "Rotating:", {
    currentAngle: ((currentAngle * 180) / Math.PI).toFixed(1),
    startAngle: ((startAngle * 180) / Math.PI).toFixed(1),
    rotationDelta: ((rotationDelta * 180) / Math.PI).toFixed(1)
  })

  // Rotate points around center
  if ("points" in annotation && originalPoints.value) {
    const rotatedPoints = originalPoints.value.map((p) => {
      // Translate to origin
      const translatedX = p.x - centerX
      const translatedY = p.y - centerY

      // Rotate
      const cos = Math.cos(rotationDelta)
      const sin = Math.sin(rotationDelta)
      const rotatedX = translatedX * cos - translatedY * sin
      const rotatedY = translatedX * sin + translatedY * cos

      // Translate back
      return {
        x: rotatedX + centerX,
        y: rotatedY + centerY
      }
    })

    annotationStore.updateAnnotation(annotation.id, { points: rotatedPoints })
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
  isDragging.value = false
  activeHandle.value = null
  dragMode.value = null
  dragStart.value = null
  originalBounds.value = null
  originalPoints.value = null

  window.removeEventListener("mousemove", handleDrag)
  window.removeEventListener("mouseup", endDrag)
}

// Cleanup on unmount
onUnmounted(() => {
  window.removeEventListener("mousemove", handleDrag)
  window.removeEventListener("mouseup", endDrag)
})
</script>

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
