<script setup lang="ts">
import { useMeasureToolState } from "@/composables/tools/useMeasureTool"

// Get viewport-relative label rotation from renderer store (defined at top level)
const rendererStore = useRendererStore()

// Inject the tool state (which extends BaseTool)
const tool = useMeasureToolState()
if (!tool) {
  throw new Error("MeasureTool must be used within SvgAnnotationLayer")
}

// Destructure everything we need (inherited + tool-specific)
const {
  // From BaseTool (inherited):
  settings,
  // From DrawingTool (inherited):
  isDrawing,
  points,
  tempEndPoint,
  completed,
  // From MeasureTool (specific):
  previewDistance
} = tool
</script>

<template>
  <g class="measure-tool">
    <!-- Completed measurements -->
    <LayersBaseAnnotation v-for="measure in completed" :key="measure.id" :annotation="measure">
      <template #content="{ annotation, isSelected }">
        <!-- Invisible hit area (makes it easier to click thin lines) -->
        <line
          :x1="annotation.points[0].x"
          :y1="annotation.points[0].y"
          :x2="annotation.points[1].x"
          :y2="annotation.points[1].y"
          stroke="transparent"
          stroke-width="15"
          class="measurement-hit-area"
        />

        <!-- Visible line -->
        <line
          :x1="annotation.points[0].x"
          :y1="annotation.points[0].y"
          :x2="annotation.points[1].x"
          :y2="annotation.points[1].y"
          :stroke="settings.measureToolSettings.strokeColor"
          :stroke-width="settings.measureToolSettings.strokeWidth"
          :class="{ 'selected-line': isSelected }"
          class="measurement-line"
        />

        <!-- Label background with rotation -->
        <rect
          :x="annotation.midpoint.x - 30"
          :y="annotation.midpoint.y - 10"
          width="60"
          height="20"
          fill="white"
          opacity="0.9"
          rx="3"
          :transform="`rotate(${annotation.labelRotation} ${annotation.midpoint.x} ${annotation.midpoint.y})`"
        />

        <!-- Label with rotation -->
        <text
          :x="annotation.midpoint.x"
          :y="annotation.midpoint.y"
          :fill="settings.measureToolSettings.labelColor"
          :font-size="settings.measureToolSettings.labelSize"
          :font-weight="settings.measureToolSettings.labelStrokeStyle === 'bold' ? 'bold' : 'normal'"
          text-anchor="middle"
          dominant-baseline="middle"
          class="measurement-label"
          :transform="`rotate(${annotation.labelRotation} ${annotation.midpoint.x} ${annotation.midpoint.y})`"
        >
          {{ annotation.distance }}mm
        </text>
      </template>
    </LayersBaseAnnotation>

    <!-- Preview while drawing -->
    <g v-if="tempEndPoint" class="preview">
      <!-- Cursor indicator (before first click) -->
      <circle
        v-if="!isDrawing"
        :cx="tempEndPoint.x"
        :cy="tempEndPoint.y"
        r="4"
        fill="none"
        :stroke="settings.measureToolSettings.strokeColor"
        stroke-width="2"
        opacity="0.6"
      />

      <!-- After first click -->
      <g v-if="isDrawing && points.length === 1 && points[0] && tempEndPoint">
        <!-- Start point marker -->
        <circle
          :cx="points[0].x"
          :cy="points[0].y"
          r="6"
          fill="green"
          stroke="white"
          stroke-width="2"
          class="point-marker"
        />

        <!-- Temp line -->
        <line
          :x1="points[0].x"
          :y1="points[0].y"
          :x2="tempEndPoint.x"
          :y2="tempEndPoint.y"
          :stroke="settings.measureToolSettings.strokeColor"
          :stroke-width="settings.measureToolSettings.strokeWidth"
          stroke-dasharray="5,5"
          opacity="0.7"
        />

        <!-- Preview distance (viewport-relative rotation) -->
        <text
          v-if="previewDistance"
          :x="(points[0].x + tempEndPoint.x) / 2"
          :y="(points[0].y + tempEndPoint.y) / 2 - 10"
          fill="blue"
          font-size="12"
          text-anchor="middle"
          :transform="`rotate(${rendererStore.getViewportLabelRotation} ${(points[0].x + tempEndPoint.x) / 2} ${(points[0].y + tempEndPoint.y) / 2})`"
        >
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
  stroke-width: 4;
  filter: drop-shadow(0 0 6px rgba(66, 153, 225, 0.8));
}

.measurement-line.selected-line {
  stroke: #4299e1;
  stroke-width: 3;
}

.measurement-label {
  pointer-events: none;
  user-select: none;
  transition: font-weight 0.15s;
}

.point-marker {
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}
</style>
