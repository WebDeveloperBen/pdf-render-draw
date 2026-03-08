<script setup lang="ts">
defineProps<{
  selectionBounds: Bounds
}>()

const scale = useEditorScale()
const { startScale } = scale
const viewportStore = useViewportStore()

const inverseScale = computed(() => viewportStore.getInverseScale)
const handleSize = computed(() => 8 * inverseScale.value)
const handleOffset = computed(() => 4 * inverseScale.value)
const handleStroke = computed(() => 2 * inverseScale.value)

function handleScaleStart(event: MouseEvent, handle: ScaleHandle) {
  startScale(event, handle)
}
</script>
<template>
  <g class="scale-handles">
    <!-- Corner handles -->
    <rect
      :x="selectionBounds.x - handleOffset"
      :y="selectionBounds.y - handleOffset"
      :width="handleSize"
      :height="handleSize"
      fill="white"
      stroke="#3b82f6"
      :stroke-width="handleStroke"
      class="scale-handle nwse-resize"
      @mousedown="handleScaleStart($event, 'nw')"
    />
    <rect
      :x="selectionBounds.x + selectionBounds.width - handleOffset"
      :y="selectionBounds.y - handleOffset"
      :width="handleSize"
      :height="handleSize"
      fill="white"
      stroke="#3b82f6"
      :stroke-width="handleStroke"
      class="scale-handle nesw-resize"
      @mousedown="handleScaleStart($event, 'ne')"
    />
    <rect
      :x="selectionBounds.x + selectionBounds.width - handleOffset"
      :y="selectionBounds.y + selectionBounds.height - handleOffset"
      :width="handleSize"
      :height="handleSize"
      fill="white"
      stroke="#3b82f6"
      :stroke-width="handleStroke"
      class="scale-handle nwse-resize"
      @mousedown="handleScaleStart($event, 'se')"
    />
    <rect
      :x="selectionBounds.x - handleOffset"
      :y="selectionBounds.y + selectionBounds.height - handleOffset"
      :width="handleSize"
      :height="handleSize"
      fill="white"
      stroke="#3b82f6"
      :stroke-width="handleStroke"
      class="scale-handle nesw-resize"
      @mousedown="handleScaleStart($event, 'sw')"
    />

    <!-- Edge handles -->
    <rect
      :x="selectionBounds.x + selectionBounds.width / 2 - handleOffset"
      :y="selectionBounds.y - handleOffset"
      :width="handleSize"
      :height="handleSize"
      fill="white"
      stroke="#3b82f6"
      :stroke-width="handleStroke"
      class="scale-handle ns-resize"
      @mousedown="handleScaleStart($event, 'n')"
    />
    <rect
      :x="selectionBounds.x + selectionBounds.width - handleOffset"
      :y="selectionBounds.y + selectionBounds.height / 2 - handleOffset"
      :width="handleSize"
      :height="handleSize"
      fill="white"
      stroke="#3b82f6"
      :stroke-width="handleStroke"
      class="scale-handle ew-resize"
      @mousedown="handleScaleStart($event, 'e')"
    />
    <rect
      :x="selectionBounds.x + selectionBounds.width / 2 - handleOffset"
      :y="selectionBounds.y + selectionBounds.height - handleOffset"
      :width="handleSize"
      :height="handleSize"
      fill="white"
      stroke="#3b82f6"
      :stroke-width="handleStroke"
      class="scale-handle ns-resize"
      @mousedown="handleScaleStart($event, 's')"
    />
    <rect
      :x="selectionBounds.x - handleOffset"
      :y="selectionBounds.y + selectionBounds.height / 2 - handleOffset"
      :width="handleSize"
      :height="handleSize"
      fill="white"
      stroke="#3b82f6"
      :stroke-width="handleStroke"
      class="scale-handle ew-resize"
      @mousedown="handleScaleStart($event, 'w')"
    />
  </g>
</template>

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
