<script setup lang="ts">
import { useLineToolState } from "@/composables/tools/useLineTool"

// Inject the tool state (which extends BaseTool)
const tool = useLineToolState()
if (!tool) {
  throw new Error("LineTool must be used within SvgAnnotationLayer")
}

// Destructure everything we need (inherited + tool-specific)
const {
  // From BaseTool (inherited):
  settings,
  getRotationTransform,
  selectAnnotation,
  isAnnotationSelected,
  // From DrawingTool (inherited):
  isDrawing,
  points,
  tempEndPoint,
  completed,
  selected: _selected,
  toSvgPoints
} = tool
</script>

<template>
  <g class="line-tool">
    <!-- Completed lines -->
    <g
      v-for="line in completed"
      :key="line.id"
      :data-annotation-id="line.id"
      :class="{ selected: isAnnotationSelected(line.id) }"
      class="line"
      :transform="getRotationTransform(line)"
      @click.stop="selectAnnotation(line.id)"
    >
      <!-- Polyline for multi-segment lines -->
      <polyline
        :points="toSvgPoints(line.points)"
        :stroke="settings.lineToolSettings.strokeColor"
        :stroke-width="settings.lineToolSettings.strokeWidth"
        fill="none"
        class="line-path"
      />

      <!-- Start point marker -->
      <circle
        v-if="line.points[0]"
        :cx="line.points[0].x"
        :cy="line.points[0].y"
        r="4"
        :fill="settings.lineToolSettings.strokeColor"
        class="start-marker"
      />

      <!-- End point marker -->
      <circle
        v-if="line.points[line.points.length - 1]"
        :cx="line.points[line.points.length - 1]?.x ?? 0"
        :cy="line.points[line.points.length - 1]?.y ?? 0"
        r="4"
        :fill="settings.lineToolSettings.strokeColor"
        class="end-marker"
      />
    </g>

    <!-- Preview while drawing -->
    <g v-if="tempEndPoint" class="preview">
      <!-- Cursor indicator (before first click) -->
      <circle
        v-if="!isDrawing"
        :cx="tempEndPoint.x"
        :cy="tempEndPoint.y"
        r="4"
        fill="none"
        :stroke="settings.lineToolSettings.strokeColor"
        stroke-width="2"
        opacity="0.6"
      />

      <!-- After first click -->
      <g v-if="isDrawing">
        <!-- Completed segments -->
        <polyline
          v-if="points.length >= 1"
          :points="toSvgPoints([...points, tempEndPoint || points[points.length - 1]])"
          :stroke="settings.lineToolSettings.strokeColor"
          :stroke-width="settings.lineToolSettings.strokeWidth"
          fill="none"
          stroke-dasharray="5,5"
          opacity="0.7"
        />

        <!-- Preview points -->
        <circle
          v-for="(point, idx) in points"
          :key="idx"
          :cx="point.x"
          :cy="point.y"
          r="4"
          :fill="settings.lineToolSettings.strokeColor"
        />

        <!-- Temp end point indicator -->
        <circle v-if="tempEndPoint" :cx="tempEndPoint.x" :cy="tempEndPoint.y" r="3" fill="blue" opacity="0.5" />
      </g>
    </g>
  </g>
</template>

<style scoped>
.line-path {
  cursor: pointer;
  transition: stroke-width 0.2s;
}

.line-path:hover {
  stroke-width: 3;
  stroke: orange;
}

.line.selected .line-path {
  stroke: blue;
  stroke-width: 3;
}

.start-marker,
.end-marker {
  pointer-events: none;
}
</style>
