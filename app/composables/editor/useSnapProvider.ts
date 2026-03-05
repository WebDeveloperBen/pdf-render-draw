import { SNAP } from "@/constants/snap"
import { SpatialGrid } from "@/utils/snap/SpatialGrid"
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
 * Tools call `getSnappedPoint(cursor, opts)` instead of using raw coordinates.
 */

// --- State ---

const snapEnabled = ref(true)
const contentSnapEnabled = ref(true)
const snapDistance = ref(SNAP.DISTANCE)
const snapIndicator = ref<SnapInfo | null>(null)

// Point-based snap grid (endpoints, midpoints, intersections)
const pointGrid = new SpatialGrid()

// Segments stored for nearest-on-edge snapping
const contentSegments = ref<Segment[]>([])

// Per-page extraction cache (page number → data). Stable across zoom since coords are PDF-space.
const pageCache = new Map<number, { endpoints: Point[]; midpoints: Point[]; intersections: Point[]; segments: Segment[] }>()
let extractAbort: AbortController | null = null
const currentExtractedPage = ref<number | null>(null)

// --- Internal helpers ---

const LABEL_MAP: Record<string, string> = {
  endpoint: "Endpoint",
  intersection: "Intersection",
  midpoint: "Midpoint",
  "nearest-on-edge": "On Edge"
}

function rebuildGrid(
  annotationStore: ReturnType<typeof useAnnotationStore>,
  viewportStore: ReturnType<typeof useViewportStore>
) {
  pointGrid.clear()
  contentSegments.value = []

  // 1. Markup targets — collect from existing annotations on current page
  if (snapEnabled.value) {
    const pageAnnotations = annotationStore.getAnnotationsByPage(viewportStore.getCurrentPage)
    for (const ann of pageAnnotations) {
      if ("points" in ann && Array.isArray(ann.points)) {
        for (const pt of ann.points as Point[]) {
          pointGrid.insert({
            point: pt,
            type: "endpoint",
            source: "markup",
            priority: SNAP.PRIORITY_MARKUP_ENDPOINT
          })
        }
      }
    }
  }

  // 2. PDF content targets — from cached extraction
  if (contentSnapEnabled.value) {
    const cached = pageCache.get(viewportStore.getCurrentPage)
    if (cached) {
      for (const pt of cached.endpoints) {
        pointGrid.insert({
          point: pt,
          type: "endpoint",
          source: "content",
          priority: SNAP.PRIORITY_CONTENT_ENDPOINT
        })
      }
      for (const pt of cached.intersections) {
        pointGrid.insert({
          point: pt,
          type: "intersection",
          source: "content",
          priority: SNAP.PRIORITY_CONTENT_INTERSECTION
        })
      }
      for (const pt of cached.midpoints) {
        pointGrid.insert({
          point: pt,
          type: "midpoint",
          source: "content",
          priority: SNAP.PRIORITY_MIDPOINT
        })
      }
      contentSegments.value = cached.segments
    }
  }

  debugLog("SnapProvider", `Grid rebuilt: ${pointGrid.size} point targets, ${contentSegments.value.length} edge segments`)
}

// --- Segment grid for edge snapping ---

function findNearestEdge(cursor: Point, threshold: number): SnapTarget | null {
  if (!contentSnapEnabled.value) return null

  let best: { point: Point; dist: number } | null = null

  // Linear scan of segments — acceptable because typical PDFs have <10k segments
  // and this only runs if no point snap was found
  for (const seg of contentSegments.value) {
    // Quick bounding box reject
    const minX = Math.min(seg.start.x, seg.end.x) - threshold
    const maxX = Math.max(seg.start.x, seg.end.x) + threshold
    const minY = Math.min(seg.start.y, seg.end.y) - threshold
    const maxY = Math.max(seg.start.y, seg.end.y) + threshold
    if (cursor.x < minX || cursor.x > maxX || cursor.y < minY || cursor.y > maxY) continue

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

// Track the active watch stop handle so HMR can clean up
let _stopWatch: (() => void) | null = null

/**
 * Shared snap provider. Call once in AnnotationLayer to initialise watches,
 * then in useBaseTool to access `getSnappedPoint`.
 */
export function useSnapProvider() {
  const annotationStore = useAnnotationStore()
  const viewportStore = useViewportStore()

  // Set up reactive watches only once (clean up on HMR)
  if (!_stopWatch) {
    const debouncedRebuild = useDebounceFn(() => {
      rebuildGrid(annotationStore, viewportStore)
    }, 80)

    _stopWatch = watch(
      [
        () => annotationStore.annotations,
        () => viewportStore.getCurrentPage,
        snapEnabled,
        contentSnapEnabled,
        currentExtractedPage
      ],
      () => debouncedRebuild(),
      { deep: true, immediate: true }
    )

    // Clean up on HMR
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        _stopWatch?.()
        _stopWatch = null
        pageCache.clear()
        pointGrid.clear()
        contentSegments.value = []
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

    pageCache.set(pageNum, {
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
    contentSegments.value = []
  }

  /**
   * Main snap function. Takes a raw cursor position and returns the
   * (possibly snapped) point along with snap info for the indicator.
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

    const threshold = snapDistance.value

    // If shift-constrained, search near the constrained point instead
    const searchPoint = opts.shiftConstrained ?? cursor

    // 1. Try point-based snap (endpoint, intersection, midpoint)
    const pointHit = pointGrid.findNearest(searchPoint, threshold)

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

  return {
    // State (reactive)
    snapEnabled,
    contentSnapEnabled,
    snapDistance,
    snapIndicator,

    // Methods
    getSnappedPoint,
    extractPageContent,
    clearContentCache
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
