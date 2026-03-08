/**
 * Room Detection Composable
 *
 * Manages room detection and raw-geometry debug overlays.
 * Results are cached per page, while visible overlays are always scoped
 * to the currently rendered page.
 */

import type { PDFPageProxy } from "pdfjs-dist"
import type { DetectedRoom, RoomDetectionDebug, RoomDetectionResult } from "@/types/rooms"
import { extractWallSegments, detectRooms } from "@/utils/rooms/roomDetector"
import { detectRoomsFromTextAndWalls } from "@/utils/rooms/textWallDetector"

// --- Module-level state (shared across all consumers) ---

const roomLayerEnabled = ref(false)
const debugLayerEnabled = ref(false)
const isDetecting = ref(false)
const detectedRooms = ref<DetectedRoom[]>([])
const debugData = ref<RoomDetectionDebug | null>(null)
const detectionStats = ref<{ nodeCount: number; edgeCount: number } | null>(null)

// Per-page cache (LRU, max 5 pages)
const MAX_CACHE = 5
const pageResultCache = new Map<number, RoomDetectionResult>()
let detectAbort: AbortController | null = null
let activeDetectRequestId = 0

function cacheSet(pageNum: number, result: RoomDetectionResult) {
  pageResultCache.delete(pageNum)
  pageResultCache.set(pageNum, result)
  while (pageResultCache.size > MAX_CACHE) {
    const oldest = pageResultCache.keys().next().value!
    pageResultCache.delete(oldest)
  }
}

function shouldShowAnyLayer(): boolean {
  return roomLayerEnabled.value || debugLayerEnabled.value
}

function cancelDetection() {
  if (detectAbort) {
    detectAbort.abort()
    detectAbort = null
  }
  activeDetectRequestId++
  isDetecting.value = false
}

function clearVisibleResults() {
  detectedRooms.value = []
  debugData.value = null
  detectionStats.value = null
}

function applyResultToVisibleLayers(
  result: RoomDetectionResult,
  pageNum: number,
  currentPage: number
): boolean {
  if (currentPage !== pageNum) return false

  detectedRooms.value = roomLayerEnabled.value ? result.rooms : []
  debugData.value = debugLayerEnabled.value ? (result.debug ?? null) : null
  detectionStats.value = shouldShowAnyLayer()
    ? { nodeCount: result.nodeCount, edgeCount: result.edgeCount }
    : null

  return true
}

// --- Public composable ---

export function useRoomDetection() {
  const viewportStore = useViewportStore()

  /**
   * Run room detection for a PDF page.
   */
  async function detectForPage(page: PDFPageProxy) {
    const pageNum = page.pageNumber
    const includeDebug = debugLayerEnabled.value
    const cached = pageResultCache.get(pageNum)

    // Fast path: page cache has everything needed for active layers.
    if (cached && (!includeDebug || cached.debug)) {
      applyResultToVisibleLayers(cached, pageNum, viewportStore.getCurrentPage)
      return
    }

    // Cancel any in-flight detection before starting a new request.
    if (detectAbort) detectAbort.abort()
    detectAbort = new AbortController()
    const signal = detectAbort.signal
    const requestId = ++activeDetectRequestId

    isDetecting.value = true

    try {
      console.log(`[RoomDetection] Extracting wall segments for page ${pageNum}...`)
      const wallSegments = await extractWallSegments(page, signal)
      if (signal.aborted || requestId !== activeDetectRequestId) return

      console.log(`[RoomDetection] Extracted ${wallSegments.length} straight-line segments`)

      const viewport = page.getViewport({ scale: 1 })
      const pageWidth = viewport.width
      const pageHeight = viewport.height

      const result = await detectRooms(wallSegments, pageWidth, pageHeight, signal, { includeDebug })
      if (signal.aborted || requestId !== activeDetectRequestId) return

      console.log(
        `[RoomDetection] Page ${pageNum}: found ${result.rooms.length} rooms (${result.nodeCount} nodes, ${result.edgeCount} edges)`
      )
      if (result.rooms.length > 0) {
        console.log("[RoomDetection] Room areas:", result.rooms.map((room) => Math.round(room.area)))
      }

      cacheSet(pageNum, result)
      applyResultToVisibleLayers(result, pageNum, viewportStore.getCurrentPage)
    } catch (err) {
      if (!signal.aborted && requestId === activeDetectRequestId) {
        console.error("Room detection failed:", err)
      }
    } finally {
      if (requestId === activeDetectRequestId) {
        isDetecting.value = false
        detectAbort = null
      }
    }
  }

  async function ensureCurrentPageDetection() {
    if (!shouldShowAnyLayer()) {
      cancelDetection()
      clearVisibleResults()
      return
    }

    const pageNum = viewportStore.getCurrentPage
    const includeDebug = debugLayerEnabled.value
    const cached = pageResultCache.get(pageNum)

    if (cached && (!includeDebug || cached.debug)) {
      applyResultToVisibleLayers(cached, pageNum, pageNum)
      return
    }

    await detectCurrentPage()
  }

  /**
   * Toggle the room detection layer on/off.
   */
  async function toggleRoomLayer() {
    roomLayerEnabled.value = !roomLayerEnabled.value

    if (!roomLayerEnabled.value) {
      detectedRooms.value = []
    }

    await ensureCurrentPageDetection()
  }

  /**
   * Toggle the raw debug geometry layer (segments, nodes, edges).
   */
  async function toggleDebugLayer() {
    debugLayerEnabled.value = !debugLayerEnabled.value

    if (!debugLayerEnabled.value) {
      debugData.value = null
    }

    await ensureCurrentPageDetection()
  }

  /**
   * Detect rooms/debug geometry for the current page.
   */
  async function detectCurrentPage() {
    if (!shouldShowAnyLayer()) return

    const docProxy = viewportStore.getDocumentProxy
    if (!docProxy) return

    const pageNum = viewportStore.getCurrentPage
    try {
      const page = await docProxy.getPage(pageNum)
      await detectForPage(page)
    } catch (err) {
      console.error("Failed to get page for room detection:", err)
    }
  }

  /**
   * Handle page changes: clear stale overlays immediately, then detect for the new page.
   */
  async function handlePageChange() {
    clearVisibleResults()

    if (!shouldShowAnyLayer()) {
      cancelDetection()
      return
    }

    await detectCurrentPage()
  }

  /**
   * Run OCR-based room detection for the current page.
   * Renders the PDF page to an image, sends to the AI vision API,
   * and gets back labeled room polygons.
   */
  async function detectWithOCR() {
    const docProxy = viewportStore.getDocumentProxy
    if (!docProxy) return

    const annotationStore = useAnnotationStore()
    const fileId = annotationStore.currentFileId
    if (!fileId) {
      console.error("[RoomOCR] No file ID available")
      return
    }

    const pageNum = viewportStore.getCurrentPage
    cancelDetection()
    isDetecting.value = true
    roomLayerEnabled.value = true

    try {
      const page = await docProxy.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1 })
      const pageWidth = viewport.width
      const pageHeight = viewport.height

      // Render at higher scale for better OCR quality, capped at 3000px wide
      const maxWidth = 3000
      const renderScale = Math.min(3, maxWidth / pageWidth)
      const renderViewport = page.getViewport({ scale: renderScale })
      const imageWidth = Math.round(renderViewport.width)
      const imageHeight = Math.round(renderViewport.height)

      console.log(`[RoomOCR] Rendering page ${pageNum} at ${imageWidth}x${imageHeight} (scale ${renderScale.toFixed(2)})`)

      // Render to offscreen canvas
      const canvas = document.createElement("canvas")
      canvas.width = imageWidth
      canvas.height = imageHeight
      const ctx = canvas.getContext("2d")!
      ctx.fillStyle = "white"
      ctx.fillRect(0, 0, imageWidth, imageHeight)

      await page.render({ canvas, canvasContext: ctx, viewport: renderViewport }).promise

      // Extract text labels with positions from the PDF (exact coordinates)
      const textContent = await page.getTextContent()
      const roomLabelPattern = /^(bed|bath|ensuite|kitchen|living|family|dining|meals|garage|hallway|hall|entry|foyer|laundry|study|robe|wir|w\.?i\.?r|pantry|wc|w\.?c|toilet|store|linen|lounge|rumpus|theatre|media|office|nook|dressing|alfresco|patio|carport|porch|verandah|balcony|deck|mud\s?room|butler)/i
      const textLabels: Array<{ text: string; pdfX: number; pdfY: number; pixelX: number; pixelY: number }> = []

      for (const item of textContent.items) {
        if (!("str" in item) || !item.str.trim()) continue
        const text = item.str.trim()
        if (text.length > 30 || text.length < 2) continue
        if (!roomLabelPattern.test(text)) continue

        // transform[4]=x, transform[5]=y in PDF default space (origin bottom-left)
        const pdfX = item.transform[4] as number
        const pdfY = item.transform[5] as number

        // Convert to viewport coordinates (origin top-left, matching rendered image)
        const [vpX, vpY] = viewport.convertToViewportPoint(pdfX, pdfY)

        // Scale to image pixel coordinates
        const pixelX = Math.round(vpX * renderScale)
        const pixelY = Math.round(vpY * renderScale)

        textLabels.push({ text, pdfX: Math.round(vpX), pdfY: Math.round(vpY), pixelX, pixelY })
      }

      // Draw crosshair markers at each text label position so the model has visual anchors
      if (textLabels.length > 0) {
        const markerSize = Math.max(8, Math.round(Math.min(imageWidth, imageHeight) * 0.008))
        ctx.strokeStyle = "#FF0000"
        ctx.lineWidth = 2
        for (const label of textLabels) {
          const { pixelX: px, pixelY: py } = label
          // Crosshair
          ctx.beginPath()
          ctx.moveTo(px - markerSize, py)
          ctx.lineTo(px + markerSize, py)
          ctx.moveTo(px, py - markerSize)
          ctx.lineTo(px, py + markerSize)
          ctx.stroke()
          // Small circle
          ctx.beginPath()
          ctx.arc(px, py, markerSize * 0.6, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      const imageDataUrl = canvas.toDataURL("image/png")
      canvas.width = 0
      canvas.height = 0

      console.log(`[RoomOCR] Page dimensions: PDF viewport=${pageWidth.toFixed(1)}x${pageHeight.toFixed(1)}, Image=${imageWidth}x${imageHeight}, renderScale=${renderScale.toFixed(2)}`)
      console.log(`[RoomOCR] Extracted ${textLabels.length} room text labels:`)
      for (const l of textLabels) {
        console.log(`[RoomOCR]   "${l.text}" → PDF viewport (${l.pdfX}, ${l.pdfY}), pixel (${l.pixelX}, ${l.pixelY})`)
      }
      console.log(`[RoomOCR] Image size: ${Math.round(imageDataUrl.length / 1024)}KB, sending to API...`)

      // Call the OCR API
      const response = await $fetch(`/api/files/${fileId}/detected-rooms/poc-ocr-detect`, {
        method: "POST",
        body: {
          pageNum,
          pageWidth,
          pageHeight,
          imageWidth,
          imageHeight,
          imageDataUrl,
          textLabels
        }
      })

      const ocrRooms: DetectedRoom[] = (response as any).rooms.map((r: any) => ({
        id: r.id,
        polygon: r.polygon,
        area: r.area,
        centroid: r.centroid,
        bounds: r.bounds,
        label: r.label,
        confidence: r.confidence
      }))

      console.log(`[RoomOCR] Page ${pageNum}: ${ocrRooms.length} rooms detected`)
      if (ocrRooms.length > 0) {
        console.log("[RoomOCR] Rooms:", ocrRooms.map((r) => `${r.label ?? "(unlabeled)"} (${Math.round(r.area)} pt²)`))
      }

      const result: RoomDetectionResult = {
        rooms: ocrRooms,
        nodeCount: 0,
        edgeCount: 0,
        debug: null
      }

      cacheSet(pageNum, result)
      detectedRooms.value = ocrRooms
      detectionStats.value = { nodeCount: 0, edgeCount: 0 }

      // Log scale info if available
      const scale = (response as any).scale
      if (scale) {
        console.log(`[RoomOCR] Scale detected: ${scale.realLengthMm}mm = ${scale.pdfPointsLength.toFixed(1)} PDF points`)
      }
    } catch (err) {
      console.error("[RoomOCR] Detection failed:", err)
    } finally {
      isDetecting.value = false
    }
  }

  /**
   * Detect rooms using PDF text labels + wall segments only. No vision model.
   * Extracts room labels from PDF text, then ray-casts to find enclosing walls.
   */
  async function detectWithTextWalls() {
    const docProxy = viewportStore.getDocumentProxy
    if (!docProxy) return

    const pageNum = viewportStore.getCurrentPage
    cancelDetection()
    isDetecting.value = true
    roomLayerEnabled.value = true

    try {
      const page = await docProxy.getPage(pageNum)
      console.log(`[TextWallDetect] Starting detection for page ${pageNum}`)

      const result = await detectRoomsFromTextAndWalls(page)

      console.log(`[TextWallDetect] Page ${pageNum}: ${result.rooms.length} rooms detected`)
      if (result.rooms.length > 0) {
        console.log("[TextWallDetect] Rooms:", result.rooms.map((r) => `${r.label ?? "(unlabeled)"} (${Math.round(r.area)} pt²)`))
      }

      cacheSet(pageNum, result)
      detectedRooms.value = result.rooms
      detectionStats.value = { nodeCount: result.nodeCount, edgeCount: result.edgeCount }
    } catch (err) {
      console.error("[TextWallDetect] Detection failed:", err)
    } finally {
      isDetecting.value = false
    }
  }

  /** Clear all cached and visible results */
  function clearCache() {
    cancelDetection()
    pageResultCache.clear()
    clearVisibleResults()
  }

  return {
    // State
    roomLayerEnabled: readonly(roomLayerEnabled),
    debugLayerEnabled: readonly(debugLayerEnabled),
    isDetecting: readonly(isDetecting),
    detectedRooms: readonly(detectedRooms),
    debugData: readonly(debugData),
    detectionStats: readonly(detectionStats),

    // Actions
    toggleRoomLayer,
    toggleDebugLayer,
    detectCurrentPage,
    detectForPage,
    detectWithOCR,
    detectWithTextWalls,
    handlePageChange,
    clearVisibleResults,
    clearCache
  }
}
