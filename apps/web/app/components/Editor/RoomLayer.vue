<script setup lang="ts">
/**
 * Room Detection Overlay
 *
 * Renders detected rooms as semi-transparent highlighted polygons
 * on top of the PDF. Sits inside the SVG annotation layer so
 * coordinates are in viewport/PDF space.
 *
 * Uses inverse-scale for stroke width so it appears consistent
 * across zoom levels.
 */

import { ROOMS } from "@/constants/rooms"
import { useRoomDetection } from "@/composables/editor/useRoomDetection"

const { detectedRooms, isDetecting, roomLayerEnabled, detectionStats } = useRoomDetection()
const viewportStore = useViewportStore()

const inverseScale = computed(() => viewportStore.getInverseScale)
const strokeWidth = computed(() => ROOMS.STROKE_WIDTH_PX * inverseScale.value)

function polygonPoints(polygon: readonly Point[]): string {
  return polygon.map((p) => `${p.x},${p.y}`).join(" ")
}
</script>

<template>
  <g v-if="roomLayerEnabled" class="room-layer" pointer-events="none">
    <!-- Loading indicator at top-left -->
    <text
      v-if="isDetecting"
      :x="10 * inverseScale"
      :y="20 * inverseScale"
      :font-size="12 * inverseScale"
      fill="hsl(210, 80%, 60%)"
      font-family="sans-serif"
    >
      Detecting rooms...
    </text>

    <!-- Room polygons -->
    <polygon
      v-for="room in detectedRooms"
      :key="room.id"
      :points="polygonPoints(room.polygon)"
      :fill="ROOMS.FILL_COLOR"
      :fill-opacity="ROOMS.FILL_OPACITY"
      :stroke="ROOMS.STROKE_COLOR"
      :stroke-opacity="ROOMS.STROKE_OPACITY"
      :stroke-width="strokeWidth"
      stroke-linejoin="round"
    />

    <!-- Room labels at centroid -->
    <text
      v-for="room in detectedRooms"
      :key="`label-${room.id}`"
      :x="room.centroid.x"
      :y="room.centroid.y"
      :font-size="10 * inverseScale"
      fill="hsl(210, 80%, 40%)"
      font-family="sans-serif"
      font-weight="600"
      text-anchor="middle"
      dominant-baseline="central"
    >
      {{ room.label || `${Math.round(room.area).toLocaleString()} pt²` }}
    </text>

    <!-- Stats badge -->
    <text
      v-if="detectionStats && detectedRooms.length > 0"
      :x="10 * inverseScale"
      :y="20 * inverseScale"
      :font-size="10 * inverseScale"
      fill="hsl(210, 60%, 50%)"
      fill-opacity="0.7"
      font-family="sans-serif"
    >
      {{ detectedRooms.length }} rooms detected
    </text>
  </g>
</template>
