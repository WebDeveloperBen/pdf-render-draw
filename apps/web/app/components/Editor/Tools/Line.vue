<script lang="ts">
/**
 * Line Tool Configuration
 *
 * Default settings for the line annotation tool.
 * These will eventually be customizable per-user and stored in the database
 * as part of a WYSIWYG-style tool configuration system.
 */

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
</script>

<script setup lang="ts">
import type { Line, Point } from "#shared/types/annotations.types"

const props = defineProps<{
  annotations?: Line[]
}>()

const config = LINE_TOOL_DEFAULTS
const tool = useLineToolState()!

function toSvgPoints(pts: Point[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ")
}

const completed = computed(() => props.annotations ?? tool.completed.value)
const isDrawing = computed(() => tool.isDrawing.value)
const points = computed(() => tool.points.value)
const tempEndPoint = computed(() => tool.tempEndPoint.value)

const { s, stamped } = useToolViewport()

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
    <!-- Completed annotations - single rendering path for both modes -->
    <EditorAnnotation
      v-for="line in completed"
      :key="line.id"
      :annotation="line"
    >
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
          vector-effect="non-scaling-stroke"
          fill="none"
          class="line-path"
        />

        <!-- Start point marker -->
        <circle
          v-if="annotation.points[0]"
          :cx="annotation.points[0].x"
          :cy="annotation.points[0].y"
          :r="stamped(config.markers.radius, annotation.labelScale)"
          :fill="config.strokeColor"
          class="start-marker"
        />

        <!-- End point marker -->
        <circle
          v-if="annotation.points[annotation.points.length - 1]"
          :cx="annotation.points[annotation.points.length - 1]?.x ?? 0"
          :cy="annotation.points[annotation.points.length - 1]?.y ?? 0"
          :r="stamped(config.markers.radius, annotation.labelScale)"
          :fill="config.strokeColor"
          class="end-marker"
        />
      </template>
    </EditorAnnotation>

    <!-- Preview while drawing - interactive mode only -->
    <g v-if="tempEndPoint" class="preview">
      <!-- Cursor indicator (before first click) -->
      <circle
        v-if="!isDrawing"
        :cx="tempEndPoint.x"
        :cy="tempEndPoint.y"
        :r="s(config.preview.cursorIndicator.radius)"
        fill="none"
        :stroke="config.strokeColor"
        :stroke-width="s(config.preview.cursorIndicator.strokeWidth)"
        :opacity="config.preview.cursorIndicator.opacity"
      />

      <!-- After first click -->
      <g v-if="isDrawing">
        <!-- Completed segments -->
        <polyline
          v-if="points.length >= 1"
          :points="toSvgPoints([...points, tempEndPoint || points[points.length - 1]])"
          :stroke="config.strokeColor"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
          fill="none"
          stroke-dasharray="5,5"
          :opacity="config.preview.line.opacity"
        />

        <!-- Preview points -->
        <circle
          v-for="(point, idx) in points"
          :key="idx"
          :cx="point.x"
          :cy="point.y"
          :r="s(config.preview.pointRadius)"
          :fill="config.strokeColor"
        />

        <!-- Temp end point indicator -->
        <circle
          v-if="tempEndPoint"
          :cx="tempEndPoint.x"
          :cy="tempEndPoint.y"
          :r="s(config.preview.tempEndPoint.radius)"
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
