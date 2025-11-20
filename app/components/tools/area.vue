<script setup lang="ts">
import type { KonvaPointerEvent } from "konva/lib/PointerEvents"

/**
 * State
 */

// const useArea = useAreaTool()
const { handleAreaClick } = useArea()
const { getAreas, getActiveTool } = storeToRefs(useMainStore())

const settings = useSettingStore()

/**
 * Functions
 */
</script>
<template>
  <v-group
    @mouseover="handleMouseOver"
    @mouseout="handleMouseOut"
    @click="(e: KonvaPointerEvent) => handleAreaClick(e)"
    v-for="(area, aIndex) in getAreas"
    :key="`area-${aIndex}`"
  >
    <!-- Render points for this area -->

    <v-ring
      v-for="(point, pointIndex) in area.points"
      :key="`area-${aIndex}-point-${pointIndex}`"
      :config="{
        x: point.x,
        y: point.y,
        innerRadius: 1,
        outerRadius: 2.5,
        strokeWidth: 1,
        hitStrokeWidth: 20,
        stroke: settings.getAreaLineColor,
        radius: 1,
        name: area.name,
        listening: getActiveTool === 'selection',
        perfectDrawEnabled: false,
      }"
    />
    <!-- Render lines for this area -->
    <v-line
      v-for="(line, lineIndex) in area.lines"
      :key="`area-${aIndex}-line-${lineIndex}`"
      :config="{
        points: line.points,
        stroke: settings.getAreaLineColor,
        strokeWidth: settings.getAreaLineStrokeWidth * 0.4,
        hitStrokeWidth: 20,
        shadowForStrokeEnabled: false,
        listening: getActiveTool === 'selection',
        perfectDrawEnabled: false,
        name: area.name,
      }"
    />
    <v-shape
      @click="(e: KonvaPointerEvent) => handleAreaClick(e)"
      :config="{
        ...renderAreaShapeConfig(area),
        fill: settings.getAreaFillColor,
        opacity: 0.35,
        stroke: settings.getAreaFillColor,
        strokeWidth: 2,
        hitStrokeWidth: 20,
        name: area.name,
        listening: getActiveTool === 'selection',
      }"
    />
    <!-- Render Annotations for Area Tool -->
    <v-text
      v-if="area.totalArea > 0 && settings.getShowAnnotations"
      :config="{
        text: area.totalArea.toFixed(2) + 'm²',
        ...getCentroid(area),
        fontSize: settings.getAreaLabelSize * 0.8,
        fontStyle: settings.getAreaLabelStrokeStyle,
        fill: settings.getAreaLabelColor,
        listening: getActiveTool === 'selection',
        perfectDrawEnabled: false,
        name: area.name,
        hitStrokeWidth: 20,
      }"
    />
  </v-group>
</template>
