<script setup lang="ts">
import { useAreaToolState } from "@/composables/tools/useAreaTool"

const settings = useSettingStore()
const annotationStore = useAnnotationStore()

// Inject the shared tool state from SvgAnnotationLayer using VueUse createInjectionState
const tool = useAreaToolState()
if (!tool) {
  throw new Error("AreaTool must be used within SvgAnnotationLayer")
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
  toSvgPoints
} = tool
</script>
<template>
  <g class="area-tool">
    <!-- Completed areas -->
    <g
      v-for="area in completed"
      :key="area.id"
      :data-annotation-id="area.id"
      :class="{ selected: selected?.id === area.id }"
      class="area"
      :transform="annotationStore.getRotationTransform(area)"
      @click.stop="selectAnnotation(area.id)"
    >
      <!-- Polygon -->
      <polygon
        :points="toSvgPoints(area.points)"
        :fill="settings.areaToolSettings.fillColor"
        :fill-opacity="settings.areaToolSettings.opacity"
        :stroke="settings.areaToolSettings.strokeColor"
        :stroke-width="settings.areaToolSettings.strokeWidth"
        class="area-polygon"
      />

      <!-- Label background with rotation -->
      <rect
        :x="area.center.x - 40"
        :y="area.center.y - 12"
        width="80"
        height="24"
        fill="white"
        opacity="0.95"
        rx="4"
        :transform="`rotate(${area.labelRotation} ${area.center.x} ${area.center.y})`"
      />

      <!-- Label with rotation -->
      <text
        :x="area.center.x"
        :y="area.center.y"
        :fill="settings.areaToolSettings.labelColor"
        :font-size="settings.areaToolSettings.labelSize"
        font-weight="bold"
        text-anchor="middle"
        dominant-baseline="middle"
        class="area-label"
        :transform="`rotate(${area.labelRotation} ${area.center.x} ${area.center.y})`"
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
        :stroke="settings.areaToolSettings.strokeColor"
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
          :fill="index === 0 ? 'green' : settings.areaToolSettings.strokeColor"
          :stroke="'white'"
          :stroke-width="2"
          class="point-marker"
        />

        <!-- Draw lines between placed points -->
        <g v-if="points.length > 0">
          <!-- Lines connecting placed points -->
          <template v-for="(point, index) in points.slice(0, -1)" :key="`line-${index}`">
            <line
              v-if="points[index + 1]"
              :x1="point.x"
              :y1="point.y"
              :x2="points[index + 1]?.x ?? 0"
              :y2="points[index + 1]?.y ?? 0"
              :stroke="settings.areaToolSettings.strokeColor"
              :stroke-width="settings.areaToolSettings.strokeWidth"
              stroke-dasharray="5,5"
              opacity="0.8"
            />
          </template>

          <!-- Line from last point to cursor -->
          <template v-if="tempEndPoint && points.length > 0">
            <line
              v-if="points[points.length - 1]"
              :x1="points[points.length - 1]?.x ?? 0"
              :y1="points[points.length - 1]?.y ?? 0"
              :x2="tempEndPoint.x"
              :y2="tempEndPoint.y"
              :stroke="settings.areaToolSettings.strokeColor"
              :stroke-width="settings.areaToolSettings.strokeWidth"
              stroke-dasharray="5,5"
              opacity="0.8"
            />
          </template>

          <!-- Preview closing line when hovering near start -->
          <line
            v-if="tempEndPoint && points.length >= 2 && points[0]"
            :x1="tempEndPoint.x"
            :y1="tempEndPoint.y"
            :x2="points[0].x"
            :y2="points[0].y"
            :stroke="settings.areaToolSettings.strokeColor"
            :stroke-width="settings.areaToolSettings.strokeWidth"
            stroke-dasharray="5,5"
            opacity="0.5"
          />
        </g>

        <!-- Preview polygon fill -->
        <polygon
          v-if="previewPolygon"
          :points="previewPolygon"
          :fill="settings.areaToolSettings.fillColor"
          :fill-opacity="settings.areaToolSettings.opacity * 0.3"
          fill-rule="evenodd"
          pointer-events="none"
        />

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
          <text :x="points[0].x + 15" :y="points[0].y - 10" fill="green" font-size="12" font-weight="bold">
            Click to close
          </text>
        </g>

        <!-- Preview area -->
        <text
          v-if="previewArea && points.length >= 2 && points[0] && points[points.length - 1]"
          :x="((points[0]?.x ?? 0) + (points[points.length - 1]?.x ?? 0)) / 2"
          :y="((points[0]?.y ?? 0) + (points[points.length - 1]?.y ?? 0)) / 2"
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
  0%,
  100% {
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
