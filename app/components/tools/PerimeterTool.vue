<template>
  <g class="perimeter-tool">
    <!-- Completed perimeters -->
    <g
      v-for="perimeter in completed"
      :key="perimeter.id"
      :data-annotation-id="perimeter.id"
      :class="{ selected: selected?.id === perimeter.id }"
      class="perimeter"
      @click.stop="selectAnnotation(perimeter.id)"
    >
      <!-- Polygon -->
      <polygon
        :points="toSvgPoints(perimeter.points)"
        :fill="settings.perimeterToolSettings.fillColor"
        :fill-opacity="settings.perimeterToolSettings.opacity"
        :stroke="settings.perimeterToolSettings.strokeColor"
        :stroke-width="settings.perimeterToolSettings.strokeWidth"
        class="perimeter-polygon"
      />

      <!-- Individual segment labels -->
      <g v-for="(segment, idx) in perimeter.segments" :key="idx">
        <!-- Label background -->
        <rect
          :x="segment.midpoint.x - 25"
          :y="segment.midpoint.y - 10"
          width="50"
          height="20"
          fill="white"
          opacity="0.9"
          rx="3"
        />

        <!-- Segment length label -->
        <text
          :x="segment.midpoint.x"
          :y="segment.midpoint.y"
          :fill="settings.perimeterToolSettings.labelColor"
          :font-size="settings.perimeterToolSettings.labelSize"
          font-weight="bold"
          text-anchor="middle"
          dominant-baseline="middle"
          class="segment-label"
        >
          {{ segment.length }}mm
        </text>
      </g>

      <!-- Total perimeter label at center -->
      <rect
        :x="perimeter.center.x - 40"
        :y="perimeter.center.y - 12"
        width="80"
        height="24"
        fill="white"
        opacity="0.95"
        rx="4"
      />
      <text
        :x="perimeter.center.x"
        :y="perimeter.center.y"
        :fill="settings.perimeterToolSettings.labelColor"
        :font-size="settings.perimeterToolSettings.labelSize + 2"
        font-weight="bold"
        text-anchor="middle"
        dominant-baseline="middle"
        class="total-label"
      >
        Total: {{ perimeter.totalLength }}mm
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
        :stroke="settings.perimeterToolSettings.strokeColor"
        stroke-width="2"
        opacity="0.6"
      />

      <!-- After first click -->
      <g v-if="isDrawing">
      <!-- Placed point markers -->
      <circle
        v-for="(point, index) in points"
        :key="`point-${index}`"
        :cx="point.x"
        :cy="point.y"
        :r="index === 0 ? 6 : 5"
        :fill="index === 0 ? 'green' : settings.perimeterToolSettings.strokeColor"
        :stroke="'white'"
        :stroke-width="2"
        class="point-marker"
      />

      <!-- Preview polygon (if we have enough points) -->
      <polygon
        v-if="points.length >= 2"
        :points="toSvgPoints([...points, tempEndPoint || points[points.length - 1]])"
        :fill="settings.perimeterToolSettings.fillColor"
        :fill-opacity="settings.perimeterToolSettings.opacity * 0.5"
        :stroke="settings.perimeterToolSettings.strokeColor"
        :stroke-width="settings.perimeterToolSettings.strokeWidth"
        stroke-dasharray="5,5"
      />

      <!-- Preview segment labels -->
      <g v-for="(segment, idx) in previewSegments" :key="idx">
        <line
          :x1="segment.start.x"
          :y1="segment.start.y"
          :x2="segment.end.x"
          :y2="segment.end.y"
          :stroke="settings.perimeterToolSettings.strokeColor"
          :stroke-width="settings.perimeterToolSettings.strokeWidth"
          :stroke-dasharray="idx === previewSegments.length - 1 ? '5,5' : '0'"
        />

        <!-- Segment length label background -->
        <rect
          :x="segment.midpoint.x - 25"
          :y="segment.midpoint.y - 10"
          width="50"
          height="20"
          fill="white"
          opacity="0.9"
          rx="3"
        />

        <!-- Segment length label -->
        <text
          :x="segment.midpoint.x"
          :y="segment.midpoint.y"
          fill="blue"
          font-size="12"
          font-weight="bold"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {{ segment.length }}mm
        </text>
      </g>

      <!-- Snap to close indicator -->
      <g v-if="canSnapToClose && points.length > 0 && points[0]">
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
      </g>
    </g>
  </g>
</template>

<script setup lang="ts">
import { usePerimeterToolState } from '~/composables/tools/usePerimeterTool'

const settings = useSettingStore()

// Inject the shared tool state from SvgAnnotationLayer using VueUse createInjectionState
const tool = usePerimeterToolState()
if (!tool) {
  throw new Error('PerimeterTool must be used within SvgAnnotationLayer')
}

const {
  isDrawing,
  points,
  tempEndPoint,
  canSnapToClose,
  completed,
  selected,
  previewSegments,
  selectAnnotation,
  toSvgPoints,
} = tool
</script>

<style scoped>
.perimeter-polygon {
  cursor: pointer;
  transition: all 0.2s;
}

.perimeter-polygon:hover {
  fill-opacity: 0.5;
  stroke-width: 3;
}

.perimeter.selected .perimeter-polygon {
  stroke: blue;
  stroke-width: 3;
}

.segment-label,
.total-label {
  pointer-events: none;
  user-select: none;
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
