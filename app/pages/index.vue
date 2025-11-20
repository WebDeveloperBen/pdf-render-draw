<script setup lang="ts">
/**
 * Example: Minimal PDF Editor with SVG Annotations
 *
 * This shows the bare minimum needed to render a PDF with annotation tools.
 * No auth, no DB, no persistence - just pure rendering.
 */

// Default test PDF - using a sample PDF from PDF.js demo
// Replace with your own PDF path: "/sample.pdf" if you add one to /public folder
const pdfString = ref<string>("https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf");

// Load PDF from file input
function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const url = URL.createObjectURL(file);
    pdfString.value = url;
  }
}

// Initialize PDF
const { pdf } = usePDF(pdfString);

// Stores
const annotationStore = useAnnotationStore();
const rendererStore = useRendererStore();
const settings = useSettingStore();

// Canvas panning state
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0 });
const spacePressed = ref(false);

// Handle wheel events (zoom + scroll)
function handleWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    // Zoom with Ctrl/Cmd + scroll
    e.preventDefault();
    const delta = e.deltaY;
    if (delta < 0) {
      rendererStore.zoomIn();
    } else {
      rendererStore.zoomOut();
    }
  } else {
    // Pan/scroll normally
    rendererStore.setCanvasPos({
      scrollTop: rendererStore.getCanvasPos.scrollTop - e.deltaY,
      scrollLeft: rendererStore.getCanvasPos.scrollLeft - e.deltaX,
    });
  }
}

// Handle canvas panning (like Figma)
function handleMouseDown(e: MouseEvent) {
  // Pan with space+click, middle mouse, or right mouse
  if (spacePressed.value || e.button === 1 || e.button === 2) {
    e.preventDefault();
    isPanning.value = true;
    panStart.value = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
  }
}

function handleMouseMove(e: MouseEvent) {
  if (isPanning.value) {
    const deltaX = e.clientX - panStart.value.x;
    const deltaY = e.clientY - panStart.value.y;

    rendererStore.setCanvasPos({
      scrollLeft: rendererStore.getCanvasPos.scrollLeft + deltaX,
      scrollTop: rendererStore.getCanvasPos.scrollTop + deltaY,
    });

    panStart.value = { x: e.clientX, y: e.clientY };
  }
}

function handleMouseUp(e: MouseEvent) {
  if (isPanning.value) {
    isPanning.value = false;
    updateCursor(e.currentTarget as HTMLElement);
  }
}

function updateCursor(element: HTMLElement) {
  if (spacePressed.value) {
    element.style.cursor = 'grab';
  } else {
    element.style.cursor = 'default';
  }
}

// Keyboard shortcuts for space bar panning
function handleKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !spacePressed.value) {
    e.preventDefault();
    spacePressed.value = true;
    const canvasArea = document.querySelector('.canvas-area') as HTMLElement;
    if (canvasArea) canvasArea.style.cursor = 'grab';
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    spacePressed.value = false;
    const canvasArea = document.querySelector('.canvas-area') as HTMLElement;
    if (canvasArea) canvasArea.style.cursor = 'default';
  }
}

onMounted(() => {
  annotationStore.setActiveTool("measure");
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
});

// Tool list
const tools = [
  { id: "measure", name: "Measure", icon: "📏" },
  { id: "area", name: "Area", icon: "📐" },
  { id: "perimeter", name: "Perimeter", icon: "⬡" },
  { id: "line", name: "Line", icon: "—" },
  { id: "fill", name: "Fill", icon: "🎨" },
  { id: "text", name: "Text", icon: "T" },
] as const;

// Get annotation count
const annotationCount = computed(() => annotationStore.annotations.length);
</script>

<template>
  <div class="pdf-editor">
    <!-- Header -->
    <div class="header">
      <h1>PDF Annotation Editor (Minimal)</h1>
      <input type="file" accept="application/pdf" @change="handleFileUpload" />
      <span class="count">{{ annotationCount }} annotations</span>
    </div>

    <!-- Tool Palette -->
    <div class="tools">
      <button
        v-for="tool in tools"
        :key="tool.id"
        :class="[
          'tool-btn',
          { active: annotationStore.activeTool === tool.id },
        ]"
        @click="annotationStore.setActiveTool(tool.id)"
        :title="tool.name"
      >
        {{ tool.icon }} {{ tool.name }}
      </button>

      <button
        :class="[
          'tool-btn',
          { active: annotationStore.activeTool === 'selection' },
        ]"
        @click="annotationStore.setActiveTool('selection')"
        title="Selection"
      >
        🔍 Select
      </button>
    </div>

    <!-- Zoom Controls -->
    <div class="zoom-controls">
      <button @click="rendererStore.zoomOut()" title="Zoom Out (Ctrl + Scroll)">
        −
      </button>
      <span>{{ Math.round(rendererStore.getScale * 100) }}%</span>
      <button @click="rendererStore.zoomIn()" title="Zoom In (Ctrl + Scroll)">
        +
      </button>
      <button @click="rendererStore.resetPageScale()" title="Reset Zoom">
        100%
      </button>
    </div>

    <!-- Rotation Controls -->
    <div class="rotation-controls">
      <button @click="rendererStore.rotateCounterClockwise()" title="Rotate Left (90°)">
        ↶
      </button>
      <span>{{ rendererStore.getRotation }}°</span>
      <button @click="rendererStore.rotateClockwise()" title="Rotate Right (90°)">
        ↷
      </button>
      <button @click="rendererStore.resetRotation()" title="Reset Rotation">
        0°
      </button>
    </div>

    <!-- Canvas Area -->
    <div
      class="canvas-area"
      @wheel="handleWheel"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @contextmenu.prevent
    >
      <div v-if="!pdf" class="placeholder">
        <p>👆 Upload a PDF to get started</p>
      </div>

      <template v-else>
        <!-- Wrapper to keep PDF and SVG aligned -->
        <div class="pdf-container">
          <!-- PDF Canvas -->
          <SimplePdfViewer :pdf="pdf" />

          <!-- SVG Annotation Layer -->
          <SvgAnnotationLayer />
        </div>
      </template>
    </div>

    <!-- Instructions -->
    <div class="instructions">
      <h3>Keyboard Shortcuts:</h3>
      <ul>
        <li><strong>Space + Drag:</strong> Pan canvas (like Figma)</li>
        <li><strong>Ctrl/Cmd + Scroll:</strong> Zoom in/out</li>
        <li><strong>Middle Mouse:</strong> Pan canvas</li>
        <li><strong>Escape:</strong> Cancel drawing</li>
        <li><strong>Delete:</strong> Remove selected annotation</li>
      </ul>
      <h3>Controls:</h3>
      <ul>
        <li><strong>Left Click:</strong> Draw with selected tool</li>
        <li><strong>Scroll:</strong> Pan vertically/horizontally</li>
        <li><strong>+/− Buttons:</strong> Zoom controls</li>
        <li><strong>↶/↷ Buttons:</strong> Rotate PDF 90°</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.pdf-editor {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: #f5f5f5;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  background: white;
  border-bottom: 1px solid #ddd;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.header input[type="file"] {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.count {
  margin-left: auto;
  padding: 4px 12px;
  background: #e3f2fd;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  color: #1976d2;
}

.tools {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  background: white;
  border-bottom: 1px solid #ddd;
  flex-wrap: wrap;
}

.tool-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: #f5f5f5;
  border-color: #999;
}

.tool-btn.active {
  background: #1976d2;
  color: white;
  border-color: #1976d2;
}

.zoom-controls {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.zoom-controls button {
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 14px;
}

.zoom-controls button:hover {
  background: #f5f5f5;
}

.zoom-controls span {
  font-size: 14px;
  font-weight: 500;
  min-width: 50px;
  text-align: center;
}

.rotation-controls {
  position: fixed;
  bottom: 20px;
  right: 220px;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.rotation-controls button {
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.rotation-controls button:hover {
  background: #f5f5f5;
}

.rotation-controls span {
  font-size: 14px;
  font-weight: 500;
  min-width: 40px;
  text-align: center;
}

.canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pdf-container {
  position: relative;
  display: inline-block;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 18px;
  color: #999;
}

.instructions {
  position: fixed;
  bottom: 20px;
  left: 20px;
  max-width: 300px;
  padding: 16px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.instructions h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.instructions ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.6;
  color: #666;
}

.instructions li {
  margin-bottom: 6px;
}
</style>
