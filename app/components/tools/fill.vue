<script setup lang="ts">
import type { KonvaPointerEvent } from "konva/lib/PointerEvents"

/**
 * State
 */

const { getFills, getActiveTool } = storeToRefs(useMainStore())
const { handleFillClick, handleDragStart, handleDragEnd, handleTransformEnd } = useFill()
const settings = useSettingStore()
const { getStageConfig } = storeToRefs(useRendererStore())
</script>
<template>
  <v-group
    v-for="(rec, fillIdx) in getFills"
    :key="fillIdx"
    @click="handleFillClick"
    @mouseover="handleMouseOver"
    @mouseout="handleMouseOut"
  >
    <v-rect
      :config="{
        x: Math.min(rec.x, rec.x + rec.width),
        y: Math.min(rec.y, rec.y + rec.height),
        width: Math.abs(rec.width),
        height: Math.abs(rec.height),
        name: rec.name,
        fill: settings.getFillFillColor,
        opacity: settings.getFillOpacity,
        stroke: settings.getFillStrokeColor,
        strokeWidth: settings.getFillStrokeWidth,
        listening: getActiveTool === 'selection',
        draggable: getActiveTool === 'selection' && !getStageConfig.draggable,
      }"
      @dragstart="(e:KonvaPointerEvent) => handleDragStart(e)"
      @dragend="(e: KonvaPointerEvent) => handleDragEnd(e)"
      @transformend="(e:KonvaPointerEvent) => handleTransformEnd(e)"
    />
  </v-group>
</template>
