<script setup lang="ts" generic="T extends Annotation">
/**
 * Annotation Component
 *
 * Wrapper for rendering completed annotations with interactivity:
 * - Selection handling (click, shift+click, cmd/ctrl+click)
 * - Event delegation (double-click, context menu)
 * - Rotation transforms
 *
 * Used by tool components to wrap their completed annotation SVG content.
 */

const props = defineProps<{
  annotation: T
}>()

const annotationStore = useAnnotationStore()
const toolRegistry = useToolRegistry()
const modifierKeys = useModifierKeys()
const interactionMode = useInteractionMode()
const bounds = useEditorBounds()

// Check if this annotation is selected
const isSelected = computed(() => {
  return annotationStore.isAnnotationSelected(props.annotation.id)
})

// Track hover state for visual feedback
const isHovered = ref(false)

// Double-click detection with manual timing (more reliable than browser dblclick)
const DOUBLE_CLICK_THRESHOLD = 300 // ms between clicks to count as double-click
const CLICK_DELAY = 200 // ms to wait before executing single-click
let lastClickTime = 0
let clickTimeout: ReturnType<typeof setTimeout> | null = null

// Handle selection logic
function performSelection() {
  const tool = annotationStore.activeTool

  // Only handle selection in selection mode or when no tool is active
  if (isSelectionMode(tool)) {
    // Multi-select support:
    // - Shift+click: Add to selection (addToSelection)
    // - Cmd/Ctrl+click: Toggle selection on/off (toggle)
    const isShiftClick = modifierKeys.isShiftPressed.value
    const isCmdCtrlClick = modifierKeys.isCmdOrCtrl.value

    if (isShiftClick) {
      annotationStore.selectAnnotation(props.annotation.id, { addToSelection: true })
    } else if (isCmdCtrlClick) {
      annotationStore.selectAnnotation(props.annotation.id, { toggle: true })
    } else {
      annotationStore.selectAnnotation(props.annotation.id)
    }

    // Clear frozen bounds so the transformer recalculates AABB for the new selection
    bounds.unfreezeBounds()
  }
}

// Handle double-click - delegate to tool's handler if registered
function triggerDoubleClick() {
  const tool = toolRegistry.getTool(props.annotation.type)

  if (tool?.onDoubleClick) {
    // Clear selection to hide transform handles during editing
    annotationStore.deselectAll()
    tool.onDoubleClick(props.annotation.id)
  }
}

// Handle context menu
function handleContextMenu(e: EditorInputEvent) {
  const tool = toolRegistry.getTool(props.annotation.type)

  if (tool?.onContextMenu) {
    tool.onContextMenu(props.annotation.id)
    e.preventDefault()
    e.stopPropagation()
  }
}

// Handle click with manual double-click detection
function handleClick(e: EditorInputEvent) {
  // Prevent selection changes if an interaction just finished (click fires after drag ends)
  if (interactionMode.isLocked.value) {
    return
  }

  e.preventDefault()
  e.stopPropagation()

  const now = Date.now()
  const timeSinceLastClick = now - lastClickTime

  // Check if this is a double-click
  if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD) {
    // Cancel pending single-click
    if (clickTimeout) {
      clearTimeout(clickTimeout)
      clickTimeout = null
    }
    lastClickTime = 0
    triggerDoubleClick()
  } else {
    // Schedule single-click action (selection)
    lastClickTime = now
    if (clickTimeout) {
      clearTimeout(clickTimeout)
    }
    clickTimeout = setTimeout(() => {
      performSelection()
      clickTimeout = null
    }, CLICK_DELAY)
  }
}

function getRotationTransform(): string {
  return annotationStore.getRotationTransform(props.annotation)
}
</script>

<template>
  <g
    :data-annotation-id="annotation.id"
    :class="['annotation', { selected: isSelected, hovered: isHovered && !isSelected }]"
    :transform="getRotationTransform()"
    @click="handleClick"
    @contextmenu="handleContextMenu"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Tool-specific content (required) -->
    <slot name="content" :annotation="annotation" :is-selected="isSelected" :is-hovered="isHovered">
      <!-- Fallback if no content slot provided -->
      <text x="0" y="0" fill="red">No content slot provided for {{ annotation.type }}</text>
    </slot>

    <!-- Transform handles slot for backwards compatibility (now handled by V2 EditorHandlesTransform) -->
    <slot name="transform" :annotation="annotation" :is-selected="isSelected" />
  </g>
</template>

<style scoped>
.annotation {
  cursor: pointer;
  transition: opacity 0.15s ease-out;
}

.annotation.hovered {
  opacity: 0.85;
}

.annotation.selected {
  opacity: 1;
}
</style>
