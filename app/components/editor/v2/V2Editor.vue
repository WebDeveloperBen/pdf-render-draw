<!--
  V2 Editor - Modular SVG Editor

  Built by extracting DebugEditor.vue into composables
  Implements PLAN.md architecture with frozen bounds pattern
-->
<script setup lang="ts">
import type { Shape } from "~/types/editor"
import { useEditorSelection } from "~/composables/editor/useEditorSelection"
import { useEditorBounds } from "~/composables/editor/useEditorBounds"
import { useEditorEventHandlers } from "~/composables/editor/useEditorEventHandlers"
import { useEditorMarquee } from "~/composables/editor/useEditorMarquee"
import TransformHandles from "./TransformHandles.vue"
import SelectionMarquee from "./SelectionMarquee.vue"

// Initialize composables
const selection = useEditorSelection()
const bounds = useEditorBounds()
const eventHandlers = useEditorEventHandlers()
const marquee = useEditorMarquee()

// Hardcoded shapes for testing (will be replaced with actual annotation data)
const shapes = ref<Shape[]>([
  {
    id: "rect-1",
    type: "rect",
    x: 100,
    y: 100,
    width: 150,
    height: 100,
    rotation: 0,
    fill: "#3b82f6"
  },
  {
    id: "rect-2",
    type: "rect",
    x: 350,
    y: 200,
    width: 120,
    height: 80,
    rotation: 0,
    fill: "#10b981"
  },
  {
    id: "rect-3",
    type: "rect",
    x: 200,
    y: 350,
    width: 100,
    height: 100,
    rotation: 0,
    fill: "#f59e0b"
  }
])

// Provide shapes to selection composable
selection.shapes.value = shapes.value

// SVG transform for shape rotation
function getShapeTransform(shape: Shape): string {
  if (shape.rotation === 0) return ""

  const centerX = shape.x + shape.width / 2
  const centerY = shape.y + shape.height / 2
  const angleDeg = (shape.rotation * 180) / Math.PI

  return `rotate(${angleDeg} ${centerX} ${centerY})`
}

// Set up global event listeners
onMounted(() => {
  eventHandlers.setupGlobalListeners()
})

onUnmounted(() => {
  eventHandlers.cleanupGlobalListeners()
})
</script>

<template>
  <div class="v2-editor">
    <h2>V2 Editor - Modular Architecture</h2>

    <svg
      width="800"
      height="600"
      viewBox="0 0 800 600"
      class="editor-canvas"
      @click="eventHandlers.handleBackgroundClick"
      @mousedown="marquee.startMarquee"
    >
      <!-- Grid background -->
      <defs>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" stroke-width="1" />
        </pattern>
      </defs>
      <rect width="800" height="600" fill="url(#grid)" />

      <!-- Shapes -->
      <g v-for="shape in shapes" :key="shape.id">
        <rect
          :x="shape.x"
          :y="shape.y"
          :width="shape.width"
          :height="shape.height"
          :fill="shape.fill"
          :transform="getShapeTransform(shape)"
          :class="{ selected: selection.isSelected(shape.id) }"
          class="shape"
          @click="eventHandlers.handleShapeClick(shape.id, $event)"
        />
      </g>

      <!-- Transform UI (handles, rotation, scaling) -->
      <TransformHandles />

      <!-- Marquee selection box -->
      <SelectionMarquee />
    </svg>

    <!-- Debug info -->
    <div class="debug-info">
      <h3>V2 Editor Status</h3>
      <p><strong>Selected Count:</strong> {{ selection.selectedIds.value.length }}</p>
      <p><strong>Selected IDs:</strong> {{ selection.selectedIds.value.length > 0 ? selection.selectedIds.value.join(", ") : "None" }}</p>
      <p v-if="selection.selectedShape.value">
        <strong>Position:</strong> ({{ Math.round(selection.selectedShape.value.x) }}, {{ Math.round(selection.selectedShape.value.y) }})
      </p>
      <p v-if="selection.selectedShape.value">
        <strong>Size:</strong> {{ selection.selectedShape.value.width }} × {{ selection.selectedShape.value.height }}
      </p>
      <p v-if="selection.selectedShape.value">
        <strong>Rotation:</strong> {{ ((selection.selectedShape.value.rotation * 180) / Math.PI).toFixed(1) }}°
      </p>
      <p v-if="bounds.selectionBounds.value">
        <strong>Selection Bounds:</strong> ({{ Math.round(bounds.selectionBounds.value.x) }}, {{ Math.round(bounds.selectionBounds.value.y) }})
        {{ Math.round(bounds.selectionBounds.value.width) }} × {{ Math.round(bounds.selectionBounds.value.height) }}
      </p>
      <p v-if="bounds.frozenBounds.value">
        <strong>Frozen Bounds:</strong> Active ✓
      </p>
      <p class="hint">
        <strong>Tip:</strong> Click to select, Shift+Click to multi-select, Drag on canvas for marquee select,
        Drag selection box to move, Drag rotation handle to rotate, Drag scale handles to resize
      </p>
    </div>
  </div>
</template>

<style scoped>
.v2-editor {
  padding: 20px;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

h2 {
  margin: 0 0 16px 0;
  font-size: 20px;
  color: #1f2937;
}

.editor-canvas {
  border: 2px solid #d1d5db;
  background: white;
  cursor: default;
}

.shape {
  cursor: pointer;
  transition: opacity 0.2s;
}

.shape:hover {
  opacity: 0.8;
}

.shape.selected {
  stroke: #3b82f6;
  stroke-width: 2;
}

.debug-info {
  margin-top: 20px;
  padding: 16px;
  background: #f3f4f6;
  border-radius: 8px;
  font-size: 14px;
}

.debug-info h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #1f2937;
}

.debug-info p {
  margin: 4px 0;
  color: #4b5563;
}

.debug-info strong {
  color: #1f2937;
}

.debug-info .hint {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #d1d5db;
  color: #6b7280;
  font-style: italic;
}
</style>
