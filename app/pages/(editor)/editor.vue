<script setup lang="ts">
definePageMeta({
  layout: "editor"
})

const viewportStore = useViewportStore()

// Load PDF via store (lazy worker initialization)
const pdfUrl = ref("/house.pdf")
onMounted(() => {
  viewportStore.loadPdf(pdfUrl.value)
})

// Watch for URL changes (e.g., if user loads a different PDF)
watch(pdfUrl, (newUrl) => {
  if (newUrl) {
    viewportStore.loadPdf(newUrl)
  }
})
const annotationStore = useAnnotationStore()

// Sidebar state
const isSidebarOpen = ref(false)

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  isSidebarOpen.value = false
}

// Tool registry for drawing tools
const toolRegistry = useToolRegistry()
const tools = computed(() => toolRegistry.getCompleteToolbarTools())

// Zoom controls
function zoomIn() {
  viewportStore.zoomIn()
}

function zoomOut() {
  viewportStore.zoomOut()
}

function resetZoom() {
  viewportStore.resetPageScale()
}

function rotateClockwise() {
  viewportStore.rotateClockwise()
}

function rotateCounterClockwise() {
  viewportStore.rotateCounterClockwise()
}

function resetRotation() {
  viewportStore.resetRotation()
}

// Canvas panning state
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const spacePressed = ref(false)

// Zoom handling composable
const { handleWheel: handleWheelZoom } = useZoom()

// Handle wheel events (zoom + scroll)
function handleWheel(e: WheelEvent) {
  const pdfContainer = document.querySelector(".pdf-container") as HTMLElement
  if (!pdfContainer) return

  handleWheelZoom(e, pdfContainer)
}

// Handle canvas panning (like Figma)
function handleMouseDown(e: MouseEvent) {
  // Pan with space+click, middle mouse, or right mouse
  if (spacePressed.value || e.button === 1 || e.button === 2) {
    e.preventDefault()
    isPanning.value = true
    panStart.value = { x: e.clientX, y: e.clientY }
  }
}

function handleMouseMove(e: MouseEvent) {
  if (isPanning.value) {
    const deltaX = e.clientX - panStart.value.x
    const deltaY = e.clientY - panStart.value.y

    viewportStore.setCanvasPos({
      scrollLeft: viewportStore.getCanvasPos.scrollLeft + deltaX,
      scrollTop: viewportStore.getCanvasPos.scrollTop + deltaY
    })

    panStart.value = { x: e.clientX, y: e.clientY }
  }
}

function handleMouseUp() {
  if (isPanning.value) {
    isPanning.value = false
  }
}

// Keyboard shortcuts for space bar panning
function handleKeyDown(e: KeyboardEvent) {
  // Space bar panning
  if (e.code === "Space" && !spacePressed.value) {
    e.preventDefault()
    spacePressed.value = true
  }
}

function handleKeyUp(e: KeyboardEvent) {
  // Space bar panning
  if (e.code === "Space") {
    spacePressed.value = false
  }
}

// Keyboard event listeners
if (typeof window !== "undefined") {
  useEventListener(window, "keydown", handleKeyDown)
  useEventListener(window, "keyup", handleKeyUp)
}
</script>

<template>
  <div class="editor-page">
    <ClientOnly>
      <!-- Page Sidebar -->
      <EditorSidebar :is-open="isSidebarOpen" @close="closeSidebar" />

      <!-- Main Editor Area -->
      <div class="editor-main" :class="{ 'sidebar-open': isSidebarOpen }">
        <!-- Toolbar -->
        <div class="toolbar">
          <!-- Left side - Navigation -->
          <div class="toolbar-section">
            <NuxtLink to="/" class="toolbar-btn" title="Back to dashboard">
              <Icon name="lucide:arrow-left" class="size-4" />
              <span>Back</span>
            </NuxtLink>

            <div class="divider" />

            <button
              class="toolbar-btn"
              :class="{ active: isSidebarOpen }"
              title="Toggle pages sidebar"
              @click="toggleSidebar"
            >
              <Icon name="lucide:panel-left" class="size-4" />
              Pages
            </button>

            <div class="divider" />

            <div class="page-nav">
              <button
                class="toolbar-btn-icon"
                title="Previous page"
                :disabled="viewportStore.getCurrentPage <= 1"
                @click="viewportStore.setCurrentPage(Math.max(1, viewportStore.getCurrentPage - 1))"
              >
                <Icon name="lucide:chevron-left" class="size-4" />
              </button>
              <span class="page-indicator">
                {{ viewportStore.getCurrentPage }} / {{ viewportStore.getTotalPages }}
              </span>
              <button
                class="toolbar-btn-icon"
                title="Next page"
                :disabled="viewportStore.getCurrentPage >= viewportStore.getTotalPages"
                @click="
                  viewportStore.setCurrentPage(Math.min(viewportStore.getTotalPages, viewportStore.getCurrentPage + 1))
                "
              >
                <Icon name="lucide:chevron-right" class="size-4" />
              </button>
            </div>
          </div>

          <!-- Center - Zoom & Rotation Controls -->
          <div class="toolbar-section">
            <div class="control-group">
              <span class="control-label">Zoom</span>
              <button class="toolbar-btn-icon" title="Zoom out" @click="zoomOut">
                <Icon name="lucide:minus" class="size-4" />
              </button>
              <button class="toolbar-btn-sm" title="Reset zoom" @click="resetZoom">
                {{ Math.round(viewportStore.getScale * 100) }}%
              </button>
              <button class="toolbar-btn-icon" title="Zoom in" @click="zoomIn">
                <Icon name="lucide:plus" class="size-4" />
              </button>
            </div>

            <div class="divider" />

            <div class="control-group">
              <span class="control-label">Rotate</span>
              <button class="toolbar-btn-icon" title="Rotate counter-clockwise" @click="rotateCounterClockwise">
                <Icon name="lucide:rotate-ccw" class="size-4" />
              </button>
              <button class="toolbar-btn-sm" title="Reset rotation" @click="resetRotation">
                {{ viewportStore.rotation }}°
              </button>
              <button class="toolbar-btn-icon" title="Rotate clockwise" @click="rotateClockwise">
                <Icon name="lucide:rotate-cw" class="size-4" />
              </button>
            </div>
          </div>

          <!-- Right side - Info & Theme -->
          <div class="toolbar-section">
            <span class="info-text">Total Annotations: {{ annotationStore.annotations.length }}</span>
            <div class="divider" />
            <BackgroundThemeToggle />
          </div>
        </div>

        <!-- Tool Palette -->
        <div class="tool-palette">
          <div class="tool-group">
            <span class="tool-group-label">Tools</span>
            <button
              v-for="tool in tools"
              :key="tool.id"
              :class="['tool-btn', { active: annotationStore.activeTool === tool.id }]"
              :title="tool.name"
              @click="annotationStore.setActiveTool(tool.id)"
            >
              <Icon :name="tool.icon" class="size-4" />
              <span class="tool-name">{{ tool.name }}</span>
            </button>

            <button
              :class="['tool-btn', { active: annotationStore.activeTool === 'selection' }]"
              title="Selection"
              @click="annotationStore.setActiveTool('selection')"
            >
              <Icon name="lucide:mouse-pointer-2" class="size-4" />
              <span class="tool-name">Select</span>
            </button>
          </div>
        </div>

        <!-- PDF Editor Canvas -->
        <div
          class="editor-container"
          :class="{ panning: isPanning, 'space-pressed': spacePressed }"
          @wheel="handleWheel"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @mouseup="handleMouseUp"
          @mouseleave="handleMouseUp"
          @contextmenu.prevent
        >
          <Editor v-if="viewportStore.isPdfLoaded" />
        </div>
      </div>
    </ClientOnly>
  </div>
</template>

<style scoped>
.editor-page {
  display: flex;
  height: 100vh;
  width: 100vw;
  background: var(--background);
  position: relative;
  overflow: hidden;
}

.editor-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  transition: margin-left 0.3s ease;
}

.editor-main.sidebar-open {
  margin-left: 280px;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 56px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  gap: 16px;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.divider {
  width: 1px;
  height: 24px;
  background: var(--border);
}

/* Buttons */
.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  color: var(--muted-foreground);
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: var(--accent);
  color: var(--foreground);
}

.toolbar-btn.active {
  background: var(--primary);
  color: var(--primary-foreground);
  border-color: var(--primary);
}

.toolbar-btn .icon {
  font-size: 16px;
}

.toolbar-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  color: var(--muted-foreground);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn-icon:hover:not(:disabled) {
  background: var(--accent);
  color: var(--foreground);
  border-color: var(--accent);
}

.toolbar-btn-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.toolbar-btn-sm {
  padding: 6px 12px;
  background: transparent;
  color: var(--muted-foreground);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 60px;
  font-family: ui-monospace, monospace;
}

.toolbar-btn-sm:hover {
  background: var(--accent);
  color: var(--foreground);
  border-color: var(--accent);
}

/* Page Navigation */
.page-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-indicator {
  font-size: 13px;
  color: var(--muted-foreground);
  font-weight: 500;
  min-width: 60px;
  text-align: center;
  font-family: ui-monospace, monospace;
}

/* Control Group */
.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 12px;
  color: var(--muted-foreground);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Info Text */
.info-text {
  font-size: 13px;
  color: var(--muted-foreground);
  font-family: ui-monospace, monospace;
}

/* Tool Palette */
.tool-palette {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tool-group-label {
  font-size: 12px;
  color: var(--muted-foreground);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-right: 8px;
}

.tool-palette .tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--card);
  color: var(--muted-foreground);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tool-palette .tool-btn:hover {
  background: var(--accent);
  color: var(--foreground);
  border-color: var(--accent);
}

.tool-palette .tool-btn.active {
  background: var(--primary);
  color: var(--primary-foreground);
  border-color: var(--primary);
}

.tool-name {
  font-size: 13px;
  font-weight: 500;
}

/* Editor Container */
.editor-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--background);
  cursor: default;
}

.editor-container.space-pressed {
  cursor: grab;
}

.editor-container.panning {
  cursor: grabbing;
}
</style>
