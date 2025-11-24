<script setup lang="ts">
// Inject the tool state (which extends BaseTool)
const tool = useFillToolState()
if (!tool) {
  throw new Error("FillTool must be used within SvgAnnotationLayer")
}

// Destructure everything we need (inherited + tool-specific)
const {
  // From BaseTool (inherited):
  settings,
  // From FillTool:
  isDrawing,
  currentRect,
  completed
} = tool
</script>
<template>
  <g class="fill-tool">
    <!-- Completed fill rectangles -->
    <LayersBaseAnnotation v-for="fill in completed" :key="fill.id" :annotation="fill">
      <template #content="{ annotation, isSelected }">
        <!-- Filled rectangle -->
        <rect
          :x="annotation.x"
          :y="annotation.y"
          :width="annotation.width"
          :height="annotation.height"
          :fill="annotation.color"
          :fill-opacity="annotation.opacity"
          class="fill-rect"
        />

        <!-- Border for visibility and selection state -->
        <rect
          :x="annotation.x"
          :y="annotation.y"
          :width="annotation.width"
          :height="annotation.height"
          fill="transparent"
          :stroke="isSelected ? settings.fillToolSettings.fillColor : annotation.color"
          :stroke-width="isSelected ? 2 : 1"
          :stroke-opacity="isSelected ? 1 : 0.5"
          class="fill-border"
        />
      </template>
    </LayersBaseAnnotation>

    <!-- Preview while drawing -->
    <rect
      v-if="isDrawing && currentRect"
      :x="currentRect.x"
      :y="currentRect.y"
      :width="currentRect.width"
      :height="currentRect.height"
      :fill="settings.fillToolSettings.fillColor"
      :fill-opacity="0.3"
      :stroke="settings.fillToolSettings.fillColor"
      stroke-width="2"
      stroke-dasharray="5,5"
      class="preview-rect"
      pointer-events="none"
    />
  </g>
</template>

<style scoped>
.fill-rect {
  cursor: pointer;
  transition: opacity 0.2s;
}

.fill-rect:hover {
  opacity: 0.8;
}

.fill-border {
  pointer-events: none;
  transition: stroke-width 0.2s;
}

.preview-rect {
  opacity: 0.7;
}
</style>
