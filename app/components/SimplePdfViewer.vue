<script setup lang="ts">
/**
 * Simple PDF Viewer - no Konva, no old stores
 */
import type { PDFDocumentLoadingTask } from "pdfjs-dist"

const props = defineProps<{
  pdf?: PDFDocumentLoadingTask
}>()

const rendererStore = useRendererStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Track current render task to allow cancellation
const currentRenderTask = ref<any>(null)
const isRendering = ref(false)

const canvasStyle = computed(() => ({
  position: "absolute" as const,
  top: "0",
  left: "0",
  transform: rendererStore.getCanvasTransform,
  transformOrigin: "center center" as const,
  // Use will-change for smooth scaling and rotation
  willChange: "transform" as const
}))

async function renderPage(pageNum: number, renderScale?: number) {
  console.debug("renderPage called:", {
    pageNum,
    renderScale,
    hasPdf: !!props.pdf,
    hasCanvas: !!canvasRef.value,
    isRendering: isRendering.value
  })

  if (!props.pdf || !canvasRef.value) {
    console.debug("renderPage early return - missing pdf or canvas")
    return
  }

  // Wait if already rendering
  if (isRendering.value) {
    console.log("Already rendering, waiting...")
    // Cancel the current task and wait a bit
    if (currentRenderTask.value) {
      try {
        currentRenderTask.value.cancel()
      } catch (e) {
        console.debug("Error cancelling render task:", e)
      }
      currentRenderTask.value = null
    }
    // Wait for the rendering flag to clear
    await new Promise(resolve => setTimeout(resolve, 50))
    if (isRendering.value) {
      console.log("Still rendering after wait, aborting")
      return
    }
  }

  // Set rendering flag
  isRendering.value = true

  try {
    console.debug("Getting PDF document from promise...")
    const pdfDoc = await props.pdf.promise
    console.debug("Got PDF doc, getting page", pageNum)
    const page = await pdfDoc.getPage(pageNum)

    // Use device pixel ratio AND current zoom scale for crisp rendering
    const dpr = window.devicePixelRatio || 1
    const currentScale = renderScale ?? rendererStore.getScale

    // Render at higher resolution based on zoom level
    // Note: We don't use viewport rotation here - rotation is applied via CSS transform
    // This keeps annotations in sync since they rotate with the CSS transform too
    const renderDpr = dpr * currentScale
    const viewport = page.getViewport({ scale: renderDpr })

    console.log("Viewport created:", {
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

    console.debug("Starting PDF render...")
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

    console.debug("PDF rendered successfully:", {
      bufferWidth: viewport.width,
      bufferHeight: viewport.height,
      displayWidth: logicalViewport.width,
      displayHeight: logicalViewport.height,
      scale: currentScale
    })
  } catch (e: any) {
    // Ignore cancellation errors
    if (e?.name === 'RenderingCancelledException') {
      console.log("Render was cancelled (expected)")
      return
    }
    console.error("Failed to render PDF:", e)
  } finally {
    // Always clear rendering flag
    isRendering.value = false
    currentRenderTask.value = null
  }
}

// Debounce timer for scale changes
let scaleDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.pdf,
  async (newPdf) => {
    console.log("🔍 PDF WATCH TRIGGERED - newPdf:", !!newPdf, "canvas:", !!canvasRef.value)

    if (!newPdf) return

    // Store PDF document and total pages (don't need canvas for this)
    console.log('⏳ Waiting for PDF promise...')
    const pdfDoc = await newPdf.promise
    console.log('✅ PDF loaded, storing in renderer store:', pdfDoc)
    // Use markRaw to prevent Vue from making the PDF document reactive
    // PDF.js uses private fields that break when wrapped in a Proxy
    rendererStore.setDocumentProxy(markRaw(pdfDoc))
    rendererStore.setTotalPages(pdfDoc.numPages)
    console.log('✅ PDF document stored, total pages:', pdfDoc.numPages)

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
    console.log("Page changed:", newPage)
    if (props.pdf && canvasRef.value) {
      await renderPage(newPage)
    }
  }
)

// Watch for scale changes and re-render at higher resolution
watch(
  () => rendererStore.getScale,
  async (newScale) => {
    console.log("Scale changed:", newScale)

    // Debounce re-rendering to avoid too many renders during continuous zoom
    if (scaleDebounceTimer) {
      clearTimeout(scaleDebounceTimer)
    }

    scaleDebounceTimer = setTimeout(async () => {
      if (props.pdf && canvasRef.value) {
        await renderPage(rendererStore.getCurrentPage, newScale)
      }
    }, 100) // Wait 100ms after user stops zooming (reduced for faster response)
  }
)

// Note: No need to watch rotation - it's applied via CSS transform, no re-render needed

onMounted(async () => {
  console.debug("SimplePdfViewer mounted:", {
    hasPdf: !!props.pdf,
    hasCanvas: !!canvasRef.value
  })

  // If PDF is already loaded but canvas wasn't ready during watch, render now
  if (props.pdf && canvasRef.value) {
    await renderPage(rendererStore.getCurrentPage)
  }
})

onUnmounted(() => {
  if (scaleDebounceTimer) {
    clearTimeout(scaleDebounceTimer)
  }
})
</script>

<template>
  <div class="pdf-viewer">
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
</style>
