<template>
  <g class="scale-handles">
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
      @mousedown="handleScaleStart($event, 'w')"
    />
  </g>
</template>

<script setup lang="ts">
import type { Bounds, ScaleHandle } from "~/types/editor"
import { useEditorScale } from "~/composables/editor/useEditorScale"

const props = defineProps<{
  selectionBounds: Bounds
}>()

const scale = useEditorScale()
const { startScale } = scale

function handleScaleStart(event: MouseEvent, handle: ScaleHandle) {
  startScale(event, handle)
}
</script>

<style scoped>
.scale-handle {
  cursor: move;
}

.scale-handle:hover {
  stroke-width: 3;
}

.scale-handle:active {
  cursor: grabbing;
}
</style>
