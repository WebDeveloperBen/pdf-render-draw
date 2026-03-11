<script setup lang="ts">
/**
 * Snap Debug Overlay
 *
 * Renders extracted PDF segments, endpoints, midpoints, and intersections
 * directly on the SVG annotation layer. This makes it immediately visible
 * where the snap system thinks the geometry is vs where the PDF renders.
 *
 * Toggle via the snap debug button in the toolbar or console:
 *   useSnapProvider().snapDebugEnabled.value = true
 */

const { snapDebugEnabled, snapDebugData } = useSnapProvider()
const viewportStore = useViewportStore()

const inverseScale = computed(() => viewportStore.getInverseScale)
const pointRadius = computed(() => 2.5 * inverseScale.value)
const labelFontSize = computed(() => 10 * inverseScale.value)
</script>

<template>
  <g v-if="snapDebugEnabled && snapDebugData" class="snap-debug-layer" pointer-events="none">
    <!-- Extracted segments (edges) — red lines, constant 1px screen width -->
    <line
      v-for="(seg, i) in snapDebugData.segments"
      :key="`seg-${i}`"
      :x1="seg.start.x"
      :y1="seg.start.y"
      :x2="seg.end.x"
      :y2="seg.end.y"
      stroke="hsl(0, 100%, 60%)"
      stroke-opacity="0.5"
      stroke-width="1"
      vector-effect="non-scaling-stroke"
    />

    <!-- Endpoints — green dots -->
    <circle
      v-for="(pt, i) in snapDebugData.endpoints"
      :key="`ep-${i}`"
      :cx="pt.x"
      :cy="pt.y"
      :r="pointRadius"
      fill="hsl(142, 72%, 43%)"
      fill-opacity="0.8"
    />

    <!-- Midpoints — orange dots -->
    <circle
      v-for="(pt, i) in snapDebugData.midpoints"
      :key="`mp-${i}`"
      :cx="pt.x"
      :cy="pt.y"
      :r="pointRadius * 0.7"
      fill="hsl(30, 100%, 50%)"
      fill-opacity="0.7"
    />

    <!-- Intersections — cyan dots -->
    <circle
      v-for="(pt, i) in snapDebugData.intersections"
      :key="`ix-${i}`"
      :cx="pt.x"
      :cy="pt.y"
      :r="pointRadius * 0.7"
      fill="hsl(190, 100%, 50%)"
      fill-opacity="0.7"
    />

    <!-- Stats label -->
    <text
      :x="10 * inverseScale"
      :y="20 * inverseScale"
      :font-size="labelFontSize"
      fill="hsl(0, 100%, 70%)"
      font-family="sans-serif"
      font-weight="600"
    >
      SNAP DEBUG | segments {{ snapDebugData.segments.length }} | endpoints {{ snapDebugData.endpoints.length }} |
      midpoints {{ snapDebugData.midpoints.length }} | intersections {{ snapDebugData.intersections.length }}
    </text>
  </g>
</template>
