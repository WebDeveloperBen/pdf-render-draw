<script setup lang="ts">
/**
 * Simple PDF Viewer - no Konva, no old stores
 */
import type { PDFDocumentLoadingTask } from "pdfjs-dist"
import { RENDERING } from "~/constants/rendering"
import { ERROR_COLORS, BUTTON_COLORS } from "~/constants/ui"
import { debugLog, debugError } from "~/utils/debug"

const props = defineProps<{
  pdf?: PDFDocumentLoadingTask
}>()

const rendererStore = useRendererStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Track current render task to allow cancellation
const currentRenderTask = ref<{ cancel: () => void } | null>(null)
const abortController = ref<AbortController | null>(null)
const isRendering = ref(false)

// Error handling state
const renderError = ref<string | null>(null)
const retryCount = ref(0)

const canvasStyle = computed(() => {
  const style = {
    position: "absolute" as const,
    top: "0",
    left: "0",
    transform: rendererStore.getCanvasTransform,
    transformOrigin: "center center" as const,
    // Use will-change for smooth scaling and rotation
    willChange: "transform" as const
  }
  debugLog("SimplePdfViewer", "canvasStyle updated:", {
    transform: style.transform,
    rotation: rendererStore.rotation
  })
  return style
})

async function renderPage(pageNum: number, renderScale?: number) {
  debugLog("SimplePdfViewer", "renderPage called:", {
    pageNum,
    renderScale,
    hasPdf: !!props.pdf,
    hasCanvas: !!canvasRef.value,
    isRendering: isRendering.value
  })

  if (!props.pdf || !canvasRef.value) {
    debugLog("SimplePdfViewer", "renderPage early return - missing pdf or canvas")
    return
  }

  // Cancel any ongoing render operation
  if (abortController.value) {
    debugLog("SimplePdfViewer", "Aborting previous render operation")
    abortController.value.abort()

    if (currentRenderTask.value) {
      try {
        currentRenderTask.value.cancel()
      } catch (e) {
        debugLog("SimplePdfViewer", "Error cancelling render task:", e)
      }
    }
  }

  // Create new abort controller for this render
  abortController.value = new AbortController()
  const signal = abortController.value.signal

  // Clear any previous errors
  renderError.value = null

  // Set rendering flag
  isRendering.value = true

  try {
    debugLog("SimplePdfViewer", "Getting PDF document from promise...")
    const pdfDoc = await props.pdf.promise

    // Check if aborted
    if (signal.aborted) {
      debugLog("SimplePdfViewer", "Render aborted after PDF load")
      return
    }

    debugLog("SimplePdfViewer", "Got PDF doc, getting page", pageNum)
    const page = await pdfDoc.getPage(pageNum)

    // Check if aborted
    if (signal.aborted) {
      debugLog("SimplePdfViewer", "Render aborted after page load")
      return
    }

    // Use device pixel ratio AND current zoom scale for crisp rendering
    const dpr = window.devicePixelRatio || RENDERING.DEFAULT_DEVICE_PIXEL_RATIO
    const currentScale = renderScale ?? rendererStore.getScale

    // Render at higher resolution based on zoom level
    // Note: We don't use viewport rotation here - rotation is applied via CSS transform
    // This keeps annotations in sync since they rotate with the CSS transform too
    const renderDpr = dpr * currentScale
    const viewport = page.getViewport({ scale: renderDpr })

    debugLog("SimplePdfViewer", "Viewport created:", {
      width: viewport.width,
      height: viewport.height,
      dpr,
      currentScale,
      renderDpr
    })

    // Store logical dimensions (without DPR/scale, no rotation applied to viewport)
    const logicalViewport = page.getViewport({ scale: 1 })
    rendererStore.setCanvasSize({
      width: logicalViewport.width,
      height: logicalViewport.height
    })

    // Render to canvas with DPR * scale
    const context = canvasRef.value.getContext("2d")
    if (!context) {
      console.error("Failed to get 2d context")
      return
    }

    // Set canvas buffer size (actual pixels at current zoom - high resolution)
    canvasRef.value.width = viewport.width
    canvasRef.value.height = viewport.height

    // Set canvas display size (CSS pixels - always logical size, CSS transform handles scale)
    canvasRef.value.style.width = `${logicalViewport.width}px`
    canvasRef.value.style.height = `${logicalViewport.height}px`

    debugLog("SimplePdfViewer", "Starting PDF render...")
    const renderTask = page.render({
      canvasContext: context,
      viewport,
      canvas: canvasRef.value
    })

    // Store the render task for potential cancellation
    currentRenderTask.value = renderTask

    await renderTask.promise

    // Clear the render task when complete
    currentRenderTask.value = null

    // Reset retry count on success
    retryCount.value = 0

    debugLog("SimplePdfViewer", "PDF rendered successfully:", {
      bufferWidth: viewport.width,
      bufferHeight: viewport.height,
      displayWidth: logicalViewport.width,
      displayHeight: logicalViewport.height,
      scale: currentScale
    })
  } catch (e: unknown) {
    // Ignore abort/cancellation errors
    const error = e as { name?: string }
    if (error?.name === 'RenderingCancelledException' || error?.name === 'AbortError' || signal.aborted) {
      debugLog("SimplePdfViewer", "Render was cancelled (expected)")
      return
    }

    debugError("SimplePdfViewer", "Failed to render PDF:", e)

    // Retry logic
    if (retryCount.value < RENDERING.MAX_RETRIES) {
      retryCount.value++
      debugLog("SimplePdfViewer", `Retrying render (${retryCount.value}/${RENDERING.MAX_RETRIES})...`)

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, RENDERING.RETRY_BASE_DELAY_MS * retryCount.value))

      // Don't retry if aborted during backoff
      if (signal.aborted) {
        return
      }

      // Retry render
      return renderPage(pageNum, renderScale)
    }

    // Max retries exceeded - show error to user
    renderError.value = `Failed to render page ${pageNum}. ${e.message || 'Unknown error'}`
  } finally {
    // Always clear rendering flag
    isRendering.value = false
    currentRenderTask.value = null

    // Clear abort controller if this was the active one
    if (abortController.value?.signal === signal) {
      abortController.value = null
    }
  }
}

// Debounce timer for scale changes
let scaleDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.pdf,
  async (newPdf) => {
    debugLog("SimplePdfViewer", "PDF WATCH TRIGGERED - newPdf:", !!newPdf, "canvas:", !!canvasRef.value)

    if (!newPdf) return

    // Store PDF document and total pages (don't need canvas for this)
    debugLog("SimplePdfViewer", "Waiting for PDF promise...")
    const pdfDoc = await newPdf.promise
    debugLog("SimplePdfViewer", "PDF loaded, storing in renderer store:", pdfDoc)
    // Use markRaw to prevent Vue from making the PDF document reactive
    // PDF.js uses private fields that break when wrapped in a Proxy
    rendererStore.setDocumentProxy(markRaw(pdfDoc))
    rendererStore.setTotalPages(pdfDoc.numPages)
    debugLog("SimplePdfViewer", "PDF document stored, total pages:", pdfDoc.numPages)

    // Render page if canvas is ready
    if (canvasRef.value) {
      await renderPage(rendererStore.getCurrentPage)
    }
  },
  { immediate: true }
)

// Watch for page changes
watch(
  () => rendererStore.getCurrentPage,
  async (newPage) => {
    debugLog("SimplePdfViewer", "Page changed:", newPage)
    if (props.pdf && canvasRef.value) {
      await renderPage(newPage)
    }
  }
)

// Watch for scale changes and re-render at higher resolution
watch(
  () => rendererStore.getScale,
  async (newScale) => {
    debugLog("SimplePdfViewer", "Scale changed:", newScale)

    // Debounce re-rendering to avoid too many renders during continuous zoom
    if (scaleDebounceTimer) {
      clearTimeout(scaleDebounceTimer)
    }

    scaleDebounceTimer = setTimeout(async () => {
      if (props.pdf && canvasRef.value) {
        await renderPage(rendererStore.getCurrentPage, newScale)
      }
    }, RENDERING.SCALE_DEBOUNCE_MS)
  }
)

onMounted(async () => {
  debugLog("SimplePdfViewer", "SimplePdfViewer mounted:", {
    hasPdf: !!props.pdf,
    hasCanvas: !!canvasRef.value
  })

  // If PDF is already loaded but canvas wasn't ready during watch, render now
  if (props.pdf && canvasRef.value) {
    await renderPage(rendererStore.getCurrentPage)
  }
})

function handleRetry() {
  retryCount.value = 0
  renderError.value = null
  renderPage(rendererStore.getCurrentPage)
}

onUnmounted(() => {
  if (scaleDebounceTimer) {
    clearTimeout(scaleDebounceTimer)
  }
})
</script>

<template>
  <div class="pdf-viewer">
    <!-- Error overlay with retry button -->
    <div v-if="renderError" class="error-overlay">
      <div class="error-content">
        <p class="error-message">{{ renderError }}</p>
        <button class="retry-btn" @click="handleRetry">
          Retry
        </button>
      </div>
    </div>

    <canvas ref="canvasRef" class="pdf-canvas" :style="canvasStyle" />
  </div>
</template>

<style scoped>
.pdf-viewer {
  position: relative;
  display: block;
}

.pdf-canvas {
  display: block;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.15),
    0 12px 32px rgba(0, 0, 0, 0.2);
  background: white;
}

.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: v-bind('ERROR_COLORS.BACKGROUND');
  z-index: 1000;
}

.error-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.error-message {
  margin: 0 0 16px 0;
  color: v-bind('ERROR_COLORS.TEXT');
  font-size: 14px;
  line-height: 1.5;
}

.retry-btn {
  padding: 8px 24px;
  background: v-bind('BUTTON_COLORS.PRIMARY');
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: v-bind('BUTTON_COLORS.PRIMARY_HOVER');
}
</style>
