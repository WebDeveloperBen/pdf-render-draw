<script lang="ts">
/**
 * Count Tool Configuration
 *
 * Default settings for the count annotation tool.
 * These will eventually be customizable per-user and stored in the database
 * as part of a WYSIWYG-style tool configuration system.
 */

export const COUNT_TOOL_DEFAULTS = {
  // Hit area for easier clicking
  hitArea: {
    radius: 20
  },

  // Count marker appearance
  marker: {
    radius: 15,
    fill: "#ff9800",
    stroke: "#000000",
    strokeWidth: 2,
    // Size of bounding box (2 * radius)
    get size() {
      return this.radius * 2
    }
  },

  // Text styling
  text: {
    fontSize: 12,
    fontWeight: "bold",
    fill: "white"
  },

  // Preview styling
  preview: {
    opacity: 0.7
  }
} as const

export type CountToolConfig = typeof COUNT_TOOL_DEFAULTS
</script>

<script setup lang="ts">
import type { Count } from "#shared/types/annotations.types"

// Props for export mode
const props = defineProps<{
  annotations?: Count[]
  exportMode?: boolean
}>()

const config = COUNT_TOOL_DEFAULTS

// Inject the tool state (only in interactive mode)
const tool = props.exportMode ? null : useCountToolState()

if (!tool && !props.exportMode) {
  throw new Error("CountTool must be used within AnnotationLayer")
}

// Use passed annotations in export mode, otherwise from store
const completed = computed(() => {
  if (props.exportMode && props.annotations) {
    return props.annotations
  }
  return tool?.completed.value ?? []
})

// Interactive-only state (not used in export mode)
const annotationStore = props.exportMode ? null : useAnnotationStore()
const nextCountNumber = computed(() => tool?.nextCountNumber.value ?? 0)
const cursorPosition = computed(() => tool?.cursorPosition.value ?? null)

const viewportStore = props.exportMode ? null : useViewportStore()
const inverseScale = computed(() => viewportStore?.getInverseScale ?? 1)
// Counter-rotation for preview to appear upright in current viewport
const previewCounterRotation = computed(() => viewportStore?.getViewportLabelRotation ?? 0)

// Only show preview when count tool is active (interactive mode only)
const showPreview = computed(() => {
  if (props.exportMode) return false
  return annotationStore?.activeTool === "count" && cursorPosition.value
})
</script>

<template>
  <g class="count-tool">
    <!-- Completed annotations - single rendering path for both modes -->
    <EditorAnnotation
      v-for="count in completed"
      :key="count.id"
      :annotation="count"
      :export-mode="exportMode"
    >
      <template #content="{ annotation }">
        <!-- Invisible hitbox - interactive mode only -->
        <circle
          v-if="!exportMode"
          :cx="annotation.x + annotation.width / 2"
          :cy="annotation.y + annotation.height / 2"
          :r="config.hitArea.radius * inverseScale"
          fill="transparent"
          class="count-hitbox"
        />

        <!-- Count marker circle -->
        <circle
          :cx="annotation.x + annotation.width / 2"
          :cy="annotation.y + annotation.height / 2"
          :r="config.marker.radius * inverseScale"
          :fill="config.marker.fill"
          :stroke="config.marker.stroke"
          :stroke-width="config.marker.strokeWidth * inverseScale"
          :class="{ 'count-marker': !exportMode }"
        />

        <!-- Count number text -->
        <text
          :x="annotation.x + annotation.width / 2"
          :y="annotation.y + annotation.height / 2"
          text-anchor="middle"
          dominant-baseline="middle"
          :font-size="config.text.fontSize * inverseScale"
          :font-weight="config.text.fontWeight"
          :fill="config.text.fill"
          :class="{ 'count-number': !exportMode }"
        >
          {{ annotation.number }}
        </text>
      </template>
    </EditorAnnotation>

    <!-- Preview marker - interactive mode only -->
    <g v-if="!exportMode && showPreview && cursorPosition" class="preview">
      <circle
        :cx="cursorPosition.x"
        :cy="cursorPosition.y"
        :r="config.marker.radius * inverseScale"
        :fill="config.marker.fill"
        :stroke="config.marker.stroke"
        :stroke-width="config.marker.strokeWidth * inverseScale"
        :opacity="config.preview.opacity"
        class="preview-marker"
      />
      <text
        :x="cursorPosition.x"
        :y="cursorPosition.y"
        text-anchor="middle"
        dominant-baseline="middle"
        :font-size="config.text.fontSize * inverseScale"
        :font-weight="config.text.fontWeight"
        :fill="config.text.fill"
        :opacity="config.preview.opacity"
        :transform="`rotate(${previewCounterRotation} ${cursorPosition.x} ${cursorPosition.y})`"
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

/* Count marker styling - hover handled by parent Annotation component */
.count-marker {
  pointer-events: none;
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
