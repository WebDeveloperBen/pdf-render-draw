import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist"
import type { UsePDFSrc } from "~/types/pdf"
import { RENDERING } from "@/constants/rendering"
import { debugLog, debugError } from "~/utils/debug"

// Track worker initialization (lazy - only when first PDF loads)
let workerConfigured = false
let pdfjsModule: typeof import("pdfjs-dist") | null = null

/**
 * Configure PDF.js worker on first use only
 * This ensures the worker is NOT loaded on non-editor pages
 */
async function ensureWorkerConfigured() {
  if (workerConfigured || typeof window === "undefined") {
    return pdfjsModule
  }

  debugLog("renderer", "Initializing PDF.js worker (lazy load)...")

  // Dynamic import - only loads pdfjs when needed
  const PDFJS = await import("pdfjs-dist")
  const PDFWorker = (await import("pdfjs-dist/build/pdf.worker.min?url")).default

  PDFJS.GlobalWorkerOptions.workerPort = new Worker(PDFWorker, { type: "module" })
  workerConfigured = true
  pdfjsModule = PDFJS

  debugLog("renderer", "PDF.js worker initialized successfully")
  return PDFJS
}

export const useRendererStore = defineStore("renderer", () => {
  /**
   * State
   */

  type PdfLoadingState = "idle" | "loading" | "loaded" | "error"
  const pdfLoadingState = shallowRef<PdfLoadingState>("idle")
  const pdfLoadingTask = shallowRef<PDFDocumentLoadingTask | null>(null)
  const loadingProgress = ref(0)
  const loadError = ref<Error | null>(null)
  const scale = ref<number>(1)
  const rotation = ref<number>(0) // Rotation in degrees: 0-360, supports any angle
  const canvasPos = ref<{ scrollTop: number; scrollLeft: number }>({ scrollTop: 0, scrollLeft: 0 }) //NOTE: canvas and pdf are inverted pos of each other
  const DocumentProxy = ref<PDFDocumentProxy>()
  const totalPages = ref(0)
  const pdfCanvasSize = ref<{ width: number; height: number }>({ width: 0, height: 0 })
  const currentPage = shallowRef(1) //first page of the pdf
  const pdfInitialised = shallowRef(false)
  const lastCursorPosition = ref<{ x: number; y: number } | null>(null) // Last known cursor position in SVG coords for paste operations
  const pdfScale = ref<string>("1:100") // Drawing scale (e.g., "1:100" means 1mm on paper = 100mm in reality)

  /**
   * Getters
   */

  const getScale = computed(() => scale.value)
  const getRotation = computed(() => rotation.value)
  const getPdfScale = computed(() => pdfScale.value)

  /**
   * Viewport-relative label rotation (counter-rotates PDF rotation)
   *
   * When PDF is rotated, labels need to rotate in the opposite direction
   * to stay upright and readable in the viewport. This value is applied
   * to preview labels during drawing, and stored as labelRotation when
   * annotations are committed so they "stamp" in their current orientation.
   *
   * Example: PDF rotated 90° → labels rotate -90° to stay upright
   */
  const getViewportLabelRotation = computed(() => rotation.value === 0 ? 0 : -rotation.value)

  const getCanvasPos = computed(() => canvasPos.value)
  const getPdfPosition = computed(() => {
    // Calculate the PDF position from the canvas position
    const pdfX = canvasPos.value.scrollLeft / scale.value
    const pdfY = canvasPos.value.scrollTop / scale.value

    return { top: pdfY, left: pdfX }
  })
  const getDocumentProxy = computed(() => DocumentProxy.value)
  const getPDFLoadingState = computed(() => pdfLoadingState.value)
  const getTotalPages = computed(() => totalPages.value)
  const getCanvasSize = computed(() => pdfCanvasSize.value)
  const getCurrentPage = computed(() => currentPage.value)
  const getPdfInitialised = computed(() => pdfInitialised.value)

  // Transform getters - single source of truth for rotation/scale/position
  const getCanvasTransform = computed(() =>
    `translate(${canvasPos.value.scrollLeft}px, ${canvasPos.value.scrollTop}px) scale(${scale.value}) rotate(${rotation.value}deg)`
  )

  const getSvgTransform = (offsetX: number = 0, offsetY: number = 0) =>
    `translate(${canvasPos.value.scrollLeft - offsetX}px, ${canvasPos.value.scrollTop - offsetY}px) rotate(${rotation.value}deg)`

  /**
   * Actions
   */

  /**
   * Set scale with validation and clamping
   * @param newScale - The new scale value
   */
  const setScale = (newScale: number) => {
    if (!validateNumber(newScale, 'scale')) return
    // Clamp scale between min and max
    scale.value = clamp(newScale, RENDERING.MIN_SCALE, RENDERING.MAX_SCALE)
  }

  const zoomIn = (mousePos?: { x: number; y: number }) => {
    zoomToScale(scale.value * RENDERING.ZOOM_FACTOR, mousePos)
  }

  const zoomOut = (mousePos?: { x: number; y: number }) => {
    zoomToScale(scale.value / RENDERING.ZOOM_FACTOR, mousePos)
  }

  const zoomToScale = (newScale: number, mousePos?: { x: number; y: number }) => {
    if (mousePos) {
      // Clamp scale first
      const clampedScale = clamp(newScale, RENDERING.MIN_SCALE, RENDERING.MAX_SCALE)
      const currentScale = scale.value

      // With transform-origin: center center, we need to account for the centering offset
      // The center point is at (width/2, height/2) in PDF coordinates
      const centerX = pdfCanvasSize.value.width / 2
      const centerY = pdfCanvasSize.value.height / 2

      // Transform formula with center origin:
      // screenX = (pdfX - centerX) * scale + centerX + translateX
      // Rearranged: screenX = pdfX * scale + translateX + centerX * (1 - scale)

      // Solving for pdfX:
      // pdfX = (screenX - translateX - centerX * (1 - scale)) / scale
      const pdfMouseX = (mousePos.x - canvasPos.value.scrollLeft - centerX * (1 - currentScale)) / currentScale
      const pdfMouseY = (mousePos.y - canvasPos.value.scrollTop - centerY * (1 - currentScale)) / currentScale

      // Calculate new translate to keep the PDF point under the mouse
      // screenX = pdfX * newScale + newTranslateX + centerX * (1 - newScale)
      // Solving for newTranslateX:
      const newScrollLeft = mousePos.x - pdfMouseX * clampedScale - centerX * (1 - clampedScale)
      const newScrollTop = mousePos.y - pdfMouseY * clampedScale - centerY * (1 - clampedScale)

      // Set new values
      scale.value = clampedScale
      canvasPos.value = {
        scrollLeft: newScrollLeft,
        scrollTop: newScrollTop
      }
    } else {
      // Original behavior - zoom towards center
      setScale(newScale)
    }
  }

  /**
   * Set rotation with validation
   * @param deg - Rotation in degrees
   */
  const setRotation = (deg: number) => {
    if (!validateNumber(deg, 'rotation')) return
    // Normalize to 0-360 range
    rotation.value = normalizeAngle(deg)
  }

  const rotateClockwise = () => {
    setRotation(rotation.value + 90)
  }

  const rotateCounterClockwise = () => {
    setRotation(rotation.value - 90)
  }

  const resetPageScale = () => (scale.value = 1)
  const resetRotation = () => (rotation.value = 0)
  const resetState = () => {
    resetPageScale()
    resetRotation()
    setCanvasPos({ scrollTop: 0, scrollLeft: 0 })
    setTotalPages(0)
    setCanvasSize({ width: 0, height: 0 })
    setCurrentPage(1)
    setPdfInitialised(false)
  }
  /**
   * Set canvas position with validation
   * @param pos - Object containing scrollTop and scrollLeft
   */
  const setCanvasPos = (pos: { scrollTop: number; scrollLeft: number }) => {
    if (!validateNumericProperties(pos, ['scrollTop', 'scrollLeft'], 'canvas position')) return
    canvasPos.value = pos
  }
  const setDocumentProxy = (doc: PDFDocumentProxy | undefined) => (DocumentProxy.value = doc)
  const setPDFLoadingState = (state: PdfLoadingState) => (pdfLoadingState.value = state)
  const setTotalPages = (pages: number) => (totalPages.value = pages)
  /**
   * Set canvas size with validation
   * @param size - Object containing width and height
   */
  const setCanvasSize = (size: { width: number; height: number }) => {
    if (!validateNumericProperties(size, ['width', 'height'], 'canvas size')) return
    if (size.width < 0 || size.height < 0) {
      console.warn('Invalid canvas size:', size)
      return
    }
    pdfCanvasSize.value = size
  }
  /**
   * Set current page with validation
   * @param page - Page number (1-indexed)
   */
  const setCurrentPage = (page: number) => {
    if (!validateInteger(page, 'page number')) return
    if (page < 1) {
      console.warn('Invalid page number:', page)
      return
    }
    if (totalPages.value > 0 && page > totalPages.value) {
      console.warn(`Page ${page} exceeds total pages ${totalPages.value}`)
      return
    }
    currentPage.value = page
  }
  const setPdfInitialised = (init: boolean) => (pdfInitialised.value = init)
  const setLastCursorPosition = (pos: { x: number; y: number } | null) => (lastCursorPosition.value = pos)
  const setPdfScale = (scaleString: string) => (pdfScale.value = scaleString)

  /**
   * Load a PDF document with lazy worker initialization
   *
   * The PDF.js worker is only loaded when this function is first called,
   * ensuring no overhead on non-editor pages.
   *
   * @param src - PDF source (URL string, TypedArray, or DocumentInitParameters)
   * @param options - Optional callbacks for progress tracking
   */
  async function loadPdf(
    src: UsePDFSrc,
    options: {
      onProgress?: (progress: { loaded: number; total: number }) => void
    } = {}
  ) {
    if (!src) {
      debugLog("renderer", "loadPdf called with no source")
      return
    }

    // Reset state
    loadError.value = null
    loadingProgress.value = 0
    pdfLoadingState.value = "loading"

    try {
      // Lazy load worker + pdfjs only when loadPdf is called
      const PDFJS = await ensureWorkerConfigured()
      if (!PDFJS) {
        throw new Error("Failed to initialize PDF.js (server-side?)")
      }

      debugLog("renderer", "Loading PDF:", typeof src === "string" ? src : "[binary data]")

      const loadingTask = PDFJS.getDocument(src)

      // Track progress
      loadingTask.onProgress = (progress: { loaded: number; total: number }) => {
        const percent = progress.total ? progress.loaded / progress.total : 0
        loadingProgress.value = percent
        options.onProgress?.(progress)
      }

      // Store loading task for access by PdfViewer
      pdfLoadingTask.value = loadingTask

      // Wait for document to load
      const doc = await loadingTask.promise

      // Store document proxy (use markRaw to prevent Vue proxy issues with PDF.js)
      DocumentProxy.value = markRaw(doc)
      totalPages.value = doc.numPages
      pdfLoadingState.value = "loaded"
      loadingProgress.value = 1

      debugLog("renderer", "PDF loaded successfully:", {
        pages: doc.numPages,
        fingerprint: doc.fingerprints?.[0]
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      loadError.value = error
      pdfLoadingState.value = "error"
      debugError("renderer", "PDF load failed:", error)
    }
  }

  // Computed getters for loading state
  const getPdfLoadingTask = computed(() => pdfLoadingTask.value)
  const getLoadingProgress = computed(() => loadingProgress.value)
  const getLoadError = computed(() => loadError.value)
  const isPdfLoaded = computed(() => pdfLoadingState.value === "loaded" && !!pdfLoadingTask.value)

  return {
    scale,
    getScale,
    setScale,
    zoomIn,
    zoomOut,
    zoomToScale,
    rotation,
    getRotation,
    getViewportLabelRotation,
    setRotation,
    rotateClockwise,
    rotateCounterClockwise,
    resetRotation,
    pdfLoadingState,
    getPDFLoadingState,
    setPDFLoadingState,
    canvasPos,
    resetPageScale,
    getCanvasPos,
    getPdfPosition,
    setCanvasPos,
    getDocumentProxy,
    setDocumentProxy,
    setTotalPages,
    getTotalPages,
    totalPages,
    pdfCanvasSize,
    getCanvasSize,
    setCanvasSize,
    currentPage,
    getCurrentPage,
    setCurrentPage,
    pdfInitialised,
    getPdfInitialised,
    setPdfInitialised,
    lastCursorPosition,
    setLastCursorPosition,
    pdfScale,
    getPdfScale,
    setPdfScale,
    resetState,
    // Transform getters
    getCanvasTransform,
    getSvgTransform,
    // PDF loading (new centralized approach)
    loadPdf,
    pdfLoadingTask,
    getPdfLoadingTask,
    loadingProgress,
    getLoadingProgress,
    loadError,
    getLoadError,
    isPdfLoaded,
  }
})
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRendererStore, import.meta.hot))
}
