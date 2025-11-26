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
const tool = useCountToolState()
const config = COUNT_TOOL_DEFAULTS

if (!tool) {
  throw new Error("CountTool must be used within AnnotationLayer")
}

const annotationStore = useAnnotationStore()
const { completed, nextCountNumber, cursorPosition } = tool

// Only show preview when count tool is active
const showPreview = computed(() => annotationStore.activeTool === "count" && cursorPosition.value)
</script>

<template>
  <g class="count-tool">
    <!-- Completed count annotations -->
    <EditorAnnotation v-for="count in completed" :key="count.id" :annotation="count">
      <template #content="{ annotation }">
        <!-- Invisible hitbox for easier clicking -->
        <circle
          :cx="annotation.x + annotation.width / 2"
          :cy="annotation.y + annotation.height / 2"
          :r="config.hitArea.radius"
          fill="transparent"
          class="count-hitbox"
        />

        <!-- Count marker circle -->
        <circle
          :cx="annotation.x + annotation.width / 2"
          :cy="annotation.y + annotation.height / 2"
          :r="config.marker.radius"
          :fill="config.marker.fill"
          :stroke="config.marker.stroke"
          :stroke-width="config.marker.strokeWidth"
          class="count-marker"
        />

        <!-- Count number text -->
        <text
          :x="annotation.x + annotation.width / 2"
          :y="annotation.y + annotation.height / 2"
          text-anchor="middle"
          dominant-baseline="middle"
          :font-size="config.text.fontSize"
          :font-weight="config.text.fontWeight"
          :fill="config.text.fill"
          class="count-number"
        >
          {{ annotation.number }}
        </text>
      </template>
    </EditorAnnotation>

    <!-- Preview marker (shown when hovering with count tool active) -->
    <g v-if="showPreview && cursorPosition" class="preview">
      <circle
        :cx="cursorPosition.x"
        :cy="cursorPosition.y"
        :r="config.marker.radius"
        :fill="config.marker.fill"
        :stroke="config.marker.stroke"
        :stroke-width="config.marker.strokeWidth"
        :opacity="config.preview.opacity"
        class="preview-marker"
      />
      <text
        :x="cursorPosition.x"
        :y="cursorPosition.y"
        text-anchor="middle"
        dominant-baseline="middle"
        :font-size="config.text.fontSize"
        :font-weight="config.text.fontWeight"
        :fill="config.text.fill"
        :opacity="config.preview.opacity"
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
