<script setup lang="ts">
/**
 * Group Transform Handles
 *
 * Handles transformation of multiple selected annotations as a group.
 * Shows a single bounding box around all selected annotations.
 */

import { TRANSFORM, COLORS } from "~/constants/ui"
import { useTransformBase } from "~/composables/useTransformBase"
import type { Annotation } from "~/types/annotations"
import type { Point } from "~/types"

const annotationStore = useAnnotationStore()
const historyStore = useHistoryStore()

const selectedAnnotations = computed(() => annotationStore.selectedAnnotations)

const handleSize = TRANSFORM.HANDLE_SIZE
const rotationHandleDistance = TRANSFORM.ROTATION_DISTANCE

// Expose colors for v-bind in styles
const colorBlueDark = COLORS.SELECTION_BLUE_DARK
const colorBlueDarker = COLORS.SELECTION_BLUE_DARKER

// Use base transform composable
const transformBase = useTransformBase()

// Component-specific state
const originalAnnotationStates = ref<Annotation[]>([]) // Store all annotation states for undo
const cumulativeGroupRotation = ref(0) // Track cumulative rotation for visual handles
const frozenTransformerBounds = ref<Bounds | null>(null) // Keep transformer bounds frozen after rotation
const originalCombinedBounds = ref<Bounds | null>(null) // Store combined bounds at drag start for delta calculation

// Reset state when selection changes
watch(
  () => annotationStore.selectedAnnotationIds,
  () => {
    cumulativeGroupRotation.value = 0
    frozenTransformerBounds.value = null
  },
  { deep: true }
)

/**
 * Calculate transformed bounds based on the change from original to current combined bounds
 * Used for both real-time display during drag and committing on drag end
 */
function calculateTransformedBounds(
  frozenBounds: Bounds,
  originalCombined: Bounds,
  currentCombined: Bounds,
  mode: "move" | "resize"
): Bounds {
  if (mode === "move") {
    // For move: translate by the movement delta
    const deltaX = currentCombined.x - originalCombined.x
    const deltaY = currentCombined.y - originalCombined.y
    return {
      x: frozenBounds.x + deltaX,
      y: frozenBounds.y + deltaY,
      width: frozenBounds.width,
      height: frozenBounds.height
    }
  } else {
    // For resize: scale and translate
    const scaleX = originalCombined.width > 0 ? currentCombined.width / originalCombined.width : 1
    const scaleY = originalCombined.height > 0 ? currentCombined.height / originalCombined.height : 1
    const deltaX = currentCombined.x - originalCombined.x
    const deltaY = currentCombined.y - originalCombined.y
    return {
      x: frozenBounds.x + deltaX,
      y: frozenBounds.y + deltaY,
      width: frozenBounds.width * scaleX,
      height: frozenBounds.height * scaleY
    }
  }
}

// Calculate combined bounding box for all selected annotations
const combinedBounds = computed(() => {
  if (selectedAnnotations.value.length < 2) return null

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

  for (const annotation of selectedAnnotations.value) {
    const bounds = calculateBounds(annotation)
    if (!bounds) continue

    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }

  if (minX === Infinity) return null

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
})

// Use original bounds during rotation to keep transformer stable
// After rotation, use frozen bounds to prevent transformer from jumping
const displayBounds = computed(() => {
  // During rotation drag: use original bounds (frozen at drag start)
  if (
    transformBase.isDragging.value &&
    transformBase.dragMode.value === "rotate" &&
    transformBase.originalBounds.value
  ) {
    return transformBase.originalBounds.value
  }

  // During move/resize drag: transform frozen bounds if rotated, otherwise use combinedBounds
  const dragMode = transformBase.dragMode.value
  if (transformBase.isDragging.value && (dragMode === "move" || dragMode === "resize")) {
    if (frozenTransformerBounds.value && originalCombinedBounds.value && combinedBounds.value) {
      return calculateTransformedBounds(
        frozenTransformerBounds.value,
        originalCombinedBounds.value,
        combinedBounds.value,
        dragMode
      )
    }
    return combinedBounds.value
  }

  // After rotation: use frozen bounds (preserves transformer position when not dragging)
  if (frozenTransformerBounds.value) {
    return frozenTransformerBounds.value
  }

  // Default: calculate from current annotation positions
  return combinedBounds.value
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

// Calculate edge midpoints for edge handles (single-axis resizing)
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

// Transform for rotating the entire transformer box (group rotation around combined center)
const transformerTransform = computed(() => {
  if (!displayBounds.value) return ""

  const dragDelta = annotationStore.rotationDragDelta
  const totalRotation = cumulativeGroupRotation.value + dragDelta

  if (totalRotation === 0) return ""

  const centerX = displayBounds.value.x + displayBounds.value.width / 2
  const centerY = displayBounds.value.y + displayBounds.value.height / 2
  const angleDeg = (totalRotation * 180) / Math.PI

  return `rotate(${angleDeg} ${centerX} ${centerY})`
})

function onStartDrag(e: MouseEvent, handle: string, mode: "resize" | "rotate" | "move") {
  if (!combinedBounds.value) return

  // Don't clear frozen bounds if we've rotated (preserves transformer orientation)
  // For move without rotation, clear to recalculate
  if (mode === "move" && cumulativeGroupRotation.value === 0) {
    frozenTransformerBounds.value = null
  }

  // Use frozen bounds if available (maintains transformer after rotation), otherwise use combined bounds
  const startBounds = frozenTransformerBounds.value || combinedBounds.value

  transformBase.startDrag(e, handle, mode, startBounds, (svgPoint) => {
    // Store COMPLETE state for ALL selected annotations
    originalAnnotationStates.value = selectedAnnotations.value.map((ann) => JSON.parse(JSON.stringify(ann)))

    // Store combined bounds at drag start for accurate delta calculation
    originalCombinedBounds.value = combinedBounds.value ? { ...combinedBounds.value } : null

    // For rotation, calculate starting angle from group center to mouse
    if (mode === "rotate" && transformBase.originalBounds.value) {
      const centerX = transformBase.originalBounds.value.x + transformBase.originalBounds.value.width / 2
      const centerY = transformBase.originalBounds.value.y + transformBase.originalBounds.value.height / 2
      transformBase.startRotationAngle.value = Math.atan2(svgPoint.y - centerY, svgPoint.x - centerX)
    }
  })
}

function handleResize(deltaX: number, deltaY: number) {
  if (!transformBase.originalBounds.value || !transformBase.activeHandle.value) return
  if (originalAnnotationStates.value.length === 0) return
  if (selectedAnnotations.value.length < 2) return

  const handle = transformBase.activeHandle.value

  // Determine which corner or edge is being dragged
  const isCorner = handle.startsWith("corner-")

  // Corner handles
  const isLeft = handle === "corner-0" || handle === "corner-3"
  const isTop = handle === "corner-0" || handle === "corner-1"
  const isRight = handle === "corner-1" || handle === "corner-2"
  const isBottom = handle === "corner-2" || handle === "corner-3"

  // Edge handles (single-axis resizing)
  const isTopEdge = handle === "edge-0"
  const isRightEdge = handle === "edge-1"
  const isBottomEdge = handle === "edge-2"
  const isLeftEdge = handle === "edge-3"

  // Calculate original aspect ratio
  const originalAspectRatio = transformBase.originalBounds.value.width / transformBase.originalBounds.value.height

  // Calculate new bounds based on corner or edge drag
  const newBounds = { ...transformBase.originalBounds.value }

  // Corner handles - resize both dimensions
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

  // Edge handles - resize single dimension only
  if (isTopEdge) {
    newBounds.y += deltaY
    newBounds.height -= deltaY
  }
  if (isBottomEdge) {
    newBounds.height += deltaY
  }
  if (isLeftEdge) {
    newBounds.x += deltaX
    newBounds.width -= deltaX
  }
  if (isRightEdge) {
    newBounds.width += deltaX
  }

  // Constrain aspect ratio if Shift is pressed (only for corner handles)
  if (transformBase.isShiftPressed.value && isCorner) {
    const widthChangePct =
      Math.abs(newBounds.width - transformBase.originalBounds.value.width) / transformBase.originalBounds.value.width
    const heightChangePct =
      Math.abs(newBounds.height - transformBase.originalBounds.value.height) / transformBase.originalBounds.value.height

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

  // Calculate scale factors
  const scaleX = newBounds.width / transformBase.originalBounds.value.width
  const scaleY = newBounds.height / transformBase.originalBounds.value.height

  // Scale all annotations proportionally
  originalAnnotationStates.value.forEach((originalAnn: Annotation) => {
    if ("points" in originalAnn && Array.isArray(originalAnn.points)) {
      // Point-based annotation - scale all points relative to combined bounds
      const scaledPoints = originalAnn.points.map((p: Point) => ({
        x: newBounds.x + (p.x - transformBase.originalBounds.value!.x) * scaleX,
        y: newBounds.y + (p.y - transformBase.originalBounds.value!.y) * scaleY
      }))
      annotationStore.updateAnnotation(originalAnn.id, { points: scaledPoints })
    } else if ("x" in originalAnn && "y" in originalAnn && "width" in originalAnn && "height" in originalAnn) {
      // Text annotation - scale bounds
      const scaledX = newBounds.x + (originalAnn.x - transformBase.originalBounds.value!.x) * scaleX
      const scaledY = newBounds.y + (originalAnn.y - transformBase.originalBounds.value!.y) * scaleY
      const scaledWidth = originalAnn.width * scaleX
      const scaledHeight = originalAnn.height * scaleY

      annotationStore.updateAnnotation(originalAnn.id, {
        x: scaledX,
        y: scaledY,
        width: scaledWidth,
        height: scaledHeight
      })
    }
  })
}

function handleRotate(svgX: number, svgY: number) {
  if (!transformBase.originalBounds.value || originalAnnotationStates.value.length === 0) return

  // Rotate around center of combined bounds
  const centerX = transformBase.originalBounds.value.x + transformBase.originalBounds.value.width / 2
  const centerY = transformBase.originalBounds.value.y + transformBase.originalBounds.value.height / 2

  // Calculate current angle from center to mouse
  const currentAngle = Math.atan2(svgY - centerY, svgX - centerX)

  // Calculate rotation delta from start
  const rotationDelta = currentAngle - transformBase.startRotationAngle.value
  transformBase.currentRotationDelta.value = rotationDelta

  // Update visual rotation delta for real-time feedback
  annotationStore.rotationDragDelta = rotationDelta

  // Apply rotation to annotations in real-time for visual feedback
  originalAnnotationStates.value.forEach((originalAnn: Annotation) => {
    if (hasPoints(originalAnn)) {
      const rotatedPoints = originalAnn.points.map((p: Point) => {
        const dx = p.x - centerX
        const dy = p.y - centerY
        const cos = Math.cos(rotationDelta)
        const sin = Math.sin(rotationDelta)
        return {
          x: centerX + dx * cos - dy * sin,
          y: centerY + dx * sin + dy * cos
        }
      })

      // For measurements, also update labelRotation to keep labels aligned
      const updates: Record<string, unknown> = { points: rotatedPoints }
      if (originalAnn.type === "measure" && hasLabelRotation(originalAnn)) {
        const rotationDegrees = (rotationDelta * 180) / Math.PI
        updates.labelRotation = originalAnn.labelRotation + rotationDegrees
      }

      annotationStore.updateAnnotation(originalAnn.id, updates)
    } else if (hasX(originalAnn) && hasY(originalAnn)) {
      // Handle fill/text annotations with x,y position
      // For group rotation, update BOTH position (to orbit around group center) AND rotation property
      if ("rotation" in originalAnn && hasWidth(originalAnn) && hasHeight(originalAnn)) {
        // Calculate fill's center position
        const fillCenterX = originalAnn.x + originalAnn.width / 2
        const fillCenterY = originalAnn.y + originalAnn.height / 2

        // Rotate the center around the group center
        const dx = fillCenterX - centerX
        const dy = fillCenterY - centerY
        const cos = Math.cos(rotationDelta)
        const sin = Math.sin(rotationDelta)
        const rotatedCenterX = centerX + dx * cos - dy * sin
        const rotatedCenterY = centerY + dx * sin + dy * cos

        // Calculate new x,y position from rotated center
        const newX = rotatedCenterX - originalAnn.width / 2
        const newY = rotatedCenterY - originalAnn.height / 2

        const originalRotation = (originalAnn.rotation as number) || 0
        annotationStore.updateAnnotation(originalAnn.id, {
          x: newX,
          y: newY,
          rotation: originalRotation + rotationDelta
        })
      }
    }
  })
}

function handleMove(deltaX: number, deltaY: number) {
  if (originalAnnotationStates.value.length === 0) return

  // Move all annotations by the same delta
  originalAnnotationStates.value.forEach((originalAnn: Annotation) => {
    if (hasPoints(originalAnn)) {
      const movedPoints = originalAnn.points.map((p: Point) => ({
        x: p.x + deltaX,
        y: p.y + deltaY
      }))
      annotationStore.updateAnnotation(originalAnn.id, { points: movedPoints })
    } else if (hasX(originalAnn) && hasY(originalAnn)) {
      annotationStore.updateAnnotation(originalAnn.id, {
        x: originalAnn.x + deltaX,
        y: originalAnn.y + deltaY
      })
    }
  })
}

function handleEndDrag(mode: "resize" | "rotate" | "move" | null, moved: boolean) {
  const dragState = useDragState()

  if (originalAnnotationStates.value.length === 0) {
    originalAnnotationStates.value = []
    return
  }

  // If mouse didn't move, deselect all
  if (!moved && mode === "move") {
    annotationStore.selectAnnotation(null)
    originalAnnotationStates.value = []
    return
  }

  // Mark that drag just ended to prevent click handlers from firing
  if (moved) {
    dragState.markDragEnd()
  }

  // Commit rotation for all annotations
  if (mode === "rotate" && transformBase.currentRotationDelta.value !== 0 && transformBase.originalBounds.value) {
    const centerX = transformBase.originalBounds.value.x + transformBase.originalBounds.value.width / 2
    const centerY = transformBase.originalBounds.value.y + transformBase.originalBounds.value.height / 2

    // Rotate all annotations around group center
    // Only rotate the points - don't update individual rotation properties
    originalAnnotationStates.value.forEach((originalAnn: Annotation) => {
      if (hasPoints(originalAnn)) {
        const rotatedPoints = originalAnn.points.map((p: Point) => {
          const dx = p.x - centerX
          const dy = p.y - centerY
          const cos = Math.cos(transformBase.currentRotationDelta.value)
          const sin = Math.sin(transformBase.currentRotationDelta.value)
          return {
            x: centerX + dx * cos - dy * sin,
            y: centerY + dx * sin + dy * cos
          }
        })

        // For measurements, also update labelRotation to keep labels aligned
        const updates: Record<string, unknown> = { points: rotatedPoints }
        if (originalAnn.type === "measure" && hasLabelRotation(originalAnn)) {
          const rotationDegrees = (transformBase.currentRotationDelta.value * 180) / Math.PI
          updates.labelRotation = originalAnn.labelRotation + rotationDegrees
        }

        annotationStore.updateAnnotation(originalAnn.id, updates)
      } else if (hasX(originalAnn) && hasY(originalAnn)) {
        // Handle fill/text annotations with x,y position
        // For group rotation, update BOTH position (to orbit around group center) AND rotation property
        if ("rotation" in originalAnn && hasWidth(originalAnn) && hasHeight(originalAnn)) {
          // Calculate fill's center position
          const fillCenterX = originalAnn.x + originalAnn.width / 2
          const fillCenterY = originalAnn.y + originalAnn.height / 2

          // Rotate the center around the group center
          const dx = fillCenterX - centerX
          const dy = fillCenterY - centerY
          const cos = Math.cos(transformBase.currentRotationDelta.value)
          const sin = Math.sin(transformBase.currentRotationDelta.value)
          const rotatedCenterX = centerX + dx * cos - dy * sin
          const rotatedCenterY = centerY + dx * sin + dy * cos

          // Calculate new x,y position from rotated center
          const newX = rotatedCenterX - originalAnn.width / 2
          const newY = rotatedCenterY - originalAnn.height / 2

          const originalRotation = (originalAnn.rotation as number) || 0
          annotationStore.updateAnnotation(originalAnn.id, {
            x: newX,
            y: newY,
            rotation: originalRotation + transformBase.currentRotationDelta.value
          })
        }
      }
    })

    // Add to cumulative group rotation so handles stay visually rotated
    cumulativeGroupRotation.value += transformBase.currentRotationDelta.value

    // Keep transformer at original size/position (just rotated)
    // Don't recalculate bounds - this prevents the bounding box from expanding
    frozenTransformerBounds.value = { ...transformBase.originalBounds.value }
  }

  // For resize/move: update frozen bounds to match what was displayed during drag
  if ((mode === "resize" || mode === "move") && moved) {
    // For move without rotation: recalculate from annotations
    if (mode === "move" && cumulativeGroupRotation.value === 0) {
      frozenTransformerBounds.value = combinedBounds.value
    }
    // For resize or rotated move: apply the same transform shown during drag
    else if (frozenTransformerBounds.value && originalCombinedBounds.value && combinedBounds.value) {
      frozenTransformerBounds.value = calculateTransformedBounds(
        frozenTransformerBounds.value,
        originalCombinedBounds.value,
        combinedBounds.value,
        mode
      )
    }
    // Fallback: recalculate from annotations
    else if (!frozenTransformerBounds.value) {
      frozenTransformerBounds.value = combinedBounds.value
    }
  }

  // Get final states for all annotations
  const _finalStates = selectedAnnotations.value.map((ann) => annotationStore.getAnnotationById(ann.id))

  // Record history for group transformations
  originalAnnotationStates.value.forEach((originalAnn: Annotation, index: number) => {
    const finalState = _finalStates[index]
    if (finalState) {
      // Calculate the updates that were made during transformation
      const updates: Record<string, unknown> = {}

      // Compare key properties that might have changed
      if (hasRotation(finalState) && hasRotation(originalAnn) && finalState.rotation !== originalAnn.rotation) {
        updates.rotation = finalState.rotation
      }
      if (
        hasPoints(finalState) &&
        hasPoints(originalAnn) &&
        JSON.stringify(finalState.points) !== JSON.stringify(originalAnn.points)
      ) {
        updates.points = finalState.points
      }
      if (
        hasX(finalState) &&
        hasY(finalState) &&
        hasWidth(finalState) &&
        hasHeight(finalState) &&
        hasX(originalAnn) &&
        hasY(originalAnn) &&
        hasWidth(originalAnn) &&
        hasHeight(originalAnn)
      ) {
        if (
          finalState.x !== originalAnn.x ||
          finalState.y !== originalAnn.y ||
          finalState.width !== originalAnn.width ||
          finalState.height !== originalAnn.height
        ) {
          updates.x = finalState.x
          updates.y = finalState.y
          updates.width = finalState.width
          updates.height = finalState.height
        }
      }

      // If any updates were made, record them in history
      if (Object.keys(updates).length > 0) {
        historyStore.updateAnnotationWithHistory(originalAnn.id, updates)
      }
    }
  })

  // Clean up
  originalAnnotationStates.value = []
  originalCombinedBounds.value = null
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
    v-if="selectedAnnotations.length >= 2 && displayBounds"
    :ref="
      (el) => {
        transformBase.svgRef.value = el as SVGGElement | null
      }
    "
    class="group-transform-handles"
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

        <!-- Rotation handle circle -->
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

        <!-- Rotation icon -->
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
.group-transform-handles {
  pointer-events: none;
}

.corner-handle,
.edge-handle,
.rotation-handle {
  cursor: pointer;
  pointer-events: all;
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
