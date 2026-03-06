<script setup lang="ts">
import { useEditorSync, type SyncState } from "@/composables/useEditorSync"
import type { ViewportState } from "@/composables/useViewportStorage"
import { useRoomDetection } from "@/composables/editor/useRoomDetection"

definePageMeta({
  layout: "editor"
})

const route = useRoute()
const viewportStore = useViewportStore()
const annotationStore = useAnnotationStore()

// Get project and file IDs from query params
const projectId = computed(() => route.query.projectId as string | undefined)
const fileId = ref<string | null>(null)

// File loading state
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const fileName = ref<string>("")
const pdfUrl = ref<string>("")

// Editor sync composable - handles persistence automatically via store action interception
const {
  syncState,
  pendingCount,
  syncError,
  hasPendingChanges,
  isOnline,
  isInitialized,
  currentViewportState,
  initializeForFile,
  forceSync,
  cleanup: cleanupSync,
  persistViewportState
} = useEditorSync({
  fileId: fileId,
  annotationStore,
  onAnnotationsLoaded: (annotations) => {
    annotationStore.setAnnotations(annotations)
  },
  onViewportLoaded: (viewport) => {
    // Apply server viewport state to viewport store
    viewportStore.setScale(viewport.scale)
    viewportStore.setRotation(viewport.rotation)
    viewportStore.setCanvasPos({
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop
    })
    viewportStore.setCurrentPage(viewport.currentPage)
  }
})

// Watch viewport changes and persist them (debounced)
const viewportDebounceTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

function persistViewport() {
  if (!fileId.value) return

  const state: ViewportState = {
    scale: viewportStore.scale,
    rotation: viewportStore.rotation,
    scrollLeft: viewportStore.canvasPos.scrollLeft,
    scrollTop: viewportStore.canvasPos.scrollTop,
    currentPage: viewportStore.currentPage
  }

  persistViewportState(state)
}

// Watch viewport changes
watch(
  [
    () => viewportStore.scale,
    () => viewportStore.rotation,
    () => viewportStore.canvasPos.scrollLeft,
    () => viewportStore.canvasPos.scrollTop,
    () => viewportStore.currentPage
  ],
  () => {
    // Debounce viewport persistence (500ms)
    if (viewportDebounceTimeout.value) {
      clearTimeout(viewportDebounceTimeout.value)
    }
    viewportDebounceTimeout.value = setTimeout(persistViewport, 500)
  }
)

// Fetch file details and load PDF
async function loadFile() {
  const projectIdValue = route.query.projectId as string | undefined
  const fileIdValue = route.query.fileId as string | undefined

  if (!projectIdValue || !fileIdValue) {
    loadError.value = "Missing project or file ID"
    isLoading.value = false
    return
  }

  try {
    isLoading.value = true
    loadError.value = null

    const response = await $fetch(`/api/projects/${projectIdValue}/files/${fileIdValue}`)
    fileName.value = response.pdfFileName
    pdfUrl.value = response.pdfUrl
    await viewportStore.loadPdf(response.pdfUrl)

    // Set file ID and initialize sync
    fileId.value = fileIdValue
    annotationStore.setCurrentFileId(fileIdValue)
    await initializeForFile(fileIdValue)
  } catch (error: unknown) {
    console.error("Failed to load file:", error)
    loadError.value = error instanceof Error ? error.message : "Failed to load file"
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadFile()
})

// Cleanup on unmount
onUnmounted(async () => {
  if (viewportDebounceTimeout.value) {
    clearTimeout(viewportDebounceTimeout.value)
  }
  await cleanupSync()
})

// Sidebar state - persisted to localStorage
const isSidebarOpen = useLocalStorage('editor-sidebar-open', false)

// Sync status tooltip
const syncTooltip = computed(() => {
  if (syncState.value === "syncing") return "Syncing changes..."
  if (syncState.value === "error") return `Sync error: ${syncError.value || "Unknown error"}`
  if (syncState.value === "offline") return "Offline - changes saved locally"
  if (pendingCount.value > 0) return `${pendingCount.value} unsaved change${pendingCount.value > 1 ? "s" : ""}`
  return "All changes saved"
})

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  isSidebarOpen.value = false
}

// Tool registry for drawing tools
const toolRegistry = useToolRegistry()
const tools = computed(() => toolRegistry.getCompleteToolbarTools())

// Room detection
const {
  roomLayerEnabled,
  debugLayerEnabled,
  isDetecting: isDetectingRooms,
  toggleRoomLayer,
  toggleDebugLayer,
  detectedRooms,
  debugData
} = useRoomDetection()

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

// PDF Export
const { exportFromEditor, isExporting } = useExportPdf()

async function handleExport() {
  if (!pdfUrl.value) {
    return
  }
  const exportFileName = fileName.value
    ? fileName.value.replace(/\.pdf$/i, "-annotated.pdf")
    : "annotated.pdf"
  await exportFromEditor(pdfUrl.value, exportFileName)
}

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

// Keyboard shortcuts for space bar panning and save
function handleKeyDown(e: KeyboardEvent) {
  // Ctrl+S or Cmd+S to force sync
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault()
    forceSync()
    return
  }

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
            <NuxtLink :to="projectId ? `/projects/${projectId}` : '/'" class="toolbar-btn" title="Back to project">
              <Icon name="lucide:arrow-left" class="size-4" />
              <span>Back</span>
            </NuxtLink>

            <div class="divider" />

            <!-- File name -->
            <div v-if="fileName" class="file-name" :title="fileName">
              <Icon name="lucide:file-text" class="size-4" />
              <span>{{ fileName }}</span>
            </div>

            <div v-if="fileName" class="divider" />

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
                {{ Math.round(viewportStore.rotation) }}°
              </button>
              <button class="toolbar-btn-icon" title="Rotate clockwise" @click="rotateClockwise">
                <Icon name="lucide:rotate-cw" class="size-4" />
              </button>
            </div>
          </div>

          <!-- Right side - Export, Sync Status, Info & Theme -->
          <div class="toolbar-section">
            <!-- Export Button -->
            <button
              class="toolbar-btn"
              :disabled="isExporting || !viewportStore.isPdfLoaded"
              title="Download PDF with annotations"
              @click="handleExport"
            >
              <Icon v-if="isExporting" name="svg-spinners:ring-resize" class="size-4" />
              <Icon v-else name="lucide:download" class="size-4" />
              <span>{{ isExporting ? 'Exporting...' : 'Export' }}</span>
            </button>

            <div class="divider" />

            <!-- Sync Status Indicator -->
            <div class="sync-status" :class="syncState" :title="syncTooltip">
              <Icon
                v-if="syncState === 'syncing'"
                name="svg-spinners:ring-resize"
                class="size-4"
              />
              <Icon
                v-else-if="syncState === 'error'"
                name="lucide:cloud-off"
                class="size-4"
              />
              <Icon
                v-else-if="syncState === 'offline'"
                name="lucide:wifi-off"
                class="size-4"
              />
              <Icon
                v-else-if="hasPendingChanges"
                name="lucide:cloud-upload"
                class="size-4"
              />
              <Icon v-else name="lucide:cloud-check" class="size-4" />
              <span v-if="pendingCount > 0" class="pending-badge">
                {{ pendingCount }}
              </span>
            </div>

            <div class="divider" />

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

            <div class="tool-divider" />

            <button
              :class="['tool-btn room-detect-btn', { active: roomLayerEnabled }]"
              :title="roomLayerEnabled ? 'Hide detected rooms' : 'Auto-detect rooms from plan'"
              :disabled="!viewportStore.isPdfLoaded"
              @click="toggleRoomLayer"
            >
              <Icon v-if="isDetectingRooms" name="svg-spinners:ring-resize" class="size-4" />
              <Icon v-else name="lucide:scan-line" class="size-4" />
              <span class="tool-name">{{ roomLayerEnabled ? `Rooms (${detectedRooms.length})` : 'Detect Rooms' }}</span>
            </button>

            <button
              :class="['tool-btn room-debug-btn', { active: debugLayerEnabled }]"
              :title="debugLayerEnabled ? 'Hide raw plan debug overlay' : 'Show raw edges/nodes debug overlay'"
              :disabled="!viewportStore.isPdfLoaded"
              @click="toggleDebugLayer"
            >
              <Icon name="lucide:bug" class="size-4" />
              <span class="tool-name">
                {{ debugLayerEnabled ? `Debug (${debugData?.nodes.length ?? 0} nodes)` : 'Debug Plan' }}
              </span>
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
          <!-- Loading state -->
          <div v-if="isLoading" class="loading-state">
            <Icon name="svg-spinners:ring-resize" class="size-8 text-primary" />
            <span>Loading file...</span>
          </div>

          <!-- Error state -->
          <div v-else-if="loadError" class="error-state">
            <Icon name="lucide:alert-circle" class="size-8 text-destructive" />
            <span>{{ loadError }}</span>
            <NuxtLink :to="projectId ? `/projects/${projectId}` : '/'" class="error-link"> Return to project </NuxtLink>
          </div>

          <!-- Editor -->
          <Editor v-else-if="viewportStore.isPdfLoaded" />
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

.tool-divider {
  width: 1px;
  height: 24px;
  background: var(--border);
  margin: 0 4px;
}

.room-detect-btn.active {
  background: hsl(210, 80%, 50%) !important;
  color: white !important;
  border-color: hsl(210, 80%, 50%) !important;
}

.room-debug-btn.active {
  background: hsl(14, 85%, 52%) !important;
  color: white !important;
  border-color: hsl(14, 85%, 52%) !important;
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

/* File name in toolbar */
.file-name {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  color: var(--foreground);
  font-size: 13px;
  font-weight: 500;
  max-width: 200px;
  overflow: hidden;
}

.file-name span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Loading state */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--muted-foreground);
  font-size: 14px;
}

/* Error state */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--muted-foreground);
  font-size: 14px;
}

.error-link {
  padding: 8px 16px;
  background: var(--primary);
  color: var(--primary-foreground);
  border-radius: 6px;
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.2s;
}

.error-link:hover {
  opacity: 0.9;
}

/* Sync Status Indicator */
.sync-status {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--muted-foreground);
  transition: all 0.2s;
  position: relative;
}

.sync-status.idle {
  color: var(--muted-foreground);
}

.sync-status.syncing {
  color: var(--primary);
}

.sync-status.error {
  color: hsl(0 84% 60%);
  background: hsl(0 84% 60% / 0.1);
}

.sync-status.offline {
  color: hsl(45 93% 47%);
  background: hsl(45 93% 47% / 0.1);
}

.pending-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--primary);
  color: var(--primary-foreground);
  border-radius: 9px;
  font-size: 10px;
  font-weight: 600;
}
</style>
