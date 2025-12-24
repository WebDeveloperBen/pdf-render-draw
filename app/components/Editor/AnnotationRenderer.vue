<script setup lang="ts">
/**
 * AnnotationRenderer - Export-only component for rendering annotations to SVG
 *
 * This component renders annotations using the existing tool components but
 * in export mode (without interactivity). Used by useExportPdf to generate
 * SVG strings via Vue SSR without needing the DOM.
 */

// Import tool components directly
import ToolsMeasure from "~/components/Editor/Tools/Measure.vue"
import ToolsCount from "~/components/Editor/Tools/Count.vue"
import ToolsArea from "~/components/Editor/Tools/Area.vue"
import ToolsPerimeter from "~/components/Editor/Tools/Perimeter.vue"
import ToolsLine from "~/components/Editor/Tools/Line.vue"
import ToolsFill from "~/components/Editor/Tools/Fill.vue"
import ToolsText from "~/components/Editor/Tools/Text.vue"
import type { Annotation, ToolType } from "#shared/types/annotations.types"

const props = defineProps<{
  annotations: Annotation[]
  width: number
  height: number
}>()

// Map of tool types to their components
const toolComponents = {
  measure: ToolsMeasure,
  count: ToolsCount,
  area: ToolsArea,
  perimeter: ToolsPerimeter,
  line: ToolsLine,
  fill: ToolsFill,
  text: ToolsText
} as const

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
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
  >
    <!-- Render each tool type's annotations using the same components as the editor -->
    <!-- Each tool type group contains correctly-typed annotations at runtime -->
    <template v-for="[type, anns] in annotationsByType" :key="type">
      <component
        :is="toolComponents[type]"
        v-if="toolComponents[type]"
        :annotations="(anns as any)"
        :export-mode="true"
      />
    </template>
  </svg>
</template>
