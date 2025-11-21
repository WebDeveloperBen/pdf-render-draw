<script setup lang="ts">
import { TRANSFORM, COLORS } from "~/constants/ui"
import { useSvgCoordinates } from "@/composables/useSvgCoordinates"
import { debugLog } from "~/utils/debug"
import { isMeasurement, isArea, isPerimeter } from "~/types/annotations"

const annotationStore = useAnnotationStore()
const historyStore = useHistoryStore()
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
const originalAnnotationState = ref<any>(null) // Store complete annotation state for undo
const startRotationAngle = ref(0)
const currentRotationDelta = ref(0)
const isShiftPressed = ref(false) // Track Shift key for aspect ratio constraint
const hasMoved = ref(false) // Track if mouse moved during drag (to distinguish click from drag)

// Set up event listeners with auto-cleanup
useEventListener(window, "mousemove", handleDrag, { passive: false })
useEventListener(window, "mouseup", endDrag)
useEventListener(window, "keydown", (e: KeyboardEvent) => {
  if (e.key === "Shift") isShiftPressed.value = true
})
useEventListener(window, "keyup", (e: KeyboardEvent) => {
  if (e.key === "Shift") isShiftPressed.value = false
})

// Convert screen coordinates to SVG coordinates
function getSvgPoint(e: MouseEvent): { x: number; y: number } | null {
  const svg = svgRef.value?.ownerSVGElement
  if (!svg) return null
  return getSvgPointUtil(e, svg)
}

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
  } else if ('points' in annotation && Array.isArray(annotation.points)) {
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
// Always use unrotated bounds - rotation is applied via transform
const bounds = computed(() => {
  if (!selectedAnnotation.value) return null
  return calculateBounds(selectedAnnotation.value)
})

// Use original bounds during rotation to keep transformer stable
// Otherwise use live bounds that fit the current shape
const displayBounds = computed(() => {
  // During rotation drag: use originalBounds to keep transformer stable
  if (isDragging.value && dragMode.value === "rotate" && originalBounds.value) {
    return originalBounds.value
  }
  // Always use current bounds to fit the shape properly
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

  // Get stored rotation + drag delta
  const storedRotation = (selectedAnnotation.value as any).rotation || 0
  const dragDelta = annotationStore.rotationDragDelta
  const totalRotation = storedRotation + dragDelta

  if (totalRotation === 0) return ""

  // Calculate center based on annotation type
  const center = getRotationCenter(selectedAnnotation.value, displayBounds.value)
  const angleDeg = (totalRotation * 180) / Math.PI

  return `rotate(${angleDeg} ${center.x} ${center.y})`
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
  hasMoved.value = false // Reset movement tracker

  // Store COMPLETE annotation state for undo/redo (deep clone)
  originalAnnotationState.value = JSON.parse(JSON.stringify(selectedAnnotation.value))

  // Store original points for point-based annotations
  if ("points" in selectedAnnotation.value && Array.isArray(selectedAnnotation.value.points)) {
    // Manual clone to avoid issues with reactive proxies
    originalPoints.value = selectedAnnotation.value.points.map((p) => ({ x: p.x, y: p.y }))
    debugLog("TransformHandles", `Stored ${originalPoints.value.length} original points`)
  }

  // For rotation, calculate the starting angle from center to mouse
  if (mode === "rotate" && originalBounds.value) {
    const center = getRotationCenter(selectedAnnotation.value, originalBounds.value)
    // Just record where the mouse is - don't account for existing rotation
    // The delta will be added to existing rotation in handleRotate
    startRotationAngle.value = Math.atan2(svgPoint.y - center.y, svgPoint.x - center.x)
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

  // Track if mouse actually moved (to distinguish click from drag)
  if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
    hasMoved.value = true
  }

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

  // Calculate original aspect ratio
  const originalAspectRatio = originalBounds.value.width / originalBounds.value.height

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

  // Constrain aspect ratio if Shift is pressed
  if (isShiftPressed.value) {
    // Determine which dimension to use as the "driver"
    // Use the dimension that changed more (abs value)
    const widthChangePct = Math.abs(newBounds.width - originalBounds.value.width) / originalBounds.value.width
    const heightChangePct = Math.abs(newBounds.height - originalBounds.value.height) / originalBounds.value.height

    if (widthChangePct > heightChangePct) {
      // Width changed more - constrain height to match
      const newHeight = newBounds.width / originalAspectRatio
      const heightDiff = newHeight - newBounds.height

      newBounds.height = newHeight

      // Adjust position if resizing from top
      if (isTop) {
        newBounds.y -= heightDiff
      }
    } else {
      // Height changed more - constrain width to match
      const newWidth = newBounds.height * originalAspectRatio
      const widthDiff = newWidth - newBounds.width

      newBounds.width = newWidth

      // Adjust position if resizing from left
      if (isLeft) {
        newBounds.x -= widthDiff
      }
    }
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
  if (!selectedAnnotation.value || !originalBounds.value) {
    return
  }

  // Calculate center based on annotation type
  const center = getRotationCenter(selectedAnnotation.value, originalBounds.value)

  // Calculate current angle from center to mouse
  const currentAngle = Math.atan2(svgY - center.y, svgX - center.x)

  // Calculate rotation delta from start
  const rotationDelta = currentAngle - startRotationAngle.value
  currentRotationDelta.value = rotationDelta

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
  } else if ("x" in annotation && "y" in annotation && originalBounds.value) {
    // Text annotation - update x, y position
    annotationStore.updateAnnotation(annotation.id, {
      x: originalBounds.value.x + deltaX,
      y: originalBounds.value.y + deltaY
    })
  }
}

function endDrag() {
  // CRITICAL: Clear drag delta IMMEDIATELY to stop rotation
  annotationStore.rotationDragDelta = 0

  // CRITICAL: Stop dragging IMMEDIATELY to prevent handleDrag from running
  const wasDragging = isDragging.value
  const mode = dragMode.value
  isDragging.value = false

  if (!selectedAnnotation.value || !originalAnnotationState.value || !wasDragging) {
    // Clean up state
    activeHandle.value = null
    dragMode.value = null
    dragStart.value = null
    originalBounds.value = null
    originalPoints.value = null
    originalAnnotationState.value = null
    startRotationAngle.value = 0
    currentRotationDelta.value = 0
    hasMoved.value = false
    return
  }

  // If mouse didn't move (just a click), deselect the annotation
  if (!hasMoved.value && mode === "move") {
    annotationStore.selectAnnotation(null)
    activeHandle.value = null
    dragMode.value = null
    dragStart.value = null
    originalBounds.value = null
    originalPoints.value = null
    originalAnnotationState.value = null
    startRotationAngle.value = 0
    currentRotationDelta.value = 0
    hasMoved.value = false
    return
  }

  const annotationId = selectedAnnotation.value.id

  // Commit rotation on release
  if (mode === "rotate" && currentRotationDelta.value !== 0) {
    const existingRotation = (selectedAnnotation.value as any).rotation || 0
    const newRotation = existingRotation + currentRotationDelta.value

    annotationStore.updateAnnotation(annotationId, {
      rotation: newRotation
    })
  }

  // Get final state AFTER all updates
  const finalState = annotationStore.getAnnotationById(annotationId)

  // Create a single history entry for the entire transformation
  // Only if the annotation actually changed
  if (finalState && JSON.stringify(originalAnnotationState.value) !== JSON.stringify(finalState)) {
    // Create update command with original and final states
    const updateCommand = new historyStore.UpdateAnnotationCommand(
      annotationId,
      originalAnnotationState.value,
      finalState,
      annotationStore
    )
    historyStore.executeCommand(updateCommand)
  }

  // Clean up state
  activeHandle.value = null
  dragMode.value = null
  dragStart.value = null
  originalBounds.value = null
  originalPoints.value = null
  originalAnnotationState.value = null
  startRotationAngle.value = 0
  currentRotationDelta.value = 0
  hasMoved.value = false
}
</script>
<template>
  <g v-if="selectedAnnotation && displayBounds" ref="svgRef" class="transform-handles">
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
