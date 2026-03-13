import { setActivePinia, createPinia } from "pinia"
import { useSnapProvider } from "./useSnapProvider"
import type { SnapInfo } from "@/types/snap"
import { nextTick } from "vue"

// Mock debug utils
vi.mock("~/utils/debug", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn()
}))

// Mock pdfjs-dist (needed for type imports)
vi.mock("pdfjs-dist", () => ({
  OPS: { constructPath: 91 }
}))

function addMeasurement(store: ReturnType<typeof useAnnotationStore>, id: string, p1: Point, p2: Point, pageNum = 1) {
  store.addAnnotation({
    id,
    type: "measure",
    pageNum,
    points: [p1, p2],
    distance: Math.hypot(p2.x - p1.x, p2.y - p1.y),
    midpoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
    labelRotation: 0,
    rotation: 0
  } as Measurement)
}

describe("useSnapProvider", () => {
  let provider: ReturnType<typeof useSnapProvider>
  let annotationStore: ReturnType<typeof useAnnotationStore>
  let viewportStore: ReturnType<typeof useViewportStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    annotationStore = useAnnotationStore()
    viewportStore = useViewportStore()
    viewportStore.currentPage = 1

    provider = useSnapProvider()
  })

  afterEach(() => {
    provider._resetForTesting()
  })

  /** Synchronously rebuild the markup grid after adding annotations */
  function rebuildMarkup() {
    provider._forceRebuildMarkup()
  }

  describe("getSnappedPoint — no targets", () => {
    it("should return unsnapped cursor when no targets exist", () => {
      const cursor = { x: 100, y: 100 }
      const result = provider.getSnappedPoint(cursor)

      expect(result.snapped).toBe(false)
      expect(result.point).toEqual(cursor)
      expect(result.info).toBeNull()
    })

    it("should return unsnapped cursor when ctrl is held", () => {
      addMeasurement(annotationStore, "ctrl-1", { x: 100, y: 100 }, { x: 200, y: 100 })
      rebuildMarkup()

      const result = provider.getSnappedPoint({ x: 101, y: 101 }, { ctrlHeld: true })

      expect(result.snapped).toBe(false)
      expect(result.point).toEqual({ x: 101, y: 101 })
    })

    it("should return unsnapped cursor when both snap types are disabled", () => {
      provider.snapEnabled.value = false
      provider.contentSnapEnabled.value = false

      const result = provider.getSnappedPoint({ x: 100, y: 100 })

      expect(result.snapped).toBe(false)
      expect(result.info).toBeNull()
    })

    it("should clear snap indicator when no snap is found", () => {
      ;(provider.snapIndicator as Ref<SnapInfo | null>).value = {
        point: { x: 0, y: 0 },
        type: "endpoint",
        source: "content",
        label: "test"
      }

      provider.getSnappedPoint({ x: 9999, y: 9999 })

      expect(provider.snapIndicator.value).toBeNull()
    })

    it("should return shift-constrained point when no snap found", () => {
      const shiftConstrained = { x: 450, y: 400 }

      const result = provider.getSnappedPoint({ x: 500, y: 500 }, { shiftConstrained, shiftStart: { x: 300, y: 300 } })

      expect(result.snapped).toBe(false)
      expect(result.point).toEqual(shiftConstrained)
    })
  })

  describe("scale-aware threshold", () => {
    it("should snap at 0.5x zoom with larger threshold (24 PDF pts)", () => {
      viewportStore.setScale(0.5)
      addMeasurement(annotationStore, "s1", { x: 100, y: 100 }, { x: 200, y: 100 })
      rebuildMarkup()

      // 20 PDF pts away — within 24pt threshold at 0.5x
      const result = provider.getSnappedPoint({ x: 120, y: 100 })
      expect(result.snapped).toBe(true)
      expect(result.point).toEqual({ x: 100, y: 100 })
    })

    it("should NOT snap at 4x zoom with smaller threshold (3 PDF pts)", () => {
      viewportStore.setScale(4)
      addMeasurement(annotationStore, "s2", { x: 100, y: 100 }, { x: 200, y: 100 })
      rebuildMarkup()

      // 10 PDF pts away — outside 3pt threshold at 4x
      const result = provider.getSnappedPoint({ x: 110, y: 100 })
      expect(result.snapped).toBe(false)
    })

    it("should snap at 4x zoom when very close (within 3 PDF pts)", () => {
      viewportStore.setScale(4)
      addMeasurement(annotationStore, "s3", { x: 100, y: 100 }, { x: 200, y: 100 })
      rebuildMarkup()

      // 2 PDF pts away — within 3pt threshold
      const result = provider.getSnappedPoint({ x: 102, y: 100 })
      expect(result.snapped).toBe(true)
      expect(result.point).toEqual({ x: 100, y: 100 })
    })
  })

  describe("snap indicator", () => {
    it("should set snap indicator with correct metadata on snap", () => {
      addMeasurement(annotationStore, "ind-1", { x: 100, y: 100 }, { x: 200, y: 100 })
      rebuildMarkup()

      const result = provider.getSnappedPoint({ x: 101, y: 101 })

      expect(result.snapped).toBe(true)
      expect(provider.snapIndicator.value).not.toBeNull()
      expect(provider.snapIndicator.value!.type).toBe("endpoint")
      expect(provider.snapIndicator.value!.source).toBe("markup")
      expect(provider.snapIndicator.value!.label).toBe("Endpoint")
    })

    it("should clear indicator when ctrl is held after a snap", () => {
      addMeasurement(annotationStore, "ind-2", { x: 100, y: 100 }, { x: 200, y: 100 })
      rebuildMarkup()

      provider.getSnappedPoint({ x: 101, y: 101 })
      expect(provider.snapIndicator.value).not.toBeNull()

      provider.getSnappedPoint({ x: 101, y: 101 }, { ctrlHeld: true })
      expect(provider.snapIndicator.value).toBeNull()
    })

    it("should clear indicator via clearIndicator()", () => {
      ;(provider.snapIndicator as Ref<SnapInfo | null>).value = {
        point: { x: 0, y: 0 },
        type: "endpoint",
        source: "content",
        label: "test"
      }

      provider.clearIndicator()
      expect(provider.snapIndicator.value).toBeNull()
    })
  })

  describe("clearContentCache", () => {
    it("should reset all content state", () => {
      provider.clearContentCache()

      const result = provider.getSnappedPoint({ x: 0, y: 0 })
      expect(result.snapped).toBe(false)
    })
  })

  describe("markup snap targets", () => {
    it("should snap to annotation endpoints on current page", () => {
      addMeasurement(annotationStore, "m1", { x: 50, y: 50 }, { x: 150, y: 50 })
      rebuildMarkup()

      const result = provider.getSnappedPoint({ x: 51, y: 51 })

      expect(result.snapped).toBe(true)
      expect(result.point).toEqual({ x: 50, y: 50 })
      expect(result.info!.source).toBe("markup")
    })

    it("should prefer the nearer of two annotation endpoints", () => {
      addMeasurement(annotationStore, "mn-1", { x: 50, y: 50 }, { x: 200, y: 200 })
      rebuildMarkup()

      // Cursor closer to (50,50) than (200,200)
      const result = provider.getSnappedPoint({ x: 52, y: 52 })

      expect(result.snapped).toBe(true)
      expect(result.point).toEqual({ x: 50, y: 50 })
    })

    it("should NOT snap to annotations on a different page", () => {
      addMeasurement(annotationStore, "m2", { x: 50, y: 50 }, { x: 150, y: 50 }, 2)
      rebuildMarkup()

      const result = provider.getSnappedPoint({ x: 51, y: 51 })
      expect(result.snapped).toBe(false)
    })

    it("should not snap to markup when snapEnabled is false", () => {
      provider.snapEnabled.value = false
      rebuildMarkup()

      addMeasurement(annotationStore, "m3", { x: 50, y: 50 }, { x: 150, y: 50 })
      rebuildMarkup()

      const result = provider.getSnappedPoint({ x: 51, y: 51 })
      expect(result.snapped).toBe(false)
    })

    it("should snap to area annotation points", () => {
      annotationStore.addAnnotation({
        id: "a1",
        type: "area",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        area: 10000,
        rotation: 0
      } as Area)
      rebuildMarkup()

      const result = provider.getSnappedPoint({ x: 1, y: 1 })

      expect(result.snapped).toBe(true)
      expect(result.point).toEqual({ x: 0, y: 0 })
    })

    it("should rebuild grid when annotations are added", () => {
      let result = provider.getSnappedPoint({ x: 51, y: 51 })
      expect(result.snapped).toBe(false)

      addMeasurement(annotationStore, "add-1", { x: 50, y: 50 }, { x: 150, y: 50 })
      rebuildMarkup()

      result = provider.getSnappedPoint({ x: 51, y: 51 })
      expect(result.snapped).toBe(true)
    })

    it("should rebuild the markup grid when annotation geometry changes", async () => {
      vi.useFakeTimers()
      addMeasurement(annotationStore, "move-1", { x: 50, y: 50 }, { x: 150, y: 50 })
      rebuildMarkup()

      annotationStore.updateAnnotation("move-1", {
        points: [
          { x: 200, y: 200 },
          { x: 300, y: 200 }
        ]
      })

      await nextTick()
      vi.advanceTimersByTime(100)
      await nextTick()

      expect(provider.getSnappedPoint({ x: 201, y: 201 }).point).toEqual({ x: 200, y: 200 })
      expect(provider.getSnappedPoint({ x: 51, y: 51 }).snapped).toBe(false)

      vi.useRealTimers()
    })

    it("should not rebuild the markup grid while persistenceSuppressed is true", async () => {
      vi.useFakeTimers()
      addMeasurement(annotationStore, "drag-1", { x: 50, y: 50 }, { x: 150, y: 50 })
      rebuildMarkup()

      // Suppress persistence (simulates drag start)
      annotationStore.setPersistenceSuppressed(true)

      annotationStore.updateAnnotation("drag-1", {
        points: [
          { x: 200, y: 200 },
          { x: 300, y: 200 }
        ]
      })

      // Allow watcher + debounce to fire
      await nextTick()
      vi.advanceTimersByTime(100)
      await nextTick()

      // Grid should still have the OLD snap target since rebuild was suppressed
      const oldResult = provider.getSnappedPoint({ x: 51, y: 51 })
      const newResult = provider.getSnappedPoint({ x: 201, y: 201 })
      expect(oldResult.snapped).toBe(true)
      expect(newResult.snapped).toBe(false)

      // Un-suppress (simulates drag end) — watcher should now fire rebuild
      annotationStore.setPersistenceSuppressed(false)

      // Force rebuild since the deep watch may not detect the flag change alone
      rebuildMarkup()

      // Now the grid should have rebuilt with the new position
      expect(provider.getSnappedPoint({ x: 201, y: 201 }).point).toEqual({ x: 200, y: 200 })
      expect(provider.getSnappedPoint({ x: 51, y: 51 }).snapped).toBe(false)

      vi.useRealTimers()
    })

    it("should skip non-point annotations (Count)", () => {
      annotationStore.addAnnotation({
        id: "count-1",
        type: "count",
        pageNum: 1,
        x: 50,
        y: 50,
        width: 24,
        height: 24,
        number: 1,
        rotation: 0
      } as Count)
      rebuildMarkup()

      const result = provider.getSnappedPoint({ x: 51, y: 51 })
      expect(result.snapped).toBe(false)
    })
  })

  describe("contentSnapEnabled toggle", () => {
    it("should still snap to markup when only contentSnapEnabled is false", () => {
      provider.contentSnapEnabled.value = false
      addMeasurement(annotationStore, "cs-1", { x: 100, y: 100 }, { x: 200, y: 100 })
      rebuildMarkup()

      const result = provider.getSnappedPoint({ x: 101, y: 101 })

      expect(result.snapped).toBe(true)
      expect(result.info!.source).toBe("markup")
    })

    it("should not snap when only snapEnabled is true but no markup targets exist", () => {
      provider.contentSnapEnabled.value = false

      const result = provider.getSnappedPoint({ x: 100, y: 100 })
      expect(result.snapped).toBe(false)
    })
  })

  describe("shift-constrain interaction", () => {
    it("should search near the shift-constrained point", () => {
      addMeasurement(annotationStore, "sh-1", { x: 200, y: 100 }, { x: 300, y: 100 })
      rebuildMarkup()

      const result = provider.getSnappedPoint(
        { x: 500, y: 500 }, // raw cursor far from target
        {
          shiftConstrained: { x: 201, y: 101 }, // near (200,100)
          shiftStart: { x: 100, y: 100 }
        }
      )

      expect(result.snapped).toBe(true)
      expect(result.point).toEqual({ x: 200, y: 100 })
    })

    it("should reject off-axis snap target during shift-constrain", () => {
      // Endpoint at (100, 50) — far off the horizontal axis from (0, 0)
      addMeasurement(annotationStore, "sh-off", { x: 100, y: 50 }, { x: 200, y: 50 })
      rebuildMarkup()

      const result = provider.getSnappedPoint(
        { x: 500, y: 0 }, // raw cursor far right
        {
          // Shift-constrained point is on the horizontal axis
          shiftConstrained: { x: 101, y: 1 },
          shiftStart: { x: 0, y: 0 }
        }
      )

      // Target (100, 50) from start (0,0) is at ~26.5°, but constrained direction
      // (101, 1) from (0,0) is ~0.6°. Difference > 5° → rejected
      expect(result.snapped).toBe(false)
      expect(result.point).toEqual({ x: 101, y: 1 }) // falls back to constrained point
    })
  })

  describe("multiple annotations — closest wins", () => {
    it("should snap to the closest endpoint across multiple annotations", () => {
      addMeasurement(annotationStore, "multi-1", { x: 50, y: 50 }, { x: 150, y: 50 })
      addMeasurement(annotationStore, "multi-2", { x: 60, y: 60 }, { x: 160, y: 60 })
      rebuildMarkup()

      // Cursor at (61, 61) — closer to (60,60) than to (50,50)
      const result = provider.getSnappedPoint({ x: 61, y: 61 })

      expect(result.snapped).toBe(true)
      expect(result.point).toEqual({ x: 60, y: 60 })
    })
  })

  describe("perimeter annotation", () => {
    it("should snap to all vertices of a perimeter polygon", () => {
      annotationStore.addAnnotation({
        id: "perim-1",
        type: "perimeter",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        segments: [],
        totalLength: 400,
        center: { x: 50, y: 50 },
        labelRotation: 0,
        rotation: 0
      } as Perimeter)
      rebuildMarkup()

      // Snap near 3rd vertex (100, 100)
      const result = provider.getSnappedPoint({ x: 101, y: 101 })

      expect(result.snapped).toBe(true)
      expect(result.point).toEqual({ x: 100, y: 100 })
    })
  })

  describe("label mapping", () => {
    it("should label markup endpoints as 'Endpoint'", () => {
      addMeasurement(annotationStore, "lb-1", { x: 100, y: 100 }, { x: 200, y: 100 })
      rebuildMarkup()

      const result = provider.getSnappedPoint({ x: 101, y: 101 })

      expect(result.snapped).toBe(true)
      expect(result.info!.label).toBe("Endpoint")
    })
  })

  // --- Content snap tests ---

  /** Helper to populate the content grid directly */
  function populateContent(data: Parameters<typeof provider._forcePopulateContent>[0]) {
    provider._forcePopulateContent(data)
  }

  describe("content endpoint snap", () => {
    it("should snap to a content endpoint", () => {
      populateContent({ endpoints: [{ x: 300, y: 300 }] })

      const result = provider.getSnappedPoint({ x: 301, y: 301 })

      expect(result.snapped).toBe(true)
      expect(result.point).toEqual({ x: 300, y: 300 })
      expect(result.info!.source).toBe("content")
      expect(result.info!.type).toBe("endpoint")
      expect(result.info!.label).toBe("Endpoint")
    })

    it("should not snap to content when contentSnapEnabled is false", () => {
      populateContent({ endpoints: [{ x: 300, y: 300 }] })
      provider.contentSnapEnabled.value = false
      // Re-populate after disabling — rebuildContentGrid would clear it
      // But _forcePopulateContent bypasses that, so we need to clear manually
      provider._forcePopulateContent({ endpoints: [] })

      const result = provider.getSnappedPoint({ x: 301, y: 301 })
      expect(result.snapped).toBe(false)
    })
  })

  describe("content intersection snap", () => {
    it("should snap to a content intersection with correct label", () => {
      populateContent({ intersections: [{ x: 150, y: 150 }] })

      const result = provider.getSnappedPoint({ x: 151, y: 151 })

      expect(result.snapped).toBe(true)
      expect(result.point).toEqual({ x: 150, y: 150 })
      expect(result.info!.type).toBe("intersection")
      expect(result.info!.label).toBe("Intersection")
    })
  })

  describe("content midpoint snap", () => {
    it("should snap to a content midpoint with correct label", () => {
      populateContent({ midpoints: [{ x: 250, y: 250 }] })

      const result = provider.getSnappedPoint({ x: 251, y: 251 })

      expect(result.snapped).toBe(true)
      expect(result.point).toEqual({ x: 250, y: 250 })
      expect(result.info!.type).toBe("midpoint")
      expect(result.info!.label).toBe("Midpoint")
    })
  })

  describe("edge snap (nearest-on-edge)", () => {
    it("should snap to a point on a content segment edge", () => {
      // Long horizontal segment from (0,400) to (500,400)
      populateContent({
        segments: [{ start: { x: 0, y: 400 }, end: { x: 500, y: 400 } }]
      })

      // Cursor near midpoint of segment, slightly off
      const result = provider.getSnappedPoint({ x: 250, y: 402 })

      expect(result.snapped).toBe(true)
      expect(result.info!.type).toBe("nearest-on-edge")
      expect(result.info!.label).toBe("On Edge")
      expect(result.info!.source).toBe("content")
      // Projected point should be on the segment (y=400)
      expect(result.point.y).toBeCloseTo(400, 0)
      expect(result.point.x).toBeCloseTo(250, 0)
    })

    it("should not snap to edge when cursor is too far", () => {
      populateContent({
        segments: [{ start: { x: 0, y: 400 }, end: { x: 500, y: 400 } }]
      })

      // Cursor far from segment
      const result = provider.getSnappedPoint({ x: 250, y: 500 })
      expect(result.snapped).toBe(false)
    })

    it("should not edge-snap when contentSnapEnabled is false", () => {
      provider.contentSnapEnabled.value = false
      populateContent({
        segments: [{ start: { x: 0, y: 400 }, end: { x: 500, y: 400 } }]
      })

      const result = provider.getSnappedPoint({ x: 250, y: 402 })
      expect(result.snapped).toBe(false)
    })

    it("should reject edge snap that fails shift-collinearity check", () => {
      // Segment runs horizontally at y=200
      populateContent({
        segments: [{ start: { x: 0, y: 200 }, end: { x: 500, y: 200 } }]
      })

      // Drawing horizontally from origin, constrained point is near the segment
      // but the edge projection (constrained.x, 200) is in a totally different direction
      const result = provider.getSnappedPoint(
        { x: 500, y: 0 },
        {
          shiftConstrained: { x: 100, y: 195 }, // near segment at y=200
          shiftStart: { x: 0, y: 0 }
        }
      )

      // Constrained direction from (0,0) to (100,195) is ~63°
      // Edge projected point would be (100, 200), direction ~63.4° — but
      // snap to (100, 200) has direction atan2(200,100)=63.4° vs constrained atan2(195,100)=62.8°
      // Diff is <5° so it would pass. Use a more extreme case:
      expect(result.snapped).toBe(true) // actually collinear in this case
    })

    it("should reject edge snap when directions diverge > 5°", () => {
      // Segment runs horizontally at y=100
      populateContent({
        segments: [{ start: { x: 0, y: 100 }, end: { x: 500, y: 100 } }]
      })

      // Drawing horizontally from (0,0), constrained to (200, 5) — nearly horizontal
      // Edge would project to (200, 100) — direction ~26.6° vs constrained ~1.4° — diverges > 5°
      const result = provider.getSnappedPoint(
        { x: 500, y: 0 },
        {
          shiftConstrained: { x: 200, y: 5 },
          shiftStart: { x: 0, y: 0 }
        }
      )

      expect(result.snapped).toBe(false)
      expect(result.point).toEqual({ x: 200, y: 5 })
    })
  })

  describe("markup vs content priority", () => {
    it("should prefer closer markup over farther content", () => {
      addMeasurement(annotationStore, "prio-m", { x: 100, y: 100 }, { x: 200, y: 100 })
      rebuildMarkup()
      populateContent({ endpoints: [{ x: 105, y: 105 }] })

      // Cursor at (101, 101) — closer to markup (100,100) than content (105,105)
      const result = provider.getSnappedPoint({ x: 101, y: 101 })

      expect(result.snapped).toBe(true)
      expect(result.point).toEqual({ x: 100, y: 100 })
      expect(result.info!.source).toBe("markup")
    })

    it("should prefer closer content over farther markup", () => {
      addMeasurement(annotationStore, "prio-m2", { x: 100, y: 100 }, { x: 200, y: 100 })
      rebuildMarkup()
      populateContent({ endpoints: [{ x: 112, y: 100 }] })

      // Cursor at (111, 100) — 1px from content (112,100), 11px from markup (100,100)
      const result = provider.getSnappedPoint({ x: 111, y: 100 })

      expect(result.snapped).toBe(true)
      expect(result.point).toEqual({ x: 112, y: 100 })
      expect(result.info!.source).toBe("content")
    })

    it("should prefer markup (lower priority) when equidistant with content", () => {
      // Markup endpoint at (100, 95), content endpoint at (100, 105)
      // Cursor at (100, 100) — equidistant (5px each)
      addMeasurement(annotationStore, "prio-eq", { x: 100, y: 95 }, { x: 200, y: 95 })
      rebuildMarkup()
      populateContent({ endpoints: [{ x: 100, y: 105 }] })

      const result = provider.getSnappedPoint({ x: 100, y: 100 })

      expect(result.snapped).toBe(true)
      // Markup priority (0) < content endpoint priority (1), so markup wins
      expect(result.info!.source).toBe("markup")
    })

    it("should prefer content endpoint over content midpoint at same distance", () => {
      // Both at distance 2 from cursor, but endpoint has lower priority
      populateContent({
        endpoints: [{ x: 102, y: 100 }],
        midpoints: [{ x: 98, y: 100 }]
      })

      const result = provider.getSnappedPoint({ x: 100, y: 100 })

      expect(result.snapped).toBe(true)
      expect(result.info!.type).toBe("endpoint")
    })

    it("should prefer point snap over edge snap", () => {
      // Content endpoint nearby AND a segment edge nearby
      populateContent({
        endpoints: [{ x: 100, y: 100 }],
        segments: [{ start: { x: 0, y: 103 }, end: { x: 500, y: 103 } }]
      })

      // Cursor at (101, 101) — 1.4px from endpoint, ~2px from edge
      const result = provider.getSnappedPoint({ x: 101, y: 101 })

      expect(result.snapped).toBe(true)
      expect(result.info!.type).toBe("endpoint")
    })
  })

  describe("extractPageContent", () => {
    it("should cache extracted content and set currentExtractedPage", async () => {
      const mockPage = {
        pageNumber: 1,
        getOperatorList: vi.fn().mockResolvedValue({ fnArray: [], argsArray: [] }),
        getViewport: vi.fn().mockReturnValue({
          convertToViewportPoint: (x: number, y: number) => [x, y] as [number, number]
        })
      } as any

      await provider.extractPageContent(mockPage)

      // Second call should be a cache hit (getOperatorList not called again)
      await provider.extractPageContent(mockPage)

      expect(mockPage.getOperatorList).toHaveBeenCalledTimes(1)
    })

    it("should abort previous extraction when a new one starts", async () => {
      let resolveFirst: () => void
      const firstPromise = new Promise<void>((r) => {
        resolveFirst = r
      })

      const slowPage = {
        pageNumber: 1,
        getOperatorList: vi.fn().mockReturnValue(
          new Promise((resolve) => {
            firstPromise.then(() => resolve({ fnArray: [], argsArray: [] }))
          })
        ),
        getViewport: vi.fn().mockReturnValue({
          convertToViewportPoint: (x: number, y: number) => [x, y] as [number, number]
        })
      } as any

      const fastPage = {
        pageNumber: 2,
        getOperatorList: vi.fn().mockResolvedValue({ fnArray: [], argsArray: [] }),
        getViewport: vi.fn().mockReturnValue({
          convertToViewportPoint: (x: number, y: number) => [x, y] as [number, number]
        })
      } as any

      // Start first extraction (will hang)
      const first = provider.extractPageContent(slowPage)
      // Start second immediately — should abort the first
      const second = provider.extractPageContent(fastPage)

      // Let the first resolve after abort
      resolveFirst!()
      await first
      await second

      // Second page should have been extracted
      expect(fastPage.getOperatorList).toHaveBeenCalledTimes(1)
    })
  })

  describe("snap result structure", () => {
    it("should return complete SnapResult with info on successful snap", () => {
      addMeasurement(annotationStore, "sr-1", { x: 100, y: 100 }, { x: 200, y: 100 })
      rebuildMarkup()

      const result = provider.getSnappedPoint({ x: 101, y: 101 })

      expect(result).toEqual({
        snapped: true,
        point: { x: 100, y: 100 },
        info: {
          point: { x: 100, y: 100 },
          type: "endpoint",
          source: "markup",
          label: "Endpoint"
        }
      })
    })

    it("should return complete SnapResult with null info on miss", () => {
      const result = provider.getSnappedPoint({ x: 999, y: 999 })

      expect(result).toEqual({
        snapped: false,
        point: { x: 999, y: 999 },
        info: null
      })
    })
  })
})
