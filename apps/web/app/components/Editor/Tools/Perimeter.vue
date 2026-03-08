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

  // Total label font size
  totalLabel: {
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

const { s, screenTransform, stampedTransform } = useToolViewport()
</script>
<template>
  <g class="perimeter-tool">
    <!-- Completed annotations - single rendering path for both modes -->
    <EditorAnnotation v-for="perimeter in completed" :key="perimeter.id" :annotation="perimeter">
      <template #content="{ annotation, isSelected }">
        <!-- Polygon -->
        <polygon :points="toSvgPoints(annotation.points)" :fill="config.fillColor" :fill-opacity="config.opacity"
          :stroke="config.strokeColor" :stroke-width="config.strokeWidth" class="perimeter-polygon"
          :class="{ 'selected-polygon': isSelected }" />

        <!-- Individual segment labels -->
        <EditorToolLabel v-for="(segment, idx) in annotation.segments" :key="idx" :text="`${segment.length}mm`"
          :transform="stampedTransform(segment.midpoint.x, segment.midpoint.y, annotation.labelScale)" :font-size="config.labelSize"
          :fill="config.labelColor" />

        <!-- Total perimeter label at center -->
        <EditorToolLabel :text="`Total: ${annotation.totalLength}mm`"
          :transform="stampedTransform(annotation.center.x, annotation.center.y, annotation.labelScale)"
          :font-size="config.labelSize + config.totalLabel.fontSizeBonus" :fill="config.labelColor" />
      </template>
    </EditorAnnotation>

    <!-- Preview while drawing - interactive mode only -->
    <g v-if="tempEndPoint" class="preview">
      <!-- Cursor indicator (before first click) -->
      <circle v-if="!isDrawing" :cx="tempEndPoint.x" :cy="tempEndPoint.y" :r="s(config.preview.cursorIndicator.radius)"
        fill="none" :stroke="config.strokeColor" :stroke-width="s(config.preview.cursorIndicator.strokeWidth)"
        :opacity="config.preview.cursorIndicator.opacity" />

      <!-- After first click -->
      <g v-if="isDrawing">
        <!-- Placed point markers -->
        <circle v-for="(point, index) in points" :key="`point-${index}`" :cx="point.x" :cy="point.y"
          :r="s(index === 0 ? config.preview.pointMarkers.firstRadius : config.preview.pointMarkers.otherRadius)"
          :fill="index === 0 ? config.preview.pointMarkers.firstFill : config.strokeColor"
          :stroke="config.preview.pointMarkers.stroke" :stroke-width="s(config.preview.pointMarkers.strokeWidth)"
          class="point-marker" />

        <!-- Preview polygon (if we have enough points) -->
        <polygon v-if="points.length >= 2" :points="toSvgPoints([...points, tempEndPoint || points[points.length - 1]])"
          :fill="config.fillColor" :fill-opacity="config.opacity * config.preview.polygon.opacityMultiplier"
          :stroke="config.strokeColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="5,5" />

        <!-- Preview segment labels -->
        <g v-for="(segment, idx) in previewSegments" :key="idx">
          <line :x1="segment.start.x" :y1="segment.start.y" :x2="segment.end.x" :y2="segment.end.y"
            :stroke="config.strokeColor" stroke-width="1" vector-effect="non-scaling-stroke"
            :stroke-dasharray="idx === previewSegments.length - 1 ? '5,5' : '0'" />

          <EditorToolLabel :text="`${segment.length}mm`"
            :transform="screenTransform(segment.midpoint.x, segment.midpoint.y)"
            :font-size="config.preview.segmentLabel.fontSize" :fill="config.preview.segmentLabel.fill" />
        </g>

        <!-- Snap to close indicator -->
        <g v-if="canSnapToClose && points.length > 0 && points[0]">
          <circle :cx="points[0].x" :cy="points[0].y" :r="s(config.snap.radius)" fill="none"
            :stroke="config.snap.stroke" :stroke-width="s(config.snap.strokeWidth)" class="snap-indicator" />
          <text :x="config.snap.text.offsetX" :y="-config.snap.text.offsetY" :fill="config.snap.text.fill"
            :transform="screenTransform(points[0].x, points[0].y)" :font-size="config.snap.text.fontSize"
            :font-weight="config.snap.text.fontWeight">
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
