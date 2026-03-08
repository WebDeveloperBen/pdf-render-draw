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
}>()

const config = COUNT_TOOL_DEFAULTS
const tool = useCountToolState()!
const annotationStore = useAnnotationStore()

const completed = computed(() => props.annotations ?? tool.completed.value)
const nextCountNumber = computed(() => tool.nextCountNumber.value)
const cursorPosition = computed(() => tool.cursorPosition.value)

const { labelRotationTransform, s, screenTransform, sc, labelTransform } = useToolViewport()

const showPreview = computed(() => {
  return annotationStore.activeTool === "count" && cursorPosition.value
})
</script>

<template>
  <g class="count-tool">
    <!-- Completed annotations - single rendering path for both modes -->
    <EditorAnnotation v-for="count in completed" :key="count.id" :annotation="count">
      <template #content="{ annotation }">
        <!-- Invisible hitbox -->
        <circle :cx="annotation.x + annotation.width / 2" :cy="annotation.y + annotation.height / 2"
          :r="sc(config.hitArea.radius)" fill="transparent" class="count-hitbox" />

        <!-- Count marker circle -->
        <circle :cx="annotation.x + annotation.width / 2" :cy="annotation.y + annotation.height / 2"
          :r="sc(config.marker.radius)" :fill="config.marker.fill" :stroke="config.marker.stroke"
          :stroke-width="sc(config.marker.strokeWidth)" class="count-marker" />

        <text x="0" y="0" text-anchor="middle"
          dominant-baseline="middle" :font-size="config.text.fontSize" :font-weight="config.text.fontWeight"
          :fill="config.text.fill" :transform="labelTransform(annotation.x + annotation.width / 2, annotation.y + annotation.height / 2)" class="count-number">
          {{ annotation.number }}
        </text>
      </template>
    </EditorAnnotation>

    <!-- Preview marker - interactive mode only -->
    <g v-if="showPreview && cursorPosition" class="preview">
      <circle :cx="cursorPosition.x" :cy="cursorPosition.y" :r="s(config.marker.radius)" :fill="config.marker.fill"
        :stroke="config.marker.stroke" :stroke-width="s(config.marker.strokeWidth)" :opacity="config.preview.opacity"
        class="preview-marker" />
      <text x="0" y="0" text-anchor="middle" dominant-baseline="middle"
        :font-size="config.text.fontSize" :font-weight="config.text.fontWeight" :fill="config.text.fill"
        :opacity="config.preview.opacity" :transform="screenTransform(cursorPosition.x, cursorPosition.y)"
        class="preview-number">
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
