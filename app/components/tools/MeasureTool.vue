<template>
  <g class="measure-tool">
    <!-- Completed measurements -->
    <g
      v-for="measure in completed"
      :key="measure.id"
      :class="{ selected: selected?.id === measure.id }"
      class="measurement"
      @click.stop="selectAnnotation(measure.id)"
    >
      <!-- Line -->
      <line
        :x1="measure.points[0].x"
        :y1="measure.points[0].y"
        :x2="measure.points[1].x"
        :y2="measure.points[1].y"
        :stroke="settings.measureStrokeColor"
        :stroke-width="settings.measureStrokeWidth"
        class="measurement-line"
      />

      <!-- Label background -->
      <rect
        :x="measure.midpoint.x - 30"
        :y="measure.midpoint.y - 10"
        width="60"
        height="20"
        fill="white"
        opacity="0.9"
        rx="3"
      />

      <!-- Label -->
      <text
        :x="measure.midpoint.x"
        :y="measure.midpoint.y"
        :fill="settings.measureLabelColor"
        :font-size="settings.measureLabelSize"
        :font-weight="settings.measureLabelStrokeStyle === 'bold' ? 'bold' : 'normal'"
        text-anchor="middle"
        dominant-baseline="middle"
        class="measurement-label"
      >
        {{ measure.distance }}mm
      </text>
    </g>

    <!-- Preview while drawing -->
    <g v-if="isDrawing && points.length === 1 && tempEndPoint" class="preview">
      <!-- Temp line -->
      <line
        :x1="points[0].x"
        :y1="points[0].y"
        :x2="tempEndPoint.x"
        :y2="tempEndPoint.y"
        :stroke="settings.measureStrokeColor"
        :stroke-width="settings.measureStrokeWidth"
        stroke-dasharray="5,5"
        opacity="0.7"
      />

      <!-- Preview distance -->
      <text
        v-if="previewDistance"
        :x="(points[0].x + tempEndPoint.x) / 2"
        :y="(points[0].y + tempEndPoint.y) / 2 - 10"
        fill="blue"
        font-size="12"
        text-anchor="middle"
      >
        {{ previewDistance }}mm
      </text>
    </g>
  </g>
</template>

<script setup lang="ts">
const settings = useSettingStore()

const {
  isDrawing,
  points,
  tempEndPoint,
  completed,
  selected,
  previewDistance,
  selectAnnotation,
} = useMeasureTool()
</script>

<style scoped>
.measurement-line {
  cursor: pointer;
  transition: stroke-width 0.2s;
}

.measurement-line:hover {
  stroke-width: 3;
  stroke: orange;
}

.measurement.selected .measurement-line {
  stroke: blue;
  stroke-width: 3;
}

.measurement-label {
  pointer-events: none;
  user-select: none;
}
</style>
