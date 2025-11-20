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
    <g v-if="tempEndPoint" class="preview">
      <!-- Cursor indicator (before first click) -->
      <circle
        v-if="!isDrawing"
        :cx="tempEndPoint.x"
        :cy="tempEndPoint.y"
        r="4"
        fill="none"
        :stroke="settings.areaStrokeColor"
        stroke-width="2"
        opacity="0.6"
      />

      <!-- Placed point markers (after starting) -->
      <g v-if="isDrawing">
        <circle
          v-for="(point, index) in points"
          :key="`point-${index}`"
          :cx="point.x"
          :cy="point.y"
          :r="index === 0 ? 6 : 5"
          :fill="index === 0 ? 'green' : settings.areaStrokeColor"
          :stroke="'white'"
          :stroke-width="2"
          class="point-marker"
        />

        <!-- Draw lines between placed points -->
        <g v-if="points.length > 0">
        <!-- Lines connecting placed points -->
        <line
          v-for="(point, index) in points.slice(0, -1)"
          :key="`line-${index}`"
          :x1="point.x"
          :y1="point.y"
          :x2="points[index + 1].x"
          :y2="points[index + 1].y"
          :stroke="settings.areaStrokeColor"
          :stroke-width="settings.areaStrokeWidth"
          stroke-dasharray="5,5"
          opacity="0.8"
        />

        <!-- Line from last point to cursor -->
        <line
          v-if="tempEndPoint"
          :x1="points[points.length - 1].x"
          :y1="points[points.length - 1].y"
          :x2="tempEndPoint.x"
          :y2="tempEndPoint.y"
          :stroke="settings.areaStrokeColor"
          :stroke-width="settings.areaStrokeWidth"
          stroke-dasharray="5,5"
          opacity="0.8"
        />

        <!-- Preview closing line when hovering near start -->
        <line
          v-if="tempEndPoint && points.length >= 2"
          :x1="tempEndPoint.x"
          :y1="tempEndPoint.y"
          :x2="points[0].x"
          :y2="points[0].y"
          :stroke="settings.areaStrokeColor"
          :stroke-width="settings.areaStrokeWidth"
          stroke-dasharray="5,5"
          opacity="0.5"
        />
        </g>

        <!-- Preview polygon fill -->
        <polygon
          v-if="previewPolygon"
          :points="previewPolygon"
          :fill="settings.areaFillColor"
          :fill-opacity="settings.areaOpacity * 0.3"
          fill-rule="evenodd"
          pointer-events="none"
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
  </g>
</template>

<script setup lang="ts">
import { useAreaToolState } from '~/composables/tools/useAreaTool'

const settings = useSettingStore()

// Inject the shared tool state from SvgAnnotationLayer using VueUse createInjectionState
const tool = useAreaToolState()
if (!tool) {
  throw new Error('AreaTool must be used within SvgAnnotationLayer')
}

const {
  isDrawing,
  points,
  tempEndPoint,
  canSnapToClose,
  completed,
  selected,
  previewArea,
  previewPolygon,
  selectAnnotation,
  toSvgPoints,
} = tool
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

.point-marker {
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}
</style>
