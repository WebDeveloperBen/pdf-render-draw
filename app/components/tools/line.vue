<script setup lang="ts">
import type { KonvaPointerEvent } from "konva/lib/PointerEvents"

/**
 * State
 */

// const useLine = useLineTool()
const { handleLineClick } = useLine()
const { getLines, getActiveTool } = storeToRefs(useMainStore())
const settings = useSettingStore()
</script>
<template>
  <v-group
    @mouseover="handleMouseOver"
    @mouseout="handleMouseOut"
    @click="(e: KonvaPointerEvent) => handleLineClick(e)"
    v-for="(line, pIndex) in getLines"
    :key="`line-${pIndex}`"
  >
    <!-- Render points for this line -->
    <v-circle
      v-for="(point, pointIndex) in line.points"
      :key="`line-${pIndex}-point-${pointIndex}`"
      :config="{
        x: point.x,
        y: point.y,
        radius: 2,
        fill: 'blue',
        hitStrokeWidth: 20,
        listening: getActiveTool === 'selection',
        perfectDrawEnabled: false,
      }"
    />
    <!-- Render lines for this line -->
    <v-line
      v-for="(l, lineIndex) in line.lines"
      :key="`line-${lineIndex}`"
      :config="{
        points: l.points,
        stroke: settings.getlineStrokeColor,
        strokeWidth: settings.getlineStrokeWidth,
        hitStrokeWidth: 20,
        fill: 'blue',
        listening: getActiveTool === 'selection',
        perfectDrawEnabled: false,
        name: l.name,
      }"
    />
  </v-group>
</template>
