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

// Calculate screen positions of corners
const screenCorners = computed(() => {
  const width = rendererStore.getCanvasSize.width
  const height = rendererStore.getCanvasSize.height
  const rotation = rendererStore.rotation
  const scale = rendererStore.getScale

  if (!width || !height) return []

  // Get the canvas element's actual transformed position
  const canvas = document.querySelector('.pdf-canvas') as HTMLCanvasElement
  if (!canvas) return []

  const rect = canvas.getBoundingClientRect()

  // Center of the transformed canvas
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  // Half dimensions (scaled)
  const halfWidth = (width * scale) / 2
  const halfHeight = (height * scale) / 2

  const rotRad = rotation * (Math.PI / 180)

  // Calculate corners relative to center, accounting for rotation
  const corners = [
    { dx: -halfWidth, dy: -halfHeight },  // top-left
    { dx: halfWidth, dy: -halfHeight },   // top-right
    { dx: halfWidth, dy: halfHeight },    // bottom-right
    { dx: -halfWidth, dy: halfHeight },   // bottom-left
  ]

  return corners.map(({ dx, dy }) => {
    // Rotate the offset around center
    const rotatedX = dx * Math.cos(rotRad) - dy * Math.sin(rotRad)
    const rotatedY = dx * Math.sin(rotRad) + dy * Math.cos(rotRad)

    return {
      x: centerX + rotatedX,
      y: centerY + rotatedY
    }
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
  const canvas = document.querySelector('.pdf-canvas') as HTMLCanvasElement
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const centerScreenX = rect.left + rect.width / 2
  const centerScreenY = rect.top + rect.height / 2

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
  const canvas = document.querySelector('.pdf-canvas') as HTMLCanvasElement
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const centerScreenX = rect.left + rect.width / 2
  const centerScreenY = rect.top + rect.height / 2

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
