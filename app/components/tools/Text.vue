<script setup lang="ts">
import { useTextToolState } from "~/composables/tools/useTextTool"

const tool = useTextToolState()
if (!tool) {
  throw new Error("TextTool must be used within SvgAnnotationLayer")
}

const { completed, editingId, editingContent, finishEditing, deleteText } = tool

// Store ref to currently editing textarea
const currentTextarea = ref<HTMLTextAreaElement | null>(null)

function setTextareaRef(el: Element | ComponentPublicInstance | null, textId: string) {
  // Only store ref for the textarea we're currently editing
  if (el && editingId.value === textId) {
    currentTextarea.value = el as HTMLTextAreaElement
  }
}

// Watch editingId to focus and select text only when editing starts
watch(editingId, (newId, oldId) => {
  if (newId && newId !== oldId && currentTextarea.value) {
    nextTick(() => {
      currentTextarea.value?.focus()
      currentTextarea.value?.select()
    })
  }
})
</script>

<template>
  <g class="text-tool">
    <!-- Each text annotation uses BaseAnnotation for common functionality -->
    <LayersBaseAnnotation v-for="text in completed" :key="text.id" :annotation="text">
      <!-- Custom content for text annotations -->
      <template #content="{ annotation, isSelected }">
        <!-- Non-editing mode: display text -->
        <g v-if="editingId !== annotation.id">
          <!-- Background for better readability -->
          <rect
            :x="annotation.x - 5"
            :y="annotation.y - annotation.fontSize - 2"
            :width="annotation.width + 10"
            :height="annotation.height + 4"
            fill="white"
            opacity="0.8"
            rx="3"
            class="text-background"
            :class="{ selected: isSelected }"
          />

          <!-- Text content -->
          <text
            :x="annotation.x"
            :y="annotation.y"
            :font-size="annotation.fontSize"
            :fill="annotation.color"
            class="text-annotation"
          >
            {{ annotation.content }}
          </text>

          <!-- Delete button (shown on hover) -->
          <g class="delete-button" @click.stop="deleteText(annotation.id)">
            <circle
              :cx="annotation.x + annotation.width + 15"
              :cy="annotation.y - annotation.fontSize / 2"
              r="8"
              fill="red"
              opacity="0.8"
            />
            <line
              :x1="annotation.x + annotation.width + 15 - 4"
              :y1="annotation.y - annotation.fontSize / 2 - 4"
              :x2="annotation.x + annotation.width + 15 + 4"
              :y2="annotation.y + annotation.fontSize / 2 + 4"
              stroke="white"
              stroke-width="2"
            />
            <line
              :x1="annotation.x + annotation.width + 15 + 4"
              :y1="annotation.y - annotation.fontSize / 2 - 4"
              :x2="annotation.x + annotation.width + 15 - 4"
              :y2="annotation.y + annotation.fontSize / 2 + 4"
              stroke="white"
              stroke-width="2"
            />
          </g>
        </g>

        <!-- Editing mode: use foreignObject for HTML input -->
        <!-- Extra space: border (2px * 2) + shadow (3px * 2) + padding = ~14px extra on each side -->
        <foreignObject
          v-else
          :x="annotation.x - 12"
          :y="annotation.y - annotation.fontSize - 9"
          :width="annotation.width + 24"
          :height="annotation.height + 18"
          style="pointer-events: all; overflow: visible"
          @click.stop
          @mousedown.stop
        >
          <div xmlns="http://www.w3.org/1999/xhtml" class="text-editor-wrapper">
            <textarea
              :ref="(el) => setTextareaRef(el, annotation.id)"
              v-model="editingContent"
              class="text-editor"
              :style="{
                fontSize: annotation.fontSize + 'px',
                color: annotation.color,
                width: annotation.width + 'px',
                height: annotation.height + 'px'
              }"
              @blur="finishEditing"
              @keydown.enter.exact.prevent="finishEditing"
              @keydown.escape="finishEditing"
              @click.stop
              @mousedown.stop
            />
          </div>
        </foreignObject>
      </template>

      <!-- Transform handles are now handled by BaseAnnotation -->
      <!-- No need to manually include them here -->
    </LayersBaseAnnotation>
  </g>
</template>

<style scoped>
.text-background {
  transition: opacity 0.2s;
}

.text-background.selected:hover {
  opacity: 0.95;
  stroke: #ccc;
  stroke-width: 1;
}

.text-annotation {
  user-select: none;
  pointer-events: all;
}

.delete-button {
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.2s;
  pointer-events: all;
}

.text-background:hover ~ .delete-button,
.delete-button:hover {
  opacity: 1;
}

.delete-button:hover circle {
  opacity: 1;
  r: 9;
}

.text-editor-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.text-editor {
  border: 2px solid #4299e1;
  border-radius: 4px;
  padding: 4px;
  font-family: Arial, sans-serif;
  resize: none;
  background: white;
  outline: none;
  box-sizing: border-box;
}

.text-editor:focus {
  border-color: #2b6cb0;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.3);
}
</style>
