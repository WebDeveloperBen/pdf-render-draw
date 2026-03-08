<script lang="ts">
/**
 * Area Tool Configuration
 *
 * Default settings for the area annotation tool.
 * These will eventually be customizable per-user and stored in the database
 * as part of a WYSIWYG-style tool configuration system.
 */

export const AREA_TOOL_DEFAULTS = {
  // Tool styling
  fillColor: "#f05a24",
  strokeColor: "#f05a24",
  strokeWidth: 1,
  opacity: 0.2,
  labelColor: "black",
  labelSize: 10,

  // Label background styling
  label: {
    background: {
      offsetX: 40,
      offsetY: 12,
      width: 80,
      height: 24,
      opacity: 0.95,
      borderRadius: 4,
      fill: "white"
    }
  },

  // Preview styling (while drawing)
  preview: {
    cursorIndicator: {
      radius: 4,
      strokeWidth: 2,
      opacity: 0.6
    },
    pointMarkers: {
      firstRadius: 6,
      otherRadius: 5,
      firstFill: "green",
      stroke: "white",
      strokeWidth: 2
    },
    lines: {
      strokeDashArray: "5,5",
      opacity: 0.8,
      closingLineOpacity: 0.5
    },
    polygonOpacityMultiplier: 0.3,
    distance: {
      fill: "blue",
      fontSize: 12
    }
  },

  // Snap to close indicator
  snap: {
    radius: 10,
    stroke: "green",
    strokeWidth: 2,
    text: {
      offsetX: 15,
      offsetY: 10,
      fontSize: 12,
      fontWeight: "bold",
      fill: "green"
    }
  },

  // Selected/hover states
  states: {
    hover: {
      fillOpacity: 0.5,
      strokeWidth: 3
    },
    selected: {
      stroke: "blue",
      strokeWidth: 3
    }
  }
} as const

export type AreaToolConfig = typeof AREA_TOOL_DEFAULTS
</script>

<script setup lang="ts">
import type { Area, Point } from "#shared/types/annotations.types"

// Props for export mode
const props = defineProps<{
  annotations?: Area[]
}>()

const config = AREA_TOOL_DEFAULTS
const tool = useAreaToolState()!

function toSvgPoints(pts: Point[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ")
}

const completed = computed(() => props.annotations ?? tool.completed.value)
const isDrawing = computed(() => tool.isDrawing.value)
const points = computed(() => tool.points.value)
const tempEndPoint = computed(() => tool.tempEndPoint.value)
const canSnapToClose = computed(() => tool.canSnapToClose.value)
const previewArea = computed(() => tool.previewArea.value)
const previewPolygon = computed(() => tool.previewPolygon.value)

const { labelRotationTransform, s, screenTransform, labelTransform } = useToolViewport()
</script>
<template>
  <g class="area-tool">
    <!-- Completed annotations - single rendering path for both modes -->
    <EditorAnnotation
      v-for="area in completed"
      :key="area.id"
      :annotation="area"
    >
      <template #content="{ annotation, isSelected }">
        <!-- Polygon -->
        <polygon
          :points="toSvgPoints(annotation.points)"
          :fill="config.fillColor"
          :fill-opacity="config.opacity"
          :stroke="config.strokeColor"
          :stroke-width="config.strokeWidth"
          class="area-polygon"
          :class="{ 'selected-polygon': isSelected }"
        />

        <rect
          :x="-config.label.background.offsetX / 2"
          :y="-config.label.background.offsetY / 2"
          :width="config.label.background.width"
          :height="config.label.background.height"
          :fill="config.label.background.fill"
          :opacity="config.label.background.opacity"
          :rx="config.label.background.borderRadius"
          :transform="labelTransform(annotation.center.x, annotation.center.y)"
        />

        <text
          x="0"
          y="0"
          :fill="config.labelColor"
          :font-size="config.labelSize"
          font-weight="bold"
          text-anchor="middle"
          dominant-baseline="middle"
          :transform="labelTransform(annotation.center.x, annotation.center.y)"
          class="area-label"
        >
          {{ annotation.area }}m²
        </text>
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

      <!-- Placed point markers (after starting) -->
      <g v-if="isDrawing">
        <circle
          v-for="(point, index) in points"
          :key="`point-${index}`"
          :cx="point.x"
          :cy="point.y"
          :r="s(index === 0 ? config.preview.pointMarkers.firstRadius : config.preview.pointMarkers.otherRadius)"
          :fill="index === 0 ? config.preview.pointMarkers.firstFill : config.strokeColor"
          :stroke="config.preview.pointMarkers.stroke"
          :stroke-width="s(config.preview.pointMarkers.strokeWidth)"
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
              :stroke="config.strokeColor"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
              :stroke-dasharray="`5,5`"
              :opacity="config.preview.lines.opacity"
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
              :stroke="config.strokeColor"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
              :stroke-dasharray="`5,5`"
              :opacity="config.preview.lines.opacity"
            />
          </template>

          <!-- Preview closing line when hovering near start -->
          <line
            v-if="tempEndPoint && points.length >= 2 && points[0]"
            :x1="tempEndPoint.x"
            :y1="tempEndPoint.y"
            :x2="points[0].x"
            :y2="points[0].y"
            :stroke="config.strokeColor"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
            :stroke-dasharray="`5,5`"
            :opacity="config.preview.lines.closingLineOpacity"
          />
        </g>

        <!-- Preview polygon fill -->
        <polygon
          v-if="previewPolygon"
          :points="previewPolygon"
          :fill="config.fillColor"
          :fill-opacity="config.opacity * config.preview.polygonOpacityMultiplier"
          fill-rule="evenodd"
          pointer-events="none"
        />

        <!-- Snap to close indicator -->
        <g v-if="canSnapToClose && points.length > 0 && points[0]">
          <circle
            :cx="points[0].x"
            :cy="points[0].y"
            :r="s(config.snap.radius)"
            fill="none"
            :stroke="config.snap.stroke"
            :stroke-width="s(config.snap.strokeWidth)"
            class="snap-indicator"
          />
          <text
            :x="config.snap.text.offsetX"
            :y="-config.snap.text.offsetY"
            :fill="config.snap.text.fill"
            :font-size="config.snap.text.fontSize"
            :font-weight="config.snap.text.fontWeight"
            :transform="screenTransform(points[0].x, points[0].y)"
          >
            Click to close
          </text>
        </g>

        <text
          v-if="previewArea && points.length >= 2 && points[0] && points[points.length - 1]"
          x="0"
          y="0"
          :fill="config.preview.distance.fill"
          :font-size="config.preview.distance.fontSize"
          text-anchor="middle"
          dominant-baseline="middle"
          :transform="screenTransform(((points[0]?.x ?? 0) + (points[points.length - 1]?.x ?? 0)) / 2, ((points[0]?.y ?? 0) + (points[points.length - 1]?.y ?? 0)) / 2)"
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
  fill-opacity: v-bind("config.states.hover.fillOpacity");
  stroke-width: v-bind("config.states.hover.strokeWidth");
}

.area-polygon.selected-polygon {
  stroke: v-bind("config.states.selected.stroke");
  stroke-width: v-bind("config.states.selected.strokeWidth");
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

.area-label {
  pointer-events: none;
  user-select: none;
}
</style>
