<script setup lang="ts">
import { useEventListener } from "@vueuse/core"
import { SELECTION } from "~/constants/ui"
import { debugLog } from "~/utils/debug"
import type { ToolType } from "~/types/annotations"

// Import tool components directly
import ToolsMeasure from "~/components/tools/Measure.vue"
import ToolsCount from "~/components/tools/Count.vue"
import ToolsArea from "~/components/tools/Area.vue"
import ToolsPerimeter from "~/components/tools/Perimeter.vue"
import ToolsLine from "~/components/tools/Line.vue"
import ToolsFill from "~/components/tools/Fill.vue"
import ToolsText from "~/components/tools/Text.vue"

// Map of tool types to their components for direct rendering
const toolComponents = {
  measure: ToolsMeasure,
  count: ToolsCount,
  area: ToolsArea,
  perimeter: ToolsPerimeter,
  line: ToolsLine,
  fill: ToolsFill,
  text: ToolsText
} as const

const rendererStore = useRendererStore()
const annotationStore = useAnnotationStore()

// SVG element ref
const svgRef = ref<SVGSVGElement>()

// Helper function to check if we should update the selection marquee during dragging
function shouldUpdateSelectionMarquee(tool: string) {
  return selectionMarquee.isMarqueeSelecting.value && isSelectionMode(tool) && !!svgRef.value
}

// Helper function to check if we have an active drawing tool (not selection mode)
function hasActiveDrawingTool(tool: string) {
  return tool && tool !== "selection"
}

// PDF dimensions
const pdfWidth = computed(() => rendererStore.getCanvasSize.width)
const pdfHeight = computed(() => rendererStore.getCanvasSize.height)

// SVG positioning (overlays PDF exactly)
// SVG scales via CSS transform like the canvas to maintain coordinate consistency
const svgStyle = computed(() => {
  return {
    position: "absolute" as const,
    top: "0",
    left: "0",
    width: `${pdfWidth.value}px`,
    height: `${pdfHeight.value}px`,
    transform: rendererStore.getCanvasTransform,
    transformOrigin: "center center" as const,
    pointerEvents: "all" as const,
    zIndex: 1001,
    willChange: "transform" as const
  }
})

// Initialize all tools (they register themselves when first called AND provide injection context)
useCountTool()!
useMeasureTool()!
useAreaTool()!
usePerimeterTool()!
useLineTool()!
useTextTool()!
useFillTool()!

const selectionMarquee = useEditorMarquee()
const dragState = useEditorDragState()
const toolRegistry = useToolRegistry()

// Enable keyboard shortcuts (undo/redo, copy/paste, etc.)
useKeyboardShortcuts()

// Get all registered tools for dynamic rendering
const registeredTools = computed(() => toolRegistry.getAllTools())

function handleMouseDown(e: MouseEvent) {
  const tool = annotationStore.activeTool
  const target = e.target as SVGElement
  const annotationId =
    target.dataset?.annotationId || target.closest("[data-annotation-id]")?.getAttribute("data-annotation-id")

  // Start selection marquee only if:
  // 1. In selection mode or no tool active
  // 2. Clicking on empty space (not on annotation)
  // 3. Not clicking on transform handles
  if (isSelectionMode(tool) && !annotationId) {
    selectionMarquee.startMarquee(e)
  }

  // Call registered tool's onMouseDown handler for the active tool
  const toolDef = toolRegistry.getTool(tool as ToolType)
  if (toolDef?.onMouseDown) {
    toolDef.onMouseDown(e)
  }
}

function handleMouseUp(e: MouseEvent) {
  // If marquee is active, don't process tool handlers
  // (marquee end is handled by global listeners in useEditorEventHandlers)
  if (selectionMarquee.isMarqueeSelecting.value) {
    return
  }

  // Call registered tool's onMouseUp handler for the active tool
  const tool = annotationStore.activeTool
  const toolDef = toolRegistry.getTool(tool as ToolType)
  if (toolDef?.onMouseUp) {
    toolDef.onMouseUp(e)
  }
}

function handleMouseLeave(e: MouseEvent) {
  // Clear cursor preview for all tools when mouse leaves canvas
  for (const toolDef of toolRegistry.getAllTools()) {
    toolDef.clearPreview?.()
  }

  // Call registered tool's onMouseLeave handler
  const tool = annotationStore.activeTool
  const toolDef = toolRegistry.getTool(tool as ToolType)
  if (toolDef?.onMouseLeave) {
    toolDef.onMouseLeave(e)
  }
}

// Event routing
function handleClick(e: MouseEvent) {
  const tool = annotationStore.activeTool

  // Check if clicking on an existing annotation to select it
  const target = e.target as SVGElement
  const annotationId =
    target.dataset?.annotationId || target.closest("[data-annotation-id]")?.getAttribute("data-annotation-id")

  // Check if clicking on transform handles (they have class or data attributes)
  const isTransformHandle =
    target.closest(".transform-handles") ||
    target.closest(".group-transform-handles") ||
    target.classList?.contains("transform-handles") ||
    target.classList?.contains("group-transform-handles")

  // Click outside any annotation - deselect regardless of active tool
  // But only if not drawing marquee or actively drawing with a tool
  // Also ignore clicks on transform handles (they handle deselection via drag/drop)
  // Prevent deselection if a drag/marquee just finished (click fires after mouseup)
  if (
    !annotationId &&
    !isTransformHandle &&
    !selectionMarquee.isMarqueeSelecting.value &&
    !selectionMarquee.isMarqueeJustFinished() &&
    !annotationStore.isDrawing &&
    !dragState.isDragJustFinished()
  ) {
    annotationStore.selectAnnotation(null)
    // Don't return - allow drawing tools to continue processing the click
  }

  // debugLog("SVG Layer", "Click:", {
  //   tool,
  //   target: e.target,
  //   clientX: e.clientX,
  //   clientY: e.clientY,
  //   svgRef: svgRef.value
  // })

  // Call registered tool's onClick handler
  const toolDef = toolRegistry.getTool(tool as ToolType)
  if (toolDef?.onClick) {
    debugLog("SVG Layer", `Calling ${tool} tool onClick`)
    toolDef.onClick(e)
  } else if (tool) {
    debugLog("SVG Layer", "No onClick handler for tool:", tool)
  }
}

function handleMove(e: MouseEvent) {
  const tool = annotationStore.activeTool
  // debugLog("SVG Layer", "handleMove:", { tool, hasTarget: !!e.target })

  // Early return if SVG ref doesn't exist
  if (!svgRef.value) {
    return
  }

  // Track cursor position for paste operations
  const svg = svgRef.value
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse())
  rendererStore.setLastCursorPosition({ x: svgP.x, y: svgP.y })

  // If marquee is active, don't process tool handlers
  // (marquee update is handled by global listeners in useEditorEventHandlers)
  if (shouldUpdateSelectionMarquee(tool)) {
    return // Don't process tool moves while selecting
  }

  // Call registered tool's onMouseMove handler
  const toolDef = toolRegistry.getTool(tool as ToolType)
  if (toolDef?.onMouseMove) {
    toolDef.onMouseMove(e)
  } else if (hasActiveDrawingTool(tool)) {
    debugLog("SVG Layer", "No onMouseMove handler for tool:", tool)
  }
}

// Keyboard shortcuts
function handleKeyDown(e: KeyboardEvent) {
  // Call all registered tools' onKeyDown handlers
  for (const toolDef of toolRegistry.getAllTools()) {
    toolDef.onKeyDown?.(e)
  }

  // Global shortcuts
  if (e.key === "Escape") {
    annotationStore.selectAnnotation(null)
    annotationStore.setActiveTool("selection")
  }
}

// Keyboard event listener using VueUse for automatic cleanup
useEventListener(window, "keydown", handleKeyDown)

// Global mouseup listener to complete tool drawing even if released outside SVG
useEventListener(window, "mouseup", (e: MouseEvent) => {
  const tool = annotationStore.activeTool
  const toolDef = toolRegistry.getTool(tool as ToolType)
  if (toolDef?.onMouseUp) {
    toolDef.onMouseUp(e)
  }
})
</script>

<template>
  <svg
    ref="svgRef"
    :viewBox="`0 0 ${pdfWidth} ${pdfHeight}`"
    :style="svgStyle"
    class="svg-annotation-layer"
    preserveAspectRatio="xMidYMid meet"
    @click="handleClick"
    @mousedown="handleMouseDown"
    @mousemove="handleMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
  >
    <!-- Render all registered tool components dynamically -->
    <template v-for="toolDef in registeredTools" :key="toolDef.type">
      <component
        :is="toolComponents[toolDef.type as keyof typeof toolComponents]"
        v-if="
          annotationStore.activeTool === toolDef.type || annotationStore.getAnnotationsByType(toolDef.type).length > 0
        "
      />
    </template>

    <!-- Selection marquee (drag-to-select rectangle) -->
    <rect
      v-if="selectionMarquee.isMarqueeSelecting.value && selectionMarquee.marqueeBounds.value"
      :x="selectionMarquee.marqueeBounds.value.x"
      :y="selectionMarquee.marqueeBounds.value.y"
      :width="selectionMarquee.marqueeBounds.value.width"
      :height="selectionMarquee.marqueeBounds.value.height"
      :fill="SELECTION.MARQUEE_FILL"
      :stroke="SELECTION.MARQUEE_STROKE"
      :stroke-width="SELECTION.MARQUEE_STROKE_WIDTH"
      :stroke-dasharray="SELECTION.MARQUEE_DASH_ARRAY"
      class="selection-marquee"
      pointer-events="none"
    />

    <!-- Transform handles (for rotation/scaling/moving annotations) -->
    <EditorTransformHandles />
  </svg>
</template>

<style scoped>
.svg-annotation-layer {
  cursor: crosshair;
}

.svg-annotation-layer.selection-mode {
  cursor: default;
}
</style>
