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
const modifierKeys = useModifierKeys()

// Check if this annotation is selected
const isSelected = computed(() => annotationStore.isAnnotationSelected(props.annotation.id))

// Debug: Watch selection changes
watch(isSelected, (newVal) => {
  console.log('🎨 BaseAnnotation selection changed:', {
    annotationId: props.annotation.id,
    isSelected: newVal,
    selectedCount: annotationStore.selectedAnnotationIds.length,
    shouldShowTransform: newVal && annotationStore.selectedAnnotationIds.length === 1,
    shouldShowGroupTransform: newVal && annotationStore.selectedAnnotationIds.length > 1
  })
})

// Handle double-click - delegate to tool's handler if registered
function handleDoubleClick(e: MouseEvent) {
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

// Handle selection
function handleClick(e: MouseEvent) {
  const tool = annotationStore.activeTool

  console.log('🖱️ BaseAnnotation clicked:', {
    annotationId: props.annotation.id,
    activeTool: tool,
    isSelected: isSelected.value
  })

  // Only handle selection in selection mode or when no tool is active
  if (tool === "selection" || tool === "") {
    // Support Shift+click for multi-select
    const isMultiSelect = modifierKeys?.isShiftPressed.value ?? false

    console.log('👆 Selecting annotation:', {
      annotationId: props.annotation.id,
      isMultiSelect,
      currentSelection: annotationStore.selectedAnnotationIds
    })

    if (isMultiSelect) {
      annotationStore.selectAnnotation(props.annotation.id, { addToSelection: true })
    } else {
      annotationStore.selectAnnotation(props.annotation.id)
    }

    e.stopPropagation()
  }
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
      <HandlesGroupTransform v-else-if="isSelected && annotationStore.selectedAnnotationIds.length > 1" />
    </slot>
  </g>
</template>

<style scoped>
.base-annotation {
  cursor: pointer;
}
</style>
