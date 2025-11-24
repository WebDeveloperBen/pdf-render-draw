<!--
  Minimal Viable SVG Editor Component

  Phase 1: Basic Selection ✓
  - One hardcoded rectangle
  - Single select on click
  - CTM-based bounding box
  - Single rotation handle

  Phase 2: Multi-Select ✓
  - Multiple hardcoded shapes
  - Shift+click to select multiple
  - Union bounding box calculation
  - Tests for multi-select behavior

  Phase 3: Translate ✓
  - Drag shapes to move them
  - Drag selection box to move all selected
  - Update position on mouseup
  - Tests for drag behavior

  Phase 4: Rotation (IN PROGRESS)
  - Drag rotation handle to rotate
  - Rotate around center point
  - Apply CTM-based rotation transform
  - Tests for rotation behavior

  Following PLAN.md spec-driven approach
-->
<script setup lang="ts">
import { ref, computed } from "vue"
import type { Bounds } from "~/utils/bounds"

// Simple shape interface for our MVP
interface Shape {
  id: string
  type: "rect"
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fill: string
}

// Hardcoded shapes for Phase 2
const shapes = ref<Shape[]>([
  {
    id: "rect-1",
    type: "rect",
    x: 100,
    y: 100,
    width: 150,
    height: 100,
    rotation: 0,
    fill: "#3b82f6"
  },
  {
    id: "rect-2",
    type: "rect",
    x: 350,
    y: 200,
    width: 120,
    height: 80,
    rotation: 0,
    fill: "#10b981"
  },
  {
    id: "rect-3",
    type: "rect",
    x: 200,
    y: 350,
    width: 100,
    height: 100,
    rotation: 0,
    fill: "#f59e0b"
  }
])

// Selection state - now supports multiple selections
const selectedIds = ref<string[]>([])

// Get selected shapes
const selectedShapes = computed(() => {
  if (selectedIds.value.length === 0) return []
  return shapes.value.filter((s) => selectedIds.value.includes(s.id))
})

// Single selected shape (for backwards compatibility with Phase 1)
const selectedShape = computed(() => {
  if (selectedIds.value.length === 1) {
    return shapes.value.find((s) => s.id === selectedIds.value[0]) || null
  }
  return null
})

// Phase 3: Drag state
const isDragging = ref(false)
const dragStartPoint = ref<{ x: number; y: number } | null>(null)
const dragOriginalPositions = ref<Map<string, { x: number; y: number }>>(new Map())

// Phase 4: Rotation state
const isRotating = ref(false)
const rotationStartAngle = ref(0)
const rotationOriginalAngles = ref<Map<string, number>>(new Map())
const rotationCenter = ref<{ x: number; y: number } | null>(null)

// Track the selection group's rotation
const selectionRotation = ref(0)

// Store bounds at start of rotation (so they don't recalculate during rotation)
const rotationLockedBounds = ref<Bounds | null>(null)

// Prevent background clicks immediately after drag/rotate ends
const justFinishedInteraction = ref(false)

// Phase 5: Scaling state
const isScaling = ref(false)
const scaleHandle = ref<string | null>(null) // which handle: 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'
const scaleStartPoint = ref<{ x: number; y: number } | null>(null)
const scaleOriginalBounds = ref<Bounds | null>(null)
const scaleOriginalShapes = ref<Map<string, { x: number; y: number; width: number; height: number }>>(new Map())

// Calculate bounding box using CTM-based approach
// For Phase 1: Simple axis-aligned bounding box
function calculateBounds(shape: Shape): Bounds {
  if (shape.rotation === 0) {
    return {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height
    }
  }

  // For rotated rectangles: calculate rotated bounding box
  const centerX = shape.x + shape.width / 2
  const centerY = shape.y + shape.height / 2

  // Get four corners
  const corners = [
    { x: shape.x, y: shape.y },
    { x: shape.x + shape.width, y: shape.y },
    { x: shape.x + shape.width, y: shape.y + shape.height },
    { x: shape.x, y: shape.y + shape.height }
  ]

  // Rotate corners
  const cos = Math.cos(shape.rotation)
  const sin = Math.sin(shape.rotation)

  const rotatedCorners = corners.map((corner) => {
    const dx = corner.x - centerX
    const dy = corner.y - centerY
    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos
    }
  })

  // Find min/max to get axis-aligned bounding box
  const xs = rotatedCorners.map((p) => p.x)
  const ys = rotatedCorners.map((p) => p.y)

  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  }
}

// Get non-rotated bounding box for a shape (ignoring its rotation)
function getNonRotatedBounds(shape: Shape): Bounds {
  return {
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height
  }
}

// Bounding box for selected shape(s)
// Phase 4: Returns bounds for the selection group
// During rotation, uses locked bounds; otherwise recalculates accounting for rotation
const selectionBounds = computed(() => {
  if (selectedIds.value.length === 0) return null

  // If we have locked bounds and selection rotation (during or after rotation)
  // use the locked bounds to keep transformer stable
  if (rotationLockedBounds.value && selectionRotation.value !== 0) {
    return rotationLockedBounds.value
  }

  // Single selection - use rotated bounds (accounts for shape rotation)
  if (selectedIds.value.length === 1 && selectedShape.value) {
    return calculateBounds(selectedShape.value)
  }

  // Multi-selection - calculate union of rotated bounds
  if (selectedShapes.value.length > 1) {
    const allBounds = selectedShapes.value.map((s) => calculateBounds(s))
    return calculateUnionBounds(allBounds)
  }

  return null
})

// Calculate union bounding box for multiple shapes
function calculateUnionBounds(bounds: Bounds[]): Bounds | null {
  if (bounds.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const b of bounds) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }

  if (minX === Infinity) return null

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

// Handle shape click with Shift support for multi-select
function handleShapeClick(shapeId: string, event: MouseEvent) {
  event.stopPropagation()

  if (event.shiftKey) {
    // Shift+click: toggle selection
    if (selectedIds.value.includes(shapeId)) {
      // Deselect if already selected
      selectedIds.value = selectedIds.value.filter((id) => id !== shapeId)
    } else {
      // Add to selection
      selectedIds.value = [...selectedIds.value, shapeId]
    }
  } else {
    // Regular click: single select
    selectedIds.value = [shapeId]
  }

  // Reset selection rotation and locked bounds when selection changes
  selectionRotation.value = 0
  rotationLockedBounds.value = null
}

// Handle background click (deselect all)
function handleBackgroundClick() {
  // Don't deselect if we just finished dragging, rotating, or scaling
  // (mouseup might trigger a click event)
  if (isDragging.value || isRotating.value || isScaling.value || justFinishedInteraction.value) return

  selectedIds.value = []
  selectionRotation.value = 0
  rotationLockedBounds.value = null
}

// SVG transform for shape rotation
function getShapeTransform(shape: Shape): string {
  if (shape.rotation === 0) return ""

  const centerX = shape.x + shape.width / 2
  const centerY = shape.y + shape.height / 2
  const angleDeg = (shape.rotation * 180) / Math.PI

  return `rotate(${angleDeg} ${centerX} ${centerY})`
}

// Rotation handle position
const rotationHandleDistance = 30

const rotationHandlePos = computed(() => {
  if (!selectionBounds.value) return null

  return {
    x: selectionBounds.value.x + selectionBounds.value.width / 2,
    y: selectionBounds.value.y - rotationHandleDistance
  }
})

// Phase 3: Convert mouse event to SVG coordinates
function getSvgPoint(event: MouseEvent, svg: SVGSVGElement): { x: number; y: number } {
  const pt = svg.createSVGPoint()
  pt.x = event.clientX
  pt.y = event.clientY
  const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse())
  return { x: svgP.x, y: svgP.y }
}

// Phase 3: Start dragging
function handleDragStart(event: MouseEvent) {
  if (selectedIds.value.length === 0) return

  const svg = (event.currentTarget as Element).ownerSVGElement
  if (!svg) return

  const svgPoint = getSvgPoint(event, svg)

  isDragging.value = true
  dragStartPoint.value = svgPoint

  // Store original positions of all selected shapes
  dragOriginalPositions.value.clear()
  for (const shape of selectedShapes.value) {
    dragOriginalPositions.value.set(shape.id, { x: shape.x, y: shape.y })
  }

  // Store original locked bounds if they exist (from previous rotation)
  if (rotationLockedBounds.value) {
    dragOriginalLockedBounds.value = { ...rotationLockedBounds.value }
  }

  event.stopPropagation()
}

// Store original locked bounds at drag start
const dragOriginalLockedBounds = ref<Bounds | null>(null)

// Phase 3: Handle drag move
function handleDragMove(event: MouseEvent) {
  if (!isDragging.value || !dragStartPoint.value) return

  const svg = (event.target as Element).ownerSVGElement
  if (!svg) return

  const svgPoint = getSvgPoint(event, svg)
  const deltaX = svgPoint.x - dragStartPoint.value.x
  const deltaY = svgPoint.y - dragStartPoint.value.y

  // Move all selected shapes
  for (const shape of selectedShapes.value) {
    const originalPos = dragOriginalPositions.value.get(shape.id)
    if (originalPos) {
      shape.x = originalPos.x + deltaX
      shape.y = originalPos.y + deltaY
    }
  }

  // If we have locked bounds (from a previous rotation), update their position too
  if (dragOriginalLockedBounds.value && rotationLockedBounds.value) {
    rotationLockedBounds.value = {
      x: dragOriginalLockedBounds.value.x + deltaX,
      y: dragOriginalLockedBounds.value.y + deltaY,
      width: dragOriginalLockedBounds.value.width,
      height: dragOriginalLockedBounds.value.height
    }
  }
}

// Phase 3: End dragging
function handleDragEnd() {
  if (!isDragging.value) return // Not dragging, nothing to end

  isDragging.value = false
  dragStartPoint.value = null
  dragOriginalPositions.value.clear()
  dragOriginalLockedBounds.value = null

  // Prevent background click for a brief moment
  justFinishedInteraction.value = true
  setTimeout(() => {
    justFinishedInteraction.value = false
  }, 100)
}

// Phase 4: Start rotating
function handleRotateStart(event: MouseEvent) {
  if (selectedIds.value.length === 0 || !selectionBounds.value) return

  const svg = (event.currentTarget as Element).ownerSVGElement
  if (!svg) return

  const svgPoint = getSvgPoint(event, svg)

  // Lock the current visible bounding box (already calculated AABB)
  // This prevents the bounds from changing when isRotating becomes true
  rotationLockedBounds.value = { ...selectionBounds.value }

  // Calculate center of selection
  const centerX = selectionBounds.value.x + selectionBounds.value.width / 2
  const centerY = selectionBounds.value.y + selectionBounds.value.height / 2
  rotationCenter.value = { x: centerX, y: centerY }

  // Calculate starting angle from center to mouse
  const dx = svgPoint.x - centerX
  const dy = svgPoint.y - centerY
  rotationStartAngle.value = Math.atan2(dy, dx)

  // Store the current selection rotation (for accumulating multiple rotations)
  rotationStartSelectionAngle.value = selectionRotation.value

  // Store original rotations and positions BEFORE setting isRotating
  rotationOriginalAngles.value.clear()
  dragOriginalPositions.value.clear()
  for (const shape of selectedShapes.value) {
    rotationOriginalAngles.value.set(shape.id, shape.rotation)
    dragOriginalPositions.value.set(shape.id, { x: shape.x, y: shape.y })
  }

  // Set rotating LAST so locked bounds are used immediately
  isRotating.value = true

  event.stopPropagation()
}

// Store the selection rotation at the start of current rotation
const rotationStartSelectionAngle = ref(0)

// Phase 4: Handle rotation move
function handleRotateMove(event: MouseEvent) {
  if (!isRotating.value || !rotationCenter.value) return

  const svg = (event.target as Element).ownerSVGElement
  if (!svg) return

  const svgPoint = getSvgPoint(event, svg)

  // Calculate current angle from center to mouse
  const dx = svgPoint.x - rotationCenter.value.x
  const dy = svgPoint.y - rotationCenter.value.y
  const currentAngle = Math.atan2(dy, dx)

  // Calculate rotation delta from when we started THIS rotation
  const rotationDelta = currentAngle - rotationStartAngle.value

  // Update selection group rotation (accumulate with previous rotation)
  selectionRotation.value = rotationStartSelectionAngle.value + rotationDelta

  // Apply rotation to all selected shapes
  // For each shape: rotate it AND move it around the selection center
  for (const shape of selectedShapes.value) {
    const originalRotation = rotationOriginalAngles.value.get(shape.id) || 0
    const originalPos = dragOriginalPositions.value.get(shape.id)

    if (!originalPos) continue

    // Update shape rotation
    shape.rotation = originalRotation + rotationDelta

    // Rotate the shape's position around the selection center
    const shapeCenterX = originalPos.x + shape.width / 2
    const shapeCenterY = originalPos.y + shape.height / 2

    // Vector from selection center to shape center
    const vecX = shapeCenterX - rotationCenter.value.x
    const vecY = shapeCenterY - rotationCenter.value.y

    // Rotate this vector
    const cos = Math.cos(rotationDelta)
    const sin = Math.sin(rotationDelta)
    const rotatedVecX = vecX * cos - vecY * sin
    const rotatedVecY = vecX * sin + vecY * cos

    // New shape center position
    const newCenterX = rotationCenter.value.x + rotatedVecX
    const newCenterY = rotationCenter.value.y + rotatedVecY

    // Update shape position (top-left corner)
    shape.x = newCenterX - shape.width / 2
    shape.y = newCenterY - shape.height / 2
  }
}

// Phase 4: End rotating
function handleRotateEnd() {
  if (!isRotating.value) return // Not rotating, nothing to end

  isRotating.value = false
  rotationStartAngle.value = 0
  rotationOriginalAngles.value.clear()
  rotationCenter.value = null
  // DON'T reset selectionRotation or rotationLockedBounds here
  // Keep transformer at rotated angle until selection changes

  // Prevent background click for a brief moment
  justFinishedInteraction.value = true
  setTimeout(() => {
    justFinishedInteraction.value = false
  }, 100)
}

// Phase 5: Start scaling
function handleScaleStart(event: MouseEvent, handle: string) {
  if (selectedIds.value.length === 0 || !selectionBounds.value) return

  const svg = (event.currentTarget as Element).ownerSVGElement
  if (!svg) return

  const svgPoint = getSvgPoint(event, svg)

  isScaling.value = true
  scaleHandle.value = handle
  scaleStartPoint.value = svgPoint

  // ALWAYS use the visual bounds (AABB) that the user sees
  // This ensures handles are where the user clicked
  scaleOriginalBounds.value = { ...selectionBounds.value }

  // Store original shape dimensions
  scaleOriginalShapes.value.clear()
  for (const shape of selectedShapes.value) {
    scaleOriginalShapes.value.set(shape.id, {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height
    })
  }

  event.stopPropagation()
}

// Phase 5: Handle scale move
function handleScaleMove(event: MouseEvent) {
  if (!isScaling.value || !scaleStartPoint.value || !scaleOriginalBounds.value || !scaleHandle.value) return

  const svg = (event.target as Element).ownerSVGElement
  if (!svg) return

  const svgPoint = getSvgPoint(event, svg)
  const deltaX = svgPoint.x - scaleStartPoint.value.x
  const deltaY = svgPoint.y - scaleStartPoint.value.y

  // Calculate new bounds based on which handle is being dragged
  let newBounds = { ...scaleOriginalBounds.value }

  switch (scaleHandle.value) {
    case 'se': // Southeast corner - resize from top-left anchor
      newBounds.width = scaleOriginalBounds.value.width + deltaX
      newBounds.height = scaleOriginalBounds.value.height + deltaY
      break
    case 'sw': // Southwest corner - resize from top-right anchor
      newBounds.x = scaleOriginalBounds.value.x + deltaX
      newBounds.width = scaleOriginalBounds.value.width - deltaX
      newBounds.height = scaleOriginalBounds.value.height + deltaY
      break
    case 'ne': // Northeast corner - resize from bottom-left anchor
      newBounds.width = scaleOriginalBounds.value.width + deltaX
      newBounds.y = scaleOriginalBounds.value.y + deltaY
      newBounds.height = scaleOriginalBounds.value.height - deltaY
      break
    case 'nw': // Northwest corner - resize from bottom-right anchor
      newBounds.x = scaleOriginalBounds.value.x + deltaX
      newBounds.width = scaleOriginalBounds.value.width - deltaX
      newBounds.y = scaleOriginalBounds.value.y + deltaY
      newBounds.height = scaleOriginalBounds.value.height - deltaY
      break
    case 'e': // East edge
      newBounds.width = scaleOriginalBounds.value.width + deltaX
      break
    case 'w': // West edge
      newBounds.x = scaleOriginalBounds.value.x + deltaX
      newBounds.width = scaleOriginalBounds.value.width - deltaX
      break
    case 's': // South edge
      newBounds.height = scaleOriginalBounds.value.height + deltaY
      break
    case 'n': // North edge
      newBounds.y = scaleOriginalBounds.value.y + deltaY
      newBounds.height = scaleOriginalBounds.value.height - deltaY
      break
  }

  // Prevent negative dimensions
  if (newBounds.width < 10) newBounds.width = 10
  if (newBounds.height < 10) newBounds.height = 10

  // Calculate scale factors from the AABB change
  const scaleFactorX = newBounds.width / scaleOriginalBounds.value.width
  const scaleFactorY = newBounds.height / scaleOriginalBounds.value.height

  // Determine the anchor point based on which handle is being dragged
  // The anchor is the point that should stay fixed during scaling
  let anchorX = scaleOriginalBounds.value.x
  let anchorY = scaleOriginalBounds.value.y

  switch (scaleHandle.value) {
    case 'se': // Southeast - anchor at NW (top-left)
      anchorX = scaleOriginalBounds.value.x
      anchorY = scaleOriginalBounds.value.y
      break
    case 'sw': // Southwest - anchor at NE (top-right)
      anchorX = scaleOriginalBounds.value.x + scaleOriginalBounds.value.width
      anchorY = scaleOriginalBounds.value.y
      break
    case 'ne': // Northeast - anchor at SW (bottom-left)
      anchorX = scaleOriginalBounds.value.x
      anchorY = scaleOriginalBounds.value.y + scaleOriginalBounds.value.height
      break
    case 'nw': // Northwest - anchor at SE (bottom-right)
      anchorX = scaleOriginalBounds.value.x + scaleOriginalBounds.value.width
      anchorY = scaleOriginalBounds.value.y + scaleOriginalBounds.value.height
      break
    case 'n': // North - anchor at bottom center
      anchorX = scaleOriginalBounds.value.x + scaleOriginalBounds.value.width / 2
      anchorY = scaleOriginalBounds.value.y + scaleOriginalBounds.value.height
      break
    case 's': // South - anchor at top center
      anchorX = scaleOriginalBounds.value.x + scaleOriginalBounds.value.width / 2
      anchorY = scaleOriginalBounds.value.y
      break
    case 'e': // East - anchor at left center
      anchorX = scaleOriginalBounds.value.x
      anchorY = scaleOriginalBounds.value.y + scaleOriginalBounds.value.height / 2
      break
    case 'w': // West - anchor at right center
      anchorX = scaleOriginalBounds.value.x + scaleOriginalBounds.value.width
      anchorY = scaleOriginalBounds.value.y + scaleOriginalBounds.value.height / 2
      break
  }

  // Apply scaling to all selected shapes from the anchor point
  for (const shape of selectedShapes.value) {
    const original = scaleOriginalShapes.value.get(shape.id)
    if (!original) continue

    // Calculate position relative to anchor point
    const relX = original.x - anchorX
    const relY = original.y - anchorY

    // Scale from anchor point
    shape.x = anchorX + relX * scaleFactorX
    shape.y = anchorY + relY * scaleFactorY
    shape.width = original.width * scaleFactorX
    shape.height = original.height * scaleFactorY
  }

  // Update locked bounds during scaling
  // Scale the transformer using the same factors and anchor as the shapes
  // This keeps them moving together as one unit
  if (rotationLockedBounds.value) {
    // Calculate the transformer's position relative to anchor
    const boundsRelX = scaleOriginalBounds.value.x - anchorX
    const boundsRelY = scaleOriginalBounds.value.y - anchorY

    // Scale the transformer from the same anchor point
    rotationLockedBounds.value = {
      x: anchorX + boundsRelX * scaleFactorX,
      y: anchorY + boundsRelY * scaleFactorY,
      width: scaleOriginalBounds.value.width * scaleFactorX,
      height: scaleOriginalBounds.value.height * scaleFactorY
    }
  }
}

// Phase 5: End scaling
function handleScaleEnd() {
  if (!isScaling.value) return

  isScaling.value = false
  scaleHandle.value = null
  scaleStartPoint.value = null
  scaleOriginalBounds.value = null
  scaleOriginalShapes.value.clear()

  // Don't recalculate bounds here - keep transformer stable
  // Bounds will be recalculated on next operation (rotation/scale start)

  // Prevent background click for a brief moment
  justFinishedInteraction.value = true
  setTimeout(() => {
    justFinishedInteraction.value = false
  }, 100)
}

// Set up global mouse event listeners for drag, rotation, and scaling
if (typeof window !== "undefined") {
  window.addEventListener("mousemove", (e: MouseEvent) => {
    handleDragMove(e)
    handleRotateMove(e)
    handleScaleMove(e)
  })
  window.addEventListener("mouseup", () => {
    handleDragEnd()
    handleRotateEnd()
    handleScaleEnd()
  })
}
</script>

<template>
  <div class="debug-editor">
    <h2>Debug SVG Editor - Phase 5: Scaling</h2>

    <svg width="800" height="600" viewBox="0 0 800 600" class="editor-canvas" @click="handleBackgroundClick">
      <!-- Grid background for reference -->
      <defs>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" stroke-width="1" />
        </pattern>
      </defs>
      <rect width="800" height="600" fill="url(#grid)" />

      <!-- Shapes -->
      <g v-for="shape in shapes" :key="shape.id">
        <rect
          :x="shape.x"
          :y="shape.y"
          :width="shape.width"
          :height="shape.height"
          :fill="shape.fill"
          :transform="getShapeTransform(shape)"
          :class="{ selected: selectedIds.includes(shape.id) }"
          class="shape"
          @click="handleShapeClick(shape.id, $event)"
        />
      </g>

      <!-- Selection UI (Phase 4: Rotates with selection) -->
      <g
        v-if="selectionBounds"
        class="selection-ui"
        :transform="selectionRotation !== 0 ? `rotate(${(selectionRotation * 180) / Math.PI} ${selectionBounds.x + selectionBounds.width / 2} ${selectionBounds.y + selectionBounds.height / 2})` : ''"
      >
        <!-- Bounding box outline - draggable to move selection -->
        <rect
          :x="selectionBounds.x"
          :y="selectionBounds.y"
          :width="selectionBounds.width"
          :height="selectionBounds.height"
          fill="transparent"
          stroke="#3b82f6"
          stroke-width="2"
          stroke-dasharray="4 4"
          class="selection-box"
          :class="{ dragging: isDragging }"
          @mousedown="handleDragStart"
        />

        <!-- Rotation handle -->
        <g v-if="rotationHandlePos" class="rotation-handle-group">
          <!-- Line to handle -->
          <line
            :x1="selectionBounds.x + selectionBounds.width / 2"
            :y1="selectionBounds.y"
            :x2="rotationHandlePos.x"
            :y2="rotationHandlePos.y"
            stroke="#3b82f6"
            stroke-width="2"
            stroke-dasharray="2 2"
          />

          <!-- Rotation handle circle -->
          <circle
            :cx="rotationHandlePos.x"
            :cy="rotationHandlePos.y"
            r="8"
            fill="white"
            stroke="#3b82f6"
            stroke-width="2"
            class="rotation-handle"
            :class="{ rotating: isRotating }"
            @mousedown="handleRotateStart"
          />
        </g>

        <!-- Phase 5: Scale handles -->
        <!-- Corner handles -->
        <rect
          :x="selectionBounds.x - 4"
          :y="selectionBounds.y - 4"
          width="8"
          height="8"
          fill="white"
          stroke="#3b82f6"
          stroke-width="2"
          class="scale-handle nwse-resize"
          data-handle="nw"
          @mousedown="handleScaleStart($event, 'nw')"
        />
        <rect
          :x="selectionBounds.x + selectionBounds.width - 4"
          :y="selectionBounds.y - 4"
          width="8"
          height="8"
          fill="white"
          stroke="#3b82f6"
          stroke-width="2"
          class="scale-handle nesw-resize"
          data-handle="ne"
          @mousedown="handleScaleStart($event, 'ne')"
        />
        <rect
          :x="selectionBounds.x + selectionBounds.width - 4"
          :y="selectionBounds.y + selectionBounds.height - 4"
          width="8"
          height="8"
          fill="white"
          stroke="#3b82f6"
          stroke-width="2"
          class="scale-handle nwse-resize"
          data-handle="se"
          @mousedown="handleScaleStart($event, 'se')"
        />
        <rect
          :x="selectionBounds.x - 4"
          :y="selectionBounds.y + selectionBounds.height - 4"
          width="8"
          height="8"
          fill="white"
          stroke="#3b82f6"
          stroke-width="2"
          class="scale-handle nesw-resize"
          data-handle="sw"
          @mousedown="handleScaleStart($event, 'sw')"
        />

        <!-- Edge handles -->
        <rect
          :x="selectionBounds.x + selectionBounds.width / 2 - 4"
          :y="selectionBounds.y - 4"
          width="8"
          height="8"
          fill="white"
          stroke="#3b82f6"
          stroke-width="2"
          class="scale-handle ns-resize"
          data-handle="n"
          @mousedown="handleScaleStart($event, 'n')"
        />
        <rect
          :x="selectionBounds.x + selectionBounds.width - 4"
          :y="selectionBounds.y + selectionBounds.height / 2 - 4"
          width="8"
          height="8"
          fill="white"
          stroke="#3b82f6"
          stroke-width="2"
          class="scale-handle ew-resize"
          data-handle="e"
          @mousedown="handleScaleStart($event, 'e')"
        />
        <rect
          :x="selectionBounds.x + selectionBounds.width / 2 - 4"
          :y="selectionBounds.y + selectionBounds.height - 4"
          width="8"
          height="8"
          fill="white"
          stroke="#3b82f6"
          stroke-width="2"
          class="scale-handle ns-resize"
          data-handle="s"
          @mousedown="handleScaleStart($event, 's')"
        />
        <rect
          :x="selectionBounds.x - 4"
          :y="selectionBounds.y + selectionBounds.height / 2 - 4"
          width="8"
          height="8"
          fill="white"
          stroke="#3b82f6"
          stroke-width="2"
          class="scale-handle ew-resize"
          data-handle="w"
          @mousedown="handleScaleStart($event, 'w')"
        />
      </g>
    </svg>

    <!-- Debug info -->
    <div class="debug-info">
      <h3>Phase 5 Status</h3>
      <p><strong>Selected Count:</strong> {{ selectedIds.length }}</p>
      <p><strong>Selected IDs:</strong> {{ selectedIds.length > 0 ? selectedIds.join(", ") : "None" }}</p>
      <p><strong>Dragging:</strong> {{ isDragging ? "Yes" : "No" }}</p>
      <p><strong>Rotating:</strong> {{ isRotating ? "Yes" : "No" }}</p>
      <p><strong>Scaling:</strong> {{ isScaling ? "Yes" : "No" }}</p>
      <p v-if="selectedIds.length === 1 && selectedShape">
        <strong>Position:</strong> ({{ Math.round(selectedShape.x) }}, {{ Math.round(selectedShape.y) }})
      </p>
      <p v-if="selectedIds.length === 1 && selectedShape">
        <strong>Size:</strong> {{ selectedShape.width }} × {{ selectedShape.height }}
      </p>
      <p v-if="selectedIds.length === 1 && selectedShape">
        <strong>Rotation:</strong> {{ ((selectedShape.rotation * 180) / Math.PI).toFixed(1) }}°
      </p>
      <p v-if="selectionBounds">
        <strong>Union BBox:</strong> ({{ Math.round(selectionBounds.x) }}, {{ Math.round(selectionBounds.y) }})
        {{ Math.round(selectionBounds.width) }} × {{ Math.round(selectionBounds.height) }}
      </p>
      <p class="hint">
        <strong>Tip:</strong> Click to select, Shift+Click to multi-select, Drag selection box to move, Drag rotation
        handle to rotate, Drag scale handles to resize
      </p>
    </div>
  </div>
</template>

<style scoped>
.debug-editor {
  padding: 20px;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

h2 {
  margin: 0 0 16px 0;
  font-size: 20px;
  color: #1f2937;
}

.editor-canvas {
  border: 2px solid #d1d5db;
  background: white;
  cursor: default;
}

.shape {
  cursor: pointer;
  transition: opacity 0.2s;
}

.shape:hover {
  opacity: 0.8;
}

.shape.selected {
  stroke: #3b82f6;
  stroke-width: 2;
}

.selection-box {
  pointer-events: all;
  cursor: move;
}

.selection-box.dragging {
  cursor: grabbing;
  stroke-width: 3;
}

.rotation-handle {
  cursor: grab;
}

.rotation-handle:active,
.rotation-handle.rotating {
  cursor: grabbing;
  stroke-width: 3;
}

.scale-handle {
  cursor: pointer;
}

.scale-handle.nwse-resize {
  cursor: nwse-resize;
}

.scale-handle.nesw-resize {
  cursor: nesw-resize;
}

.scale-handle.ns-resize {
  cursor: ns-resize;
}

.scale-handle.ew-resize {
  cursor: ew-resize;
}

.scale-handle:hover {
  stroke-width: 3;
}

.debug-info {
  margin-top: 20px;
  padding: 16px;
  background: #f3f4f6;
  border-radius: 8px;
  font-size: 14px;
}

.debug-info h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #1f2937;
}

.debug-info p {
  margin: 4px 0;
  color: #4b5563;
}

.debug-info strong {
  color: #1f2937;
}

.debug-info .hint {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #d1d5db;
  color: #6b7280;
  font-style: italic;
}
</style>
