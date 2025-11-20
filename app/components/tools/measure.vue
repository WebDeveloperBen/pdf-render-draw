<script setup lang="ts">
import type Konva from "konva"

/**
 * State
 */

// const useMeasure = useMeasureTool()
const { handleMeasurementClick } = useMeasure()
const { getMeasureState, getActiveTool } = storeToRefs(useMainStore())
const settings = useSettingStore()
</script>
<template>
  <v-group
    v-for="(measurement, mIdx) in getMeasureState.measurements"
    :key="'dot-' + mIdx"
    @click="(e: Konva.KonvaPointerEvent) => handleMeasurementClick(e)"
    @mouseover="handleMouseOver"
    @mouseout="handleMouseOut"
  >
    <!-- Render lines and their annotations -->
    <template v-for="(line, mLineIdx) in measurement.lines" :key="`line-${mLineIdx}`">
      <v-line
        :config="{
          ...line.config,
          stroke: settings.getMeasureLineColor,
          strokeWidth: settings.getMeasureStrokeWidth * 0.8,
          shadowForStrokeEnabled: false,
          perfectDrawEnabled: false,
          name: line.name,
          hitStrokeWidth: 20,
          listening: getActiveTool === 'selection',
        }"
      />
      <v-line
        v-for="(dot, pointIdx) in measurement.points"
        :key="'marker-' + pointIdx"
        :config="{
          ...getMarkerLineConfig(dot, line.config, settings.getMeasureStrokeWidth * 3),
          strokeWidth: settings.getMeasureStrokeWidth * 0.8,
          stroke: line.config.fill,
          shadowForStrokeEnabled: false,
          name: line.name,
          perfectDrawEnabled: false,
          hitStrokeWidth: 20,
          listening: getActiveTool === 'selection',
        }"
      />
      <v-text
        v-if="settings.getShowAnnotations"
        :config="{
          text: `${line.distance}${settings.getDisplayMeasurementValues}`,
          x: line.midpoint.x,
          y: line.midpoint.y,
          fontSize: settings.getMeasureLabelSize,
          fontStyle: settings.getMeasureLabelStrokeStyle,
          perfectDrawEnabled: false,
          name: line.name,
          listening: getActiveTool === 'selection',
        }"
      />
    </template>
  </v-group>
</template>
