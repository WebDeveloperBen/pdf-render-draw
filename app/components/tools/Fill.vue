<script setup lang="ts">
import { useFillToolState } from "@/composables/tools/useFillTool"

const tool = useFillToolState()
if (!tool) {
  throw new Error("FillTool must be used within SvgAnnotationLayer")
}

const { completed, isDrawing, currentRect, deleteFill } = tool
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
    <g v-for="fill in completed" :key="fill.id" class="fill-rect-group">
      <!-- Filled rectangle -->
      <rect
        :x="fill.x"
        :y="fill.y"
        :width="fill.width"
        :height="fill.height"
        :fill="fill.color"
        :opacity="fill.opacity"
        class="fill-rect"
        @click.stop="deleteFill(fill.id)"
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
        @click.stop="deleteFill(fill.id)"
      />

      <!-- Delete indicator on hover -->
      <g class="delete-indicator">
        <!-- X symbol in center -->
        <line :x1="fill.x + fill.width / 2 - 5" :y1="fill.y + fill.height / 2 - 5" :x2="fill.x + fill.width / 2 + 5" :y2="fill.y + fill.height / 2 + 5" stroke="white" stroke-width="2" />
        <line :x1="fill.x + fill.width / 2 + 5" :y1="fill.y + fill.height / 2 - 5" :x2="fill.x + fill.width / 2 - 5" :y2="fill.y + fill.height / 2 + 5" stroke="white" stroke-width="2" />
      </g>
    </g>
  </g>
</template>

<style scoped>
.fill-point-group {
  cursor: pointer;
  transition: all 0.2s;
}

.fill-point,
.fill-point-outer {
  transition: all 0.2s;
}

.fill-point-group:hover .fill-point-outer {
  r: 12;
  opacity: 0.5;
}

.fill-point-group:hover .fill-point {
  r: 6;
}

.delete-indicator {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.fill-point-group:hover .delete-indicator {
  opacity: 1;
}
</style>
