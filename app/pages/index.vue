<script setup lang="ts">
/**
 * Example: Minimal PDF Editor with SVG Annotations
 *
 * This shows the bare minimum needed to render a PDF with annotation tools.
 * No auth, no DB, no persistence - just pure rendering.
 */

import PdfPageSidebar from '~/components/PdfPageSidebar.vue'

// Default test PDF - using a sample PDF from PDF.js demo
// Replace with your own PDF path: "/sample.pdf" if you add one to /public folder
const pdfString = ref<string>(
  "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf"
)

// Load PDF from file input
function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    const url = URL.createObjectURL(file)
    pdfString.value = url
  }
}

// Initialize PDF
const { pdf } = usePDF(pdfString)

// Stores
const annotationStore = useAnnotationStore()
const rendererStore = useRendererStore()
const settingsStore = useSettingStore()

// Sidebar state
const sidebarOpen = ref(false)
function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

// PDF scale input
const scaleInput = ref(settingsStore.getPdfScale)
function updatePdfScale() {
  // Validate format (1:50, 1:100, etc.)
  const scaleRegex = /^1:\d+$/
  if (scaleRegex.test(scaleInput.value)) {
    settingsStore.setPdfScale(scaleInput.value)
  } else {
    // Reset to current valid value if invalid
    scaleInput.value = settingsStore.getPdfScale
  }
}

// Canvas panning state
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const spacePressed = ref(false)

// Handle wheel events (zoom + scroll)
function handleWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    // Zoom with Ctrl/Cmd + scroll
    e.preventDefault()
    const delta = e.deltaY
    if (delta < 0) {
      rendererStore.zoomIn()
    } else {
      rendererStore.zoomOut()
    }
  } else {
    // Pan/scroll normally
    rendererStore.setCanvasPos({
      scrollTop: rendererStore.getCanvasPos.scrollTop - e.deltaY,
      scrollLeft: rendererStore.getCanvasPos.scrollLeft - e.deltaX
    })
  }
}

// Handle canvas panning (like Figma)
function handleMouseDown(e: MouseEvent) {
  // Pan with space+click, middle mouse, or right mouse
  if (spacePressed.value || e.button === 1 || e.button === 2) {
    e.preventDefault()
    isPanning.value = true
    panStart.value = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as HTMLElement).style.cursor = "grabbing"
  }
}

function handleMouseMove(e: MouseEvent) {
  if (isPanning.value) {
    const deltaX = e.clientX - panStart.value.x
    const deltaY = e.clientY - panStart.value.y

    rendererStore.setCanvasPos({
      scrollLeft: rendererStore.getCanvasPos.scrollLeft + deltaX,
      scrollTop: rendererStore.getCanvasPos.scrollTop + deltaY
    })

    panStart.value = { x: e.clientX, y: e.clientY }
  }
}

function handleMouseUp(e: MouseEvent) {
  if (isPanning.value) {
    isPanning.value = false
    updateCursor(e.currentTarget as HTMLElement)
  }
}

function updateCursor(element: HTMLElement) {
  if (spacePressed.value) {
    element.style.cursor = "grab"
  } else {
    element.style.cursor = "default"
  }
}

// Keyboard shortcuts for space bar panning
function handleKeyDown(e: KeyboardEvent) {
  // Space bar panning
  if (e.code === "Space" && !spacePressed.value) {
    e.preventDefault()
    spacePressed.value = true
    const canvasArea = document.querySelector(".canvas-area") as HTMLElement
    if (canvasArea) canvasArea.style.cursor = "grab"
  }
}

function handleKeyUp(e: KeyboardEvent) {
  // Space bar panning
  if (e.code === "Space") {
    spacePressed.value = false
    const canvasArea = document.querySelector(".canvas-area") as HTMLElement
    if (canvasArea) canvasArea.style.cursor = "default"
  }
}

onMounted(() => {
  annotationStore.setActiveTool("measure")
  window.addEventListener("keydown", handleKeyDown)
  window.addEventListener("keyup", handleKeyUp)
})

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown)
  window.removeEventListener("keyup", handleKeyUp)
})

// Tool list
const tools = [
  { id: "measure", name: "Measure", icon: "📏" },
  { id: "area", name: "Area", icon: "📐" },
  { id: "perimeter", name: "Perimeter", icon: "⬡" },
  { id: "line", name: "Line", icon: "—" },
  { id: "fill", name: "Fill", icon: "🎨" },
  { id: "text", name: "Text", icon: "T" },
  { id: "rotate", name: "Rotate", icon: "🔄" }
] as const

// Get annotation count
const annotationCount = computed(() => annotationStore.annotations.length)
</script>

<template>
  <PdfEditorProvider>
    <!-- Page Sidebar -->
    <PdfPageSidebar :isOpen="sidebarOpen" @close="sidebarOpen = false" />

    <div class="pdf-editor" :class="{ 'sidebar-open': sidebarOpen }">
      <!-- Header -->
      <div class="header">
        <button class="sidebar-toggle-btn" @click="toggleSidebar" title="Toggle page sidebar">
          ☰
        </button>
        <h1>PDF Annotation Editor (Minimal)</h1>
        <input type="file" accept="application/pdf" @change="handleFileUpload" />
        <span class="count">{{ annotationCount }} annotations</span>
      </div>

      <!-- Tool Palette -->
      <div class="tools">
        <button
          v-for="tool in tools"
          :key="tool.id"
          :class="['tool-btn', { active: annotationStore.activeTool === tool.id }]"
          @click="annotationStore.setActiveTool(tool.id)"
          :title="tool.name"
        >
          {{ tool.icon }} {{ tool.name }}
        </button>

        <button
          :class="['tool-btn', { active: annotationStore.activeTool === 'selection' }]"
          @click="annotationStore.setActiveTool('selection')"
          title="Selection"
        >
          🔍 Select
        </button>
      </div>

      <!-- Zoom Controls -->
      <div class="zoom-controls">
        <button @click="rendererStore.zoomOut()" title="Zoom Out (Ctrl + Scroll)">−</button>
        <span>{{ Math.round(rendererStore.getScale * 100) }}%</span>
        <button @click="rendererStore.zoomIn()" title="Zoom In (Ctrl + Scroll)">+</button>
        <button @click="rendererStore.resetPageScale()" title="Reset Zoom">100%</button>
      </div>

      <!-- Rotation Controls -->
      <div class="rotation-controls">
        <button @click="rendererStore.rotateCounterClockwise()" title="Rotate Left (90°)">↶</button>
        <span>{{ rendererStore.getRotation }}°</span>
        <button @click="rendererStore.rotateClockwise()" title="Rotate Right (90°)">↷</button>
        <button @click="rendererStore.resetRotation()" title="Reset Rotation">0°</button>
      </div>

      <!-- PDF Scale Controls -->
      <div class="scale-controls">
        <label for="pdf-scale">PDF Scale:</label>
        <input
          id="pdf-scale"
          v-model="scaleInput"
          type="text"
          placeholder="1:100"
          @blur="updatePdfScale"
          @keyup.enter="updatePdfScale"
          title="Enter drawing scale (e.g., 1:50, 1:100, 1:200)"
        />
        <span class="scale-hint">{{ settingsStore.getPdfScale }}</span>
      </div>

      <!-- Page Navigation Controls -->
      <div class="page-controls">
        <button
          @click="rendererStore.setCurrentPage(rendererStore.getCurrentPage - 1)"
          :disabled="rendererStore.getCurrentPage <= 1"
          title="Previous Page"
        >
          ‹
        </button>
        <span>Page {{ rendererStore.getCurrentPage }} / {{ rendererStore.getTotalPages }}</span>
        <button
          @click="rendererStore.setCurrentPage(rendererStore.getCurrentPage + 1)"
          :disabled="rendererStore.getCurrentPage >= rendererStore.getTotalPages"
          title="Next Page"
        >
          ›
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
          <li><strong>Shift:</strong> Modifier (snap, constrain)</li>
          <li><strong>Escape:</strong> Cancel drawing</li>
          <li><strong>Delete:</strong> Remove selected annotation</li>
        </ul>
        <h3>Controls:</h3>
        <ul>
          <li><strong>Left Click:</strong> Draw with selected tool</li>
          <li><strong>Scroll:</strong> Pan vertically/horizontally</li>
          <li><strong>+/− Buttons:</strong> Zoom controls</li>
          <li><strong>↶/↷ Buttons:</strong> Rotate PDF 90°</li>
          <li><strong>🔄 Rotate Tool:</strong> Drag corners (+ Shift for 15°)</li>
        </ul>
      </div>

      <!-- Rotation Handles Component -->
      <HandlesRotation />
    </div>
  </PdfEditorProvider>
</template>

<style scoped>
.pdf-editor {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: #f5f5f5;
  overflow: hidden;
  transition: margin-left 0.3s ease;
}

.pdf-editor.sidebar-open {
  margin-left: 280px;
}

.sidebar-toggle-btn {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-toggle-btn:hover {
  background: #f5f5f5;
  border-color: #999;
}

.sidebar-open .sidebar-toggle-btn {
  background: #1976d2;
  color: white;
  border-color: #1976d2;
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

.scale-controls {
  position: fixed;
  bottom: 20px;
  right: 450px;
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

.scale-controls label {
  font-size: 14px;
  font-weight: 500;
  color: #555;
}

.scale-controls input {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  text-align: center;
}

.scale-controls input:focus {
  outline: none;
  border-color: #1976d2;
}

.scale-controls .scale-hint {
  font-size: 12px;
  color: #1976d2;
  font-weight: 500;
  padding: 2px 6px;
  background: #e3f2fd;
  border-radius: 4px;
}

.page-controls {
  position: fixed;
  bottom: 20px;
  left: 20px;
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

.page-controls button {
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.page-controls button:hover:not(:disabled) {
  background: #f5f5f5;
}

.page-controls button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-controls span {
  font-size: 14px;
  font-weight: 500;
  min-width: 100px;
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
