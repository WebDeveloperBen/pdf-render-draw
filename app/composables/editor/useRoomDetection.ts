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
    handlePageChange,
    clearVisibleResults,
    clearCache
  }
}
