<template>
  <div
    v-if="isVisible"
    class="rotation-wheel-overlay"
    @mousedown.stop="handleOverlayClick"
  >
    <div
      class="rotation-wheel"
      :style="wheelStyle"
    >
      <!-- SVG for smooth graphics -->
      <svg
        width="180"
        height="180"
        viewBox="0 0 180 180"
        class="wheel-svg"
        @mousedown.stop="startDrag"
      >
        <!-- Outer circle track -->
        <circle
          cx="90"
          cy="90"
          r="70"
          fill="none"
          stroke="rgba(0, 0, 0, 0.06)"
          stroke-width="1.5"
        />

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
          :cx="90 + 70 * Math.sin((angle * Math.PI) / 180)"
          :cy="90 - 70 * Math.cos((angle * Math.PI) / 180)"
          :r="isNearSnap(angle) ? 4 : 2"
          :fill="isNearSnap(angle) ? '#667eea' : 'rgba(0, 0, 0, 0.15)'"
          class="snap-dot"
          :class="{ active: isNearSnap(angle) }"
        />

        <!-- Reference line (0° north) -->
        <line
          x1="90"
          y1="25"
          x2="90"
          y2="35"
          stroke="rgba(0, 0, 0, 0.2)"
          stroke-width="1.5"
          stroke-linecap="round"
        />

        <!-- Rotation handle -->
        <g :transform="`rotate(${currentRotation} 90 90)`">
          <!-- Handle line -->
          <line
            x1="90"
            y1="90"
            x2="90"
            y2="25"
            stroke="#667eea"
            stroke-width="2"
            stroke-linecap="round"
          />
          <!-- Handle dot -->
          <circle
            cx="90"
            cy="25"
            r="8"
            fill="white"
            stroke="#667eea"
            stroke-width="2.5"
            class="handle-dot"
          />
        </g>

        <!-- Center point -->
        <circle
          cx="90"
          cy="90"
          r="3"
          fill="rgba(0, 0, 0, 0.2)"
        />
      </svg>

      <!-- Angle input -->
      <div class="angle-input-container">
        <input
          v-model.number="angleInput"
          type="number"
          min="0"
          max="360"
          class="angle-input"
          @input="handleAngleInput"
          @keydown.enter="hideWheel"
          @keydown.esc="hideWheel"
        >
        <span class="angle-unit">°</span>
      </div>

      <!-- Hint text -->
      <div class="hint-text">
        {{ snapHint }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const rendererStore = useRendererStore()
const annotationStore = useAnnotationStore()

const isVisible = ref(false)
const position = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const currentRotation = ref(0)
const angleInput = ref(0)

// Set up event listeners with auto-cleanup
useEventListener(window, 'mousemove', updateRotation, { passive: false })
useEventListener(window, 'mouseup', stopDrag)

// Snap angles (common increments)
const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315]
const snapThreshold = 5 // degrees

const wheelStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
}))

// Check if current angle is near a snap point
function isNearSnap(snapAngle: number): boolean {
  const diff = Math.abs(currentRotation.value - snapAngle)
  return diff < snapThreshold || diff > (360 - snapThreshold)
}

// Snap hint text
const snapHint = computed(() => {
  const nearSnap = snapAngles.find(angle => isNearSnap(angle))
  if (nearSnap !== undefined) {
    return `Snap to ${nearSnap}°`
  }
  return 'Drag to rotate'
})

// Generate SVG arc path for rotation visualization
function getArcPath(): string {
  const radius = 70
  const startAngle = 0
  const endAngle = currentRotation.value

  const start = polarToCartesian(90, 90, radius, endAngle)
  const end = polarToCartesian(90, 90, radius, startAngle)

  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(' ')
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
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

// Apply snap if near snap angle
function applySnap(angle: number): number {
  for (const snapAngle of snapAngles) {
    const diff = Math.abs(angle - snapAngle)
    if (diff < snapThreshold || diff > (360 - snapThreshold)) {
      return snapAngle
    }
  }
  return angle
}

// Start dragging
function startDrag(e: MouseEvent) {
  e.preventDefault()
  isDragging.value = true
  updateRotation(e)
}

// Update rotation while dragging
function updateRotation(e: MouseEvent) {
  if (!isDragging.value && e.type === 'mousemove') return

  let angle = calculateAngle(e.clientX, e.clientY)

  // Apply snap
  angle = applySnap(angle)

  currentRotation.value = angle
  angleInput.value = Math.round(angle)
  rendererStore.setRotation(angle)
}

// Stop dragging
function stopDrag() {
  isDragging.value = false
}

// Handle manual angle input
function handleAngleInput() {
  let angle = angleInput.value
  if (angle < 0) angle = 0
  if (angle > 360) angle = 360

  currentRotation.value = angle
  rendererStore.setRotation(angle)
}

// Click outside to close
function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    hideWheel()
    annotationStore.setActiveTool('selection')
  }
}

// Expose methods for parent to call
defineExpose({
  showWheel,
  hideWheel,
})

// Event listeners auto-cleanup via useEventListener
</script>

<style scoped>
.rotation-wheel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.rotation-wheel {
  position: fixed;
  transform: translate(-50%, -50%);
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  animation: scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
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
  cursor: grab;
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.12));
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 50%;
  transition: all 0.2s ease;
}

.wheel-svg:active {
  cursor: grabbing;
  filter: drop-shadow(0 12px 32px rgba(0, 0, 0, 0.18));
}

.rotation-arc {
  transition: d 0.05s ease-out;
}

.snap-dot {
  transition: all 0.15s ease;
}

.snap-dot.active {
  animation: snapPulse 0.3s ease;
}

@keyframes snapPulse {
  0%, 100% {
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

.wheel-svg:active .handle-dot {
  cursor: grabbing;
  filter: drop-shadow(0 4px 12px rgba(102, 126, 234, 0.5));
}

.angle-input-container {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  padding: 8px 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.angle-input {
  width: 60px;
  border: none;
  background: transparent;
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  text-align: right;
  outline: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.angle-input::-webkit-inner-spin-button,
.angle-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.angle-unit {
  font-size: 16px;
  font-weight: 500;
  color: #718096;
  margin-left: 4px;
}

.hint-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  padding: 6px 14px;
  background: rgba(102, 126, 234, 0.9);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  animation: hintFade 0.3s ease;
}

@keyframes hintFade {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
