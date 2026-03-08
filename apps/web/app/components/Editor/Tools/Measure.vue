<script lang="ts">
/**
 * Measure Tool Configuration
 *
 * Default settings for the measure annotation tool.
 * These will eventually be customizable per-user and stored in the database
 * as part of a WYSIWYG-style tool configuration system.
 */

export const MEASURE_TOOL_DEFAULTS = {
  // Tool styling
  strokeColor: "black",
  strokeWidth: 1,
  labelColor: "black",
  labelSize: 8,
  labelStrokeStyle: "bold" as const,

  // Hit area for easier clicking on thin lines
  hitArea: {
    strokeWidth: 15
  },

  // Preview styling (while drawing)
  preview: {
    cursorIndicator: {
      radius: 4,
      strokeWidth: 2,
      opacity: 0.6
    },
    startMarker: {
      radius: 6,
      fill: "green",
      stroke: "white",
      strokeWidth: 2
    },
    line: {
      strokeDashArray: "5,5",
      opacity: 0.7
    },
    distance: {
      offsetY: 10,
      fill: "blue",
      fontSize: 12
    }
  },

  // Selected/hover states
  states: {
    hover: {
      strokeWidth: 4,
      dropShadow: "drop-shadow(0 0 6px rgba(66, 153, 225, 0.8))"
    },
    selected: {
      stroke: "#4299e1",
      strokeWidth: 3
    }
  }
} as const

export type MeasureToolConfig = typeof MEASURE_TOOL_DEFAULTS
</script>

<script setup lang="ts">
import type { Measurement } from "#shared/types/annotations.types"

const props = defineProps<{
  annotations?: Measurement[]
}>()

const config = MEASURE_TOOL_DEFAULTS
const tool = useMeasureToolState()!

const completed = computed(() => props.annotations ?? tool.completed.value)
const isDrawing = computed(() => tool.isDrawing.value)
const points = computed(() => tool.points.value)
const tempEndPoint = computed(() => tool.tempEndPoint.value)
const previewDistance = computed(() => tool.previewDistance.value)

const { labelRotationTransform, s, screenTransform, labelTransform } = useToolViewport()
</script>

<template>
  <g class="measure-tool">
    <!-- Completed annotations - single rendering path for both modes -->
    <EditorAnnotation v-for="measure in completed" :key="measure.id" :annotation="measure">
      <template #content="{ annotation, isSelected }">
        <!-- Invisible hit area -->
        <line :x1="annotation.points[0].x" :y1="annotation.points[0].y" :x2="annotation.points[1].x"
          :y2="annotation.points[1].y" stroke="transparent" :stroke-width="config.hitArea.strokeWidth"
          class="measurement-hit-area" />

        <!-- Visible line -->
        <line :x1="annotation.points[0].x" :y1="annotation.points[0].y" :x2="annotation.points[1].x"
          :y2="annotation.points[1].y" :stroke="config.strokeColor" :stroke-width="config.strokeWidth"
          :class="{ 'selected-line': isSelected }" class="measurement-line" />

        <!-- Label -->
        <EditorToolLabel
          :text="`${annotation.distance}mm`"
          :transform="labelTransform(annotation.midpoint.x, annotation.midpoint.y)"
          :font-size="config.labelSize"
          :font-weight="config.labelStrokeStyle === 'bold' ? 'bold' : 'normal'"
          :fill="config.labelColor"
        />
      </template>
    </EditorAnnotation>

    <!-- Preview while drawing - interactive mode only -->
    <g v-if="tempEndPoint" class="preview">
      <!-- Cursor indicator (before first click) -->
      <circle v-if="!isDrawing" :cx="tempEndPoint.x" :cy="tempEndPoint.y" :r="s(config.preview.cursorIndicator.radius)"
        fill="none" :stroke="config.strokeColor" :stroke-width="s(config.preview.cursorIndicator.strokeWidth)"
        :opacity="config.preview.cursorIndicator.opacity" />

      <!-- After first click -->
      <g v-if="isDrawing && points.length === 1 && points[0] && tempEndPoint">
        <!-- Start point marker -->
        <circle :cx="points[0].x" :cy="points[0].y" :r="s(config.preview.startMarker.radius)"
          :fill="config.preview.startMarker.fill" :stroke="config.preview.startMarker.stroke"
          :stroke-width="s(config.preview.startMarker.strokeWidth)" class="point-marker" />

        <!-- Temp line -->
        <line :x1="points[0].x" :y1="points[0].y" :x2="tempEndPoint.x" :y2="tempEndPoint.y" :stroke="config.strokeColor"
          stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="5,5"
          :opacity="config.preview.line.opacity" />

        <!-- Preview distance -->
        <text v-if="previewDistance"
          x="0"
          :y="-config.preview.distance.offsetY"
          :fill="config.preview.distance.fill"
          :font-size="config.preview.distance.fontSize"
          text-anchor="middle"
          :transform="screenTransform((points[0].x + tempEndPoint.x) / 2, (points[0].y + tempEndPoint.y) / 2)">
          {{ previewDistance }}mm
        </text>
      </g>
    </g>
  </g>
</template>

<style scoped>
.measurement-hit-area {
  pointer-events: stroke;
  cursor: pointer;
}

.measurement-line {
  transition:
    stroke-width 0.15s,
    filter 0.15s;
  stroke-linecap: round;
  pointer-events: none;
}

.measurement-line:hover {
  stroke-width: v-bind("config.states.hover.strokeWidth");
  filter: v-bind("config.states.hover.dropShadow");
}

.measurement-line.selected-line {
  stroke: v-bind("config.states.selected.stroke");
  stroke-width: v-bind("config.states.selected.strokeWidth");
}

.point-marker {
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}
</style>
