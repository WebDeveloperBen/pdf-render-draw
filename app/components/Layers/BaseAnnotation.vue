<script setup lang="ts" generic="T extends Annotation">
/**
 * Base Annotation Component
 *
 * Provides common functionality for all annotation types:
 * - Selection handling
 * - Transform handles (when selected)
 * - Event delegation (double-click, context menu, etc.)
 * - Common props and emits
 *
 * Tools extend this via slots to customize rendering
 */

const props = defineProps<{
  annotation: T
}>()

const annotationStore = useAnnotationStore()
const toolRegistry = useToolRegistry()
const modifierKeys = useModifierKeys() // Shared composable - same instance across all components
const dragState = useDragState() // Track drag state to prevent clicks after drag

// Check if this annotation is selected
const isSelected = computed(() => annotationStore.isAnnotationSelected(props.annotation.id))

// Debounce single-click to allow double-click to take precedence
const CLICK_DELAY = 150 // ms to wait for potential double-click

// Handle selection logic
function performSelection() {
  const tool = annotationStore.activeTool

  // Only handle selection in selection mode or when no tool is active
  if (tool === "selection" || tool === "") {
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
  }
}

// Debounced version of selection - waits for potential double-click
const debouncedSelection = useDebounceFn(performSelection, CLICK_DELAY)

// Handle double-click - delegate to tool's handler if registered
function handleDoubleClick(e: MouseEvent) {
  // Cancel pending single-click
  debouncedSelection()

  const tool = toolRegistry.getTool(props.annotation.type)

  if (tool?.onDoubleClick) {
    tool.onDoubleClick(props.annotation.id)
    e.stopPropagation()
  }
}

// Handle context menu
function handleContextMenu(e: MouseEvent) {
  const tool = toolRegistry.getTool(props.annotation.type)

  if (tool?.onContextMenu) {
    tool.onContextMenu(props.annotation.id)
    e.preventDefault()
    e.stopPropagation()
  }
}

// Handle click with debounce to detect double-click
function handleClick(e: MouseEvent) {
  // Prevent selection changes if a drag just finished (click fires after drag ends)
  if (dragState.isDragJustFinished()) {
    return
  }

  // Delay single-click to see if double-click is coming
  debouncedSelection()
  e.stopPropagation()
}
</script>

<template>
  <g
    :data-annotation-id="annotation.id"
    :class="['base-annotation', { selected: isSelected }]"
    :transform="annotationStore.getRotationTransform(annotation)"
    @click="handleClick"
    @dblclick="handleDoubleClick"
    @contextmenu="handleContextMenu"
  >
    <!-- Tool-specific content (required) -->
    <slot name="content" :annotation="annotation" :is-selected="isSelected">
      <!-- Fallback if no content slot provided -->
      <text x="0" y="0" fill="red">No content slot provided for {{ annotation.type }}</text>
    </slot>

    <!-- Transform handles (conditionally shown when selected) -->
    <!-- This makes each annotation own its transform handles -->
    <slot name="transform" :annotation="annotation" :is-selected="isSelected">
      <!-- Default transform handles for single selection -->
      <HandlesTransform
        v-if="isSelected && annotationStore.selectedAnnotationIds.length === 1"
        :annotation="annotation"
      />
      <!-- Group transform handles for multi-selection -->
      <!-- Only render on the FIRST selected annotation to avoid duplicates -->
      <HandlesGroupTransform
        v-else-if="
          isSelected &&
          annotationStore.selectedAnnotationIds.length > 1 &&
          annotationStore.selectedAnnotationIds[0] === annotation.id
        "
      />
    </slot>
  </g>
</template>

<style scoped>
.base-annotation {
  cursor: pointer;
}
</style>
