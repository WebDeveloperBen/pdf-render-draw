<script lang="ts">
/**
 * Line Tool Configuration
 *
 * Default settings for the line annotation tool.
 * These will eventually be customizable per-user and stored in the database
 * as part of a WYSIWYG-style tool configuration system.
 */

</script>

<script setup lang="ts">
import { useLineToolState } from "@/composables/editor/tools/useLineTool"
export const LINE_TOOL_DEFAULTS = {
  // Tool styling
  strokeColor: "blue",
  strokeWidth: 3,

  // Hit area for easier clicking
  hitArea: {
    strokeWidth: 20
  },

  // Point markers on completed lines
  markers: {
    radius: 4
  },

  // Preview styling (while drawing)
  preview: {
    cursorIndicator: {
      radius: 4,
      strokeWidth: 2,
      opacity: 0.6
    },
    line: {
      strokeDashArray: "5,5",
      opacity: 0.7
    },
    pointRadius: 4,
    tempEndPoint: {
      radius: 3,
      fill: "blue",
      opacity: 0.5
    }
  }
} as const

export type LineToolConfig = typeof LINE_TOOL_DEFAULTS

// Inject the tool state (which extends BaseTool)
const tool = useLineToolState()
const config = LINE_TOOL_DEFAULTS

if (!tool) {
  throw new Error("LineTool must be used within AnnotationLayer")
}

// Destructure everything we need (inherited + tool-specific)
const {
  // From DrawingTool (inherited):
  isDrawing,
  points,
  tempEndPoint,
  completed,
  toSvgPoints
} = tool

// Debug: watch completed to see when it changes
watch(
  completed,
  (newVal) => {
    console.log("[Line.vue] Completed lines changed:", newVal.length, newVal)
  },
  { immediate: true }
)
</script>

<template>
  <g class="line-tool">
    <!-- Completed lines -->
    <EditorAnnotation v-for="line in completed" :key="line.id" :annotation="line">
      <template #content="{ annotation }">
        <!-- Invisible wider hitbox for easier clicking -->
        <polyline
          :points="toSvgPoints(annotation.points)"
          stroke="transparent"
          :stroke-width="config.hitArea.strokeWidth"
          fill="none"
          class="line-hitbox"
        />

        <!-- Visible line -->
        <polyline
          :points="toSvgPoints(annotation.points)"
          :stroke="config.strokeColor"
          :stroke-width="config.strokeWidth"
          fill="none"
          class="line-path"
        />

        <!-- Start point marker -->
        <circle
          v-if="annotation.points[0]"
          :cx="annotation.points[0].x"
          :cy="annotation.points[0].y"
          :r="config.markers.radius"
          :fill="config.strokeColor"
          class="start-marker"
        />

        <!-- End point marker -->
        <circle
          v-if="annotation.points[annotation.points.length - 1]"
          :cx="annotation.points[annotation.points.length - 1]?.x ?? 0"
          :cy="annotation.points[annotation.points.length - 1]?.y ?? 0"
          :r="config.markers.radius"
          :fill="config.strokeColor"
          class="end-marker"
        />
      </template>
    </EditorAnnotation>

    <!-- Preview while drawing -->
    <g v-if="tempEndPoint" class="preview">
      <!-- Cursor indicator (before first click) -->
      <circle
        v-if="!isDrawing"
        :cx="tempEndPoint.x"
        :cy="tempEndPoint.y"
        :r="config.preview.cursorIndicator.radius"
        fill="none"
        :stroke="config.strokeColor"
        :stroke-width="config.preview.cursorIndicator.strokeWidth"
        :opacity="config.preview.cursorIndicator.opacity"
      />

      <!-- After first click -->
      <g v-if="isDrawing">
        <!-- Completed segments -->
        <polyline
          v-if="points.length >= 1"
          :points="toSvgPoints([...points, tempEndPoint || points[points.length - 1]])"
          :stroke="config.strokeColor"
          :stroke-width="config.strokeWidth"
          fill="none"
          :stroke-dasharray="config.preview.line.strokeDashArray"
          :opacity="config.preview.line.opacity"
        />

        <!-- Preview points -->
        <circle
          v-for="(point, idx) in points"
          :key="idx"
          :cx="point.x"
          :cy="point.y"
          :r="config.preview.pointRadius"
          :fill="config.strokeColor"
        />

        <!-- Temp end point indicator -->
        <circle
          v-if="tempEndPoint"
          :cx="tempEndPoint.x"
          :cy="tempEndPoint.y"
          :r="config.preview.tempEndPoint.radius"
          :fill="config.preview.tempEndPoint.fill"
          :opacity="config.preview.tempEndPoint.opacity"
        />
      </g>
    </g>
  </g>
</template>

<style scoped>
/* Invisible hitbox for easier clicking */
.line-hitbox {
  cursor: pointer;
}

/* Visual line - no pointer events, hover handled by parent Annotation component */
.line-path {
  pointer-events: none;
}

.start-marker,
.end-marker {
  pointer-events: none;
}
</style>
