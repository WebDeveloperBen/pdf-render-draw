<script setup lang="ts">
/**
 * AnnotationRenderer - Export-only component for rendering annotations to SVG
 *
 * This component renders annotations using the existing tool components but
 * in export mode (without interactivity). Used by useExportPdf to generate
 * SVG strings via Vue SSR without needing the DOM.
 */

import { toolComponents } from "~/components/Editor/Tools"
import type { Annotation, ToolType } from "#shared/types/annotations.types"

// Provide tool injection context so child tool components get a valid instance.
// registerTool is a no-op here since tools are already registered by the editor.
useCountTool()
useMeasureTool()
useAreaTool()
usePerimeterTool()
useLineTool()
useTextTool()
useFillTool()

const props = defineProps<{
  annotations: Annotation[]
  width: number
  height: number
}>()

// Group annotations by type for efficient rendering
const annotationsByType = computed(() => {
  const grouped = new Map<ToolType, Annotation[]>()
  for (const ann of props.annotations) {
    const list = grouped.get(ann.type) || []
    list.push(ann)
    grouped.set(ann.type, list)
  }
  return grouped
})
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" :viewBox="`0 0 ${width} ${height}`" :width="width" :height="height">
    <!-- Render each tool type's annotations using the same components as the editor -->
    <!-- Each tool type group contains correctly-typed annotations at runtime -->
    <template v-for="[type, anns] in annotationsByType" :key="type">
      <component :is="toolComponents[type]" v-if="toolComponents[type]" :annotations="anns as any" />
    </template>
  </svg>
</template>
