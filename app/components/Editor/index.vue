<script setup lang="ts">
/**
 * PdfEditor - Integrated PDF viewer with annotation system
 *
 * This component combines:
 * - PdfViewer: Renders the PDF document
 * - AnnotationLayer: Interactive drawing and annotation layer
 * - Transform handles: For editing existing annotations
 *
 * The layers are positioned absolutely and share the same coordinate system
 */

// PDF is now loaded via viewportStore.loadPdf() - no props needed

const viewportStore = useViewportStore()

// V2 Editor event handlers for transform handles (drag/rotate/scale)
const editorEventHandlers = useEditorEventHandlers()

// Set up global event listeners for transform handles
onMounted(() => {
  editorEventHandlers.setupGlobalListeners()
})

onUnmounted(() => {
  editorEventHandlers.cleanupGlobalListeners()
})

// Container for both PDF and annotation layers
const containerRef = ref<HTMLDivElement | null>(null)

// Container style - centered viewport
const containerStyle = computed(() => {
  return {
    position: "relative" as const,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  }
})
</script>

<template>
  <EditorPdfEditorProvider>
    <div ref="containerRef" class="pdf-editor" :style="containerStyle">
      <!-- Grid pattern background -->
      <BackgroundGridPattern :width="32" :height="32" class="fill-muted/5 stroke-muted-foreground/10" />

      <!-- PDF Container - wraps both canvas and SVG -->
      <div class="pdf-container">
        <!-- PDF Viewer Layer (Canvas) -->
        <EditorPdfViewer />

        <!-- SVG Annotation Layer (Interactive Drawing) -->
        <EditorAnnotationLayer />
      </div>

      <!-- Debug info -->
      <div v-if="viewportStore.getPdfInitialised" class="debug-overlay">
        <div class="debug-content">
          <p><strong>Scale:</strong> {{ viewportStore.getScale.toFixed(2) }}x</p>
          <p><strong>Rotation:</strong> {{ viewportStore.rotation }}°</p>
          <p><strong>Page:</strong> {{ viewportStore.getCurrentPage }} / {{ viewportStore.getTotalPages }}</p>
        </div>
      </div>
    </div>

    <EditorHandlesPdfRotate />
  </EditorPdfEditorProvider>
</template>

<style scoped>
.pdf-editor {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--background);
}

.pdf-container {
  position: relative;
  display: inline-block;
}

.debug-overlay {
  position: absolute;
  top: 16px;
  right: 16px;
  pointer-events: none;
  user-select: none;
  z-index: 1000;
}

.debug-content {
  background: color-mix(in srgb, var(--card) 95%, transparent);
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.2),
    0 4px 16px rgba(0, 0, 0, 0.15);
  font-size: 13px;
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.debug-content p {
  margin: 0;
  color: var(--muted-foreground);
}

.debug-content strong {
  color: var(--foreground);
  font-weight: 600;
  min-width: 90px;
  display: inline-block;
}
</style>
