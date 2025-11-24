<!--
  V2 Editor - Modular SVG Editor

  Built by extracting DebugEditor.vue into composables
  Implements PLAN.md architecture with frozen bounds pattern
  Now supports both point-based and positioned annotations
-->
<script setup lang="ts">
import type { Annotation, Measurement, Fill } from "~/types/annotations"
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

// Test annotations - mix of point-based and positioned types
const annotations = ref<Annotation[]>([
  // Point-based: Measurement
  {
    id: "measure-1",
    type: "measure",
    pageNum: 1,
    rotation: 0,
    points: [
      { x: 100, y: 100 },
      { x: 250, y: 100 }
    ],
    distance: 150,
    midpoint: { x: 175, y: 100 },
    labelRotation: 0
  } as Measurement,

  // Point-based: Measurement (angled)
  {
    id: "measure-2",
    type: "measure",
    pageNum: 1,
    rotation: 0,
    points: [
      { x: 350, y: 200 },
      { x: 470, y: 280 }
    ],
    distance: 141.42,
    midpoint: { x: 410, y: 240 },
    labelRotation: 0
  } as Measurement,

  // Positioned: Fill rectangle
  {
    id: "fill-1",
    type: "fill",
    pageNum: 1,
    rotation: 0,
    x: 200,
    y: 350,
    width: 100,
    height: 100,
    color: "#f59e0b",
    opacity: 0.5
  } as Fill,

  // Positioned: Fill rectangle #2
  {
    id: "fill-2",
    type: "fill",
    pageNum: 1,
    rotation: 0,
    x: 500,
    y: 150,
    width: 120,
    height: 80,
    color: "#10b981",
    opacity: 0.6
  } as Fill
])

// Provide annotations to selection composable
selection.annotations.value = annotations.value

// SVG transform for annotation rotation
function getAnnotationTransform(annotation: Annotation): string {
  if (annotation.rotation === 0) return ""

  // Point-based annotations - rotate around center of points
  if ('points' in annotation && Array.isArray(annotation.points)) {
    // Calculate center of points
    const xs = annotation.points.map(p => p.x)
    const ys = annotation.points.map(p => p.y)
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2
    const angleDeg = (annotation.rotation * 180) / Math.PI
    return `rotate(${angleDeg} ${centerX} ${centerY})`
  }

  // Positioned annotations - rotate around shape center
  if ('x' in annotation && 'width' in annotation) {
    const centerX = annotation.x + annotation.width / 2
    const centerY = annotation.y + annotation.height / 2
    const angleDeg = (annotation.rotation * 180) / Math.PI
    return `rotate(${angleDeg} ${centerX} ${centerY})`
  }

  return ""
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

      <!-- Annotations -->
      <g v-for="annotation in annotations" :key="annotation.id">
        <!-- Point-based: Measurement (render as line) -->
        <g
          v-if="annotation.type === 'measure'"
          class="measurement"
          :transform="getAnnotationTransform(annotation)"
        >
          <line
            :x1="annotation.points[0].x"
            :y1="annotation.points[0].y"
            :x2="annotation.points[1].x"
            :y2="annotation.points[1].y"
            stroke="#3b82f6"
            stroke-width="3"
            :class="{ selected: selection.isSelected(annotation.id) }"
            class="shape"
            @click="eventHandlers.handleShapeClick(annotation.id, $event)"
          />
          <!-- Measurement endpoints -->
          <circle
            :cx="annotation.points[0].x"
            :cy="annotation.points[0].y"
            r="5"
            fill="#3b82f6"
            class="shape"
            @click="eventHandlers.handleShapeClick(annotation.id, $event)"
          />
          <circle
            :cx="annotation.points[1].x"
            :cy="annotation.points[1].y"
            r="5"
            fill="#3b82f6"
            class="shape"
            @click="eventHandlers.handleShapeClick(annotation.id, $event)"
          />
        </g>

        <!-- Positioned: Fill rectangle -->
        <rect
          v-else-if="annotation.type === 'fill'"
          :x="annotation.x"
          :y="annotation.y"
          :width="annotation.width"
          :height="annotation.height"
          :fill="annotation.color"
          :opacity="annotation.opacity"
          :transform="getAnnotationTransform(annotation)"
          :class="{ selected: selection.isSelected(annotation.id) }"
          class="shape"
          @click="eventHandlers.handleShapeClick(annotation.id, $event)"
        />
      </g>

      <!-- Transform UI (handles, rotation, scaling) -->
      <TransformHandles />

      <!-- Marquee selection box -->
      <SelectionMarquee />
    </svg>

    <!-- Debug info -->
    <div class="debug-info">
      <h3>V2 Editor Status - Annotation Support</h3>
      <p><strong>Selected Count:</strong> {{ selection.selectedIds.value.length }}</p>
      <p><strong>Selected IDs:</strong> {{ selection.selectedIds.value.length > 0 ? selection.selectedIds.value.join(", ") : "None" }}</p>

      <template v-if="selection.selectedAnnotation.value">
        <p><strong>Type:</strong> {{ selection.selectedAnnotation.value.type }}</p>

        <!-- Point-based annotation info -->
        <template v-if="'points' in selection.selectedAnnotation.value">
          <p><strong>Points:</strong> {{ selection.selectedAnnotation.value.points.length }}</p>
          <p v-if="selection.selectedAnnotation.value.type === 'measure'">
            <strong>Distance:</strong> {{ selection.selectedAnnotation.value.distance?.toFixed(1) }}
          </p>
        </template>

        <!-- Positioned annotation info -->
        <template v-if="'x' in selection.selectedAnnotation.value && 'width' in selection.selectedAnnotation.value">
          <p>
            <strong>Position:</strong> ({{ Math.round(selection.selectedAnnotation.value.x) }}, {{ Math.round(selection.selectedAnnotation.value.y) }})
          </p>
          <p>
            <strong>Size:</strong> {{ selection.selectedAnnotation.value.width }} × {{ selection.selectedAnnotation.value.height }}
          </p>
        </template>

        <p><strong>Rotation:</strong> {{ ((selection.selectedAnnotation.value.rotation * 180) / Math.PI).toFixed(1) }}°</p>
      </template>

      <p v-if="bounds.selectionBounds.value">
        <strong>Selection Bounds:</strong> ({{ Math.round(bounds.selectionBounds.value.x) }}, {{ Math.round(bounds.selectionBounds.value.y) }})
        {{ Math.round(bounds.selectionBounds.value.width) }} × {{ Math.round(bounds.selectionBounds.value.height) }}
      </p>
      <p v-if="bounds.frozenBounds.value">
        <strong>Frozen Bounds:</strong> Active ✓
      </p>
      <p class="hint">
        <strong>Tip:</strong> Testing point-based (measurements) and positioned (fill) annotations.
        Click to select, Shift+Click to multi-select, Drag for marquee select.
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
