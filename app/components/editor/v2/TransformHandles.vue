<template>
  <g
    v-if="selectionBounds"
    class="selection-ui"
    :transform="selectionTransform"
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
    <RotationHandle :selection-bounds="selectionBounds" />

    <!-- Scale handles -->
    <ScaleHandles :selection-bounds="selectionBounds" />
  </g>
</template>

<script setup lang="ts">
import { useEditorBounds } from "~/composables/editor/useEditorBounds"
import { useEditorMove } from "~/composables/editor/useEditorMove"
import RotationHandle from "./RotationHandle.vue"
import ScaleHandles from "./ScaleHandles.vue"

const bounds = useEditorBounds()
const move = useEditorMove()

const { selectionBounds, selectionRotation } = bounds
const { isDragging, startDrag } = move

/**
 * Transform for the entire selection UI
 * Rotates all handles around the selection center
 */
const selectionTransform = computed(() => {
  if (!selectionBounds.value || selectionRotation.value === 0) return ""

  const centerX = selectionBounds.value.x + selectionBounds.value.width / 2
  const centerY = selectionBounds.value.y + selectionBounds.value.height / 2
  const angleDeg = (selectionRotation.value * 180) / Math.PI

  return `rotate(${angleDeg} ${centerX} ${centerY})`
})

function handleDragStart(event: MouseEvent) {
  startDrag(event)
}
</script>

<style scoped>
.selection-box {
  pointer-events: all;
  cursor: move;
}

.selection-box:hover {
  stroke-width: 3;
}

.selection-box.dragging {
  cursor: grabbing;
  stroke-width: 3;
}
</style>
