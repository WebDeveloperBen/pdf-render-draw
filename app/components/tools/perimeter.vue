<script setup lang="ts">
import type { KonvaPointerEvent } from "konva/lib/PointerEvents"

/**
 * State
 */

// const usePerimeter = usePerimeterTool()
const { handlePerimeterClick } = usePerimeter()
const { getPerimeters, getActiveTool } = storeToRefs(useMainStore())
const settings = useSettingStore()
</script>
<template>
  <v-group
    @mouseover="handleMouseOver"
    @mouseout="handleMouseOut"
    @click="(e: KonvaPointerEvent) => handlePerimeterClick(e)"
    v-for="(perimeter, pIndex) in getPerimeters"
    :key="`perimeter-${pIndex}`"
  >
    <!-- Render points for this perimeter -->
    <v-circle
      v-for="(point, pointIndex) in perimeter.points"
      :key="`perimeter-${pIndex}-point-${pointIndex}`"
      :config="{
        x: point.x,
        y: point.y,
        radius: 1.5,
        fill: 'green',
        hitStrokeWidth: 20,
        listening: getActiveTool === 'selection',
        perfectDrawEnabled: false,
      }"
    />
    <!-- Render lines for this perimeter -->
    <v-line
      v-for="(line, lineIndex) in perimeter.lines"
      :key="`perimeter-${pIndex}-line-${lineIndex}`"
      :config="{
        points: line.points,
        stroke: settings.getPerimeterStrokeColor,
        strokeWidth: 1,
        hitStrokeWidth: 20,
        listening: getActiveTool === 'selection',
        perfectDrawEnabled: false,
        name: line.name,
      }"
    />
    <!-- Render Text for each line of the Perimeter Tool -->
    <template v-for="(label, pLineIdx) in perimeter.lines" :key="`text-label-${pLineIdx}`">
      <v-text
        v-if="settings.getShowAnnotations"
        :config="{
          ...renderPerimeterLabelConfig(
            label,
            settings.getAnnotationDefaultDistance,
            perimeter,
            settings.getDisplayMeasurementValues
          ),
          name: label.name,
          fill: settings.getPerimeterLabelColor,
          hitStrokeWidth: 20,
          fontSize: settings.getPerimeterLabelSize * 0.6,
          listening: getActiveTool === 'selection',
          perfectDrawEnabled: false,
        }"
      />
    </template>

    <!-- Render Annotation for Perimeter Total Distance End point -->
    <v-text
      v-if="settings.getShowAnnotations"
      :config="{
        text:
          perimeter.totalDistance > 0
            ? perimeter.totalDistance + settings.getDisplayMeasurementValues
            : '',
        x: perimeter.points[perimeter.points.length - 1].x + 4,
        y: perimeter.points[perimeter.points.length - 1].y + 4,
        fontSize: settings.getPerimeterLabelSize * 0.8,
        fill: 'black',
        hitStrokeWidth: 20,
        fontStyle: settings.getPerimeterLabelStrokeStyle,
        listening: getActiveTool === 'selection',
        perfectDrawEnabled: false,
        name: perimeter.name,
      }"
    />
  </v-group>
</template>
