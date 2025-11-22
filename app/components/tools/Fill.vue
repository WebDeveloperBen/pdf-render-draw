<script setup lang="ts">
import { useFillToolState } from "@/composables/tools/useFillTool"

const tool = useFillToolState()
if (!tool) {
  throw new Error("FillTool must be used within SvgAnnotationLayer")
}

const { completed, isDrawing, currentRect, deleteFill } = tool

const annotationStore = useAnnotationStore()
const { getRotationTransform, isAnnotationSelected, selectAnnotation } = annotationStore
</script>
<template>
  <g class="fill-tool">
    <!-- Current drawing rectangle preview -->
    <rect
      v-if="isDrawing && currentRect"
      :x="currentRect.x"
      :y="currentRect.y"
      :width="currentRect.width"
      :height="currentRect.height"
      fill="#007acc"
      fill-opacity="0.2"
      stroke="#007acc"
      stroke-width="2"
      stroke-dasharray="4 4"
      class="drawing-rect"
      pointer-events="none"
    />

    <!-- Completed fill rectangles -->
    <g
      v-for="fill in completed"
      :key="fill.id"
      class="fill-rect-group"
      :data-annotation-id="fill.id"
      :class="{ selected: isAnnotationSelected(fill.id) }"
      :transform="getRotationTransform(fill)"
      @click.stop="selectAnnotation(fill.id)"
    >
      <!-- Filled rectangle -->
      <rect
        :x="fill.x"
        :y="fill.y"
        :width="fill.width"
        :height="fill.height"
        :fill="fill.color"
        :opacity="fill.opacity"
        class="fill-rect"
        :data-annotation-id="fill.id"
      />

      <!-- Border for visibility -->
      <rect
        :x="fill.x"
        :y="fill.y"
        :width="fill.width"
        :height="fill.height"
        fill="transparent"
        stroke="#007acc"
        stroke-width="1"
        class="fill-border"
        :data-annotation-id="fill.id"
      />

      <!-- Delete button on hover -->
      <g class="delete-indicator" @click.stop="deleteFill(fill.id)">
        <!-- Background circle for delete button -->
        <circle
          :cx="fill.x + fill.width / 2"
          :cy="fill.y + fill.height / 2"
          r="12"
          fill="rgba(220, 53, 69, 0.9)"
          class="delete-bg"
        />
        <!-- X symbol in center -->
        <line
          :x1="fill.x + fill.width / 2 - 5"
          :y1="fill.y + fill.height / 2 - 5"
          :x2="fill.x + fill.width / 2 + 5"
          :y2="fill.y + fill.height / 2 + 5"
          stroke="white"
          stroke-width="2"
        />
        <line
          :x1="fill.x + fill.width / 2 + 5"
          :y1="fill.y + fill.height / 2 - 5"
          :x2="fill.x + fill.width / 2 - 5"
          :y2="fill.y + fill.height / 2 + 5"
          stroke="white"
          stroke-width="2"
        />
      </g>
    </g>
  </g>
</template>

<style scoped>
.fill-rect-group {
  cursor: pointer;
}

.fill-rect-group:hover .fill-border {
  stroke-width: 2;
  stroke: #0056b3;
}

.delete-indicator {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  cursor: pointer;
}

.fill-rect-group:hover .delete-indicator {
  opacity: 1;
  pointer-events: all;
}

.delete-indicator:hover .delete-bg {
  fill: rgba(220, 53, 69, 1);
  r: 14;
}
</style>
