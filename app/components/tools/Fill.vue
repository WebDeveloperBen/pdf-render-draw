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
    <BaseAnnotation
      v-for="fill in completed"
      :key="fill.id"
      :annotation="fill"
    >
      <template #content="{ annotation: fill, isSelected }">
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
          :stroke="isSelected ? '#0056b3' : '#007acc'"
          :stroke-width="isSelected ? 2 : 1"
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
      </template>
    </BaseAnnotation>
  </g>
</template>

<style scoped>
.fill-rect {
  cursor: pointer;
}

.fill-border {
  transition: stroke-width 0.2s;
  pointer-events: none;
}

.delete-indicator {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  cursor: pointer;
}

/* Show delete button on hover of parent BaseAnnotation */
:deep(.base-annotation:hover) .delete-indicator {
  opacity: 1;
  pointer-events: all;
}

.delete-indicator:hover .delete-bg {
  fill: rgba(220, 53, 69, 1);
  r: 14;
}
</style>
