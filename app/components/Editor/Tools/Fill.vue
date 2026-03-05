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
  color: "#3b82f6",
  opacity: 0.3,

  // Preview styling (while drawing)
  preview: {
    fillOpacity: 0.3,
    strokeWidth: 2,
    strokeDashArray: "5,5",
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
import type { Fill } from "#shared/types/annotations.types"

// Props for export mode
const props = defineProps<{
  annotations?: Fill[]
  exportMode?: boolean
}>()

const config = FILL_TOOL_DEFAULTS

// Inject the tool state (only in interactive mode)
const tool = props.exportMode ? null : useFillToolState()

if (!tool && !props.exportMode) {
  throw new Error("FillTool must be used within AnnotationLayer")
}

// Use passed annotations in export mode, otherwise from store
const completed = computed(() => {
  if (props.exportMode && props.annotations) {
    return props.annotations
  }
  return tool?.completed.value ?? []
})

// Interactive-only state (not used in export mode)
const isDrawing = computed(() => tool?.isDrawing.value ?? false)
const currentRect = computed(() => tool?.currentRect.value ?? null)

const viewportStore = props.exportMode ? null : useViewportStore()
const inverseScale = computed(() => viewportStore?.getInverseScale ?? 1)
</script>
<template>
  <g class="fill-tool">
    <!-- Completed annotations - single rendering path for both modes -->
    <EditorAnnotation
      v-for="fill in completed"
      :key="fill.id"
      :annotation="fill"
      :export-mode="exportMode"
    >
      <template #content="{ annotation, isSelected }">
        <!-- Filled rectangle -->
        <rect
          :x="annotation.x"
          :y="annotation.y"
          :width="annotation.width"
          :height="annotation.height"
          :fill="annotation.color"
          :fill-opacity="annotation.opacity"
          :class="{ 'fill-rect': !exportMode }"
        />

        <!-- Border for visibility and selection state -->
        <rect
          :x="annotation.x"
          :y="annotation.y"
          :width="annotation.width"
          :height="annotation.height"
          fill="transparent"
          :stroke="isSelected ? config.color : annotation.color"
          :stroke-width="(isSelected ? config.border.strokeWidthSelected : config.border.strokeWidth) * inverseScale"
          :stroke-opacity="isSelected ? config.border.strokeOpacitySelected : config.border.strokeOpacity"
          :class="{ 'fill-border': !exportMode }"
        />
      </template>
    </EditorAnnotation>

    <!-- Preview while drawing - interactive mode only -->
    <rect
      v-if="!exportMode && isDrawing && currentRect"
      :x="currentRect.x"
      :y="currentRect.y"
      :width="currentRect.width"
      :height="currentRect.height"
      :fill="config.color"
      :fill-opacity="config.preview.fillOpacity"
      :stroke="config.color"
      :stroke-width="config.preview.strokeWidth * inverseScale"
      :stroke-dasharray="`${5 * inverseScale},${5 * inverseScale}`"
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
  opacity: v-bind("config.preview.opacity");
}
</style>
