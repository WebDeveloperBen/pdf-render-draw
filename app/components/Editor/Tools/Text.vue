<script lang="ts">
/**
 * Text Tool Configuration
 *
 * Default settings for the text annotation tool.
 * These will eventually be customizable per-user and stored in the database
 * as part of a WYSIWYG-style tool configuration system.
 */

export const TEXT_TOOL_DEFAULTS = {
  // Dimensions
  width: 200,
  height: 50,

  // Typography
  fontSize: 16,
  fontFamily: "Arial, sans-serif",
  color: "#000000",

  // Initial content
  placeholder: "Double-click to edit",

  // Background styling
  background: {
    fill: "white",
    opacity: 0.8,
    borderRadius: 3,
    padding: {
      horizontal: 5,
      vertical: 2
    }
  },

  // Editor styling (when editing text)
  editor: {
    borderColor: "#4299e1",
    borderColorFocus: "#2b6cb0",
    borderWidth: 2,
    borderRadius: 4,
    padding: 4,
    // Extra space needed for border + shadow + padding
    extraSpace: {
      horizontal: 12,
      vertical: 9
    }
  },

  // Delete button
  deleteButton: {
    offset: 15, // Distance from text right edge
    radius: 8,
    radiusHover: 9,
    fill: "red",
    opacity: 0.8
  }
} as const

// Type for the text tool configuration
export type TextToolConfig = typeof TEXT_TOOL_DEFAULTS
</script>
<script setup lang="ts">
const tool = useTextToolState()
const config = TEXT_TOOL_DEFAULTS
if (!tool) {
  throw new Error("TextTool must be used within AnnotationRendererLayer")
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
    <EditorBaseAnnotation v-for="text in completed" :key="text.id" :annotation="text">
      <!-- Custom content for text annotations -->
      <template #content="{ annotation, isSelected }">
        <!-- Non-editing mode: display text -->
        <!-- Note: x, y are TOP-LEFT corner of the bounding box (consistent with other positioned annotations) -->
        <g v-if="editingId !== annotation.id">
          <!-- Background for better readability -->
          <rect
            :x="annotation.x - config.background.padding.horizontal"
            :y="annotation.y - config.background.padding.vertical"
            :width="annotation.width + config.background.padding.horizontal * 2"
            :height="annotation.height + config.background.padding.vertical * 2"
            :fill="config.background.fill"
            :opacity="config.background.opacity"
            :rx="config.background.borderRadius"
            class="text-background"
            :class="{ selected: isSelected }"
          />

          <!-- Text content - SVG text uses baseline, so add fontSize to y -->
          <text
            :x="annotation.x"
            :y="annotation.y + annotation.fontSize"
            :font-size="annotation.fontSize"
            :fill="annotation.color"
            class="text-annotation"
          >
            {{ annotation.content }}
          </text>

          <!-- Delete button (shown on hover) -->
          <g class="delete-button" @click.stop="deleteText(annotation.id)">
            <circle
              :cx="annotation.x + annotation.width + config.deleteButton.offset"
              :cy="annotation.y + annotation.height / 2"
              :r="config.deleteButton.radius"
              :fill="config.deleteButton.fill"
              :opacity="config.deleteButton.opacity"
            />
            <line
              :x1="annotation.x + annotation.width + config.deleteButton.offset - 4"
              :y1="annotation.y + annotation.height / 2 - 4"
              :x2="annotation.x + annotation.width + config.deleteButton.offset + 4"
              :y2="annotation.y + annotation.height / 2 + 4"
              stroke="white"
              stroke-width="2"
            />
            <line
              :x1="annotation.x + annotation.width + config.deleteButton.offset + 4"
              :y1="annotation.y + annotation.height / 2 - 4"
              :x2="annotation.x + annotation.width + config.deleteButton.offset - 4"
              :y2="annotation.y + annotation.height / 2 + 4"
              stroke="white"
              stroke-width="2"
            />
          </g>
        </g>

        <!-- Editing mode: use foreignObject for HTML input -->
        <!-- Note: x, y are TOP-LEFT corner of the bounding box -->
        <foreignObject
          v-else
          :x="annotation.x - config.editor.extraSpace.horizontal"
          :y="annotation.y - config.editor.extraSpace.vertical"
          :width="annotation.width + config.editor.extraSpace.horizontal * 2"
          :height="annotation.height + config.editor.extraSpace.vertical * 2"
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
    </EditorBaseAnnotation>
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
  r: v-bind("config.deleteButton.radiusHover");
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
  border: v-bind('config.editor.borderWidth + "px"') solid v-bind("config.editor.borderColor");
  border-radius: v-bind('config.editor.borderRadius + "px"');
  padding: v-bind('config.editor.padding + "px"');
  font-family: v-bind("config.fontFamily");
  resize: none;
  background: white;
  outline: none;
  box-sizing: border-box;
}

.text-editor:focus {
  border-color: v-bind("config.editor.borderColorFocus");
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.3);
}
</style>
