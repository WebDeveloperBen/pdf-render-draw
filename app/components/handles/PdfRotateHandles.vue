<template>
  <Teleport to="body">
    <div v-if="showHandles">
      <div
        v-for="(corner, index) in screenCorners"
        :key="`rotate-${index}`"
        class="rotate-handle"
        :style="{
          left: `${corner.x}px`,
          top: `${corner.y}px`,
          background: isDragging && activeCorner === index ? colorBlueDarker : 'white',
          border: `3px solid ${COLORS.SELECTION_BLUE}`,
        }"
        @mousedown.stop="startRotate($event, index)"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { COLORS } from '~/constants/ui'
import { debugLog } from '~/utils/debug'

const annotationStore = useAnnotationStore()
const rendererStore = useRendererStore()

const colorBlueDarker = COLORS.SELECTION_BLUE_DARKER

// Show handles when rotate tool is active
const showHandles = computed(() => annotationStore.activeTool === 'rotate')

const pdfWidth = computed(() => rendererStore.getCanvasSize.width)
const pdfHeight = computed(() => rendererStore.getCanvasSize.height)

// Calculate screen positions of corners
const screenCorners = computed(() => {
  const w = pdfWidth.value
  const h = pdfHeight.value
  const scale = rendererStore.getScale
  const rotation = rendererStore.rotation * (Math.PI / 180)
  const centerX = w / 2
  const centerY = h / 2

  // Original corners in PDF space
  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ]

  // Transform each corner: rotate, then scale, then translate
  return corners.map(corner => {
    // Rotate around center
    const dx = corner.x - centerX
    const dy = corner.y - centerY
    const rotatedX = centerX + dx * Math.cos(rotation) - dy * Math.sin(rotation)
    const rotatedY = centerY + dx * Math.sin(rotation) + dy * Math.cos(rotation)

    // Apply scale and get screen position
    // Note: This assumes the PDF viewer is at 0,0 - adjust if needed
    const screenX = rotatedX * scale + rendererStore.canvasPos.scrollLeft
    const screenY = rotatedY * scale + rendererStore.canvasPos.scrollTop

    return { x: screenX, y: screenY }
  })
})

const isDragging = ref(false)
const activeCorner = ref<number | null>(null)
const startMouseAngle = ref(0)
const startRotation = ref(0)
const lastRotation = ref(0)
const lastMouseAngle = ref(0)
const accumulatedRotation = ref(0)

function startRotate(e: MouseEvent, cornerIndex: number) {
  isDragging.value = true
  activeCorner.value = cornerIndex
  startRotation.value = rendererStore.rotation
  lastRotation.value = rendererStore.rotation
  accumulatedRotation.value = 0

  // Calculate initial angle from center to mouse in screen space
  const scale = rendererStore.getScale
  const centerScreenX = (pdfWidth.value / 2) * scale + rendererStore.canvasPos.scrollLeft
  const centerScreenY = (pdfHeight.value / 2) * scale + rendererStore.canvasPos.scrollTop

  const initialAngle = Math.atan2(e.clientY - centerScreenY, e.clientX - centerScreenX)
  startMouseAngle.value = initialAngle
  lastMouseAngle.value = initialAngle

  debugLog('PdfRotateHandles', 'Start rotate:', { cornerIndex, startAngle: initialAngle * (180 / Math.PI) })

  window.addEventListener('mousemove', handleRotate)
  window.addEventListener('mouseup', endRotate)

  e.preventDefault()
  e.stopPropagation()
}

function handleRotate(e: MouseEvent) {
  if (!isDragging.value) return

  // Calculate current angle from center to mouse in screen space
  const scale = rendererStore.getScale
  const centerScreenX = (pdfWidth.value / 2) * scale + rendererStore.canvasPos.scrollLeft
  const centerScreenY = (pdfHeight.value / 2) * scale + rendererStore.canvasPos.scrollTop

  const currentMouseAngle = Math.atan2(e.clientY - centerScreenY, e.clientX - centerScreenX)

  // Calculate the delta from the last angle (not from start)
  let deltaRadians = currentMouseAngle - lastMouseAngle.value

  // Handle wraparound: if the delta is too large, we crossed the ±π boundary
  if (deltaRadians > Math.PI) {
    deltaRadians -= 2 * Math.PI
  } else if (deltaRadians < -Math.PI) {
    deltaRadians += 2 * Math.PI
  }

  // Accumulate the rotation delta
  accumulatedRotation.value += deltaRadians
  lastMouseAngle.value = currentMouseAngle

  // Convert accumulated rotation to degrees
  const deltaDegrees = accumulatedRotation.value * (180 / Math.PI)

  // Calculate new rotation
  let newRotation = startRotation.value + deltaDegrees

  // Snap to 15-degree increments if Shift is held
  if (e.shiftKey) {
    newRotation = Math.round(newRotation / 15) * 15
  }

  // Smooth the rotation to avoid jitter
  const smoothedRotation = lastRotation.value * 0.2 + newRotation * 0.8
  lastRotation.value = smoothedRotation

  // Update rotation in store
  rendererStore.setRotation(smoothedRotation)

  debugLog('PdfRotateHandles', 'Rotating:', {
    deltaDegrees: deltaDegrees.toFixed(1),
    newRotation: smoothedRotation.toFixed(1)
  })
}

function endRotate() {
  debugLog('PdfRotateHandles', 'End rotate, final rotation:', rendererStore.rotation)

  isDragging.value = false
  activeCorner.value = null

  window.removeEventListener('mousemove', handleRotate)
  window.removeEventListener('mouseup', endRotate)
}

// Cleanup on unmount
onUnmounted(() => {
  window.removeEventListener('mousemove', handleRotate)
  window.removeEventListener('mouseup', endRotate)
})
</script>

<style scoped>
.rotate-handle {
  position: fixed;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  cursor: grab;
  z-index: 20;
  pointer-events: all;
  /* Center the handle on the calculated position */
  transform: translate(-50%, -50%);
  transition: transform 0.15s, background 0.15s;
}

.rotate-handle:hover {
  transform: translate(-50%, -50%) scale(1.2);
  background: v-bind(colorBlueDarker) !important;
}

.rotate-handle:active {
  cursor: grabbing;
}
</style>
