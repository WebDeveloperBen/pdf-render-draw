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
  defaultWidth: 100, // Default width for new text boxes (user can resize via handles)
  minHeight: 20, // Single line minimum (fontSize * lineHeight)

  // Typography
  fontSize: 16,
  lineHeight: 1.2,
  fontFamily: "Arial, sans-serif",
  color: "#000000",

  // Initial content
  placeholder: "Text",

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
  throw new Error("TextTool must be used within AnnotationLayer")
}

const { completed, editingId, editingContent, finishEditing, deleteText, handleDoubleClick } = tool

// Store ref to currently editing textarea
const currentTextarea = ref<HTMLTextAreaElement | null>(null)
// Track dynamic height while editing (width stays fixed, only height auto-adjusts)
const editingHeight = ref<number | null>(null)

function setTextareaRef(el: Element | ComponentPublicInstance | null, textId: string) {
  // Only store ref for the textarea we're currently editing
  if (el && editingId.value === textId) {
    currentTextarea.value = el as HTMLTextAreaElement
  }
}

// Watch editingId to focus and select text only when editing starts
watch(editingId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    editingHeight.value = null
    nextTick(() => {
      currentTextarea.value?.focus()
      currentTextarea.value?.select()
      // Initialize height from content
      if (currentTextarea.value) {
        handleInput()
      }
    })
  } else if (!newId) {
    editingHeight.value = null
  }
})

// Auto-resize textarea height while typing (width stays fixed)
function handleInput() {
  if (currentTextarea.value) {
    const textarea = currentTextarea.value
    // Reset to auto to measure true content height
    textarea.style.height = "auto"
    const newHeight = Math.max(textarea.scrollHeight, config.minHeight)
    textarea.style.height = `${newHeight}px`
    editingHeight.value = newHeight
  }
}

// Measure actual rendered text width using a hidden element
function measureTextWidth(text: string, fontSize: number): number {
  const div = document.createElement("div")
  div.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: pre;
    font-size: ${fontSize}px;
    font-family: ${config.fontFamily};
    line-height: ${config.lineHeight};
  `
  // Measure each line and find the widest
  const lines = text.split("\n")
  let maxLineWidth = 0

  for (const line of lines) {
    div.textContent = line || " " // Use space for empty lines to get some width
    document.body.appendChild(div)
    maxLineWidth = Math.max(maxLineWidth, div.offsetWidth)
    document.body.removeChild(div)
  }

  // Add buffer for sub-pixel rendering differences
  return Math.ceil(maxLineWidth) + 4
}

// Finish editing and save dimensions to hug content
function handleFinishEditing() {
  if (currentTextarea.value && editingId.value) {
    const textarea = currentTextarea.value
    const annotation = completed.value.find((a) => a.id === editingId.value)
    const fontSize = annotation?.fontSize ?? config.fontSize

    // Calculate the border+padding offset (what reduces content area)
    const offset = config.editor.borderWidth + config.editor.padding
    const totalOffset = offset * 2

    // Current content width (what text actually wraps within)
    const currentContentWidth = (annotation?.width ?? config.defaultWidth) - totalOffset

    // Get content height from scrollHeight minus padding
    const style = window.getComputedStyle(textarea)
    const paddingTop = parseFloat(style.paddingTop)
    const paddingBottom = parseFloat(style.paddingBottom)
    const contentHeight = textarea.scrollHeight - paddingTop - paddingBottom

    // Measure unwrapped text width
    const unwrappedWidth = measureTextWidth(editingContent.value, fontSize)

    // Shrink to fit if text is shorter than content area, otherwise keep current
    // Add back the offset to get the outer width for annotation
    const newContentWidth = Math.min(unwrappedWidth, currentContentWidth)
    const newWidth = Math.max(newContentWidth + totalOffset, config.minHeight + totalOffset)
    const newHeight = Math.max(contentHeight, config.minHeight)

    finishEditing({ width: newWidth, height: newHeight })
  } else {
    finishEditing()
  }
}
</script>

<template>
  <g class="text-tool">
    <!-- Each text annotation uses BaseAnnotation for common functionality -->
    <EditorAnnotation v-for="text in completed" :key="text.id" :annotation="text">
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

          <!-- Text content - use foreignObject for consistent wrapping with edit mode -->
          <!-- Offset by editor border+padding to match textarea content area -->
          <foreignObject
            :x="annotation.x + config.editor.borderWidth + config.editor.padding"
            :y="annotation.y + config.editor.borderWidth + config.editor.padding"
            :width="annotation.width - 2 * (config.editor.borderWidth + config.editor.padding)"
            :height="annotation.height - 2 * (config.editor.borderWidth + config.editor.padding)"
            class="text-foreign-object"
          >
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              class="text-display"
              :style="{
                fontSize: annotation.fontSize + 'px',
                lineHeight: config.lineHeight,
                color: annotation.color,
                fontFamily: config.fontFamily
              }"
            >
              {{ annotation.content }}
            </div>
          </foreignObject>

          <!-- Transparent hit area on top for reliable click/double-click events -->
          <rect
            :x="annotation.x - config.background.padding.horizontal"
            :y="annotation.y - config.background.padding.vertical"
            :width="annotation.width + config.background.padding.horizontal * 2"
            :height="annotation.height + config.background.padding.vertical * 2"
            fill="transparent"
            class="text-hit-area"
          />

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
          :height="(editingHeight || annotation.height) + config.editor.extraSpace.vertical * 2"
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
                minHeight: config.minHeight + 'px'
              }"
              @input="handleInput"
              @blur="handleFinishEditing"
              @keydown.enter.exact.prevent="handleFinishEditing"
              @keydown.escape="handleFinishEditing"
              @keydown.stop
              @keyup.stop
              @click.stop
              @mousedown.stop
            />
          </div>
        </foreignObject>
      </template>

      <!-- Transform handles are now handled by BaseAnnotation -->
      <!-- No need to manually include them here -->
    </EditorAnnotation>
  </g>
</template>

<style scoped>
.text-background {
  transition: opacity 0.2s;
}

/* Show subtle border when hovering selected text (via parent g hover) */
g:hover > .text-background.selected {
  opacity: 0.95;
  stroke: #ccc;
  stroke-width: 1;
}

.text-foreign-object {
  pointer-events: none;
  overflow: visible;
}

.text-hit-area {
  pointer-events: all;
  cursor: pointer;
}

.text-display {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  user-select: none;
  pointer-events: none;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  overflow: hidden;
  line-height: v-bind("config.lineHeight");
  margin: 0;
  padding: 0;
}

.delete-button {
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.2s;
  pointer-events: all;
}

.text-hit-area:hover ~ .delete-button,
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
  line-height: v-bind("config.lineHeight");
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}

.text-editor:focus {
  border-color: v-bind("config.editor.borderColorFocus");
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.3);
}
</style>
