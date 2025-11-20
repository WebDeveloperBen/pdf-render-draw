<template>
  <g class="area-tool">
    <!-- Completed areas -->
    <g
      v-for="area in completed"
      :key="area.id"
      :class="{ selected: selected?.id === area.id }"
      class="area"
      @click.stop="selectAnnotation(area.id)"
    >
      <!-- Polygon -->
      <polygon
        :points="toSvgPoints(area.points)"
        :fill="settings.areaFillColor"
        :fill-opacity="settings.areaOpacity"
        :stroke="settings.areaStrokeColor"
        :stroke-width="settings.areaStrokeWidth"
        class="area-polygon"
      />

      <!-- Label background -->
      <rect
        :x="area.center.x - 40"
        :y="area.center.y - 12"
        width="80"
        height="24"
        fill="white"
        opacity="0.95"
        rx="4"
      />

      <!-- Label -->
      <text
        :x="area.center.x"
        :y="area.center.y"
        :fill="settings.areaLabelColor"
        :font-size="settings.areaLabelSize"
        font-weight="bold"
        text-anchor="middle"
        dominant-baseline="middle"
        class="area-label"
      >
        {{ area.area }}m²
      </text>
    </g>

    <!-- Preview while drawing -->
    <g v-if="isDrawing" class="preview">
      <!-- Preview polygon -->
      <polygon
        v-if="previewPolygon"
        :points="previewPolygon"
        :fill="settings.areaFillColor"
        :fill-opacity="settings.areaOpacity * 0.5"
        :stroke="settings.areaStrokeColor"
        :stroke-width="settings.areaStrokeWidth"
        stroke-dasharray="5,5"
      />

      <!-- Snap to close indicator -->
      <g v-if="canSnapToClose && points.length > 0">
        <circle
          :cx="points[0].x"
          :cy="points[0].y"
          r="10"
          fill="none"
          stroke="green"
          stroke-width="2"
          class="snap-indicator"
        />
        <text
          :x="points[0].x + 15"
          :y="points[0].y - 10"
          fill="green"
          font-size="12"
          font-weight="bold"
        >
          Click to close
        </text>
      </g>

      <!-- Preview area -->
      <text
        v-if="previewArea && points.length >= 2"
        :x="(points[0].x + points[points.length - 1].x) / 2"
        :y="(points[0].y + points[points.length - 1].y) / 2"
        fill="blue"
        font-size="12"
        text-anchor="middle"
      >
        {{ previewArea }}m²
      </text>
    </g>
  </g>
</template>

<script setup lang="ts">
const settings = useSettingStore()

const {
  isDrawing,
  points,
  canSnapToClose,
  completed,
  selected,
  previewArea,
  previewPolygon,
  selectAnnotation,
  toSvgPoints,
} = useAreaTool()
</script>

<style scoped>
.area-polygon {
  cursor: pointer;
  transition: all 0.2s;
}

.area-polygon:hover {
  fill-opacity: 0.5;
  stroke-width: 3;
}

.area.selected .area-polygon {
  stroke: blue;
  stroke-width: 3;
}

.snap-indicator {
  animation: pulse 0.6s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    r: 8;
    opacity: 1;
  }
  50% {
    r: 12;
    opacity: 0.5;
  }
}
</style>
