# MetreMate SVG Annotation Migration Plan

## Overview

**Goal:** Transition from Konva dual-canvas to SVG overlay while simplifying architecture and maintaining all functionality.

**Strategy:** Big-bang refactor (not incremental) since you have a new database and can afford breaking changes.

**Timeline:** 6-8 weeks for complete migration

---

## Phase 0: Preparation & Setup (Week 1)

### 0.1 Create Feature Branch
```bash
git checkout -b feat/svg-migration
```

### 0.2 Document Current Feature List

Create `docs/FEATURES_CHECKLIST.md`:

```markdown
# Feature Checklist - Must Maintain 100%

## Drawing Tools
- [ ] Measure tool (2 points, shows distance)
- [ ] Area tool (polygon, shows area in m²)
- [ ] Perimeter tool (polygon, shows total + individual segments)
- [ ] Line tool (simple line drawing)
- [ ] Fill tool (fill areas with color/opacity)
- [ ] Text tool (add text annotations)

## Drawing Features
- [ ] Multi-step drawing (click to add points)
- [ ] Temporary preview line while drawing
- [ ] Snap to 45° angles (Shift key)
- [ ] Snap to close polygon (near start point)
- [ ] Visual snap indicators
- [ ] Cancel drawing (Escape key)

## Interaction Features
- [ ] Select annotations (click)
- [ ] Delete annotations (Delete/Backspace key)
- [ ] Hover effects
- [ ] Resize text annotations
- [ ] Move annotations (drag)
- [ ] Edit text content (double-click)

## Display Features
- [ ] Configurable colors per tool
- [ ] Configurable stroke widths
- [ ] Configurable opacities
- [ ] Configurable label sizes
- [ ] Show/hide annotations toggle
- [ ] Individual segment measurements (perimeter)
- [ ] Label backgrounds for readability

## PDF Features (Keep As-Is)
- [ ] PDF rendering with pdfjs
- [ ] Multi-page support
- [ ] Page thumbnails
- [ ] Zoom in/out (Ctrl+wheel)
- [ ] Pan (drag or wheel)
- [ ] Zoom at cursor position
- [ ] Page navigation
- [ ] PDF scale detection (1:100 etc)

## Data Features
- [ ] Auto-save (debounced)
- [ ] Save on navigation
- [ ] Load annotations from database
- [ ] Per-page annotations
- [ ] Real-time sync ready (structure)
```

### 0.3 Freeze Current State

Tag current working version:
```bash
git tag -a konva-baseline -m "Last working Konva implementation"
git push origin konva-baseline
```

### 0.4 Setup New Database Schema

Create migration:
```sql
-- db/migrations/002_simplify_annotations.sql

-- New simplified annotations table
CREATE TABLE annotations_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_url TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id),
  page_num INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'measure', 'area', 'perimeter', 'line', 'fill', 'text'

  -- All annotation data in one JSON column (no more normalization!)
  data JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT annotations_v2_type_check
    CHECK (type IN ('measure', 'area', 'perimeter', 'line', 'fill', 'text'))
);

-- Indexes
CREATE INDEX idx_annotations_v2_document ON annotations_v2(document_url);
CREATE INDEX idx_annotations_v2_page ON annotations_v2(document_url, page_num);
CREATE INDEX idx_annotations_v2_type ON annotations_v2(type);

-- RLS policies (copy from original)
ALTER TABLE annotations_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view annotations on their documents"
  ON annotations_v2 FOR SELECT
  USING (auth.uid() = author_id);

CREATE POLICY "Users can insert annotations on their documents"
  ON annotations_v2 FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own annotations"
  ON annotations_v2 FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own annotations"
  ON annotations_v2 FOR DELETE
  USING (auth.uid() = author_id);
```

Generate new types:
```bash
pnpm run db:types
```

---

## Phase 1: New State Management (Week 1)

### 1.1 Create Simplified Types

**File:** `types/annotations.ts` (NEW)

```typescript
import type { Point } from './tools'

// Base annotation type
export interface BaseAnnotation {
  id: string
  type: 'measure' | 'area' | 'perimeter' | 'line' | 'fill' | 'text'
  pageNum: number
  createdAt?: string
  updatedAt?: string
}

// Specific annotation types
export interface Measurement extends BaseAnnotation {
  type: 'measure'
  points: [Point, Point] // Always exactly 2 points
  distance: number
  midpoint: Point
}

export interface Area extends BaseAnnotation {
  type: 'area'
  points: Point[] // Min 3 points
  area: number // in m²
  center: Point
}

export interface PerimeterSegment {
  start: Point
  end: Point
  length: number
  midpoint: Point
}

export interface Perimeter extends BaseAnnotation {
  type: 'perimeter'
  points: Point[] // Min 3 points
  segments: PerimeterSegment[]
  totalLength: number
  center: Point
}

export interface Line extends BaseAnnotation {
  type: 'line'
  points: Point[] // Min 2 points
}

export interface Fill extends BaseAnnotation {
  type: 'fill'
  x: number
  y: number
  color: string
  opacity: number
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text'
  x: number
  y: number
  width: number
  height: number
  content: string
  fontSize: number
  color: string
}

// Union type for all annotations
export type Annotation =
  | Measurement
  | Area
  | Perimeter
  | Line
  | Fill
  | TextAnnotation

// Type guards
export function isMeasurement(ann: Annotation): ann is Measurement {
  return ann.type === 'measure'
}

export function isArea(ann: Annotation): ann is Area {
  return ann.type === 'area'
}

export function isPerimeter(ann: Annotation): ann is Perimeter {
  return ann.type === 'perimeter'
}

export function isLine(ann: Annotation): ann is Line {
  return ann.type === 'line'
}

export function isFill(ann: Annotation): ann is Fill {
  return ann.type === 'fill'
}

export function isText(ann: Annotation): ann is TextAnnotation {
  return ann.type === 'text'
}
```

### 1.2 Create New Simplified Store

**File:** `stores/annotations.ts` (NEW)

```typescript
import { defineStore } from 'pinia'
import type { Annotation } from '~/types/annotations'

export const useAnnotationStore = defineStore('annotations', () => {
  // ============================================
  // State - DRASTICALLY SIMPLIFIED
  // ============================================

  const annotations = ref<Annotation[]>([])
  const activeTool = ref<Annotation['type'] | 'selection' | ''>('')
  const selectedAnnotationId = ref<string | null>(null)
  const isDrawing = ref(false)

  // ============================================
  // Getters
  // ============================================

  const getAnnotationsByPage = computed(() => (pageNum: number) => {
    return annotations.value.filter(a => a.pageNum === pageNum)
  })

  const getAnnotationsByType = computed(() => (type: Annotation['type']) => {
    return annotations.value.filter(a => a.type === type)
  })

  const getAnnotationById = computed(() => (id: string) => {
    return annotations.value.find(a => a.id === id)
  })

  const selectedAnnotation = computed(() => {
    if (!selectedAnnotationId.value) return null
    return getAnnotationById.value(selectedAnnotationId.value)
  })

  // ============================================
  // Actions
  // ============================================

  function addAnnotation(annotation: Annotation) {
    annotations.value.push(annotation)
  }

  function updateAnnotation(id: string, updates: Partial<Annotation>) {
    const index = annotations.value.findIndex(a => a.id === id)
    if (index !== -1) {
      annotations.value[index] = { ...annotations.value[index], ...updates }
    }
  }

  function deleteAnnotation(id: string) {
    const index = annotations.value.findIndex(a => a.id === id)
    if (index !== -1) {
      annotations.value.splice(index, 1)
    }
    if (selectedAnnotationId.value === id) {
      selectedAnnotationId.value = null
    }
  }

  function setActiveTool(tool: Annotation['type'] | 'selection' | '') {
    activeTool.value = tool
    selectedAnnotationId.value = null
    isDrawing.value = false
  }

  function selectAnnotation(id: string | null) {
    selectedAnnotationId.value = id
    if (id !== null) {
      activeTool.value = 'selection'
    }
  }

  function clearAnnotations() {
    annotations.value = []
    selectedAnnotationId.value = null
    isDrawing.value = false
  }

  function setAnnotations(newAnnotations: Annotation[]) {
    annotations.value = newAnnotations
  }

  // ============================================
  // Persistence (replaces your complex save logic)
  // ============================================

  async function saveAnnotations(documentUrl: string, authorId: string) {
    const payload = annotations.value.map(ann => ({
      id: ann.id,
      document_url: documentUrl,
      author_id: authorId,
      page_num: ann.pageNum,
      type: ann.type,
      data: ann, // Entire annotation as JSON
    }))

    await $fetch('/api/annotations/upsert', {
      method: 'POST',
      body: payload,
    })
  }

  async function loadAnnotations(documentUrl: string) {
    const { data } = await $fetch<{ data: any[] }>('/api/annotations/fetch', {
      method: 'POST',
      body: { documentSlug: documentUrl },
    })

    // Data is already in the right format!
    annotations.value = data.map(item => item.data as Annotation)
  }

  return {
    // State
    annotations,
    activeTool,
    selectedAnnotationId,
    isDrawing,

    // Getters
    getAnnotationsByPage,
    getAnnotationsByType,
    getAnnotationById,
    selectedAnnotation,

    // Actions
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    setActiveTool,
    selectAnnotation,
    clearAnnotations,
    setAnnotations,
    saveAnnotations,
    loadAnnotations,
  }
})
```

**Compare to current:**
- **Before:** 30KB file, 900+ lines, deeply nested state, 50+ actions
- **After:** ~150 lines, flat array, 10 actions
- **Reduction:** ~83% code reduction ✅

### 1.3 Simplify Renderer Store

**File:** `stores/renderer.ts` (MODIFY)

Keep only what's needed for PDF rendering:

```typescript
import type { PDFDocumentProxy } from 'pdfjs-dist'

export const useRendererStore = defineStore('renderer', () => {
  // ============================================
  // PDF State (Keep)
  // ============================================

  const documentProxy = ref<PDFDocumentProxy>()
  const currentPage = ref(1)
  const totalPages = ref(0)
  const pdfInitialised = ref(false)
  const pdfLoadingState = ref<'loading' | 'complete'>('loading')

  // ============================================
  // Viewport State (Keep)
  // ============================================

  const scale = ref(1)
  const scrollTop = ref(0)
  const scrollLeft = ref(0)
  const pdfWidth = ref(0)
  const pdfHeight = ref(0)

  // ============================================
  // UI State (Keep)
  // ============================================

  const isSideBarShown = ref(true)

  // ============================================
  // REMOVE - No longer needed with SVG
  // ============================================

  // ❌ stage ref - SVG doesn't need this
  // ❌ transformer ref - SVG handles this differently
  // ❌ stageConfig - SVG doesn't need this
  // ❌ canvasPos separate from scroll - SVG uses scroll directly
  // ❌ dragOffset - SVG handles this in composables

  // ============================================
  // Getters
  // ============================================

  const getCurrentPage = computed(() => currentPage.value)
  const getScale = computed(() => scale.value)
  const getPdfWidth = computed(() => pdfWidth.value)
  const getPdfHeight = computed(() => pdfHeight.value)
  const getDocumentProxy = computed(() => documentProxy.value)
  const getPdfInitialised = computed(() => pdfInitialised.value)

  // ============================================
  // Actions
  // ============================================

  function setDocumentProxy(proxy: PDFDocumentProxy | undefined) {
    documentProxy.value = proxy
    if (proxy) {
      totalPages.value = proxy.numPages
    }
  }

  function setCurrentPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page
    }
  }

  function setScale(newScale: number) {
    const min = 0.2
    const max = 5
    scale.value = Math.max(min, Math.min(max, newScale))
  }

  function setScroll(top: number, left: number) {
    scrollTop.value = top
    scrollLeft.value = left
  }

  function setPdfDimensions(width: number, height: number) {
    pdfWidth.value = width
    pdfHeight.value = height
  }

  function setPdfInitialised(initialised: boolean) {
    pdfInitialised.value = initialised
  }

  function setPDFLoadingState(state: 'loading' | 'complete') {
    pdfLoadingState.value = state
  }

  function toggleSideBar() {
    isSideBarShown.value = !isSideBarShown.value
  }

  function resetState() {
    currentPage.value = 1
    scale.value = 1
    scrollTop.value = 0
    scrollLeft.value = 0
    pdfInitialised.value = false
  }

  return {
    // State
    documentProxy,
    currentPage,
    totalPages,
    pdfInitialised,
    pdfLoadingState,
    scale,
    scrollTop,
    scrollLeft,
    pdfWidth,
    pdfHeight,
    isSideBarShown,

    // Getters
    getCurrentPage,
    getScale,
    getPdfWidth,
    getPdfHeight,
    getDocumentProxy,
    getPdfInitialised,

    // Actions
    setDocumentProxy,
    setCurrentPage,
    setScale,
    setScroll,
    setPdfDimensions,
    setPdfInitialised,
    setPDFLoadingState,
    toggleSideBar,
    resetState,
  }
})
```

**Compare to current:**
- **Before:** 5KB file, complex Konva state management
- **After:** ~2KB, just PDF + viewport state
- **Reduction:** ~60% ✅

### 1.4 Keep Settings Store As-Is

Settings store is fine - no changes needed! It already follows the right pattern.

### 1.5 Delete Old Stores

Mark for deletion (don't delete yet):
- `stores/main.ts` - Will be replaced by `stores/annotations.ts`

---

## Phase 2: Core Composables (Week 2)

### 2.1 Base Tool Composable

**File:** `composables/tools/useBaseTool.ts` (NEW)

```typescript
import type { Point } from '~/types'

export interface BaseToolOptions {
  type: string
  minPoints?: number
  canClose?: boolean
  snapDistance?: number
}

export function useBaseTool(options: BaseToolOptions) {
  const settings = useSettingStore()
  const annotationStore = useAnnotationStore()

  // State
  const points = ref<Point[]>([])
  const tempEndPoint = ref<Point | null>(null)

  // Computed
  const hasMinimumPoints = computed(() =>
    points.value.length >= (options.minPoints ?? 2)
  )

  const canSnapToClose = computed(() => {
    if (!options.canClose || points.value.length < (options.minPoints ?? 3)) {
      return false
    }
    if (!tempEndPoint.value) return false

    const firstPoint = points.value[0]
    const dist = distance(tempEndPoint.value, firstPoint)
    const snapDist = options.snapDistance ?? settings.toolSnapDistance
    return dist < snapDist
  })

  // Methods
  function startDrawing(point: Point) {
    points.value = [point]
    annotationStore.isDrawing = true
  }

  function addPoint(point: Point) {
    points.value.push(point)
  }

  function updateTempPoint(point: Point) {
    tempEndPoint.value = point
  }

  function reset() {
    points.value = []
    tempEndPoint.value = null
    annotationStore.isDrawing = false
  }

  function complete() {
    annotationStore.isDrawing = false
    return [...points.value]
  }

  // SVG utilities
  function getSvgPoint(e: MouseEvent): Point {
    const svg = e.currentTarget as SVGSVGElement
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const transformed = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: transformed.x, y: transformed.y }
  }

  function toSvgPoints(pts: Point[]): string {
    return pts.map(p => `${p.x},${p.y}`).join(' ')
  }

  function snapTo45Degrees(start: Point, end: Point): Point {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    const snappedAngle = Math.round(angle / 45) * 45
    const distance = Math.sqrt(dx * dx + dy * dy)

    return {
      x: start.x + distance * Math.cos(snappedAngle * Math.PI / 180),
      y: start.y + distance * Math.sin(snappedAngle * Math.PI / 180)
    }
  }

  return {
    // State
    points,
    tempEndPoint,

    // Computed
    hasMinimumPoints,
    canSnapToClose,

    // Methods
    startDrawing,
    addPoint,
    updateTempPoint,
    reset,
    complete,
    getSvgPoint,
    toSvgPoints,
    snapTo45Degrees,
  }
}
```

### 2.2 Drawing Tool Factory

**File:** `composables/tools/useDrawingTool.ts` (NEW)

```typescript
import type { Annotation, BaseAnnotation } from '~/types/annotations'
import type { Point } from '~/types'

export interface DrawingToolConfig<T extends Annotation> {
  type: T['type']
  minPoints: number
  canClose: boolean
  calculate: (points: Point[]) => Omit<T, keyof BaseAnnotation>
  onCreate: (annotation: T) => void
  onUpdate?: (annotation: T) => void
  snapDistance?: number
}

export function useDrawingTool<T extends Annotation>(config: DrawingToolConfig<T>) {
  const annotationStore = useAnnotationStore()
  const rendererStore = useRendererStore()

  const base = useBaseTool({
    type: config.type,
    minPoints: config.minPoints,
    canClose: config.canClose,
    snapDistance: config.snapDistance,
  })

  // Tool-specific state
  const completed = computed(() =>
    annotationStore.getAnnotationsByType(config.type) as T[]
  )

  const selected = computed(() => {
    if (!annotationStore.selectedAnnotationId) return null
    const ann = annotationStore.selectedAnnotation
    return ann?.type === config.type ? (ann as T) : null
  })

  // Event handlers
  function handleClick(e: MouseEvent) {
    const point = base.getSvgPoint(e)

    // Check for snap to close
    if (base.canSnapToClose.value) {
      completeDrawing()
      return
    }

    if (!annotationStore.isDrawing) {
      base.startDrawing(point)
    } else {
      const pointToAdd = e.shiftKey
        ? base.snapTo45Degrees(base.points.value[base.points.value.length - 1], point)
        : point

      base.addPoint(pointToAdd)

      // Auto-complete for 2-point tools (measure, line)
      if (config.minPoints === 2 && base.points.value.length === 2) {
        completeDrawing()
      }
    }
  }

  function handleMove(e: MouseEvent) {
    if (!annotationStore.isDrawing) return

    const point = base.getSvgPoint(e)
    const lastPoint = base.points.value[base.points.value.length - 1]

    const snappedPoint = e.shiftKey && lastPoint
      ? base.snapTo45Degrees(lastPoint, point)
      : point

    base.updateTempPoint(snappedPoint)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && annotationStore.isDrawing) {
      base.reset()
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && selected.value) {
      deleteAnnotation(selected.value.id)
    }
  }

  function completeDrawing() {
    if (!base.hasMinimumPoints.value) {
      base.reset()
      return
    }

    const points = base.complete()
    const calculatedData = config.calculate(points)

    const annotation: T = {
      id: uuidv4(),
      type: config.type,
      pageNum: rendererStore.currentPage,
      ...calculatedData,
    } as T

    annotationStore.addAnnotation(annotation)
    config.onCreate(annotation)
    base.reset()
  }

  function selectAnnotation(id: string) {
    annotationStore.selectAnnotation(id)
  }

  function deleteAnnotation(id: string) {
    annotationStore.deleteAnnotation(id)
  }

  return {
    // Base state
    isDrawing: computed(() => annotationStore.isDrawing),
    points: base.points,
    tempEndPoint: base.tempEndPoint,
    canSnapToClose: base.canSnapToClose,

    // Tool state
    completed,
    selected,

    // Methods
    handleClick,
    handleMove,
    handleKeyDown,
    selectAnnotation,
    deleteAnnotation,
    getSvgPoint: base.getSvgPoint,
    toSvgPoints: base.toSvgPoints,
  }
}
```

### 2.3 Utility Functions

**File:** `utils/calculations.ts` (NEW - consolidate from canvas.ts)

```typescript
import type { Point } from '~/types'

/**
 * Calculate distance between two points in real-world units (mm)
 */
export function calculateDistance(
  point1: Point,
  point2: Point,
  scaleString: string,
  dpi: number = 72
): number {
  // Distance in PDF units (points)
  const distanceInPoints = Math.sqrt(
    Math.pow(point2.x - point1.x, 2) +
    Math.pow(point2.y - point1.y, 2)
  )

  // Convert points to millimeters (1 point = 1/72 inch)
  const distanceInMm = (distanceInPoints / dpi) * 25.4

  // Apply scale (e.g., 1:100 = 100)
  const scale = parsePdfPageScale(scaleString)
  const realWorldDistance = distanceInMm * scale

  return Math.round(realWorldDistance)
}

/**
 * Calculate area of a polygon in square meters
 */
export function calculatePolygonArea(
  points: Point[],
  scaleString: string,
  dpi: number = 72
): number {
  let area = 0
  const scale = parsePdfPageScale(scaleString)
  const pixelsToMm = 25.4 / dpi

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length

    // Convert to real-world coordinates
    const x1 = points[i].x * pixelsToMm * scale
    const y1 = points[i].y * pixelsToMm * scale
    const x2 = points[j].x * pixelsToMm * scale
    const y2 = points[j].y * pixelsToMm * scale

    area += x1 * y2 - x2 * y1
  }

  // Convert mm² to m²
  const areaInM2 = Math.abs(area) / 2 / 1000000
  return Math.round(areaInM2 * 100) / 100 // 2 decimal places
}

/**
 * Calculate centroid of a polygon
 */
export function calculateCentroid(points: Point[]): Point {
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  )

  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  }
}

/**
 * Calculate midpoint between two points
 */
export function calculateMidpoint(point1: Point, point2: Point): Point {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2
  }
}

/**
 * Calculate distance between two points (no unit conversion)
 */
export function distance(point1: Point, point2: Point): number {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) +
    Math.pow(point2.y - point1.y, 2)
  )
}

/**
 * Parse PDF scale string (e.g., "1:100" -> 100)
 */
export function parsePdfPageScale(scaleString: string): number {
  const match = scaleString.match(/1:(\d+)/)
  return match ? parseInt(match[1]) : 1
}
```

**File:** `utils/svg.ts` (NEW)

```typescript
import type { Point } from '~/types'

/**
 * Get SVG point from mouse event
 */
export function getSvgPoint(e: MouseEvent, svg: SVGSVGElement): Point {
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const transformed = pt.matrixTransform(svg.getScreenCTM()!.inverse())
  return { x: transformed.x, y: transformed.y }
}

/**
 * Convert points array to SVG points string
 */
export function toSvgPoints(points: Point[]): string {
  return points.map(p => `${p.x},${p.y}`).join(' ')
}

/**
 * Get bounding box of points
 */
export function getBoundingBox(points: Point[]): {
  x: number
  y: number
  width: number
  height: number
} {
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}
```

---

## Phase 3: Tool Migration (Week 3-4)

### 3.1 Measure Tool

**File:** `composables/tools/useMeasureTool.ts` (NEW)

```typescript
import type { Measurement } from '~/types/annotations'
import type { Point } from '~/types'

export function useMeasureTool() {
  const settings = useSettingStore()
  const rendererStore = useRendererStore()

  const tool = useDrawingTool<Measurement>({
    type: 'measure',
    minPoints: 2,
    canClose: false,

    calculate: (points: Point[]) => {
      const [start, end] = points
      const distance = calculateDistance(
        start,
        end,
        rendererStore.pdfScale || '1:100'
      )
      const midpoint = calculateMidpoint(start, end)

      return {
        points: [start, end],
        distance,
        midpoint,
      }
    },

    onCreate: async (measurement) => {
      // Additional logic if needed
      console.log('Measurement created:', measurement)
    },
  })

  // Computed for preview
  const previewDistance = computed(() => {
    if (!tool.isDrawing.value || tool.points.value.length !== 1 || !tool.tempEndPoint.value) {
      return null
    }

    return calculateDistance(
      tool.points.value[0],
      tool.tempEndPoint.value,
      rendererStore.pdfScale || '1:100'
    )
  })

  return {
    ...tool,
    previewDistance,
  }
}
```

**That's it! ~40 lines vs your current ~300 lines.**

### 3.2 Area Tool

**File:** `composables/tools/useAreaTool.ts` (NEW)

```typescript
import type { Area } from '~/types/annotations'
import type { Point } from '~/types'

export function useAreaTool() {
  const rendererStore = useRendererStore()

  const tool = useDrawingTool<Area>({
    type: 'area',
    minPoints: 3,
    canClose: true,

    calculate: (points: Point[]) => {
      const area = calculatePolygonArea(
        points,
        rendererStore.pdfScale || '1:100'
      )
      const center = calculateCentroid(points)

      return {
        points,
        area,
        center,
      }
    },

    onCreate: async (area) => {
      console.log('Area created:', area)
    },
  })

  const previewArea = computed(() => {
    if (!tool.isDrawing.value || tool.points.value.length < 2) {
      return null
    }

    const previewPoints = [...tool.points.value]
    if (tool.tempEndPoint.value) {
      previewPoints.push(tool.tempEndPoint.value)
    }

    return calculatePolygonArea(
      previewPoints,
      rendererStore.pdfScale || '1:100'
    )
  })

  const previewPolygon = computed(() => {
    if (!tool.isDrawing.value || tool.points.value.length === 0) {
      return null
    }

    const points = [...tool.points.value]
    if (tool.tempEndPoint.value) {
      points.push(tool.tempEndPoint.value)
    }

    return tool.toSvgPoints(points)
  })

  return {
    ...tool,
    previewArea,
    previewPolygon,
  }
}
```

### 3.3 Perimeter Tool

**File:** `composables/tools/usePerimeterTool.ts` (NEW)

```typescript
import type { Perimeter, PerimeterSegment } from '~/types/annotations'
import type { Point } from '~/types'

export function usePerimeterTool() {
  const rendererStore = useRendererStore()

  const tool = useDrawingTool<Perimeter>({
    type: 'perimeter',
    minPoints: 3,
    canClose: true,

    calculate: (points: Point[]) => {
      const scale = rendererStore.pdfScale || '1:100'

      // Calculate segments for closed perimeter
      const segments: PerimeterSegment[] = []
      for (let i = 0; i < points.length; i++) {
        const start = points[i]
        const end = points[(i + 1) % points.length]

        segments.push({
          start,
          end,
          length: calculateDistance(start, end, scale),
          midpoint: calculateMidpoint(start, end),
        })
      }

      const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0)
      const center = calculateCentroid(points)

      return {
        points,
        segments,
        totalLength,
        center,
      }
    },

    onCreate: async (perimeter) => {
      console.log('Perimeter created:', perimeter)
    },
  })

  // Preview segments while drawing
  const previewSegments = computed((): PerimeterSegment[] => {
    if (!tool.isDrawing.value || tool.points.value.length < 1) {
      return []
    }

    const scale = rendererStore.pdfScale || '1:100'
    const segments: PerimeterSegment[] = []

    // Completed segments
    for (let i = 0; i < tool.points.value.length - 1; i++) {
      const start = tool.points.value[i]
      const end = tool.points.value[i + 1]

      segments.push({
        start,
        end,
        length: calculateDistance(start, end, scale),
        midpoint: calculateMidpoint(start, end),
      })
    }

    // Temp segment to cursor
    if (tool.tempEndPoint.value) {
      const lastPoint = tool.points.value[tool.points.value.length - 1]
      segments.push({
        start: lastPoint,
        end: tool.tempEndPoint.value,
        length: calculateDistance(lastPoint, tool.tempEndPoint.value, scale),
        midpoint: calculateMidpoint(lastPoint, tool.tempEndPoint.value),
      })
    }

    return segments
  })

  return {
    ...tool,
    previewSegments,
  }
}
```

### 3.4 Line Tool

**File:** `composables/tools/useLineTool.ts` (NEW)

```typescript
import type { Line } from '~/types/annotations'
import type { Point } from '~/types'

export function useLineTool() {
  const tool = useDrawingTool<Line>({
    type: 'line',
    minPoints: 2,
    canClose: false,

    calculate: (points: Point[]) => ({
      points,
    }),

    onCreate: async (line) => {
      console.log('Line created:', line)
    },
  })

  return tool
}
```

### 3.5 Fill Tool

**File:** `composables/tools/useFillTool.ts` (NEW)

```typescript
import type { Fill } from '~/types/annotations'

export function useFillTool() {
  const annotationStore = useAnnotationStore()
  const rendererStore = useRendererStore()
  const settings = useSettingStore()

  const completed = computed(() =>
    annotationStore.getAnnotationsByType('fill') as Fill[]
  )

  function handleClick(e: MouseEvent) {
    const svg = e.currentTarget as SVGSVGElement
    const point = getSvgPoint(e, svg)

    const fill: Fill = {
      id: uuidv4(),
      type: 'fill',
      pageNum: rendererStore.currentPage,
      x: point.x,
      y: point.y,
      color: settings.fillFillColor,
      opacity: settings.fillOpacity,
    }

    annotationStore.addAnnotation(fill)
  }

  function deleteFill(id: string) {
    annotationStore.deleteAnnotation(id)
  }

  return {
    completed,
    handleClick,
    deleteFill,
  }
}
```

### 3.6 Text Tool

**File:** `composables/tools/useTextTool.ts` (NEW)

```typescript
import type { TextAnnotation } from '~/types/annotations'

export function useTextTool() {
  const annotationStore = useAnnotationStore()
  const rendererStore = useRendererStore()
  const settings = useSettingStore()

  const completed = computed(() =>
    annotationStore.getAnnotationsByType('text') as TextAnnotation[]
  )

  const editingId = ref<string | null>(null)

  function handleClick(e: MouseEvent) {
    const svg = e.currentTarget as SVGSVGElement
    const point = getSvgPoint(e, svg)

    const text: TextAnnotation = {
      id: uuidv4(),
      type: 'text',
      pageNum: rendererStore.currentPage,
      x: point.x,
      y: point.y,
      width: 200,
      height: 50,
      content: 'Double-click to edit',
      fontSize: 16,
      color: settings.textColor || '#000000',
    }

    annotationStore.addAnnotation(text)
    editingId.value = text.id
  }

  function handleDoubleClick(id: string) {
    editingId.value = id
  }

  function updateText(id: string, content: string) {
    annotationStore.updateAnnotation(id, { content })
    editingId.value = null
  }

  function deleteText(id: string) {
    annotationStore.deleteAnnotation(id)
  }

  return {
    completed,
    editingId,
    handleClick,
    handleDoubleClick,
    updateText,
    deleteText,
  }
}
```

### 3.7 File Size Comparison

**Before (Konva):**
```
composables/useMeasure.ts:     ~300 lines
composables/useArea.ts:        ~300 lines
composables/usePerimeter.ts:   ~300 lines
composables/useLine.ts:        ~250 lines
composables/useFill.ts:        ~200 lines
composables/useText.ts:        ~200 lines
composables/useSelection.ts:   ~150 lines
-------------------------------------------
TOTAL:                        ~1,700 lines
```

**After (SVG):**
```
composables/tools/useBaseTool.ts:      ~100 lines
composables/tools/useDrawingTool.ts:   ~150 lines
composables/tools/useMeasureTool.ts:    ~40 lines
composables/tools/useAreaTool.ts:       ~60 lines
composables/tools/usePerimeterTool.ts:  ~80 lines
composables/tools/useLineTool.ts:       ~20 lines
composables/tools/useFillTool.ts:       ~40 lines
composables/tools/useTextTool.ts:       ~50 lines
-------------------------------------------
TOTAL:                                ~540 lines
```

**Reduction: 68%** ✅

---

## Phase 4: Component Migration (Week 4-5)

### 4.1 Main SVG Layer Component

**File:** `components/viewer/SvgAnnotationLayer.vue` (NEW)

```vue
<template>
  <svg
    ref="svgRef"
    :viewBox="`0 0 ${pdfWidth} ${pdfHeight}`"
    :style="svgStyle"
    class="svg-annotation-layer"
    @click="handleClick"
    @mousemove="handleMove"
    @dblclick="handleDoubleClick"
  >
    <!-- All tools render here -->
    <MeasureTool v-if="showMeasurements" />
    <AreaTool v-if="showAreas" />
    <PerimeterTool v-if="showPerimeters" />
    <LineTool v-if="showLines" />
    <FillTool v-if="showFills" />
    <TextTool v-if="showTexts" />
  </svg>
</template>

<script setup lang="ts">
const rendererStore = useRendererStore()
const annotationStore = useAnnotationStore()
const settings = useSettingStore()

// SVG element ref
const svgRef = ref<SVGSVGElement>()

// PDF dimensions
const pdfWidth = computed(() => rendererStore.pdfWidth)
const pdfHeight = computed(() => rendererStore.pdfHeight)

// SVG positioning (overlays PDF exactly)
const svgStyle = computed(() => ({
  position: 'absolute',
  top: `${rendererStore.scrollTop}px`,
  left: `${rendererStore.scrollLeft}px`,
  width: `${pdfWidth.value * rendererStore.scale}px`,
  height: `${pdfHeight.value * rendererStore.scale}px`,
  pointerEvents: 'all',
  zIndex: 10,
}))

// Show/hide based on settings
const showMeasurements = computed(() => settings.showAnnotations)
const showAreas = computed(() => settings.showAnnotations)
const showPerimeters = computed(() => settings.showAnnotations)
const showLines = computed(() => settings.showAnnotations)
const showFills = computed(() => settings.showAnnotations)
const showTexts = computed(() => settings.showAnnotations)

// Tool instances
const measureTool = useMeasureTool()
const areaTool = useAreaTool()
const perimeterTool = usePerimeterTool()
const lineTool = useLineTool()
const fillTool = useFillTool()
const textTool = useTextTool()

// Event routing
function handleClick(e: MouseEvent) {
  const tool = annotationStore.activeTool

  switch (tool) {
    case 'measure':
      measureTool.handleClick(e)
      break
    case 'area':
      areaTool.handleClick(e)
      break
    case 'perimeter':
      perimeterTool.handleClick(e)
      break
    case 'line':
      lineTool.handleClick(e)
      break
    case 'fill':
      fillTool.handleClick(e)
      break
    case 'text':
      textTool.handleClick(e)
      break
  }
}

function handleMove(e: MouseEvent) {
  const tool = annotationStore.activeTool

  switch (tool) {
    case 'measure':
      measureTool.handleMove(e)
      break
    case 'area':
      areaTool.handleMove(e)
      break
    case 'perimeter':
      perimeterTool.handleMove(e)
      break
    case 'line':
      lineTool.handleMove(e)
      break
  }
}

function handleDoubleClick(e: MouseEvent) {
  // Text editing
  if (annotationStore.activeTool === 'text') {
    const target = e.target as SVGElement
    const id = target.dataset.annotationId
    if (id) {
      textTool.handleDoubleClick(id)
    }
  }
}

// Keyboard shortcuts
function handleKeyDown(e: KeyboardEvent) {
  measureTool.handleKeyDown(e)
  areaTool.handleKeyDown(e)
  perimeterTool.handleKeyDown(e)
  lineTool.handleKeyDown(e)

  // Global shortcuts
  if (e.key === 'Escape') {
    annotationStore.setActiveTool('selection')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.svg-annotation-layer {
  cursor: crosshair;
}

.svg-annotation-layer.selection-mode {
  cursor: default;
}
</style>
```

### 4.2 Individual Tool Components

**File:** `components/viewer/tools/MeasureTool.vue` (NEW)

```vue
<template>
  <g class="measure-tool">
    <!-- Completed measurements -->
    <g
      v-for="measure in completed"
      :key="measure.id"
      :class="{ selected: selected?.id === measure.id }"
      class="measurement"
      @click.stop="selectAnnotation(measure.id)"
    >
      <!-- Line -->
      <line
        :x1="measure.points[0].x"
        :y1="measure.points[0].y"
        :x2="measure.points[1].x"
        :y2="measure.points[1].y"
        :stroke="settings.measureStrokeColor"
        :stroke-width="settings.measureStrokeWidth"
        class="measurement-line"
      />

      <!-- Label background -->
      <rect
        :x="measure.midpoint.x - 30"
        :y="measure.midpoint.y - 10"
        width="60"
        height="20"
        fill="white"
        opacity="0.9"
        rx="3"
      />

      <!-- Label -->
      <text
        :x="measure.midpoint.x"
        :y="measure.midpoint.y"
        :fill="settings.measureLabelColor"
        :font-size="settings.measureLabelSize"
        :font-weight="settings.measureLabelStrokeStyle === 'bold' ? 'bold' : 'normal'"
        text-anchor="middle"
        dominant-baseline="middle"
        class="measurement-label"
      >
        {{ measure.distance }}mm
      </text>
    </g>

    <!-- Preview while drawing -->
    <g v-if="isDrawing && points.length === 1 && tempEndPoint" class="preview">
      <!-- Temp line -->
      <line
        :x1="points[0].x"
        :y1="points[0].y"
        :x2="tempEndPoint.x"
        :y2="tempEndPoint.y"
        :stroke="settings.measureStrokeColor"
        :stroke-width="settings.measureStrokeWidth"
        stroke-dasharray="5,5"
        opacity="0.7"
      />

      <!-- Preview distance -->
      <text
        v-if="previewDistance"
        :x="(points[0].x + tempEndPoint.x) / 2"
        :y="(points[0].y + tempEndPoint.y) / 2 - 10"
        fill="blue"
        font-size="12"
        text-anchor="middle"
      >
        {{ previewDistance }}mm
      </text>
    </g>
  </g>
</template>

<script setup lang="ts">
const settings = useSettingStore()

const {
  isDrawing,
  points,
  tempEndPoint,
  completed,
  selected,
  previewDistance,
  selectAnnotation,
} = useMeasureTool()
</script>

<style scoped>
.measurement-line {
  cursor: pointer;
  transition: stroke-width 0.2s;
}

.measurement-line:hover {
  stroke-width: 3;
  stroke: orange;
}

.measurement.selected .measurement-line {
  stroke: blue;
  stroke-width: 3;
}

.measurement-label {
  pointer-events: none;
  user-select: none;
}
</style>
```

**Note:** Create similar files for AreaTool.vue, PerimeterTool.vue, LineTool.vue, FillTool.vue, TextTool.vue following the same pattern.

### 4.3 Update Editor Page

**File:** `pages/editor/[projectId]/[file]/index.vue` (MODIFY)

Simplified version - remove all Konva and normalization logic:

```vue
<script setup lang="ts">
// ... existing PDF setup code ...

const annotationStore = useAnnotationStore()
const rendererStore = useRendererStore()

// Load annotations on mount
onMounted(async () => {
  await annotationStore.loadAnnotations(`${projectId}/${file}`)
})

// Auto-save (debounced)
const debouncedSave = useDebounceFn(async () => {
  await annotationStore.saveAnnotations(
    `${projectId}/${file}`,
    user.value!.id
  )
}, 5000, { maxWait: 10000 })

// Watch for changes
watch(
  () => annotationStore.annotations,
  () => {
    debouncedSave()
  },
  { deep: true }
)

// Save on navigation
onBeforeRouteLeave(async () => {
  await annotationStore.saveAnnotations(
    `${projectId}/${file}`,
    user.value!.id
  )
})

// REMOVE all the complex flattenAndMap functions!
// REMOVE all coordinate normalization!
// REMOVE all the dual-canvas sync logic!
</script>

<template>
  <div>
    <ClientOnly>
      <div v-if="width >= 1024" class="w-full bg-gray-200 relative h-full overflow-hidden">
        <ViewerCanvasSideBar :pdfDoc="rendererStore.getDocumentProxy">
          <ViewerCanvasPdfThumbnails />
        </ViewerCanvasSideBar>

        <!-- PDF Viewer (unchanged) -->
        <div class="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden">
          <ViewerPage v-if="pdf" ref="viewerRef" :pdf="pdf" />
        </div>

        <!-- SVG Annotation Layer (NEW - replaces entire Konva setup!) -->
        <SvgAnnotationLayer />
      </div>

      <!-- Mobile message (unchanged) -->
      <div v-else>
        <div class="flex justify-center my-20 h-screen">
          <div class="text-center">
            <h1 class="text-2xl font-bold max-w-xl px-5">
              Please use a desktop device to view this document
            </h1>
          </div>
        </div>
      </div>
    </ClientOnly>
  </div>
</template>
```

**Deleted from editor page:**
- All `flattenAndMapXByPage` functions (300+ lines) ❌
- All `compileRecordsForSave` logic ❌
- All Konva canvas setup ❌
- All coordinate transformation logic ❌

**Reduction: ~400 lines deleted** ✅

---

## Phase 5: API Updates (Week 5)

### 5.1 Simplified API Endpoints

**File:** `server/api/annotations/upsert.post.ts` (NEW)

```typescript
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const annotations = await readBody(event)

  // Upsert all annotations (insert or update)
  const { error } = await client
    .from('annotations_v2')
    .upsert(annotations, {
      onConflict: 'id',
      ignoreDuplicates: false,
    })

  if (error) {
    throw createError({
      statusCode: 500,
      message: error.message,
    })
  }

  return { message: 'Annotations saved' }
})
```

**File:** `server/api/annotations/fetch.post.ts` (MODIFY)

```typescript
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const { documentSlug } = await readBody(event)

  const { data, error } = await client
    .from('annotations_v2')
    .select('*')
    .eq('document_url', documentSlug)
    .order('created_at', { ascending: true })

  if (error) {
    return {
      data: [],
      error: error.message,
      statusCode: 500,
    }
  }

  return {
    data: data || [],
    error: null,
    statusCode: 200,
  }
})
```

**File:** `server/api/annotations/del.delete.ts` (MODIFY)

```typescript
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const { id } = await readBody(event)

  const { error } = await client
    .from('annotations_v2')
    .delete()
    .eq('id', id)

  if (error) {
    throw createError({
      statusCode: 500,
      message: error.message,
    })
  }

  return { message: 'Annotation deleted' }
})
```

**Delete old API:**
- `server/api/annotations/insert.ts` - Replaced by upsert

---

## Phase 6: Cleanup & Testing (Week 6)

### 6.1 Delete Old Files

Create `CLEANUP_LIST.md`:

```markdown
# Files to Delete After Migration

## Stores
- [ ] stores/main.ts (30KB)

## Composables
- [ ] composables/useMeasure.ts
- [ ] composables/useArea.ts
- [ ] composables/usePerimeter.ts
- [ ] composables/useLine.ts
- [ ] composables/useFill.ts
- [ ] composables/useText.ts
- [ ] composables/useSelection.ts
- [ ] composables/useSaveTool.ts

## Components
- [ ] components/viewer/canvas/index.vue (Konva canvas)
- [ ] components/viewer/canvas/drawing.vue
- [ ] components/viewer/canvas/menuTools.vue
- [ ] All components/viewer/tools/* (Konva versions)

## Utils
- [ ] utils/normalize.ts (entire file - no longer needed!)
- [ ] Large parts of utils/canvas.ts (coordinate transforms)

## Types
- [ ] types/konva-viewer.ts
- [ ] Old tool types in types/tools.ts (keep Point, SupportedMeasurementUnits)

## Dependencies
Remove from package.json:
- [ ] konva
- [ ] vue-konva

Total files deleted: ~20
Total lines deleted: ~4,000+
```

### 6.2 Testing Checklist

Create `TESTING_CHECKLIST.md`:

```markdown
# Testing Checklist

## Tools - Basic Functionality
- [ ] Measure: Draw 2-point measurement
- [ ] Measure: Shows correct distance in mm
- [ ] Measure: Snap to 45° with Shift
- [ ] Area: Draw polygon (3+ points)
- [ ] Area: Shows correct area in m²
- [ ] Area: Snap to close near start
- [ ] Area: Cancel with Escape
- [ ] Perimeter: Draw closed perimeter
- [ ] Perimeter: Shows individual segment lengths
- [ ] Perimeter: Shows total perimeter
- [ ] Line: Draw simple line
- [ ] Fill: Click to add fill annotation
- [ ] Text: Click to add text
- [ ] Text: Double-click to edit

## Interactions
- [ ] Select annotation by clicking
- [ ] Delete with Delete/Backspace key
- [ ] Hover effects work
- [ ] Multiple annotations on same page
- [ ] Annotations persist across page changes

## PDF Features (Should work unchanged)
- [ ] Zoom in/out
- [ ] Pan PDF
- [ ] Multi-page navigation
- [ ] Page thumbnails
- [ ] Scale detection

## Display
- [ ] Annotations render at all zoom levels
- [ ] Labels readable at all zooms
- [ ] Colors configurable in settings
- [ ] Show/hide annotations toggle

## Data Persistence
- [ ] Auto-save works (wait 5s after change)
- [ ] Save on navigation
- [ ] Load on page load
- [ ] Annotations survive page refresh

## Performance
- [ ] 100 annotations render smoothly
- [ ] Zoom/pan remains smooth with annotations
- [ ] No lag when drawing
- [ ] No memory leaks (check dev tools)

## Edge Cases
- [ ] Works on different DPI screens
- [ ] Works with browser zoom (Ctrl++)
- [ ] Works on different PDF scales (1:50, 1:100, etc.)
- [ ] Handles PDF rotation
- [ ] Works with very large PDFs
```

### 6.3 Performance Testing

Create performance test:

**File:** `tests/performance.spec.ts` (NEW)

```typescript
import { test, expect } from '@nuxt/test-utils'

test('SVG annotation performance', async () => {
  const annotationStore = useAnnotationStore()
  const start = performance.now()

  // Create 100 annotations
  for (let i = 0; i < 100; i++) {
    annotationStore.addAnnotation({
      id: `test-${i}`,
      type: 'measure',
      pageNum: 1,
      points: [
        { x: i * 10, y: 100 },
        { x: i * 10 + 50, y: 100 }
      ],
      distance: 50,
      midpoint: { x: i * 10 + 25, y: 100 }
    })
  }

  const end = performance.now()
  const duration = end - start

  // Should complete in under 100ms
  expect(duration).toBeLessThan(100)
  expect(annotationStore.annotations.length).toBe(100)
})
```

---

## Phase 7: Migration & Deployment (Week 7-8)

### 7.1 Data Migration Script

**File:** `scripts/migrate-annotations.ts` (NEW)

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function migrateAnnotations() {
  console.log('Starting annotation migration...')

  // 1. Fetch all old annotations
  const { data: oldAnnotations, error: fetchError } = await supabase
    .from('annotations')
    .select('*')

  if (fetchError) {
    console.error('Error fetching old annotations:', fetchError)
    return
  }

  console.log(`Found ${oldAnnotations.length} annotations to migrate`)

  // 2. Transform to new format
  const newAnnotations = oldAnnotations.map(old => {
    const content = JSON.parse(old.content)
    const toolType = old.type.replace('Tool', '') // 'measureTool' -> 'measure'

    // Data is already in correct format (no DPR normalization needed in SVG!)
    return {
      id: old.id,
      document_url: old.document_url,
      author_id: old.author_id,
      page_num: old.page_num,
      type: toolType,
      data: {
        id: old.id,
        type: toolType,
        pageNum: old.page_num,
        ...content,
      },
      created_at: old.created_at,
      updated_at: old.updated_at || old.created_at,
    }
  })

  // 3. Insert in batches
  const batchSize = 100
  for (let i = 0; i < newAnnotations.length; i += batchSize) {
    const batch = newAnnotations.slice(i, i + batchSize)

    const { error: insertError } = await supabase
      .from('annotations_v2')
      .insert(batch)

    if (insertError) {
      console.error(`Error inserting batch ${i / batchSize}:`, insertError)
    } else {
      console.log(`Migrated batch ${i / batchSize + 1}/${Math.ceil(newAnnotations.length / batchSize)}`)
    }
  }

  console.log('Migration complete!')
}

migrateAnnotations()
```

Run migration:
```bash
tsx scripts/migrate-annotations.ts
```

### 7.2 Deployment Checklist

```markdown
# Deployment Steps

## Pre-Deployment
- [ ] All tests passing
- [ ] Feature complete (100% feature parity)
- [ ] Performance validated (100 annotations smooth)
- [ ] Code reviewed
- [ ] Database migration script tested

## Deployment
- [ ] Create backup of production database
- [ ] Run migration script on production
- [ ] Deploy new code to production
- [ ] Monitor error logs for 24h
- [ ] Test critical paths in production

## Post-Deployment
- [ ] Verify old annotations migrated correctly
- [ ] Verify new annotations save/load
- [ ] Monitor performance metrics
- [ ] Collect user feedback

## Rollback Plan (if needed)
- [ ] Keep old Konva code in git tag
- [ ] Keep old database table (don't drop)
- [ ] Can rollback code deployment
- [ ] Can switch API to old table
```

---

## Summary: Before & After

### Code Stats

| Metric | Before (Konva) | After (SVG) | Reduction |
|--------|---------------|-------------|-----------|
| **Stores** | 35KB (main.ts) | 5KB (annotations.ts) | **86%** ✅ |
| **Composables** | 1,700 lines | 540 lines | **68%** ✅ |
| **Utils** | 800 lines | 400 lines | **50%** ✅ |
| **Components** | 1,200 lines | 600 lines | **50%** ✅ |
| **Editor Page** | 480 lines | 150 lines | **69%** ✅ |
| **Total Code** | ~4,180 lines | ~1,695 lines | **59%** ✅ |

### Complexity Reduction

**Eliminated:**
- ❌ Dual-canvas synchronization
- ❌ Coordinate transformations (3 systems)
- ❌ Device pixel ratio normalization
- ❌ Konva stage/transformer management
- ❌ Complex flattenAndMap functions
- ❌ Deep nested state structure
- ❌ 50+ store actions

**Gained:**
- ✅ Single coordinate system (SVG = PDF)
- ✅ Flat annotation array
- ✅ 10 simple store actions
- ✅ Composable factory pattern
- ✅ CSS-based styling
- ✅ Better performance
- ✅ Easier to extend

### Timeline

- **Week 1:** Setup & new state management
- **Week 2:** Core composables
- **Week 3-4:** Tool migration
- **Week 4-5:** Component migration
- **Week 5:** API updates
- **Week 6:** Cleanup & testing
- **Week 7-8:** Migration & deployment

**Total: 7-8 weeks**

---

---

## POC Session Results (2025-01-13)

### ✅ What We Accomplished

Successfully built a working proof-of-concept SVG editor that demonstrates the core architecture:

1. **Database Setup** ✅
   - Created `annotations_v2` table with simplified JSONB schema
   - Applied migrations to local Supabase
   - Seeded 6 test annotations (measure, area, perimeter, line, fill, text)

2. **New Stores** ✅
   - Created simplified `stores/annotations.ts` (~150 lines vs 900+)
   - Flat array structure, 10 actions vs 50+
   - Modified `stores/renderer.ts` with SSR guards

3. **PDF Rendering** ✅
   - Fixed `usePDF` composable to watch for changes
   - Created `SimplePdfViewer.vue` component
   - PDF renders successfully from Supabase storage

4. **SVG Layer** ✅
   - Created `SvgAnnotationLayer.vue` component
   - Integrated all 6 tool components
   - **Scroll/Zoom Sync Working** - Both PDF and SVG use CSS transforms
   - Transform approach: `translate(scrollLeft, scrollTop) scale(scale)`

5. **Tool Composables** ✅
   - Created all 6 tool composables in `composables/tools/`
   - useMeasureTool, useAreaTool, usePerimeterTool, useLineTool, useFillTool, useTextTool
   - Fixed all missing imports (calculations, SVG utilities)

6. **API Integration** ✅
   - Annotations load successfully from database (6 items)
   - URL encoding/decoding fixed in both fetch and upsert endpoints
   - Auto-save with debounce working

7. **Route Setup** ✅
   - Created `/view-svg/[file]` test route
   - PDF displays with annotations overlay
   - Scroll and zoom synchronization working perfectly

### ⚠️ Known Issues

1. **Drawing Not Working** - Mouse events not creating new annotations
   - Existing annotations from DB display correctly
   - But clicking to draw new annotations doesn't work
   - Need to debug event handlers and coordinate transformation

2. **Hydration Warnings** - SSR/client mismatch warnings (non-blocking)
   - Can be fixed by wrapping more components in ClientOnly

### 🎯 Next Session Goals

1. **Fix Tool Drawing** (HIGH PRIORITY)
   - Debug why handleClick events not creating annotations
   - Verify getSvgPoint coordinate transformation
   - Test mouse event flow in SvgAnnotationLayer

2. **Complete Tool Testing**
   - Test each of 6 tools can create new annotations
   - Verify snap-to-close for polygons
   - Verify Shift+45° snapping
   - Verify Escape to cancel

3. **Integrate into Main Editor**
   - Move working SVG layer to `/editor/[projectId]/[file]` route
   - Remove Konva canvas components
   - Hook up with existing UI (menu, sidebar, etc.)

4. **Cleanup**
   - Delete old Konva files
   - Remove konva/vue-konva from package.json
   - Update existing components to use new stores

### 📝 Key Learnings

1. **SVG Coordinate System** - Much simpler than Konva
   - No need for device pixel ratio normalization
   - No dual-canvas synchronization
   - CSS transforms handle everything

2. **usePDF Fix** - Needed to add watch for reactive source
   ```typescript
   if (isRef(src)) {
     watch(src, (newSrc) => processLoadingTask(newSrc), { immediate: true })
   }
   ```

3. **Transform Sync** - Both PDF and SVG use same transform
   ```typescript
   transform: `translate(${scrollLeft}px, ${scrollTop}px) scale(${scale})`
   ```

4. **Store Simplification** - Massive reduction in complexity
   - Before: 30KB main store with nested state
   - After: 5KB annotations store with flat array
   - 86% code reduction!

### 🔄 Architecture Validation

The POC validates the planned architecture:
- ✅ Simplified state management works
- ✅ SVG overlay approach works
- ✅ Single coordinate system works
- ✅ CSS-based positioning/scaling works
- ✅ Flat annotation array works
- ✅ JSONB storage works

**Ready to proceed with full migration once drawing is fixed!**

---

## Next Steps

1. **Fix drawing functionality** - Debug event handlers
2. **Complete tool testing** - All 6 tools working
3. **Integrate into main editor** - Replace Konva
4. **Delete old code** - Clean up Konva files
5. **Deploy** - Test in production

**Current Status: POC Complete (~80%), Drawing Debug Needed**
