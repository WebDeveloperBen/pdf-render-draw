<script setup lang="ts">
import { useFillToolState } from "@/composables/tools/useFillTool"

const tool = useFillToolState()
if (!tool) {
  throw new Error("FillTool must be used within SvgAnnotationLayer")
}

const { completed, deleteFill } = tool
</script>
<template>
  <g class="fill-tool">
    <!-- Completed fill points -->
    <g v-for="fill in completed" :key="fill.id" class="fill-point-group">
      <!-- Outer ring for visibility -->
      <circle
        :cx="fill.x"
        :cy="fill.y"
        r="8"
        :fill="fill.color"
        :opacity="fill.opacity * 0.3"
        class="fill-point-outer"
        @click.stop="deleteFill(fill.id)"
      />

      <!-- Main fill point -->
      <circle
        :cx="fill.x"
        :cy="fill.y"
        r="5"
        :fill="fill.color"
        :opacity="fill.opacity"
        class="fill-point"
        @click.stop="deleteFill(fill.id)"
      />

      <!-- Delete indicator on hover -->
      <g class="delete-indicator">
        <!-- X symbol -->
        <line :x1="fill.x - 3" :y1="fill.y - 3" :x2="fill.x + 3" :y2="fill.y + 3" stroke="white" stroke-width="2" />
        <line :x1="fill.x + 3" :y1="fill.y - 3" :x2="fill.x - 3" :y2="fill.y + 3" stroke="white" stroke-width="2" />
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
