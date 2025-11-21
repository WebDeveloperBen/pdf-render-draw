<script setup lang="ts">
const rendererStore = useRendererStore()
const annotationStore = useAnnotationStore()

const isVisible = ref(false)
const position = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const currentRotation = ref(0)
const angleInput = ref(0)
const startDragAngle = ref(0) // Track the angle offset when drag starts
const targetRotation = ref(0) // Target angle for smooth interpolation

// Set up event listeners with auto-cleanup
useEventListener(window, "mousemove", updateRotation, { passive: false })
useEventListener(window, "mouseup", stopDrag)

// Snap angles (common increments)
const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315]
const snapThreshold = 5 // degrees

const wheelStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`
}))

// Check if current angle is near a snap point
function isNearSnap(snapAngle: number): boolean {
  const diff = Math.abs(currentRotation.value - snapAngle)
  return diff < snapThreshold || diff > 360 - snapThreshold
}

// Snap hint text
const snapHint = computed(() => {
  const nearSnap = snapAngles.find((angle) => isNearSnap(angle))
  if (nearSnap !== undefined) {
    return `Snap to ${nearSnap}°`
  }
  return "Drag to rotate"
})

// Generate SVG arc path for rotation visualization
function getArcPath(): string {
  const radius = 28
  const startAngle = 0
  const endAngle = currentRotation.value

  const start = polarToCartesian(35, 35, radius, endAngle)
  const end = polarToCartesian(35, 35, radius, startAngle)

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"

  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ")
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  }
}

// Show wheel at position
function showWheel(x: number, y: number) {
  position.value = { x, y }
  currentRotation.value = rendererStore.getRotation
  angleInput.value = Math.round(rendererStore.getRotation)
  isVisible.value = true
}

// Hide wheel
function hideWheel() {
  isVisible.value = false
  isDragging.value = false
}

// Calculate angle from center to mouse position
function calculateAngle(mouseX: number, mouseY: number): number {
  const centerX = position.value.x
  const centerY = position.value.y

  const deltaX = mouseX - centerX
  const deltaY = mouseY - centerY

  // atan2 returns angle in radians, convert to degrees
  // Subtract 90 to make 0° point upward (north)
  let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90

  // Normalize to 0-360
  if (angle < 0) angle += 360

  return angle
}

// Calculate shortest angle difference (handles 0/360 wrap)
function angleDifference(target: number, current: number): number {
  let diff = target - current
  // Normalize to -180 to 180
  while (diff > 180) diff -= 360
  while (diff < -180) diff += 360
  return diff
}

// Apply snap if near snap angle
function applySnap(angle: number): number {
  for (const snapAngle of snapAngles) {
    const diff = Math.abs(angle - snapAngle)
    if (diff < snapThreshold || diff > 360 - snapThreshold) {
      return snapAngle
    }
  }
  return angle
}

// Start dragging
function startDrag(e: MouseEvent) {
  // Only respond to left click
  if (e.button !== 0) return

  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true

  // Calculate the angle offset when starting drag
  // This prevents the rotation from jumping to the cursor position
  const clickAngle = calculateAngle(e.clientX, e.clientY)
  startDragAngle.value = clickAngle - currentRotation.value
}

// Update rotation while dragging
function updateRotation(e: MouseEvent) {
  if (!isDragging.value && e.type === "mousemove") return

  // Calculate angle relative to the starting drag offset
  let angle = calculateAngle(e.clientX, e.clientY) - startDragAngle.value

  // Normalize to 0-360
  angle = ((angle % 360) + 360) % 360

  // Apply snap
  angle = applySnap(angle)

  // Direct assignment - no damping, just proper angle wrapping
  currentRotation.value = angle
  angleInput.value = Math.round(angle)
  rendererStore.setRotation(angle)
}

// Stop dragging
function stopDrag() {
  isDragging.value = false
}

// Expose methods for parent to call
defineExpose({
  showWheel,
  hideWheel
})

// Event listeners auto-cleanup via useEventListener
</script>
<template>
  <div v-if="isVisible" class="rotation-wheel" :style="wheelStyle">
    <!-- SVG for smooth graphics -->
    <svg width="70" height="70" viewBox="0 0 70 70" class="wheel-svg">
        <!-- Outer circle track -->
        <circle cx="35" cy="35" r="28" fill="none" stroke="rgba(0, 0, 0, 0.06)" stroke-width="1" />

        <!-- Rotation arc (shows swept angle) -->
        <path
          v-if="currentRotation > 0"
          :d="getArcPath()"
          fill="none"
          stroke="url(#arcGradient)"
          stroke-width="3"
          stroke-linecap="round"
          class="rotation-arc"
        />

        <!-- Gradient for arc -->
        <defs>
          <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color: #667eea; stop-opacity: 1" />
            <stop offset="100%" style="stop-color: #764ba2; stop-opacity: 1" />
          </linearGradient>
        </defs>

        <!-- Snap indicators (subtle dots at key angles) -->
        <circle
          v-for="angle in snapAngles"
          :key="angle"
          :cx="35 + 28 * Math.sin((angle * Math.PI) / 180)"
          :cy="35 - 28 * Math.cos((angle * Math.PI) / 180)"
          :r="isNearSnap(angle) ? 2 : 1"
          :fill="isNearSnap(angle) ? '#667eea' : 'rgba(0, 0, 0, 0.15)'"
          class="snap-dot"
          :class="{ active: isNearSnap(angle) }"
        />

        <!-- Reference line (0° north) -->
        <line x1="35" y1="10" x2="35" y2="14" stroke="rgba(0, 0, 0, 0.2)" stroke-width="1" stroke-linecap="round" />

        <!-- Rotation handle -->
        <g :transform="`rotate(${currentRotation} 35 35)`">
          <!-- Handle line -->
          <line x1="35" y1="35" x2="35" y2="10" stroke="#667eea" stroke-width="1.5" stroke-linecap="round" />
          <!-- Handle dot - click this to drag -->
          <circle cx="35" cy="10" r="4" fill="white" stroke="#667eea" stroke-width="2" class="handle-dot" @mousedown.stop="startDrag" />
        </g>

        <!-- Center point -->
        <circle cx="35" cy="35" r="1.5" fill="rgba(0, 0, 0, 0.2)" />

        <!-- Angle text in center -->
        <text
          x="35"
          y="35"
          text-anchor="middle"
          dominant-baseline="middle"
          class="angle-text"
          fill="#667eea"
          font-size="10"
          font-weight="600"
        >
          {{ Math.round(currentRotation) }}°
        </text>
      </svg>
  </div>
</template>

<style scoped>
.rotation-wheel {
  position: fixed;
  transform: translate(-50%, -50%);
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 1000;
  pointer-events: all;
  animation: scaleIn 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.wheel-svg {
  filter: drop-shadow(0 8px 32px rgba(0, 0, 0, 0.15)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(16px);
  border-radius: 50%;
  transition: all 0.15s ease;
  pointer-events: all;
}

.wheel-svg:hover {
  filter: drop-shadow(0 10px 36px rgba(0, 0, 0, 0.18)) drop-shadow(0 3px 10px rgba(0, 0, 0, 0.1));
}

/* Removed transitions for immediate, responsive feel */

.snap-dot {
  transition: all 0.15s ease;
}

.snap-dot.active {
  animation: snapPulse 0.3s ease;
}

@keyframes snapPulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.5);
  }
}

.handle-dot {
  cursor: grab;
  filter: drop-shadow(0 2px 6px rgba(102, 126, 234, 0.3));
  transition: all 0.15s ease;
}

.handle-dot:hover {
  filter: drop-shadow(0 3px 9px rgba(102, 126, 234, 0.4));
  r: 8;
}

.handle-dot:active {
  cursor: grabbing;
  filter: drop-shadow(0 4px 12px rgba(102, 126, 234, 0.5));
}

.angle-text {
  pointer-events: none;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
</style>
