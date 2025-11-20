import type { PDFDocumentProxy } from "pdfjs-dist"

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

  /**
   * Getters
   */

  const getScale = computed(() => scale.value)
  const getRotation = computed(() => rotation.value)
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

  const setScale = (newScale: number) => {
    // Clamp scale between 0.1 and 5
    scale.value = Math.max(0.1, Math.min(5, newScale))
  }

  const zoomIn = () => {
    setScale(scale.value * 1.25) // 25% zoom in
  }

  const zoomOut = () => {
    setScale(scale.value / 1.25) // 25% zoom out
  }

  const setRotation = (deg: number) => {
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
  const setCanvasPos = (pos: { scrollTop: number; scrollLeft: number }) => (canvasPos.value = pos)
  const setDocumentProxy = (doc: PDFDocumentProxy | undefined) => (DocumentProxy.value = doc)
  const setPDFLoadingState = (state: PdfLoadingState) => (pdfLoadingState.value = state)
  const setTotalPages = (pages: number) => (totalPages.value = pages)
  const setCanvasSize = (size: { width: number; height: number }) => (pdfCanvasSize.value = size)
  const setCurrentPage = (page: number) => (currentPage.value = page)
  const setPdfInitialised = (init: boolean) => (pdfInitialised.value = init)

  return {
    scale,
    getScale,
    setScale,
    zoomIn,
    zoomOut,
    rotation,
    getRotation,
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
    resetState,
    // Transform getters
    getCanvasTransform,
    getSvgTransform,
  }
})
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRendererStore, import.meta.hot))
}
