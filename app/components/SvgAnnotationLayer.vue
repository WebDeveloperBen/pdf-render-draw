<template>
  <svg
    ref="svgRef"
    :viewBox="`0 0 ${pdfWidth} ${pdfHeight}`"
    :style="svgStyle"
    class="svg-annotation-layer"
    @click="handleClick"
    @mousedown="handleMouseDown"
    @mousemove="handleMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
    @dblclick="handleDoubleClick"
  >
    <!-- Render active tool + all completed annotations -->
    <MeasureTool
      v-if="annotationStore.activeTool === 'measure' || annotationStore.getAnnotationsByType('measure').length > 0"
    />
    <AreaTool v-if="annotationStore.activeTool === 'area' || annotationStore.getAnnotationsByType('area').length > 0" />
    <PerimeterTool
      v-if="annotationStore.activeTool === 'perimeter' || annotationStore.getAnnotationsByType('perimeter').length > 0"
    />
    <LineTool v-if="annotationStore.activeTool === 'line' || annotationStore.getAnnotationsByType('line').length > 0" />
    <FillTool v-if="annotationStore.activeTool === 'fill' || annotationStore.getAnnotationsByType('fill').length > 0" />
    <TextTool v-if="annotationStore.activeTool === 'text' || annotationStore.getAnnotationsByType('text').length > 0" />

    <!-- Selection marquee (drag-to-select rectangle) -->
    <rect
      v-if="selectionMarquee.isDrawing && selectionMarquee.marqueeBounds"
      :x="selectionMarquee.marqueeBounds.x"
      :y="selectionMarquee.marqueeBounds.y"
      :width="selectionMarquee.marqueeBounds.width"
      :height="selectionMarquee.marqueeBounds.height"
      fill="rgba(66, 153, 225, 0.1)"
      stroke="#4299e1"
      stroke-width="2"
      stroke-dasharray="4 4"
      class="selection-marquee"
      pointer-events="none"
    />

    <!-- Transform handles for selected annotation -->
    <TransformHandles />
  </svg>
</template>

<script setup lang="ts">
import MeasureTool from "~/components/tools/MeasureTool.vue"
import AreaTool from "~/components/tools/AreaTool.vue"
import PerimeterTool from "~/components/tools/PerimeterTool.vue"
import LineTool from "~/components/tools/LineTool.vue"
import FillTool from "~/components/tools/FillTool.vue"
import TextTool from "~/components/tools/TextTool.vue"
import TransformHandles from "~/components/handles/TransformHandles.vue"

const rendererStore = useRendererStore()
const annotationStore = useAnnotationStore()

// SVG element ref
const svgRef = ref<SVGSVGElement>()

// PDF dimensions
const pdfWidth = computed(() => rendererStore.getCanvasSize.width)
const pdfHeight = computed(() => rendererStore.getCanvasSize.height)

// SVG positioning (overlays PDF exactly)
// SVG scales by changing dimensions (not CSS transform) to maintain crisp vector rendering
const svgStyle = computed(() => {
  const scaledWidth = pdfWidth.value * rendererStore.getScale
  const scaledHeight = pdfHeight.value * rendererStore.getScale

  // Calculate offset to keep centered when scaling
  const offsetX = (scaledWidth - pdfWidth.value) / 2
  const offsetY = (scaledHeight - pdfHeight.value) / 2

  return {
    position: "absolute" as const,
    top: "0",
    left: "0",
    width: `${scaledWidth}px`,
    height: `${scaledHeight}px`,
    transform: rendererStore.getSvgTransform(offsetX, offsetY),
    transformOrigin: "center center" as const,
    pointerEvents: "all" as const,
    zIndex: 10,
    willChange: "width, height, transform" as const
  }
})

const measureTool = useMeasureTool()
const areaTool = useAreaTool()
const perimeterTool = usePerimeterTool()
const lineTool = useLineTool()
const fillTool = useFillTool()
const textTool = useTextTool()
const selectionMarquee = useSelectionMarquee()

function handleMouseDown(e: MouseEvent) {
  const tool = annotationStore.activeTool
  const target = e.target as SVGElement
  const annotationId = target.dataset?.annotationId || target.closest('[data-annotation-id]')?.getAttribute('data-annotation-id')

  // Start selection marquee only if:
  // 1. In selection mode or no tool active
  // 2. Clicking on empty space (not on annotation)
  // 3. Not clicking on transform handles
  if ((tool === 'selection' || tool === '') && !annotationId && svgRef.value) {
    selectionMarquee.startMarquee(e, svgRef.value)
  }
}

function handleMouseUp(e: MouseEvent) {
  if (selectionMarquee.isDrawing) {
    selectionMarquee.endMarquee()
  }
}

function handleMouseLeave(e: MouseEvent) {
  // Clear cursor preview for all tools when mouse leaves canvas
  measureTool.clearPreview?.()
  areaTool.clearPreview?.()
  perimeterTool.clearPreview?.()
  lineTool.clearPreview?.()
  fillTool.clearPreview?.()
  textTool.clearPreview?.()
}

// Event routing
function handleClick(e: MouseEvent) {
  const tool = annotationStore.activeTool

  // Check if clicking on an existing annotation to select it
  const target = e.target as SVGElement
  const annotationId = target.dataset?.annotationId || target.closest('[data-annotation-id]')?.getAttribute('data-annotation-id')

  if (annotationId && (tool === 'selection' || tool === '') && !annotationStore.isDrawing) {
    // Click on annotation while in selection mode (and not actively drawing)
    annotationStore.selectAnnotation(annotationId)
    return
  }

  // Click outside any annotation - deselect if in selection mode or no tool active
  // But only if not drawing marquee (to avoid deselecting during drag)
  if (!annotationId && (tool === 'selection' || tool === '') && !selectionMarquee.isDrawing) {
    annotationStore.selectAnnotation(null)
    return
  }

  console.debug("SVG Layer Click:", {
    tool,
    target: e.target,
    clientX: e.clientX,
    clientY: e.clientY,
    svgRef: svgRef.value
  })

  switch (tool) {
    case "measure":
      console.debug("Calling measure tool handleClick")
      measureTool.handleClick(e)
      break
    case "area":
      console.debug("Calling area tool handleClick")
      areaTool.handleClick(e)
      break
    case "perimeter":
      console.debug("Calling perimeter tool handleClick")
      perimeterTool.handleClick(e)
      break
    case "line":
      console.debug("Calling line tool handleClick")
      lineTool.handleClick(e)
      break
    case "fill":
      console.debug("Calling fill tool handleClick")
      fillTool.handleClick(e)
      break
    case "text":
      console.debug("Calling text tool handleClick")
      textTool.handleClick(e)
      break
    default:
      console.debug("No tool selected or unknown tool:", tool)
  }
}

function handleMove(e: MouseEvent) {
  const tool = annotationStore.activeTool
  console.debug("SVG handleMove:", { tool, hasTarget: !!e.target })

  // Update selection marquee if dragging (only in selection mode)
  if (selectionMarquee.isDrawing && (tool === 'selection' || tool === '') && svgRef.value) {
    selectionMarquee.updateMarquee(e, svgRef.value)
    return  // Don't process tool moves while selecting
  }

  switch (tool) {
    case "measure":
      measureTool.handleMove(e)
      break
    case "area":
      areaTool.handleMove(e)
      break
    case "perimeter":
      perimeterTool.handleMove(e)
      break
    case "line":
      lineTool.handleMove(e)
      break
    default:
      console.debug("No matching tool for handleMove:", tool)
  }
}

function handleDoubleClick(e: MouseEvent) {
  // Text editing - allow editing text regardless of active tool
  const target = e.target as SVGElement
  const id = target.dataset.annotationId
  if (id) {
    const annotation = annotationStore.getAnnotationById(id)
    if (annotation?.type === 'text') {
      textTool.handleDoubleClick(id)
      e.stopPropagation()
    }
  }
}

// Keyboard shortcuts
function handleKeyDown(e: KeyboardEvent) {
  measureTool.handleKeyDown(e)
  areaTool.handleKeyDown(e)
  perimeterTool.handleKeyDown(e)
  lineTool.handleKeyDown(e)

  // Global shortcuts
  if (e.key === "Escape") {
    annotationStore.setActiveTool("selection")
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown)
})
</script>

<style scoped>
.svg-annotation-layer {
  cursor: crosshair;
}

.svg-annotation-layer.selection-mode {
  cursor: default;
}
</style>
