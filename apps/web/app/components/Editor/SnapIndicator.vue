<script setup lang="ts">
/**
 * Snap Indicator
 *
 * Renders visual feedback when the cursor snaps to a target.
 * Sits inside the SVG annotation layer so coordinates are in PDF space.
 * Uses inverse-scale transform so indicators appear at a consistent
 * screen size regardless of zoom level.
 */

const { snapIndicator } = useSnapProvider()
const viewportStore = useViewportStore()

/** Indicator size in screen pixels (constant regardless of zoom) */
const SIZE_PX = 5
const FONT_PX = 9
const STROKE_PX = 1.5

const inverseScale = computed(() => viewportStore.getInverseScale)
const size = computed(() => SIZE_PX * inverseScale.value)
const strokeWidth = computed(() => STROKE_PX * inverseScale.value)
const fontSize = computed(() => FONT_PX * inverseScale.value)
</script>

<template>
  <g v-if="snapIndicator" pointer-events="none">
    <!-- Markup endpoint: cyan square -->
    <rect v-if="snapIndicator.source === 'markup'" :x="snapIndicator.point.x - size" :y="snapIndicator.point.y - size"
      :width="size * 2" :height="size * 2" fill="none" stroke="#00CCFF" :stroke-width="strokeWidth" />

    <!-- Content endpoint: white square with dark stroke -->
    <rect v-if="snapIndicator.source === 'content' && snapIndicator.type === 'endpoint'"
      :x="snapIndicator.point.x - size" :y="snapIndicator.point.y - size" :width="size * 2" :height="size * 2"
      fill="white" fill-opacity="0.8" stroke="#333" :stroke-width="strokeWidth" />

    <!-- Content intersection: X mark -->
    <g v-if="snapIndicator.source === 'content' && snapIndicator.type === 'intersection'">
      <line :x1="snapIndicator.point.x - size" :y1="snapIndicator.point.y - size" :x2="snapIndicator.point.x + size"
        :y2="snapIndicator.point.y + size" stroke="#333" :stroke-width="strokeWidth" />
      <line :x1="snapIndicator.point.x + size" :y1="snapIndicator.point.y - size" :x2="snapIndicator.point.x - size"
        :y2="snapIndicator.point.y + size" stroke="#333" :stroke-width="strokeWidth" />
    </g>

    <!-- Content midpoint: diamond -->
    <polygon v-if="snapIndicator.source === 'content' && snapIndicator.type === 'midpoint'" :points="`
        ${snapIndicator.point.x},${snapIndicator.point.y - size}
        ${snapIndicator.point.x + size},${snapIndicator.point.y}
        ${snapIndicator.point.x},${snapIndicator.point.y + size}
        ${snapIndicator.point.x - size},${snapIndicator.point.y}
      `" fill="white" fill-opacity="0.8" stroke="#FF8800" :stroke-width="strokeWidth" />

    <!-- Nearest-on-edge: circle -->
    <circle v-if="snapIndicator.type === 'nearest-on-edge'" :cx="snapIndicator.point.x" :cy="snapIndicator.point.y"
      :r="size" fill="none" stroke="#22CC66" :stroke-width="strokeWidth" />

    <!-- Label -->
    <text :x="snapIndicator.point.x + size + 3 * inverseScale" :y="snapIndicator.point.y - size - 2 * inverseScale"
      :fill="snapIndicator.source === 'markup' ? '#00CCFF' : '#555'" :font-size="fontSize" font-family="sans-serif">
      {{ snapIndicator.label }}
    </text>
  </g>
</template>
