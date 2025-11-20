<template>
  <g class="line-tool">
    <!-- Completed lines -->
    <g
      v-for="line in completed"
      :key="line.id"
      :data-annotation-id="line.id"
      :class="{ selected: selected?.id === line.id }"
      class="line"
      @click.stop="selectAnnotation(line.id)"
    >
      <!-- Polyline for multi-segment lines -->
      <polyline
        :points="toSvgPoints(line.points)"
        :stroke="settings.lineStrokeColor"
        :stroke-width="settings.lineStrokeWidth"
        fill="none"
        class="line-path"
      />

      <!-- Start point marker -->
      <circle
        :cx="line.points[0].x"
        :cy="line.points[0].y"
        r="4"
        :fill="settings.lineStrokeColor"
        class="start-marker"
      />

      <!-- End point marker -->
      <circle
        :cx="line.points[line.points.length - 1].x"
        :cy="line.points[line.points.length - 1].y"
        r="4"
        :fill="settings.lineStrokeColor"
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
        :stroke="settings.lineStrokeColor"
        stroke-width="2"
        opacity="0.6"
      />

      <!-- After first click -->
      <g v-if="isDrawing">
      <!-- Completed segments -->
      <polyline
        v-if="points.length >= 1"
        :points="toSvgPoints([...points, tempEndPoint || points[points.length - 1]])"
        :stroke="settings.lineStrokeColor"
        :stroke-width="settings.lineStrokeWidth"
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
        :fill="settings.lineStrokeColor"
      />

      <!-- Temp end point indicator -->
      <circle
        v-if="tempEndPoint"
        :cx="tempEndPoint.x"
        :cy="tempEndPoint.y"
        r="3"
        fill="blue"
        opacity="0.5"
      />
      </g>
    </g>
  </g>
</template>

<script setup lang="ts">
import { useLineToolState } from '~/composables/tools/useLineTool'

const settings = useSettingStore()

// Inject the shared tool state from SvgAnnotationLayer using VueUse createInjectionState
const tool = useLineToolState()
if (!tool) {
  throw new Error('LineTool must be used within SvgAnnotationLayer')
}

const {
  isDrawing,
  points,
  tempEndPoint,
  completed,
  selected,
  selectAnnotation,
  toSvgPoints,
} = tool
</script>

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
