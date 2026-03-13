<script setup lang="ts">
const props = defineProps<{
  selectionBounds: Bounds
}>()

const rotation = useEditorRotation()
const { isRotating, startRotation } = rotation
const viewportStore = useViewportStore()

const inverseScale = computed(() => viewportStore.getInverseScale)
const HANDLE_DISTANCE_PX = 30
const HANDLE_RADIUS_PX = 8
const STROKE_PX = 2

const scaledDistance = computed(() => HANDLE_DISTANCE_PX * inverseScale.value)
const scaledRadius = computed(() => HANDLE_RADIUS_PX * inverseScale.value)
const scaledStroke = computed(() => STROKE_PX * inverseScale.value)

const rotationHandlePos = computed<Point | null>(() => {
  if (!props.selectionBounds) return null

  return {
    x: props.selectionBounds.x + props.selectionBounds.width / 2,
    y: props.selectionBounds.y - scaledDistance.value
  }
})

function handleRotateStart(event: EditorInputEvent) {
  startRotation(event)
}
</script>
<template>
  <g v-if="rotationHandlePos" class="rotation-handle-group">
    <!-- Line to handle -->
    <line
      :x1="selectionBounds.x + selectionBounds.width / 2"
      :y1="selectionBounds.y"
      :x2="rotationHandlePos.x"
      :y2="rotationHandlePos.y"
      stroke="#3b82f6"
      :stroke-width="scaledStroke"
      :stroke-dasharray="`${2 * inverseScale} ${2 * inverseScale}`"
    />

    <!-- Rotation handle circle -->
    <circle
      :cx="rotationHandlePos.x"
      :cy="rotationHandlePos.y"
      :r="scaledRadius"
      fill="white"
      stroke="#3b82f6"
      :stroke-width="scaledStroke"
      class="rotation-handle"
      :class="{ rotating: isRotating }"
      @pointerdown="handleRotateStart"
    />
  </g>
</template>

<style scoped>
.rotation-handle {
  cursor: move;
}

.rotation-handle:active,
.rotation-handle.rotating {
  cursor: grabbing;
}
</style>
