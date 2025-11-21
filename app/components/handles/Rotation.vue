<template>
  <div v-if="showHandles" class="rotation-handles" :style="containerStyle" @mousemove="handleMouseMove">
    <!-- Corner rotation handles -->
    <div
      v-for="corner in corners"
      :key="corner.position"
      class="rotation-handle"
      :class="{ active: isDragging && activeCorner === corner.position }"
      :style="corner.style"
      @mousedown.stop="startRotation($event, corner.position)"
    >
      <div class="handle-icon">
        <svg width="20" height="20" viewBox="0 0 20 20">
          <path
            d="M10 2 L10 6 M10 14 L10 18 M2 10 L6 10 M14 10 L18 10"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </div>
    </div>

    <!-- Center indicator (rotation origin) -->
    <div class="rotation-center" :style="centerStyle">
      <div class="center-dot" />
    </div>

    <!-- Angle display -->
    <div v-if="isDragging" class="angle-display" :style="angleDisplayStyle">
      <div class="angle-value">{{ Math.round(currentAngle) }}°</div>
      <div v-if="modifierKeys.isShiftPressed" class="angle-hint">15° snap</div>
      <div v-else class="angle-hint">45° snap</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const rendererStore = useRendererStore()
const annotationStore = useAnnotationStore()
const modifierKeys = useModifierKeys()!

// Use shared corner calculation logic
const { screenCorners, center } = useRotatedPdfCorners()

const showHandles = ref(false)
const isDragging = ref(false)
const activeCorner = ref<string | null>(null)
const currentAngle = ref(0)
const startAngle = ref(0)

// Set up event listeners with auto-cleanup
useEventListener(window, "mousemove", handleDrag, { passive: false })
useEventListener(window, "mouseup", stopRotation)

// Show handles when rotate tool is active
watch(
  () => annotationStore.activeTool,
  (tool) => {
    showHandles.value = tool === "rotate"
    if (!showHandles.value) {
      isDragging.value = false
    }
  }
)

// Container positioning - no longer used as container, just for reference
const containerStyle = computed(() => {
  return {
    position: 'fixed' as const,
    inset: '0',
    pointerEvents: 'none' as const
  }
})

// Map corner positions to styled elements
const corners = computed(() => {
  const positions = ["top-left", "top-right", "bottom-right", "bottom-left"] as const

  return screenCorners.value.map((corner, index) => ({
    position: positions[index]!,
    style: {
      position: 'fixed' as const,
      left: `${corner.x}px`,
      top: `${corner.y}px`,
      transform: 'translate(-50%, -50%)'
    }
  }))
})

// Center dot position
const centerStyle = computed(() => {
  const centerPos = center.value
  return {
    position: 'fixed' as const,
    left: `${centerPos.x}px`,
    top: `${centerPos.y}px`,
    transform: "translate(-50%, -50%)"
  }
})

// Angle display position (at center)
const angleDisplayStyle = computed(() => {
  const centerPos = center.value
  return {
    position: 'fixed' as const,
    left: `${centerPos.x}px`,
    top: `${centerPos.y}px`,
    transform: "translate(-50%, -50%)"
  }
})

// Calculate angle from center to point
function calculateAngle(x: number, y: number): number {
  const centerPos = center.value

  const deltaX = x - centerPos.x
  const deltaY = y - centerPos.y

  let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90
  if (angle < 0) angle += 360

  return angle
}

// Start rotation
function startRotation(e: MouseEvent, corner: string) {
  e.preventDefault()
  isDragging.value = true
  activeCorner.value = corner

  startAngle.value = calculateAngle(e.clientX, e.clientY) - rendererStore.getRotation
  currentAngle.value = rendererStore.getRotation
}

// Handle drag
function handleDrag(e: MouseEvent) {
  if (!isDragging.value) return

  let angle = calculateAngle(e.clientX, e.clientY) - startAngle.value

  // Normalize to 0-360
  angle = ((angle % 360) + 360) % 360

  // Snap behavior based on modifiers
  // Shift: Snap to 15° increments (tighter snapping)
  // No modifier: Snap to 45° increments (common angles)
  const snapThreshold = 5

  if (modifierKeys.isShiftPressed) {
    // Shift pressed: 15° increments (0, 15, 30, 45, 60, 75, 90, ...)
    const snapInterval = 15
    const nearestSnap = Math.round(angle / snapInterval) * snapInterval
    const diff = Math.abs(angle - nearestSnap)

    if (diff < snapThreshold) {
      angle = nearestSnap
    }
  } else {
    // No modifier: 45° increments (0, 45, 90, 135, 180, 225, 270, 315)
    const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315]

    for (const snapAngle of snapAngles) {
      const diff = Math.abs(angle - snapAngle)
      if (diff < snapThreshold || diff > 360 - snapThreshold) {
        angle = snapAngle
        break
      }
    }
  }

  currentAngle.value = angle
  rendererStore.setRotation(angle)
}

// Stop rotation
function stopRotation() {
  isDragging.value = false
  activeCorner.value = null
}

// Mouse move to show handles
function handleMouseMove(_e: MouseEvent) {
  // Already handled by container visibility
}
</script>

<style scoped>
.rotation-handles {
  position: fixed;
  pointer-events: none;
  z-index: 900;
}

.rotation-handle {
  position: absolute;
  width: 32px;
  height: 32px;
  pointer-events: all;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.rotation-handles:hover .rotation-handle {
  opacity: 1;
}

.rotation-handle:hover {
  opacity: 1 !important;
}

.rotation-handle.active {
  cursor: grabbing;
  opacity: 1 !important;
}

.handle-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1.5px solid #667eea;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  color: #667eea;
  transition: all 0.15s ease;
}

.rotation-handle:hover .handle-icon {
  background: #667eea;
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  transform: scale(1.1);
}

.rotation-handle.active .handle-icon {
  background: #667eea;
  color: white;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.6);
  transform: scale(1.15);
}

.rotation-center {
  position: absolute;
  pointer-events: none;
}

.center-dot {
  width: 8px;
  height: 8px;
  background: #667eea;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.angle-display {
  position: absolute;
  pointer-events: none;
  background: #667eea;
  color: white;
  padding: 8px 14px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(102, 126, 234, 0.4);
  white-space: nowrap;
  margin-top: -50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.angle-value {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

.angle-hint {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.8;
  line-height: 1;
}
</style>
