import { SNAP } from "@/constants/snap"
import { SpatialGrid, SegmentGrid } from "@/utils/snap/SpatialGrid"
import { extractPdfContent, nearestPointOnSegment } from "@/utils/snap/pdfContentExtractor"
import type {
  SnapResult,
  SnapInfo,
  SnapTarget,
  Segment
} from "@/types/snap"
import type { PDFPageProxy } from "pdfjs-dist"

/**
 * Snap Provider
 *
 * Shared composable that provides snap-to-point and snap-to-edge
 * functionality to all drawing tools. Initialised once at the
 * AnnotationLayer level and consumed via `useSnap()`.
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

// --- State ---

const snapEnabled = ref(true)
const contentSnapEnabled = ref(true)
const snapIndicator = ref<SnapInfo | null>(null)

// Separate grids for markup and content — allows incremental rebuilds
const markupGrid = new SpatialGrid()
const contentPointGrid = new SpatialGrid()

// Segment grid for fast edge snapping (replaces linear scan)
const contentSegmentGrid = new SegmentGrid()

// Per-page extraction cache with LRU eviction.
// Stable across zoom since coords are PDF-space.
const MAX_PAGE_CACHE = 5
type PageCacheEntry = { endpoints: Point[]; midpoints: Point[]; intersections: Point[]; segments: Segment[] }
const pageCache = new Map<number, PageCacheEntry>()
let extractAbort: AbortController | null = null
const currentExtractedPage = ref<number | null>(null)

/** Insert into cache with LRU eviction. Map iteration order = insertion order. */
function pageCacheSet(pageNum: number, data: PageCacheEntry) {
  // If already present, delete to refresh insertion order
  pageCache.delete(pageNum)
  pageCache.set(pageNum, data)
  // Evict oldest entries beyond limit
  while (pageCache.size > MAX_PAGE_CACHE) {
    const oldest = pageCache.keys().next().value!
    pageCache.delete(oldest)
  }
}

// Track what content page the content grid was built for
let contentGridPage: number | null = null

// --- Internal helpers ---

const LABEL_MAP: Record<string, string> = {
  endpoint: "Endpoint",
  intersection: "Intersection",
  midpoint: "Midpoint",
  "nearest-on-edge": "On Edge"
}

/**
 * Rebuild only the markup grid (annotation endpoints).
 * Content grid is left untouched.
 */
function rebuildMarkupGrid(
  annotationStore: ReturnType<typeof useAnnotationStore>,
  viewportStore: ReturnType<typeof useViewportStore>
) {
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

/**
 * Rebuild the content grid from cached extraction data.
 * Only runs when the page changes or content is first extracted.
 */
function rebuildContentGrid(viewportStore: ReturnType<typeof useViewportStore>) {
  const pageNum = viewportStore.getCurrentPage
  if (contentGridPage === pageNum) return // Already up to date

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
    contentPointGrid.insert({
      point: pt,
      type: "midpoint",
      source: "content",
      priority: SNAP.PRIORITY_MIDPOINT
    })
  }

  contentSegmentGrid.insertAll(cached.segments)
  contentGridPage = pageNum

  debugLog("SnapProvider", `Content grid rebuilt: ${contentPointGrid.size} point targets, ${contentSegmentGrid.size} edge segments`)
}

// --- Segment edge snapping using spatial grid ---

function findNearestEdge(cursor: Point, threshold: number): SnapTarget | null {
  if (!contentSnapEnabled.value) return null

  const candidates = contentSegmentGrid.findNear(cursor, threshold)
  let best: { point: Point; dist: number } | null = null

  for (const seg of candidates) {
    const projected = nearestPointOnSegment(cursor, seg)
    if (!projected) continue

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
    priority: SNAP.PRIORITY_NEAREST_ON_EDGE
  }
}

// --- Public composable ---

export interface SnapPointOpts {
  /** Set true when Ctrl is held — disables all snapping */
  ctrlHeld?: boolean
  /** When shift-constrained, the angle-snapped point to check against */
  shiftConstrained?: Point
  /** The anchor point for shift-constrain (previous point in the drawing) */
  shiftStart?: Point
}

// Track the active watch stop handles so HMR can clean up
let _stopWatches: (() => void)[] = []

/**
 * Shared snap provider. Call once in AnnotationLayer to initialise watches,
 * then in useBaseTool to access `getSnappedPoint`.
 */
export function useSnapProvider() {
  const annotationStore = useAnnotationStore()
  const viewportStore = useViewportStore()

  // Set up reactive watches only once (clean up on HMR)
  if (_stopWatches.length === 0) {
    // Markup grid: rebuild on annotation changes (debounced).
    // Only watches annotation count + snapEnabled — avoids triggering on
    // non-point property changes (color, label, rotation).
    const debouncedMarkupRebuild = useDebounceFn(() => {
      rebuildMarkupGrid(annotationStore, viewportStore)
    }, 80)

    const stopMarkup = watch(
      [
        () => annotationStore.annotations.length,
        snapEnabled
      ],
      () => debouncedMarkupRebuild(),
      { immediate: true }
    )

    // Content grid + markup: rebuild on page change or new extraction.
    // Markup must also rebuild here (page changed = different annotations).
    const stopContent = watch(
      [
        () => viewportStore.getCurrentPage,
        contentSnapEnabled,
        currentExtractedPage
      ],
      () => {
        contentGridPage = null
        rebuildContentGrid(viewportStore)
        rebuildMarkupGrid(annotationStore, viewportStore)
      },
      { immediate: true }
    )

    _stopWatches = [stopMarkup, stopContent]

    // Clean up on HMR
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        for (const stop of _stopWatches) stop()
        _stopWatches = []
        pageCache.clear()
        markupGrid.clear()
        contentPointGrid.clear()
        contentSegmentGrid.clear()
        contentGridPage = null
        currentExtractedPage.value = null
      })
    }
  }

  /**
   * Extract PDF content for a page. Call when a page is rendered.
   */
  async function extractPageContent(page: PDFPageProxy) {
    const pageNum = page.pageNumber

    // Already cached
    if (pageCache.has(pageNum)) {
      currentExtractedPage.value = pageNum
      return
    }

    // Cancel any in-flight extraction
    if (extractAbort) extractAbort.abort()
    extractAbort = new AbortController()

    const data = await extractPdfContent(page, extractAbort.signal)
    if (extractAbort.signal.aborted) return

    debugLog("SnapProvider", `Page ${pageNum} extracted: ${data.endpoints.length} endpoints, ${data.midpoints.length} midpoints, ${data.intersections.length} intersections, ${data.segments.length} segments`)

    pageCacheSet(pageNum, {
      endpoints: data.endpoints,
      midpoints: data.midpoints,
      intersections: data.intersections,
      segments: data.segments
    })

    currentExtractedPage.value = pageNum
  }

  /**
   * Clear cached content (e.g. when loading a new document).
   */
  function clearContentCache() {
    pageCache.clear()
    currentExtractedPage.value = null
    contentPointGrid.clear()
    contentSegmentGrid.clear()
    contentGridPage = null
  }

  /**
   * Main snap function. Takes a raw cursor position and returns the
   * (possibly snapped) point along with snap info for the indicator.
   *
   * Threshold is computed from screen pixels converted to PDF points
   * using the current zoom scale, so snapping feels consistent at all zoom levels.
   */
  function getSnappedPoint(cursor: Point, opts: SnapPointOpts = {}): SnapResult {
    const noSnap: SnapResult = { snapped: false, point: cursor, info: null }

    // Ctrl disables snapping
    if (opts.ctrlHeld) {
      snapIndicator.value = null
      return noSnap
    }

    // Nothing enabled
    if (!snapEnabled.value && !contentSnapEnabled.value) {
      snapIndicator.value = null
      return noSnap
    }

    // Scale-aware threshold: convert screen pixels to PDF points
    const scale = viewportStore.getScale
    const threshold = SNAP.DISTANCE_PX / scale

    // If shift-constrained, search near the constrained point instead
    const searchPoint = opts.shiftConstrained ?? cursor

    // 1. Try point-based snap — check both markup and content grids
    const markupHit = markupGrid.findNearest(searchPoint, threshold)
    const contentHit = contentPointGrid.findNearest(searchPoint, threshold)

    // Pick the best point hit (prefer closer, then priority)
    let pointHit = markupHit
    if (contentHit) {
      if (!pointHit || contentHit.dist < pointHit.dist || (contentHit.dist === pointHit.dist && contentHit.priority < pointHit.priority)) {
        pointHit = contentHit
      }
    }

    if (pointHit) {
      // If shift-constrained, only accept if roughly collinear with the constrained direction
      if (opts.shiftStart && opts.shiftConstrained) {
        if (!isRoughlyCollinear(opts.shiftStart, opts.shiftConstrained, pointHit.point)) {
          snapIndicator.value = null
          return { snapped: false, point: opts.shiftConstrained, info: null }
        }
      }

      const info: SnapInfo = {
        point: pointHit.point,
        type: pointHit.type,
        source: pointHit.source,
        label: LABEL_MAP[pointHit.type] ?? pointHit.type
      }
      snapIndicator.value = info
      return { snapped: true, point: pointHit.point, info }
    }

    // 2. Try edge-based snap (nearest point on segment)
    const edgeHit = findNearestEdge(searchPoint, threshold)
    if (edgeHit) {
      if (opts.shiftStart && opts.shiftConstrained) {
        if (!isRoughlyCollinear(opts.shiftStart, opts.shiftConstrained, edgeHit.point)) {
          snapIndicator.value = null
          return { snapped: false, point: opts.shiftConstrained, info: null }
        }
      }

      const info: SnapInfo = {
        point: edgeHit.point,
        type: edgeHit.type,
        source: edgeHit.source,
        label: LABEL_MAP[edgeHit.type] ?? edgeHit.type
      }
      snapIndicator.value = info
      return { snapped: true, point: edgeHit.point, info }
    }

    // No snap
    snapIndicator.value = null
    if (opts.shiftConstrained) {
      return { snapped: false, point: opts.shiftConstrained, info: null }
    }
    return noSnap
  }

  /**
   * Clear the snap indicator (call on mouse leave).
   */
  function clearIndicator() {
    snapIndicator.value = null
  }

  /**
   * Force-rebuild the markup grid synchronously. Exposed for testing
   * where the debounced watcher is unreliable with fake timers.
   */
  function _forceRebuildMarkup() {
    rebuildMarkupGrid(annotationStore, viewportStore)
  }

  /**
   * Reset all internal state — used in tests to allow re-registration of watches
   * after Pinia is recreated between test cases.
   */
  function _resetForTesting() {
    for (const stop of _stopWatches) stop()
    _stopWatches = []
    pageCache.clear()
    markupGrid.clear()
    contentPointGrid.clear()
    contentSegmentGrid.clear()
    contentGridPage = null
    currentExtractedPage.value = null
    snapIndicator.value = null
    snapEnabled.value = true
    contentSnapEnabled.value = true
  }

  /**
   * Directly populate the content grids from raw data. Exposed for testing
   * to avoid mocking PDFPageProxy end-to-end.
   */
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
      contentPointGrid.insert({
        point: pt,
        type: "midpoint",
        source: "content",
        priority: SNAP.PRIORITY_MIDPOINT
      })
    }
    if (data.segments) {
      contentSegmentGrid.insertAll(data.segments)
    }
    contentGridPage = viewportStore.getCurrentPage
  }

  return {
    // State (reactive)
    snapEnabled,
    contentSnapEnabled,
    snapIndicator,

    // Methods
    getSnappedPoint,
    extractPageContent,
    clearContentCache,
    clearIndicator,
    _resetForTesting,
    _forceRebuildMarkup,
    _forcePopulateContent
  }
}

// --- Geometry helper ---

const COLLINEAR_TOLERANCE_RAD = (5 * Math.PI) / 180

function isRoughlyCollinear(start: Point, constrainedEnd: Point, candidate: Point): boolean {
  const constrainedAngle = Math.atan2(constrainedEnd.y - start.y, constrainedEnd.x - start.x)
  const candidateAngle = Math.atan2(candidate.y - start.y, candidate.x - start.x)
  let diff = Math.abs(constrainedAngle - candidateAngle)
  if (diff > Math.PI) diff = 2 * Math.PI - diff
  return diff <= COLLINEAR_TOLERANCE_RAD
}
