<script setup lang="ts">
import { useCountToolState } from "~/composables/tools/useCountTool"

const tool = useCountToolState()
if (!tool) {
  throw new Error("CountTool must be used within SvgAnnotationLayer")
}

const annotationStore = useAnnotationStore()
const { completed, nextCountNumber, cursorPosition } = tool

// Only show preview when count tool is active
const showPreview = computed(() => annotationStore.activeTool === 'count' && cursorPosition.value)
</script>

<template>
  <g class="count-tool">
    <!-- Completed count markers -->
    <LayersBaseAnnotation v-for="count in completed" :key="count.id" :annotation="count">
      <template #content="{ annotation, isSelected }">
        <!-- Invisible larger hitbox for easier clicking -->
        <circle
          :cx="annotation.x"
          :cy="annotation.y"
          r="20"
          fill="transparent"
          class="count-hitbox"
        />

        <!-- Count marker circle -->
        <circle
          :cx="annotation.x"
          :cy="annotation.y"
          r="15"
          :fill="isSelected ? '#1976d2' : '#ff9800'"
          :stroke="isSelected ? '#ffffff' : '#000000'"
          stroke-width="2"
          class="count-marker"
        />

        <!-- Count number text -->
        <text
          :x="annotation.x"
          :y="annotation.y"
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="12"
          font-weight="bold"
          fill="white"
          class="count-number"
        >
          {{ annotation.number }}
        </text>

        <!-- Optional label below the marker -->
        <text
          v-if="annotation.label"
          :x="annotation.x"
          :y="annotation.y + 25"
          text-anchor="middle"
          font-size="10"
          fill="#333"
          class="count-label"
        >
          {{ annotation.label }}
        </text>
      </template>
    </LayersBaseAnnotation>

    <!-- Preview marker (shown when hovering with count tool active) -->
    <g v-if="showPreview && cursorPosition" class="preview">
      <circle
        :cx="cursorPosition.x"
        :cy="cursorPosition.y"
        r="15"
        fill="#ff9800"
        stroke="#000000"
        stroke-width="2"
        opacity="0.7"
        class="preview-marker"
      />
      <text
        :x="cursorPosition.x"
        :y="cursorPosition.y"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="12"
        font-weight="bold"
        fill="white"
        opacity="0.7"
        class="preview-number"
      >
        {{ nextCountNumber }}
      </text>
    </g>
  </g>
</template>

<style scoped>
/* Invisible hitbox for easier clicking */
.count-hitbox {
  cursor: pointer;
}

/* Count marker styling */
.count-marker {
  pointer-events: none;
  transition: all 0.2s;
}

/* Hover effect */
.count-hitbox:hover ~ .count-marker {
  r: 18;
  stroke-width: 3;
}

/* Text styling */
.count-number,
.count-label {
  pointer-events: none;
  user-select: none;
}

/* Preview styling */
.preview-marker,
.preview-number {
  pointer-events: none;
}
</style>