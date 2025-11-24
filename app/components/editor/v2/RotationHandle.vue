<template>
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
</template>

<script setup lang="ts">
import type { Bounds, Point } from "~/types/editor"
import { useEditorRotation } from "~/composables/editor/useEditorRotation"

const props = defineProps<{
  selectionBounds: Bounds
}>()

const rotation = useEditorRotation()
const { isRotating, startRotation } = rotation

const rotationHandleDistance = 30

const rotationHandlePos = computed<Point | null>(() => {
  if (!props.selectionBounds) return null

  return {
    x: props.selectionBounds.x + props.selectionBounds.width / 2,
    y: props.selectionBounds.y - rotationHandleDistance
  }
})

function handleRotateStart(event: MouseEvent) {
  startRotation(event)
}
</script>

<style scoped>
.rotation-handle {
  cursor: move;
}

.rotation-handle:hover {
  r: 10;
  stroke-width: 3;
}

.rotation-handle:active,
.rotation-handle.rotating {
  cursor: grabbing;
  stroke-width: 3;
}
</style>
