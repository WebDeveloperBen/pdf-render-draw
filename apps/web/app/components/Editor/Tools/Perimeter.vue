<script lang="ts">
/**
 * Perimeter Tool Configuration
 *
 * Default settings for the perimeter annotation tool.
 * These will eventually be customizable per-user and stored in the database
 * as part of a WYSIWYG-style tool configuration system.
 */

export const PERIMETER_TOOL_DEFAULTS = {
  // Tool styling
  fillColor: "green",
  strokeColor: "green",
  strokeWidth: 1,
  opacity: 0.2,
  labelColor: "green",
  labelSize: 10,

  // Segment label background styling
  segmentLabel: {
    background: {
      offsetX: 25,
      offsetY: 10,
      width: 50,
      height: 20,
      opacity: 0.9,
      borderRadius: 3,
      fill: "white"
    }
  },

  // Total label background styling
  totalLabel: {
    background: {
      offsetX: 40,
      offsetY: 12,
      width: 80,
      height: 24,
      opacity: 0.95,
      borderRadius: 4,
      fill: "white"
    },
    fontSizeBonus: 2 // Added to settings.labelSize for total
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
    polygon: {
      opacityMultiplier: 0.5,
      strokeDashArray: "5,5"
    },
    segmentLabel: {
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

export type PerimeterToolConfig = typeof PERIMETER_TOOL_DEFAULTS
</script>

<script setup lang="ts">
import type { Perimeter, Point } from "#shared/types/annotations.types"

const props = defineProps<{
  annotations?: Perimeter[]
}>()

const config = PERIMETER_TOOL_DEFAULTS
const tool = usePerimeterToolState()!

function toSvgPoints(pts: Point[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ")
}

const completed = computed(() => props.annotations ?? tool.completed.value)
const isDrawing = computed(() => tool.isDrawing.value)
const points = computed(() => tool.points.value)
const tempEndPoint = computed(() => tool.tempEndPoint.value)
const canSnapToClose = computed(() => tool.canSnapToClose.value)
const previewSegments = computed(() => tool.previewSegments.value)

const { labelRotationTransform, s, screenTransform } = useToolViewport()
</script>
<template>
  <g class="perimeter-tool">
    <!-- Completed annotations - single rendering path for both modes -->
    <EditorAnnotation
      v-for="perimeter in completed"
      :key="perimeter.id"
      :annotation="perimeter"
    >
      <template #content="{ annotation, isSelected }">
        <!-- Polygon -->
        <polygon
          :points="toSvgPoints(annotation.points)"
          :fill="config.fillColor"
          :fill-opacity="config.opacity"
          :stroke="config.strokeColor"
          :stroke-width="config.strokeWidth"
          class="perimeter-polygon"
          :class="{ 'selected-polygon': isSelected }"
        />

        <!-- Individual segment labels -->
        <g v-for="(segment, idx) in annotation.segments" :key="idx">
          <rect
            :x="segment.midpoint.x - config.segmentLabel.background.offsetX / 2"
            :y="segment.midpoint.y - config.segmentLabel.background.offsetY / 2"
            :width="config.segmentLabel.background.width"
            :height="config.segmentLabel.background.height"
            :fill="config.segmentLabel.background.fill"
            :opacity="config.segmentLabel.background.opacity"
            :rx="config.segmentLabel.background.borderRadius"
            :transform="annotation.labelRotation ? `rotate(${annotation.labelRotation}, ${segment.midpoint.x}, ${segment.midpoint.y})` : undefined"
          />

          <text
            :x="segment.midpoint.x"
            :y="segment.midpoint.y"
            :fill="config.labelColor"
            :font-size="config.labelSize"
            font-weight="bold"
            text-anchor="middle"
            dominant-baseline="middle"
            :transform="annotation.labelRotation ? `rotate(${annotation.labelRotation}, ${segment.midpoint.x}, ${segment.midpoint.y})` : undefined"
            class="segment-label"
          >
            {{ segment.length }}mm
          </text>
        </g>

        <!-- Total perimeter label at center -->
        <rect
          :x="annotation.center.x - config.totalLabel.background.offsetX / 2"
          :y="annotation.center.y - config.totalLabel.background.offsetY / 2"
          :width="config.totalLabel.background.width"
          :height="config.totalLabel.background.height"
          :fill="config.totalLabel.background.fill"
          :opacity="config.totalLabel.background.opacity"
          :rx="config.totalLabel.background.borderRadius"
          :transform="annotation.labelRotation ? `rotate(${annotation.labelRotation}, ${annotation.center.x}, ${annotation.center.y})` : undefined"
        />
        <text
          :x="annotation.center.x"
          :y="annotation.center.y"
          :fill="config.labelColor"
          :font-size="config.labelSize + config.totalLabel.fontSizeBonus"
          font-weight="bold"
          text-anchor="middle"
          dominant-baseline="middle"
          :transform="annotation.labelRotation ? `rotate(${annotation.labelRotation}, ${annotation.center.x}, ${annotation.center.y})` : undefined"
          class="total-label"
        >
          Total: {{ annotation.totalLength }}mm
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

      <!-- After first click -->
      <g v-if="isDrawing">
        <!-- Placed point markers -->
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

        <!-- Preview polygon (if we have enough points) -->
        <polygon
          v-if="points.length >= 2"
          :points="toSvgPoints([...points, tempEndPoint || points[points.length - 1]])"
          :fill="config.fillColor"
          :fill-opacity="config.opacity * config.preview.polygon.opacityMultiplier"
          :stroke="config.strokeColor"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
          stroke-dasharray="5,5"
        />

        <!-- Preview segment labels -->
        <g v-for="(segment, idx) in previewSegments" :key="idx">
          <line
            :x1="segment.start.x"
            :y1="segment.start.y"
            :x2="segment.end.x"
            :y2="segment.end.y"
            :stroke="config.strokeColor"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
            :stroke-dasharray="idx === previewSegments.length - 1 ? '5,5' : '0'"
          />

          <rect
            :x="-config.segmentLabel.background.offsetX / 2"
            :y="-config.segmentLabel.background.offsetY / 2"
            :width="config.segmentLabel.background.width"
            :height="config.segmentLabel.background.height"
            :fill="config.segmentLabel.background.fill"
            :opacity="config.segmentLabel.background.opacity"
            :rx="config.segmentLabel.background.borderRadius"
            :transform="screenTransform(segment.midpoint.x, segment.midpoint.y)"
          />

          <text
            x="0"
            y="0"
            :fill="config.preview.segmentLabel.fill"
            :font-size="config.preview.segmentLabel.fontSize"
            font-weight="bold"
            text-anchor="middle"
            dominant-baseline="middle"
            :transform="screenTransform(segment.midpoint.x, segment.midpoint.y)"
          >
            {{ segment.length }}mm
          </text>
        </g>

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
            :transform="screenTransform(points[0].x, points[0].y)"
            :font-size="config.snap.text.fontSize"
            :font-weight="config.snap.text.fontWeight"
          >
            Click to close
          </text>
        </g>
      </g>
    </g>
  </g>
</template>

<style scoped>
.perimeter-polygon {
  cursor: pointer;
  transition: all 0.2s;
}

.perimeter-polygon:hover {
  fill-opacity: v-bind("config.states.hover.fillOpacity");
  stroke-width: v-bind("config.states.hover.strokeWidth");
}

.perimeter-polygon.selected-polygon {
  stroke: v-bind("config.states.selected.stroke");
  stroke-width: v-bind("config.states.selected.strokeWidth");
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
