import { SNAP } from "@/constants/snap"
import { SpatialGrid, SegmentGrid } from "@/utils/snap/SpatialGrid"
import { extractPdfContent, nearestPointOnSegment } from "@/utils/snap/pdfContentExtractor"
import type { SnapResult, SnapInfo, SnapTarget, Segment } from "@/types/snap"
import type { PDFPageProxy } from "pdfjs-dist"

/**
 * Snap Provider
 *
 * Shared composable that provides snap-to-point and snap-to-edge
 * functionality to all drawing tools.
 *
 * Two snap layers:
 * 1. Markup snap — snaps to existing annotation endpoints
 * 2. Content snap — snaps to PDF vector geometry (endpoints, midpoints, intersections, edges)
 *
 * Performance: Grid is split into markup and content layers. Content targets
 * are stable per page and only rebuilt on page change. Markup targets are
 * rebuilt incrementally on annotation changes without touching content data.
 *
 * Tools call `getSnappedPoint(cursor, opts)` instead of using raw coordinates.
 */

export interface SnapPointOpts {
  /** Set true when Ctrl is held — disables all snapping */
  ctrlHeld?: boolean
  /** When shift-constrained, the angle-snapped point to check against */
  shiftConstrained?: Point
  /** The anchor point for shift-constrain (previous point in the drawing) */
  shiftStart?: Point
}

// --- Pure helpers (stateless, fine at module level) ---

type PageCacheEntry = { endpoints: Point[]; midpoints: Point[]; intersections: Point[]; segments: Segment[] }

const MAX_PAGE_CACHE = 5

const LABEL_MAP: Record<string, string> = {
  endpoint: "Endpoint",
  intersection: "Intersection",
  midpoint: "Midpoint",
  "nearest-on-edge": "On Edge"
}

const COLLINEAR_TOLERANCE_RAD = (5 * Math.PI) / 180

function isRoughlyCollinear(start: Point, constrainedEnd: Point, candidate: Point): boolean {
  const constrainedAngle = Math.atan2(constrainedEnd.y - start.y, constrainedEnd.x - start.x)
  const candidateAngle = Math.atan2(candidate.y - start.y, candidate.x - start.x)
  let diff = Math.abs(constrainedAngle - candidateAngle)
  if (diff > Math.PI) diff = 2 * Math.PI - diff
  return diff <= COLLINEAR_TOLERANCE_RAD
}

// --- Singleton with reset support ---

let _instance: ReturnType<typeof _createSnapProvider> | null = null

export function useSnapProvider() {
  if (!_instance) _instance = _createSnapProvider()
  return _instance
}

function _createSnapProvider() {
  const annotationStore = useAnnotationStore()
  const viewportStore = useViewportStore()

  // --- Reactive state ---
  const snapEnabled = ref(true)
  const contentSnapEnabled = ref(true)
  const snapIndicator = ref<SnapInfo | null>(null)
  const currentExtractedPage = ref<number | null>(null)
  const snapDebugEnabled = ref(false)

  // --- Grids ---
  const markupGrid = new SpatialGrid()
  const contentPointGrid = new SpatialGrid()
  const contentSegmentGrid = new SegmentGrid()

  // --- Internal state ---
  const pageCache = new Map<number, PageCacheEntry>()
  let extractAbort: AbortController | null = null
  let contentGridPage: number | null = null

  // --- LRU cache ---

  function pageCacheSet(pageNum: number, data: PageCacheEntry) {
    pageCache.delete(pageNum)
    pageCache.set(pageNum, data)
    while (pageCache.size > MAX_PAGE_CACHE) {
      const oldest = pageCache.keys().next().value!
      pageCache.delete(oldest)
    }
  }

  // --- Grid rebuilders ---

  function rebuildMarkupGrid() {
    markupGrid.clear()
    if (!snapEnabled.value) return

    const pageAnnotations = annotationStore.getAnnotationsByPage(viewportStore.getCurrentPage)
    for (const ann of pageAnnotations) {
      if ("points" in ann && Array.isArray(ann.points)) {
        for (const pt of ann.points as Point[]) {
          markupGrid.insert({
            point: pt,
            type: "endpoint",
            source: "markup",
            priority: SNAP.PRIORITY_MARKUP_ENDPOINT
          })
        }
      }
    }

    debugLog("SnapProvider", `Markup grid rebuilt: ${markupGrid.size} targets`)
  }

  function rebuildContentGrid() {
    const pageNum = viewportStore.getCurrentPage
    if (contentGridPage === pageNum) return

    contentPointGrid.clear()
    contentSegmentGrid.clear()

    if (!contentSnapEnabled.value) {
      contentGridPage = pageNum
      return
    }

    const cached = pageCache.get(pageNum)
    if (!cached) {
      contentGridPage = pageNum
      return
    }

    for (const pt of cached.endpoints) {
      contentPointGrid.insert({
        point: pt,
        type: "endpoint",
        source: "content",
        priority: SNAP.PRIORITY_CONTENT_ENDPOINT
      })
    }
    for (const pt of cached.intersections) {
      contentPointGrid.insert({
        point: pt,
        type: "intersection",
        source: "content",
        priority: SNAP.PRIORITY_CONTENT_INTERSECTION
      })
    }
    for (const pt of cached.midpoints) {
      contentPointGrid.insert({ point: pt, type: "midpoint", source: "content", priority: SNAP.PRIORITY_MIDPOINT })
    }

    contentSegmentGrid.insertAll(cached.segments)
    contentGridPage = pageNum

    debugLog(
      "SnapProvider",
      `Content grid rebuilt: ${contentPointGrid.size} point targets, ${contentSegmentGrid.size} edge segments`
    )
  }

  // --- Edge snapping ---

  // Debug: expose on window so you can run window._snapDebug() from console while hovering
  if (typeof window !== "undefined") {
    ;(window as any)._snapDebug = () => {
      const cursor = viewportStore.lastCursorPosition
      if (!cursor) {
        console.log("[SnapDebug] No cursor position")
        return
      }
      const scale = viewportStore.getScale
      const threshold = (SNAP.DISTANCE_PX * SNAP.EDGE_DISTANCE_MULTIPLIER) / scale
      const candidates = contentSegmentGrid.findNear(cursor, threshold)
      const allCandidates = contentSegmentGrid.findNear(cursor, threshold * 10) // much wider search

      console.log(`[SnapDebug] Cursor: (${cursor.x.toFixed(1)}, ${cursor.y.toFixed(1)})`)
      console.log(`[SnapDebug] Scale: ${scale}, threshold: ${threshold.toFixed(1)}pt`)
      console.log(`[SnapDebug] Segments within threshold: ${candidates.length}`)
      console.log(`[SnapDebug] Segments within 10x threshold: ${allCandidates.length}`)

      if (allCandidates.length > 0) {
        const nearest = allCandidates
          .map((seg) => {
            const proj = nearestPointOnSegment(cursor, seg)
            const rawDist = Math.hypot(proj.x - cursor.x, proj.y - cursor.y)
            return { seg, proj, rawDist }
          })
          .sort((a, b) => a.rawDist - b.rawDist)
          .slice(0, 5)

        for (const { seg, proj, rawDist } of nearest) {
          const len = Math.hypot(seg.end.x - seg.start.x, seg.end.y - seg.start.y)
          console.log(
            `[SnapDebug] Seg (${seg.start.x.toFixed(0)},${seg.start.y.toFixed(0)})→(${seg.end.x.toFixed(0)},${seg.end.y.toFixed(0)}) len=${len.toFixed(1)} dist=${rawDist.toFixed(1)} proj=${proj ? `(${proj.x.toFixed(1)},${proj.y.toFixed(1)})` : "null"}`
          )
        }
      }

      const pointHit = contentPointGrid.findNearest(cursor, threshold)
      console.log(
        `[SnapDebug] Nearest content point: ${pointHit ? `(${pointHit.point.x.toFixed(1)},${pointHit.point.y.toFixed(1)}) dist=${pointHit.dist.toFixed(1)} type=${pointHit.type}` : "none"}`
      )

      // Show bounding box of all segments in grid
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      let count = 0
      const allSegs = contentSegmentGrid.findNear({ x: 50000, y: 50000 }, 100000)
      for (const s of allSegs) {
        minX = Math.min(minX, s.start.x, s.end.x)
        minY = Math.min(minY, s.start.y, s.end.y)
        maxX = Math.max(maxX, s.start.x, s.end.x)
        maxY = Math.max(maxY, s.start.y, s.end.y)
        count++
      }
      console.log(
        `[SnapDebug] Segment grid bounds: (${minX.toFixed(0)},${minY.toFixed(0)})→(${maxX.toFixed(0)},${maxY.toFixed(0)}) [${count} segments]`
      )
      console.log(
        `[SnapDebug] SVG viewBox: 0 0 ${viewportStore.getCanvasSize.width} ${viewportStore.getCanvasSize.height}`
      )
    }
  }

  function findNearestEdge(cursor: Point, threshold: number): (SnapTarget & { dist: number }) | null {
    if (!contentSnapEnabled.value) return null

    const candidates = contentSegmentGrid.findNear(cursor, threshold)
    let best: { point: Point; dist: number } | null = null

    for (const seg of candidates) {
      const projected = nearestPointOnSegment(cursor, seg)
      const d = Math.hypot(projected.x - cursor.x, projected.y - cursor.y)
      if (d <= threshold && (!best || d < best.dist)) {
        best = { point: projected, dist: d }
      }
    }

    if (!best) return null
    return {
      point: best.point,
      type: "nearest-on-edge",
      source: "content",
      priority: SNAP.PRIORITY_NEAREST_ON_EDGE,
      dist: best.dist
    }
  }

  // --- Snap resolution ---

  function resolveSnapHit(hit: SnapTarget, opts: SnapPointOpts): SnapResult | null {
    if (opts.shiftStart && opts.shiftConstrained) {
      if (!isRoughlyCollinear(opts.shiftStart, opts.shiftConstrained, hit.point)) {
        snapIndicator.value = null
        return { snapped: false, point: opts.shiftConstrained, info: null }
      }
    }

    const info: SnapInfo = {
      point: hit.point,
      type: hit.type,
      source: hit.source,
      label: LABEL_MAP[hit.type] ?? hit.type
    }
    snapIndicator.value = info
    return { snapped: true, point: hit.point, info }
  }

  // --- Reactive watches (return stop handles for cleanup) ---

  const debouncedMarkupRebuild = useDebounceFn(() => rebuildMarkupGrid(), 80)

  const stopMarkupWatch = watch(
    [() => annotationStore.annotations.length, snapEnabled],
    () => debouncedMarkupRebuild(),
    { immediate: true }
  )

  const stopContentWatch = watch(
    [() => viewportStore.getCurrentPage, contentSnapEnabled, currentExtractedPage],
    () => {
      contentGridPage = null
      rebuildContentGrid()
      rebuildMarkupGrid()
    },
    { immediate: true }
  )

  // HMR cleanup
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      stopMarkupWatch()
      stopContentWatch()
      _instance = null
    })
  }

  // --- Public API ---

  async function extractPageContent(page: PDFPageProxy) {
    const pageNum = page.pageNumber

    if (pageCache.has(pageNum)) {
      currentExtractedPage.value = pageNum
      return
    }

    if (extractAbort) extractAbort.abort()
    extractAbort = new AbortController()

    const data = await extractPdfContent(page, extractAbort.signal)
    if (extractAbort.signal.aborted) return

    debugLog(
      "SnapProvider",
      `Page ${pageNum} extracted: ${data.endpoints.length} endpoints, ${data.midpoints.length} midpoints, ${data.intersections.length} intersections, ${data.segments.length} segments`
    )

    pageCacheSet(pageNum, data)
    currentExtractedPage.value = pageNum
  }

  function clearContentCache() {
    pageCache.clear()
    currentExtractedPage.value = null
    contentPointGrid.clear()
    contentSegmentGrid.clear()
    contentGridPage = null
  }

  function getSnappedPoint(cursor: Point, opts: SnapPointOpts = {}): SnapResult {
    const noSnap: SnapResult = { snapped: false, point: cursor, info: null }

    if (opts.ctrlHeld) {
      snapIndicator.value = null
      return noSnap
    }

    if (!snapEnabled.value && !contentSnapEnabled.value) {
      snapIndicator.value = null
      return noSnap
    }

    const scale = viewportStore.getScale
    const pointThreshold = SNAP.DISTANCE_PX / scale
    const edgeThreshold = (SNAP.DISTANCE_PX * SNAP.EDGE_DISTANCE_MULTIPLIER) / scale
    const searchPoint = opts.shiftConstrained ?? cursor

    // 1. Gather candidates from all layers
    const markupHit = markupGrid.findNearest(searchPoint, pointThreshold)
    const contentHit = contentPointGrid.findNearest(searchPoint, pointThreshold)
    const edgeHit = findNearestEdge(searchPoint, edgeThreshold)

    // Best point hit (markup vs content)
    let pointHit = markupHit
    if (contentHit) {
      if (
        !pointHit ||
        contentHit.dist < pointHit.dist ||
        (contentHit.dist === pointHit.dist && contentHit.priority < pointHit.priority)
      ) {
        pointHit = contentHit
      }
    }

    // 2. Pick best overall: markup endpoints always win, otherwise closest wins
    let bestHit: SnapTarget | null = null

    if (pointHit && pointHit.source === "markup") {
      // Markup endpoints (user's own annotations) always win
      bestHit = pointHit
    } else if (pointHit && edgeHit) {
      // Both exist — pick the closer one
      bestHit = edgeHit.dist < pointHit.dist ? edgeHit : pointHit
    } else {
      bestHit = pointHit ?? edgeHit
    }

    if (bestHit) {
      const result = resolveSnapHit(bestHit, opts)
      if (result) return result
    }

    // No snap
    snapIndicator.value = null
    if (opts.shiftConstrained) {
      return { snapped: false, point: opts.shiftConstrained, info: null }
    }
    return noSnap
  }

  function clearIndicator() {
    snapIndicator.value = null
  }

  // --- Test helpers ---

  function _forceRebuildMarkup() {
    rebuildMarkupGrid()
  }

  function _resetForTesting() {
    stopMarkupWatch()
    stopContentWatch()
    _instance = null
  }

  function _forcePopulateContent(data: {
    endpoints?: Point[]
    midpoints?: Point[]
    intersections?: Point[]
    segments?: Segment[]
  }) {
    contentPointGrid.clear()
    contentSegmentGrid.clear()

    for (const pt of data.endpoints ?? []) {
      contentPointGrid.insert({
        point: pt,
        type: "endpoint",
        source: "content",
        priority: SNAP.PRIORITY_CONTENT_ENDPOINT
      })
    }
    for (const pt of data.intersections ?? []) {
      contentPointGrid.insert({
        point: pt,
        type: "intersection",
        source: "content",
        priority: SNAP.PRIORITY_CONTENT_INTERSECTION
      })
    }
    for (const pt of data.midpoints ?? []) {
      contentPointGrid.insert({ point: pt, type: "midpoint", source: "content", priority: SNAP.PRIORITY_MIDPOINT })
    }
    if (data.segments) {
      contentSegmentGrid.insertAll(data.segments)
    }
    contentGridPage = viewportStore.getCurrentPage
  }

  /** Expose current page's extracted data for the debug overlay */
  const snapDebugData = computed(() => {
    if (!snapDebugEnabled.value) return null
    const pageNum = viewportStore.getCurrentPage
    return pageCache.get(pageNum) ?? null
  })

  return {
    snapEnabled,
    contentSnapEnabled,
    snapIndicator,
    snapDebugEnabled,
    snapDebugData,
    getSnappedPoint,
    extractPageContent,
    clearContentCache,
    clearIndicator,
    _resetForTesting,
    _forceRebuildMarkup,
    _forcePopulateContent
  }
}
