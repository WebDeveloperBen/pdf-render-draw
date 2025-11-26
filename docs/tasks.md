# Tasks

## Test Coverage & Quality

### 1. Fix Failing Unit Tests

**Priority:** High
**Status:** � To Do

Currently 12 tests are failing across 5 test files:

#### Annotation Validation Tests (`tests/error-handling/annotation-validation.spec.ts`)
Tests expect `addAnnotation()` to throw errors for invalid annotations, but validation was changed to be more lenient:
- `should throw error when measurement has wrong number of points (3 instead of 2)`
- `should throw error when area annotation has less than 3 points`
- `should throw error when perimeter has empty segments array`

**Fix options:**
1. Update `validateAnnotation()` in `stores/annotations.ts` to throw on these edge cases
2. Update tests to match current validation behavior (log warning instead of throw)

#### Rotation Tests (`tests/rotation/fill-rotation-basic.spec.ts`)
- `should allow user to rotate measurement annotation and see updated visual` - NaN issue with rotation calculations

**Tasks:**
- [ ] Review `validateAnnotation()` function behavior
- [ ] Decide: strict validation (throw) vs lenient (warn + reject)
- [ ] Update tests or validation logic accordingly
- [ ] Fix NaN issue in rotation test (likely missing data in test fixture)
- [ ] Ensure all 703 tests pass

---

### 2. E2E Testing with Playwright

**Priority:** High
**Status:** � To Do

Create comprehensive E2E tests using Playwright to validate visual and interactive behavior.

#### 2.1 Transform Handle Tests

**File:** `tests/e2e/transform-handles.spec.ts`

Test that transform handles render correctly and respond to user interaction:
- [ ] Handles appear when annotation is selected
- [ ] Correct number of handles for each annotation type
- [ ] Handles positioned correctly at corners/edges
- [ ] Handles scale with viewport zoom
- [ ] Rotation handle appears and functions
- [ ] Handles disappear when deselected

#### 2.2 Scaling Tests

**File:** `tests/e2e/annotation-scaling.spec.ts`

Test scaling behavior for all annotation types:
- [ ] **Fill**: Scale from corner handles, maintains aspect ratio with shift
- [ ] **Text**: Scale updates width/height, font remains readable
- [ ] **Measure**: Endpoints move, distance recalculates
- [ ] **Area**: Polygon points scale proportionally
- [ ] **Perimeter**: Points scale proportionally
- [ ] **Line**: Endpoints scale from center
- [ ] **Count**: Position and radius scale

Edge cases:
- [ ] Minimum size constraints
- [ ] Scale from different handles (NW, NE, SE, SW)
- [ ] Scale while rotated
- [ ] Multi-select scaling

#### 2.3 Rotation Tests

**File:** `tests/e2e/annotation-rotation.spec.ts`

Test rotation behavior:
- [ ] **Single annotation**: Rotate around center
- [ ] **Multi-select**: Rotate around group center
- [ ] Rotation handle drag interaction
- [ ] Rotation visual feedback during drag
- [ ] Derived values recalculate (midpoint, labelRotation)
- [ ] Labels remain readable (counter-rotation)

Edge cases:
- [ ] Rotate Fill (x, y, width, height + rotation)
- [ ] Rotate Text (same structure)
- [ ] Rotate point-based annotations (points transformed)
- [ ] Rotation persists through save/load

#### 2.4 Moving/Dragging Tests

**File:** `tests/e2e/annotation-moving.spec.ts`

Test move behavior:
- [ ] **Single annotation**: Click and drag moves annotation
- [ ] **Multi-select**: All selected annotations move together
- [ ] Move maintains relative positions in group
- [ ] Boundary constraints (stay within viewport)
- [ ] Move updates all derived values
- [ ] Move works at different zoom levels

Edge cases:
- [ ] Move while rotated
- [ ] Move after scaling
- [ ] Move measurement updates midpoint
- [ ] Move area updates centroid

#### 2.5 Selection Tests

**File:** `tests/e2e/annotation-selection.spec.ts`

Test selection behavior:
- [ ] Click to select single annotation
- [ ] Click empty area deselects
- [ ] Shift+click adds to selection
- [ ] Ctrl/Cmd+click toggles selection
- [ ] Marquee/box selection (if implemented)
- [ ] Selection visual feedback (handles appear)
- [ ] Tab cycles through annotations

#### 2.6 Tool Interaction Tests

**File:** `tests/e2e/tool-interactions.spec.ts`

Test creating annotations with each tool:
- [ ] **Fill**: Click-drag creates rectangle
- [ ] **Text**: Click creates text, double-click to edit
- [ ] **Measure**: Click-click creates measurement
- [ ] **Area**: Click points, close polygon
- [ ] **Perimeter**: Click points, finish
- [ ] **Line**: Click-click creates line
- [ ] **Count**: Click places numbered marker

#### 2.7 Keyboard Shortcuts Tests

**File:** `tests/e2e/keyboard-shortcuts.spec.ts`

Test keyboard interaction:
- [ ] Delete/Backspace removes selected
- [ ] Escape deselects
- [ ] Cmd/Ctrl+Z undos
- [ ] Cmd/Ctrl+Shift+Z redos
- [ ] Cmd/Ctrl+C copies
- [ ] Cmd/Ctrl+V pastes
- [ ] Cmd/Ctrl+D duplicates

---

### 3. Unit Test Coverage Goals

**Priority:** Medium
**Status:** � To Do

Achieve 100% coverage on critical paths:

#### Stores
- [ ] `stores/annotations.ts` - CRUD, validation, selection
- [ ] `stores/history.ts` - Undo/redo commands
- [ ] `stores/renderer.ts` - Zoom, rotation, page navigation

#### Utils
- [ ] `utils/editor/bounds.ts` - Bounds calculations
- [ ] `utils/editor/derived-values.ts` - Type guards, recalculation
- [ ] `utils/editor/transform.ts` - Math functions

#### Composables
- [ ] `composables/tools/*` - Each tool's logic
- [ ] `composables/editor/*` - Transform, bounds, selection

---

## Test Commands

```bash
# Run all unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test tests/error-handling/annotation-validation.spec.ts

# Run E2E tests (Playwright)
pnpm exec playwright test

# Run E2E with UI
pnpm exec playwright test --ui
```

---

## Test Fixtures

Create reusable test fixtures in `tests/fixtures/`:

```typescript
// tests/fixtures/annotations.ts
export const createTestFill = (overrides = {}) => ({
  id: 'test-fill-1',
  type: 'fill',
  pageNum: 1,
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  color: '#ff0000',
  opacity: 0.5,
  rotation: 0,
  ...overrides
})

export const createTestMeasurement = (overrides = {}) => ({
  id: 'test-measure-1',
  type: 'measure',
  pageNum: 1,
  points: [{ x: 100, y: 100 }, { x: 200, y: 100 }],
  distance: 100,
  midpoint: { x: 150, y: 100 },
  labelRotation: 0,
  rotation: 0,
  ...overrides
})

// ... more fixtures
```

---

## PDF.js Implementation Enhancement

### 4. PDF.js EventBus & Viewer Layer Integration

**Priority:** Medium
**Status:** 🔍 Research Required

#### Current Implementation

The application uses **pdfjs-dist v5.4.394** with only the **core library**:

```typescript
// Current: Core library only
import * as PDFJS from "pdfjs-dist"
import type { PDFDocumentProxy } from "pdfjs-dist"
```

**What we have:**
- `PDFJS.getDocument()` - Load PDF documents
- `page.getViewport()` - Get page dimensions
- `page.render()` - Render to canvas
- Web Worker for background processing
- Progress/error callbacks

**What we DON'T have:**
- EventBus for inter-component messaging
- Built-in text selection layer
- Built-in annotation layer
- Find/search functionality
- Page navigation events
- Zoom/scale change events

#### The Two Layers of PDF.js

PDF.js has two distinct layers:

| Layer | Package Path | Purpose |
|-------|--------------|---------|
| **Core** | `pdfjs-dist` | PDF parsing, rendering, worker |
| **Viewer** | `pdfjs-dist/web/pdf_viewer` | EventBus, PDFViewer, text layer, annotations |

The **EventBus is part of the Viewer layer**, not the Core layer.

#### Option A: Import EventBus from Viewer Layer

Add the viewer components to access EventBus:

```typescript
// Import viewer components
import { EventBus, PDFViewer, PDFPageView } from 'pdfjs-dist/web/pdf_viewer'

// Create event bus
const eventBus = new EventBus()

// Listen for events
eventBus.on('pagesinit', () => console.log('Pages initialized'))
eventBus.on('pagechanging', (e) => console.log('Page:', e.pageNumber))
eventBus.on('scalechanging', (e) => console.log('Scale:', e.scale))

// Dispatch custom events
eventBus.dispatch('find', {
  query: 'search term',
  highlightAll: true,
  caseSensitive: false
})
```

**Pros:**
- Access to official PDF.js event system
- Built-in events for common operations
- Can dispatch events to PDF.js internals (find, zoom, etc.)

**Cons:**
- May require restructuring from custom canvas to PDFViewer component
- Additional bundle size (~50-100KB)
- Need to handle CSS for viewer components
- Potential conflicts with custom annotation layer

**Available Events:**
- `documentloaded` - Document fully loaded
- `pagesinit` - All pages initialized
- `pagechanging` - Page navigation
- `scalechanging` - Zoom level change
- `rotationchanging` - Rotation change
- `textlayerrendered` - Text layer ready
- `annotationlayerrendered` - Annotation layer ready
- `find` - Search dispatch
- `updatefindcontrol` - Search UI updates

#### Option B: Create Custom Event System

Build a Vue-native event system that mirrors EventBus functionality:

```typescript
// composables/usePdfEventBus.ts
import { createEventHook } from '@vueuse/core'

export function usePdfEventBus() {
  const pageChange = createEventHook<{ page: number; previous: number }>()
  const scaleChange = createEventHook<{ scale: number }>()
  const documentLoaded = createEventHook<{ totalPages: number }>()
  const renderComplete = createEventHook<{ page: number }>()

  return {
    // Triggers
    onPageChange: pageChange.on,
    onScaleChange: scaleChange.on,
    onDocumentLoaded: documentLoaded.on,
    onRenderComplete: renderComplete.on,

    // Dispatchers
    emitPageChange: pageChange.trigger,
    emitScaleChange: scaleChange.trigger,
    emitDocumentLoaded: documentLoaded.trigger,
    emitRenderComplete: renderComplete.trigger,
  }
}
```

**Pros:**
- Full control over event types and payloads
- Vue-native reactivity
- No additional dependencies
- Works with existing custom canvas implementation
- Lighter weight

**Cons:**
- Must manually emit events at appropriate times
- No access to PDF.js internal events
- Can't dispatch to PDF.js internals (find, etc.)

#### Option C: Hybrid Approach

Use both systems - custom events for Vue/application layer, PDF.js EventBus for PDF-specific features:

```typescript
// Wrap PDF.js EventBus with Vue reactivity
export function usePdfJsEventBus() {
  const eventBus = new EventBus()

  // Proxy PDF.js events to Vue refs
  const currentPage = ref(1)
  const scale = ref(1)

  eventBus.on('pagechanging', (e) => {
    currentPage.value = e.pageNumber
  })

  eventBus.on('scalechanging', (e) => {
    scale.value = e.scale
  })

  return {
    eventBus,  // Raw access for PDF.js components
    currentPage,
    scale,
    // Helper methods
    find: (query: string) => eventBus.dispatch('find', { query, highlightAll: true }),
    goToPage: (page: number) => eventBus.dispatch('pagenumberchange', { value: page }),
  }
}
```

#### Research Tasks

- [ ] **Verify viewer imports work with v5.x** - Import paths changed between versions
  ```bash
  # Test import
  import { EventBus } from 'pdfjs-dist/web/pdf_viewer'
  ```

- [ ] **Check bundle impact** - Measure size increase from viewer layer
  ```bash
  # Before/after build size comparison
  pnpm build && ls -la .output/public/_nuxt/
  ```

- [ ] **Test CSS requirements** - Viewer components need CSS
  ```typescript
  // May need to import
  import 'pdfjs-dist/web/pdf_viewer.css'
  ```

- [ ] **Evaluate PDFViewer vs custom canvas** - Compare features:
  | Feature | Custom Canvas | PDFViewer Component |
  |---------|---------------|---------------------|
  | Rendering | Manual | Automatic |
  | Text selection | None | Built-in |
  | Find/search | None | Built-in |
  | Annotations | Custom layer | Built-in layer |
  | Event system | Custom | EventBus |
  | Bundle size | Smaller | Larger |
  | Flexibility | High | Medium |

- [ ] **Prototype EventBus integration** - Create proof of concept
  - Import EventBus
  - Wire to existing renderer store
  - Test event dispatch/receive

#### Implementation Decision Tree

```
Do you need PDF.js internal features (find, text selection)?
├── YES → Option A or C (use viewer layer)
│   └── Can you replace custom canvas with PDFViewer?
│       ├── YES → Option A (full viewer adoption)
│       └── NO → Option C (hybrid - EventBus only)
└── NO → Option B (custom event system)
    └── Just need inter-component messaging
```

#### Recommended Approach

Based on current architecture (custom canvas + annotation layer), **Option B or C** is recommended:

1. **Start with Option B** - Custom event system
   - No breaking changes
   - Works with existing implementation
   - Add events incrementally

2. **Evaluate Option C later** - If you need:
   - Built-in text selection
   - Find/search functionality
   - Access to PDF.js annotation layer

#### Files to Modify

If implementing Option A/C:
- `composables/usePDF.ts` - Add EventBus creation
- `components/Layers/PdfViewer.vue` - Wire EventBus to rendering
- `stores/renderer.ts` - Integrate with EventBus events
- `nuxt.config.ts` - May need CSS import handling

If implementing Option B:
- Create `composables/usePdfEventBus.ts`
- Update `stores/renderer.ts` to emit events
- Update `components/Layers/PdfViewer.vue` to emit render events

#### References

- [PDF.js Third-party Viewer Usage](https://github.com/mozilla/pdf.js/wiki/Third-party-viewer-usage)
- [EventBus API Discussion](https://github.com/mozilla/pdf.js/issues/10584)
- [Custom Event Implementation](https://stackoverflow.com/questions/32660796/does-pdf-js-raise-an-event-as-i-browse-between-pages)
- [EventBus Source Code](https://www.terminalworks.com/web-pdf-viewer-jsdoc/event_bus.js.html)

---

### 5. usePDF Composable Audit & Optimization

**Priority:** Medium
**Status:** 🔍 Audit Complete - Implementation Pending

#### Current Usage Analysis

**Call Sites:** Only 2 files call `usePDF()`:

| File | Usage | Callbacks |
|------|-------|-----------|
| `pages/editor.vue` | `usePDF(pdfUrl)` | None |
| `components/DrawingEditor.vue` | `usePDF(pdfString)` | None |

**Prop Chain:** PDF is forwarded through 4 components:
```
usePDF() → EditorDrawingPad → DrawingPad → LayersPdfViewer
```

#### Identified Issues

##### Issue #1: Duplicate `totalPages` State (Medium)

Two sources of truth exist:
```typescript
// Source A: usePDF composable
const { pdf, totalPages } = usePDF(pdfUrl)  // pages/editor.vue uses this

// Source B: Renderer store
rendererStore.setTotalPages(pdfDoc.numPages)  // Set by LayersPdfViewer
rendererStore.getTotalPages  // Used by PdfPageSidebar, DrawingEditor
```

**Impact:** Confusing, potential for stale values, inconsistent patterns between files.

##### Issue #2: No Error Handling (Medium)

Neither call site passes error callbacks:
```typescript
// Current - silent failures
const { pdf } = usePDF(pdfUrl)

// Should be
const { pdf } = usePDF(pdfUrl, {
  onError: (err) => toast.error('Failed to load PDF'),
  onProgress: (p) => loadingProgress.value = p.loaded / p.total
})
```

##### Issue #3: Deep Prop Drilling (Low)

PDF prop forwarded through 3 intermediate components that don't use it:
```
editor.vue → EditorDrawingPad → DrawingPad → LayersPdfViewer
                 ↑                  ↑
            Just forwards      Just forwards
```

##### Issue #4: Worker Config on Every Call (Low)

Worker configuration check runs on every `usePDF()` call:
```typescript
export function usePDF(...) {
  configWorker(PDFWorker)  // Runs every time, but only configures once
  // ...
}
```

Not a bug, but could be cleaner.

#### Optimization Options

##### Option A: Convert to Nuxt Plugin

Initialize PDF.js worker once at app startup:

```typescript
// plugins/pdfjs.client.ts
import * as PDFJS from 'pdfjs-dist'
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min?url'

export default defineNuxtPlugin(() => {
  // Configure worker once at startup
  if (typeof window !== 'undefined') {
    PDFJS.GlobalWorkerOptions.workerPort = new Worker(PDFWorker, { type: 'module' })
  }

  return {
    provide: {
      pdfjs: PDFJS
    }
  }
})
```

**Pros:**
- Clear initialization timing
- Available via `useNuxtApp().$pdfjs`
- No redundant config checks

**Cons:**
- Loads PDF.js even if no PDF is used
- Plugin runs on every page load

##### Option B: Provide/Inject Pattern

Centralize PDF state at app level, inject where needed:

```typescript
// composables/usePdfProvider.ts
const PDF_INJECTION_KEY = Symbol('pdf') as InjectionKey<{
  pdf: Ref<PDFDocumentLoadingTask | null>
  totalPages: Ref<number>
  loadPdf: (src: UsePDFSrc) => void
}>

export function providePdf() {
  const pdf = ref<PDFDocumentLoadingTask | null>(null)
  const totalPages = ref(0)

  function loadPdf(src: UsePDFSrc) {
    // ... loading logic
  }

  provide(PDF_INJECTION_KEY, { pdf, totalPages, loadPdf })
  return { pdf, totalPages, loadPdf }
}

export function usePdfContext() {
  const ctx = inject(PDF_INJECTION_KEY)
  if (!ctx) throw new Error('PDF context not provided')
  return ctx
}
```

**Usage:**
```vue
<!-- App.vue or layout -->
<script setup>
providePdf()
</script>

<!-- Any descendant component -->
<script setup>
const { pdf, totalPages } = usePdfContext()
</script>
```

**Pros:**
- Single source of truth
- No prop drilling
- Any component can access PDF

**Cons:**
- More complex setup
- Requires provider at correct level

##### Option C: Move PDF Loading to Store (Recommended)

Let renderer store own all PDF state with **lazy worker initialization**:

```typescript
// stores/renderer.ts
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import type { UsePDFSrc } from '~/types/pdf'

export const useRendererStore = defineStore('renderer', () => {
  const pdf = ref<PDFDocumentLoadingTask | null>(null)
  const documentProxy = ref<PDFDocumentProxy | null>(null)
  const totalPages = ref(0)
  const loadingProgress = ref(0)
  const loadError = ref<Error | null>(null)

  // Track worker initialization (lazy - only when first PDF loads)
  let workerConfigured = false

  /**
   * Configure PDF.js worker on first use only
   * This ensures the worker is NOT loaded on non-editor pages
   */
  async function ensureWorkerConfigured() {
    if (workerConfigured || typeof window === 'undefined') return

    // Dynamic import - only loads pdfjs when needed
    const PDFJS = await import('pdfjs-dist')
    const PDFWorker = (await import('pdfjs-dist/build/pdf.worker.min?url')).default

    PDFJS.GlobalWorkerOptions.workerPort = new Worker(PDFWorker, { type: 'module' })
    workerConfigured = true

    return PDFJS
  }

  async function loadPdf(src: UsePDFSrc) {
    loadError.value = null
    loadingProgress.value = 0

    try {
      // Lazy load worker + pdfjs only when loadPdf is called
      const PDFJS = await ensureWorkerConfigured()
      if (!PDFJS) return

      const loadingTask = PDFJS.getDocument(src)
      loadingTask.onProgress = (p) => {
        loadingProgress.value = p.loaded / (p.total || 1)
      }

      const doc = await loadingTask.promise
      pdf.value = loadingTask
      documentProxy.value = markRaw(doc)
      totalPages.value = doc.numPages
    } catch (err) {
      loadError.value = err as Error
      console.error('[renderer] PDF load failed:', err)
    }
  }

  return {
    pdf,
    documentProxy,
    totalPages,
    loadingProgress,
    loadError,
    loadPdf
  }
})
```

**Key: Lazy Worker Loading**

The worker is only initialized when `loadPdf()` is first called:
- Landing page → No worker loaded
- Pricing page → No worker loaded
- Editor page → `loadPdf()` called → Worker initializes → PDF loads

This is achieved via:
1. Dynamic `import('pdfjs-dist')` inside `ensureWorkerConfigured()`
2. Worker only created on first `loadPdf()` call
3. Subsequent calls reuse the configured worker

**Usage:**
```vue
<script setup>
const renderer = useRendererStore()
renderer.loadPdf('/document.pdf')
</script>

<template>
  <div v-if="renderer.loadError">Error: {{ renderer.loadError.message }}</div>
  <div v-else-if="!renderer.pdf">Loading... {{ renderer.loadingProgress }}%</div>
  <LayersPdfViewer v-else />
</template>
```

**Pros:**
- Single source of truth (store already manages PDF state)
- Built-in loading/error states
- No prop drilling
- Composable becomes unnecessary

**Cons:**
- Larger store responsibility
- Store becomes less focused

##### Option D: Keep Composable, Fix Issues

Minimal changes to current architecture:

```typescript
// composables/usePDF.ts (updated)

// 1. Move worker config to module scope
if (typeof window !== 'undefined') {
  PDFJS.GlobalWorkerOptions.workerPort = new Worker(PDFWorker, { type: 'module' })
}

export function usePDF(
  src: UsePDFSrc | Ref<UsePDFSrc>,
  options: UsePDFOptions = {}
) {
  const rendererStore = useRendererStore()

  // 2. Use store as single source of truth
  const totalPages = computed(() => rendererStore.totalPages)

  // 3. Add default error handling
  const defaultOnError = (err: Error) => {
    console.error('[usePDF] Load failed:', err)
  }

  function processLoadingTask(source: UsePDFSrc) {
    if (!source) return
    const loadingTask = PDFJS.getDocument(source)

    if (options.onProgress) {
      loadingTask.onProgress = options.onProgress
    }

    loadingTask.promise.then(
      (doc) => {
        pdf.value = doc.loadingTask
        // 4. Update store (single source of truth)
        rendererStore.setDocumentProxy(markRaw(doc))
        rendererStore.setTotalPages(doc.numPages)
      },
      options.onError ?? defaultOnError
    )
  }

  // ... rest unchanged
}
```

**Pros:**
- Minimal changes
- Backward compatible
- Fixes immediate issues

**Cons:**
- Doesn't solve prop drilling
- Still have composable + store pattern

#### Recommendation

**Start with Option D** (minimal fixes), then evaluate **Option C** (store-based) if more centralization is needed.

#### Implementation Tasks

##### Phase 1: Quick Fixes
- [ ] Move worker config to module scope (remove per-call check)
- [ ] Add default error handler with console.error
- [ ] Remove `totalPages` from composable return, use store only
- [ ] Update `pages/editor.vue` to use `rendererStore.totalPages`
- [ ] Add `onError` callback in both call sites

##### Phase 2: Evaluate Architecture
- [ ] Decide: keep composable vs move to store
- [ ] If keeping composable, consider provide/inject for prop drilling
- [ ] If moving to store, refactor `usePDF` into store action
- [ ] Update all consumers

##### Phase 3: Enhanced Features
- [ ] Add loading progress indicator
- [ ] Add retry logic for failed loads
- [ ] Add PDF caching for previously loaded documents
- [ ] Support for cancelling in-flight loads

#### Files to Modify

| File | Changes |
|------|---------|
| `composables/usePDF.ts` | Worker config, error handling, store integration |
| `pages/editor.vue` | Use store for totalPages, add onError |
| `components/DrawingEditor.vue` | Add onError callback |
| `stores/renderer.ts` | Potentially add loadPdf action |

#### Current vs Proposed Data Flow

**Current (fragmented):**
```
usePDF() ─────────────────────────────────────────┐
    │                                              │
    ├─► pdf ref ──► prop ──► prop ──► prop ──► LayersPdfViewer
    │                                              │
    └─► totalPages ref ◄───────────────────────────┘
                                     (also sets store)

rendererStore.totalPages ◄── LayersPdfViewer sets this too
```

**Proposed (unified):**
```
usePDF() or rendererStore.loadPdf()
    │
    └─► rendererStore
            ├─► pdf
            ├─► documentProxy
            ├─► totalPages (single source)
            ├─► loadingProgress
            └─► loadError

All components read from store, no prop drilling needed
```

