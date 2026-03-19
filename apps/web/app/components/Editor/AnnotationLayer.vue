<script setup lang="ts">
import { SELECTION } from "@/constants/ui"

import { toolComponents } from "~/components/Editor/Tools"

const viewportStore = useViewportStore()
const annotationStore = useAnnotationStore()

// SVG element ref
const svgRef = ref<SVGSVGElement>()

// Helper function to check if we should update the selection marquee during dragging
function shouldUpdateSelectionMarquee(tool: string) {
  return interactionMode.isMode("marquee") && isSelectionMode(tool) && !!svgRef.value
}

// Helper function to check if we have an active drawing tool (not selection mode)
function hasActiveDrawingTool(tool: string) {
  return tool && tool !== "selection"
}

// PDF dimensions
const pdfWidth = computed(() => viewportStore.getCanvasSize.width)
const pdfHeight = computed(() => viewportStore.getCanvasSize.height)

// SVG positioning (overlays PDF exactly)
// SVG scales via CSS transform like the canvas to maintain coordinate consistency
const svgStyle = computed(() => {
  return {
    position: "absolute" as const,
    top: "0",
    left: "0",
    width: `${pdfWidth.value}px`,
    height: `${pdfHeight.value}px`,
    transform: viewportStore.getCanvasTransform,
    transformOrigin: "center center" as const,
    pointerEvents: "all" as const,
    zIndex: 1001,
    willChange: "auto" as const
  }
})

const toolRegistry = useToolRegistry()

// Clear stale tool registrations so tools re-register with fresh handler closures.
// Without this, client-side navigation keeps the old (dead) handlers from the
// previous AnnotationLayer instance because registerTool() skips duplicates.
toolRegistry.clearRegistry()

// Initialize all tools (they register themselves when first called AND provide injection context)
useCountTool()!
useMeasureTool()!
useAreaTool()!
usePerimeterTool()!
useLineTool()!
useTextTool()!
useFillTool()!

const selectionMarquee = useEditorMarquee()
const interactionMode = useInteractionMode()

// Initialise snap provider (sets up reactive watches)
const { extractPageContent, clearContentCache, clearIndicator } = useSnapProvider()

// Clear snap cache when document changes (new PDF loaded)
watch(
  () => viewportStore.getDocumentProxy,
  (docProxy, oldProxy) => {
    if (docProxy && docProxy !== oldProxy) {
      clearContentCache()
    }
  }
)

// Extract PDF content for snapping when page changes or PDF finishes loading
watch(
  [() => viewportStore.getCurrentPage, () => viewportStore.getDocumentProxy],
  async ([pageNum, docProxy]) => {
    if (!docProxy) return
    try {
      const page = await docProxy.getPage(pageNum)
      debugLog("SnapProvider", `Extracting PDF content for page ${pageNum}...`)
      await extractPageContent(page)
      debugLog("SnapProvider", `PDF content extracted for page ${pageNum}`)
    } catch (err) {
      debugLog("SnapProvider", "PDF content extraction failed:", err)
    }
  },
  { immediate: true }
)

// Enable keyboard shortcuts (undo/redo, copy/paste, etc.)
useKeyboardShortcuts()

// Get all registered tools for dynamic rendering
const registeredTools = computed(() => toolRegistry.getAllTools())

function handleMouseDown(e: EditorInputEvent) {
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

function handleMouseUp(e: EditorInputEvent) {
  // If marquee is active, don't process tool handlers
  // (marquee end is handled by global listeners in useEditorEventHandlers)
  if (interactionMode.isMode("marquee")) {
    return
  }

  // Call registered tool's onMouseUp handler for the active tool
  const tool = annotationStore.activeTool
  const toolDef = toolRegistry.getTool(tool as ToolType)
  if (toolDef?.onMouseUp) {
    toolDef.onMouseUp(e)
  }
}

function handleMouseLeave(e: EditorInputEvent) {
  // Clear snap indicator when cursor leaves the SVG
  clearIndicator()

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
function handleClick(e: EditorInputEvent) {
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
  if (!annotationId && !isTransformHandle && !interactionMode.shouldSuppressClick.value) {
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

function handleMove(e: EditorInputEvent) {
  const tool = annotationStore.activeTool

  // Early return if SVG ref doesn't exist
  if (!svgRef.value) {
    return
  }

  // Track cursor position for paste operations (lightweight: store raw client coords,
  // resolve to SVG space lazily via the store's getter)
  viewportStore.setLastClientPosition(e.clientX, e.clientY)

  // If marquee is active, don't process tool handlers
  // (marquee update is handled by global listeners in useEditorEventHandlers)
  if (shouldUpdateSelectionMarquee(tool)) {
    return // Don't process tool moves while selecting
  }

  // Call registered tool's onMouseMove handler
  const toolDef = toolRegistry.getTool(tool as ToolType)
  if (toolDef?.onMouseMove) {
    toolDef.onMouseMove(e)
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

// Global pointerup listener to complete tool drawing even if released outside SVG
useEventListener(window, "pointerup", (e: EditorInputEvent) => {
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
    :class="['svg-annotation-layer', { 'selection-mode': isSelectionMode(annotationStore.activeTool) }]"
    preserveAspectRatio="xMidYMid meet"
    @click="handleClick"
    @pointerdown="handleMouseDown"
    @pointermove="handleMove"
    @pointerup="handleMouseUp"
    @pointerleave="handleMouseLeave"
  >
    <!-- Snap system debug overlay (extracted segments/points) -->
    <EditorSnapDebugLayer />

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
      v-if="interactionMode.isMode('marquee') && selectionMarquee.marqueeBounds.value"
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

    <!-- Snap indicator (rendered above annotations, below handles) -->
    <EditorSnapIndicator />

    <!-- Transform handles (for rotation/scaling/moving annotations) -->
    <EditorHandlesTransform />
  </svg>
</template>

<style scoped>
.svg-annotation-layer {
  cursor: crosshair;
  touch-action: none; /* Prevent browser gestures (scroll/zoom) from interfering with drawing */
}

.svg-annotation-layer.selection-mode {
  cursor: default;
}
</style>
