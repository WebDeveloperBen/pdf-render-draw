import type { PDFDocumentProxy } from "pdfjs-dist"
import { RENDERING } from "~/constants/rendering"

export const useRendererStore = defineStore("renderer", () => {
  /**
   * State
   */

  type PdfLoadingState = "loading" | "loaded" | "error"
  const pdfLoadingState = shallowRef<PdfLoadingState>("loading")
  const scale = ref<number>(1)
  const rotation = ref<number>(0) // Rotation in degrees: 0-360, supports any angle
  const canvasPos = ref<{ scrollTop: number; scrollLeft: number }>({ scrollTop: 0, scrollLeft: 0 }) //NOTE: canvas and pdf are inverted pos of each other
  const DocumentProxy = ref<PDFDocumentProxy>()
  const totalPages = ref(0)
  const pdfCanvasSize = ref<{ width: number; height: number }>({ width: 0, height: 0 })
  const currentPage = shallowRef(1) //first page of the pdf
  const pdfInitialised = shallowRef(false)
  const lastCursorPosition = ref<{ x: number; y: number } | null>(null) // Last known cursor position in SVG coords for paste operations

  /**
   * Getters
   */

  const getScale = computed(() => scale.value)
  const getRotation = computed(() => rotation.value)

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
    if (typeof newScale !== 'number' || !isFinite(newScale)) {
      console.warn('Invalid scale value:', newScale)
      return
    }
    // Clamp scale between min and max
    scale.value = Math.max(RENDERING.MIN_SCALE, Math.min(RENDERING.MAX_SCALE, newScale))
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
      const clampedScale = Math.max(RENDERING.MIN_SCALE, Math.min(RENDERING.MAX_SCALE, newScale))
      const currentScale = scale.value

      // Convert mouse position to PDF coordinates (accounting for current transform)
      // With transform-origin: top left, the math is straightforward:
      // screenPos = pdfPos * scale + translate
      const pdfMouseX = (mousePos.x - canvasPos.value.scrollLeft) / currentScale
      const pdfMouseY = (mousePos.y - canvasPos.value.scrollTop) / currentScale

      // Calculate new translate to keep the PDF point under the mouse
      const newScrollLeft = mousePos.x - (pdfMouseX * clampedScale)
      const newScrollTop = mousePos.y - (pdfMouseY * clampedScale)

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
    if (typeof deg !== 'number' || !isFinite(deg)) {
      console.warn('Invalid rotation value:', deg)
      return
    }
    // Normalize to 0-360 range
    rotation.value = ((deg % 360) + 360) % 360
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
    if (
      typeof pos.scrollTop !== 'number' ||
      typeof pos.scrollLeft !== 'number' ||
      !isFinite(pos.scrollTop) ||
      !isFinite(pos.scrollLeft)
    ) {
      console.warn('Invalid canvas position:', pos)
      return
    }
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
    if (
      typeof size.width !== 'number' ||
      typeof size.height !== 'number' ||
      !isFinite(size.width) ||
      !isFinite(size.height) ||
      size.width < 0 ||
      size.height < 0
    ) {
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
    if (typeof page !== 'number' || !isFinite(page) || !Number.isInteger(page) || page < 1) {
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

  return {
    scale,
    getScale,
    setScale,
    zoomIn,
    zoomOut,
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
    resetState,
    // Transform getters
    getCanvasTransform,
    getSvgTransform,
  }
})
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRendererStore, import.meta.hot))
}
