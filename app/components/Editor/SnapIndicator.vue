<script setup lang="ts">
/**
 * Snap Indicator
 *
 * Renders visual feedback when the cursor snaps to a target.
 * Sits inside the SVG annotation layer so coordinates are in PDF space.
 */
import { useSnapProvider } from "@/composables/editor/useSnapProvider"

const { snapIndicator } = useSnapProvider()

const SIZE = 5
</script>

<template>
  <g v-if="snapIndicator" pointer-events="none">
    <!-- Markup endpoint: cyan square -->
    <rect
      v-if="snapIndicator.source === 'markup'"
      :x="snapIndicator.point.x - SIZE"
      :y="snapIndicator.point.y - SIZE"
      :width="SIZE * 2"
      :height="SIZE * 2"
      fill="none"
      stroke="#00CCFF"
      :stroke-width="1.5"
    />

    <!-- Content endpoint: white square with dark stroke -->
    <rect
      v-if="snapIndicator.source === 'content' && snapIndicator.type === 'endpoint'"
      :x="snapIndicator.point.x - SIZE"
      :y="snapIndicator.point.y - SIZE"
      :width="SIZE * 2"
      :height="SIZE * 2"
      fill="white"
      fill-opacity="0.8"
      stroke="#333"
      :stroke-width="1.5"
    />

    <!-- Content intersection: X mark -->
    <g v-if="snapIndicator.source === 'content' && snapIndicator.type === 'intersection'">
      <line
        :x1="snapIndicator.point.x - SIZE"
        :y1="snapIndicator.point.y - SIZE"
        :x2="snapIndicator.point.x + SIZE"
        :y2="snapIndicator.point.y + SIZE"
        stroke="#333"
        :stroke-width="1.5"
      />
      <line
        :x1="snapIndicator.point.x + SIZE"
        :y1="snapIndicator.point.y - SIZE"
        :x2="snapIndicator.point.x - SIZE"
        :y2="snapIndicator.point.y + SIZE"
        stroke="#333"
        :stroke-width="1.5"
      />
    </g>

    <!-- Content midpoint: diamond -->
    <polygon
      v-if="snapIndicator.source === 'content' && snapIndicator.type === 'midpoint'"
      :points="`
        ${snapIndicator.point.x},${snapIndicator.point.y - SIZE}
        ${snapIndicator.point.x + SIZE},${snapIndicator.point.y}
        ${snapIndicator.point.x},${snapIndicator.point.y + SIZE}
        ${snapIndicator.point.x - SIZE},${snapIndicator.point.y}
      `"
      fill="white"
      fill-opacity="0.8"
      stroke="#FF8800"
      :stroke-width="1.5"
    />

    <!-- Nearest-on-edge: circle -->
    <circle
      v-if="snapIndicator.type === 'nearest-on-edge'"
      :cx="snapIndicator.point.x"
      :cy="snapIndicator.point.y"
      :r="SIZE"
      fill="none"
      stroke="#22CC66"
      :stroke-width="1.5"
    />

    <!-- Label -->
    <text
      :x="snapIndicator.point.x + SIZE + 3"
      :y="snapIndicator.point.y - SIZE - 2"
      :fill="snapIndicator.source === 'markup' ? '#00CCFF' : '#555'"
      font-size="8"
      font-family="sans-serif"
    >
      {{ snapIndicator.label }}
    </text>
  </g>
</template>
