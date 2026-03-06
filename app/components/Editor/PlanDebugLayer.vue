<script setup lang="ts">
/**
 * Plan Debug Overlay
 *
 * Renders raw geometry used by room detection:
 * - extracted straight segments from PDF
 * - filtered wall segments
 * - graph edges and merged graph nodes
 */

import { useRoomDetection } from "@/composables/editor/useRoomDetection"

const { debugLayerEnabled, debugData, isDetecting } = useRoomDetection()
const viewportStore = useViewportStore()

const inverseScale = computed(() => viewportStore.getInverseScale)
const rawStrokeWidth = computed(() => 0.4 * inverseScale.value)
const wallStrokeWidth = computed(() => 0.8 * inverseScale.value)
const edgeStrokeWidth = computed(() => 1.2 * inverseScale.value)
const nodeRadius = computed(() => 1.8 * inverseScale.value)
</script>

<template>
  <g v-if="debugLayerEnabled && debugData" class="plan-debug-layer" pointer-events="none">
    <!-- Raw extracted segments (all straight content) -->
    <line
      v-for="(segment, index) in debugData.rawSegments"
      :key="`raw-${index}`"
      :x1="segment.start.x"
      :y1="segment.start.y"
      :x2="segment.end.x"
      :y2="segment.end.y"
      stroke="hsl(200, 30%, 70%)"
      stroke-opacity="0.2"
      :stroke-width="rawStrokeWidth"
    />

    <!-- Wall-like segments after bounds/length filtering -->
    <line
      v-for="(segment, index) in debugData.wallSegments"
      :key="`wall-${index}`"
      :x1="segment.start.x"
      :y1="segment.start.y"
      :x2="segment.end.x"
      :y2="segment.end.y"
      stroke="hsl(42, 90%, 55%)"
      stroke-opacity="0.75"
      :stroke-width="wallStrokeWidth"
    />

    <!-- Graph edges used for face traversal -->
    <line
      v-for="(segment, index) in debugData.edges"
      :key="`edge-${index}`"
      :x1="segment.start.x"
      :y1="segment.start.y"
      :x2="segment.end.x"
      :y2="segment.end.y"
      stroke="hsl(8, 92%, 56%)"
      stroke-opacity="0.8"
      :stroke-width="edgeStrokeWidth"
    />

    <!-- Graph nodes -->
    <circle
      v-for="(node, index) in debugData.nodes"
      :key="`node-${index}`"
      :cx="node.x"
      :cy="node.y"
      :r="nodeRadius"
      fill="hsl(142, 72%, 43%)"
      fill-opacity="0.85"
    />

    <!-- Overlay stats -->
    <text
      :x="10 * inverseScale"
      :y="20 * inverseScale"
      :font-size="10 * inverseScale"
      fill="hsl(0, 0%, 98%)"
      font-family="sans-serif"
      font-weight="600"
    >
      raw {{ debugData.rawSegments.length }} | walls {{ debugData.wallSegments.length }} | edges
      {{ debugData.edges.length }} | nodes {{ debugData.nodes.length }} | faces {{ debugData.faceCount }}
    </text>

    <text
      v-if="isDetecting"
      :x="10 * inverseScale"
      :y="34 * inverseScale"
      :font-size="10 * inverseScale"
      fill="hsl(210, 100%, 70%)"
      font-family="sans-serif"
    >
      Updating debug geometry...
    </text>
  </g>
</template>
