<script setup lang="ts">
/**
 * Simple PDF Viewer - no Konva, no old stores
 */
import type { PDFDocumentLoadingTask } from 'pdfjs-dist'

const props = defineProps<{
  pdf?: PDFDocumentLoadingTask
}>()

const rendererStore = useRendererStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)

const canvasStyle = computed(() => ({
  position: 'absolute',
  top: '0',
  left: '0',
  transform: `translate(${rendererStore.getCanvasPos.scrollLeft}px, ${rendererStore.getCanvasPos.scrollTop}px) scale(${rendererStore.getScale})`,
  transformOrigin: 'center center',
  // Use will-change for smooth scaling
  willChange: 'transform',
}))

async function renderPage(pageNum: number, renderScale?: number) {
  console.log('renderPage called:', {
    pageNum,
    renderScale,
    hasPdf: !!props.pdf,
    hasCanvas: !!canvasRef.value
  })

  if (!props.pdf || !canvasRef.value) {
    console.log('renderPage early return - missing pdf or canvas')
    return
  }

  try {
    console.log('Getting PDF document from promise...')
    const pdfDoc = await props.pdf.promise
    console.log('Got PDF doc, getting page', pageNum)
    const page = await pdfDoc.getPage(pageNum)

    // Use device pixel ratio AND current zoom scale for crisp rendering
    const dpr = window.devicePixelRatio || 1
    const currentScale = renderScale ?? rendererStore.getScale

    // Render at higher resolution based on zoom level
    const renderDpr = dpr * currentScale
    const viewport = page.getViewport({ scale: renderDpr })

    console.log('Viewport created:', {
      width: viewport.width,
      height: viewport.height,
      dpr,
      currentScale,
      renderDpr
    })

    // Store logical dimensions (without DPR/scale)
    const logicalViewport = page.getViewport({ scale: 1 })
    rendererStore.setCanvasSize({
      width: logicalViewport.width,
      height: logicalViewport.height,
    })

    // Render to canvas with DPR * scale
    const context = canvasRef.value.getContext('2d')
    if (!context) {
      console.log('Failed to get 2d context')
      return
    }

    // Set canvas buffer size (actual pixels at current zoom - high resolution)
    canvasRef.value.width = viewport.width
    canvasRef.value.height = viewport.height

    // Set canvas display size (CSS pixels - always logical size, CSS transform handles scale)
    canvasRef.value.style.width = `${logicalViewport.width}px`
    canvasRef.value.style.height = `${logicalViewport.height}px`

    console.log('Starting PDF render...')
    await page.render({
      canvasContext: context,
      viewport,
    }).promise

    console.log('PDF rendered successfully:', {
      bufferWidth: viewport.width,
      bufferHeight: viewport.height,
      displayWidth: logicalViewport.width,
      displayHeight: logicalViewport.height,
      scale: currentScale
    })
  } catch (e) {
    console.error('Failed to render PDF:', e)
  }
}

// Debounce timer for scale changes
let scaleDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.pdf, async (newPdf) => {
  console.log('SimplePdfViewer watch triggered:', {
    hasPdf: !!newPdf,
    hasCanvas: !!canvasRef.value
  })
  if (newPdf && canvasRef.value) {
    await renderPage(1) // Render first page
  }
}, { immediate: true })

// Watch for scale changes and re-render at higher resolution
watch(() => rendererStore.getScale, async (newScale) => {
  console.log('Scale changed:', newScale)

  // Debounce re-rendering to avoid too many renders during continuous zoom
  if (scaleDebounceTimer) {
    clearTimeout(scaleDebounceTimer)
  }

  scaleDebounceTimer = setTimeout(async () => {
    if (props.pdf && canvasRef.value) {
      await renderPage(rendererStore.getCurrentPage, newScale)
    }
  }, 100) // Wait 100ms after user stops zooming (reduced for faster response)
})

onMounted(async () => {
  console.log('SimplePdfViewer mounted:', {
    hasPdf: !!props.pdf,
    hasCanvas: !!canvasRef.value
  })

  // If PDF is already loaded but canvas wasn't ready during watch, render now
  if (props.pdf && canvasRef.value) {
    await renderPage(1)
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15),
              0 12px 32px rgba(0, 0, 0, 0.2);
  background: white;
}
</style>
