<script setup lang="ts">
import type { KonvaPointerEvent } from "konva/lib/PointerEvents"

/**
 * State
 */

const { handleTextClick, handleTransformEnd, handleDragStart, handleDragEnd } = useText()
const { getSelectedText, getTexts, getActiveTool } = storeToRefs(useMainStore())
const settings = useSettingStore()

/**
 * Functions
 */

const handleTextMouseOver = (e: KonvaPointerEvent) => {
  const stage = e.target.getStage()

  if (stage) {
    if (getSelectedText.value?.name === e.target.attrs.name) {
      stage.container().style.cursor = "move"
      return
    }
    stage.container().style.cursor = "pointer"
  }
}
</script>
<template>
  <v-group>
    <v-text
      v-for="(t, tIdx) in getTexts"
      :key="tIdx"
      :config="{
        ...t,
        draggable: true,
        align: 'center',
        fontSize: settings.getTextFontSize,
        listening: getActiveTool === 'selection',
      }"
      @mouseover="(e:KonvaPointerEvent) => handleTextMouseOver(e)"
      @mouseout="(e:KonvaPointerEvent) => handleMouseOut(e)"
      @transformend="(e:KonvaPointerEvent) => handleTransformEnd(e)"
      @click="(e:KonvaPointerEvent) => handleTextClick(e)"
      @dragstart="(e:KonvaPointerEvent) => handleDragStart(e)"
      @dragend="(e: KonvaPointerEvent) =>handleDragEnd(e)"
    />
  </v-group>
</template>
