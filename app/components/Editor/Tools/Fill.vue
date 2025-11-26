<script lang="ts">
/**
 * Fill Tool Configuration
 *
 * Default settings for the fill annotation tool.
 * These will eventually be customizable per-user and stored in the database
 * as part of a WYSIWYG-style tool configuration system.
 */

export const FILL_TOOL_DEFAULTS = {
  // Default fill appearance
  color: '#3b82f6',
  opacity: 0.3,

  // Preview styling (while drawing)
  preview: {
    fillOpacity: 0.3,
    strokeWidth: 2,
    strokeDashArray: '5,5',
    opacity: 0.7
  },

  // Border styling for completed fills
  border: {
    strokeWidth: 1,
    strokeWidthSelected: 2,
    strokeOpacity: 0.5,
    strokeOpacitySelected: 1
  }
} as const

export type FillToolConfig = typeof FILL_TOOL_DEFAULTS
</script>

<script setup lang="ts">
// Inject the tool state (which extends BaseTool)
const tool = useFillToolState()
const config = FILL_TOOL_DEFAULTS

if (!tool) {
  throw new Error("FillTool must be used within AnnotationRendererLayer")
}

// Destructure everything we need (inherited + tool-specific)
const {
  // From FillTool:
  isDrawing,
  currentRect,
  completed
} = tool
</script>
<template>
  <g class="fill-tool">
    <!-- Completed fill rectangles -->
    <EditorBaseAnnotation v-for="fill in completed" :key="fill.id" :annotation="fill">
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
          :stroke="isSelected ? config.color : annotation.color"
          :stroke-width="isSelected ? config.border.strokeWidthSelected : config.border.strokeWidth"
          :stroke-opacity="isSelected ? config.border.strokeOpacitySelected : config.border.strokeOpacity"
          class="fill-border"
        />
      </template>
    </EditorBaseAnnotation>

    <!-- Preview while drawing -->
    <rect
      v-if="isDrawing && currentRect"
      :x="currentRect.x"
      :y="currentRect.y"
      :width="currentRect.width"
      :height="currentRect.height"
      :fill="config.color"
      :fill-opacity="config.preview.fillOpacity"
      :stroke="config.color"
      :stroke-width="config.preview.strokeWidth"
      :stroke-dasharray="config.preview.strokeDashArray"
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
  opacity: v-bind('config.preview.opacity');
}
</style>
