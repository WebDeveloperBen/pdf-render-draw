# Performance Review — PDF Annotator Editor

> Red team review conducted 2026-03-14. Findings ranked by severity and effort.

---

## TODO List

- [x] **P1** Remove debug deep watcher + console.log pollution from hot paths
- [x] **P1** Add PDF page cleanup (`page.cleanup()`) and `DocumentProxy.destroy()` on unmount
- [x] **P2** Index annotation lookups (replace O(n) filters with computed Maps)
- [x] **P2** Remove unconditional `getScreenCTM()` call from every mousemove
- [x] **P2** Migrate MouseEvent → PointerEvent for pen/touch/stylus support
- [x] **P3** Replace full `structuredClone` snapshots in undo with minimal diffs
- [x] **P3** Replace `JSON.stringify` equality check in history recording
- [x] **P3** Add `touch-action: none` CSS for drawing on tablets
- [x] **P3** Gate reactive cursor tracking behind actual paste intent *(merged into P2 getScreenCTM fix)*
- [x] **P4** Add DPR change listener (`matchMedia`) for multi-monitor support
- [x] **P4** Cap `renderDpr` to prevent canvas buffer overflow at high zoom
- [x] **P4** Implement two-tier zoom (CSS scale → bitmap re-render on settle)
- [ ] **P4** Consider state machine for tool modes instead of string + booleans
- [x] **P5** Remove `v-bind()` in scoped styles for static constants
- [x] **P5** Add RAF batching for mousemove → SVG updates on high-refresh displays

---

## Findings

### 1. Rendering Pipeline

#### [CRITICAL] PDF pages never cleaned up after render
- **File**: `components/Editor/PdfViewer.vue:91`
- **Issue**: `pdfDoc.getPage(pageNum)` called on every render, but `page.cleanup()` / `page.destroy()` never called. PDF.js caches page objects with operator lists and image data internally.
- **Impact**: GPU and heap memory grows linearly with page navigations. On a 100-page PDF where the user browses many pages, this can consume hundreds of MB.
- **Fix**: Store last page ref, clean up before rendering next:
  ```typescript
  const lastPage = ref<PDFPageProxy | null>(null)
  // In renderPage():
  if (lastPage.value) {
    lastPage.value.cleanup()
  }
  const page = await pdfDoc.getPage(pageNum)
  lastPage.value = page
  ```

#### [CRITICAL] PDF DocumentProxy never destroyed on navigation
- **File**: `stores/viewport.ts:298`
- **Issue**: `DocumentProxy.value = markRaw(doc)` set on load. No `doc.destroy()` anywhere. `resetState()` resets primitives but not the document.
- **Impact**: Full PDF document (including worker-side data) remains allocated after leaving editor. 50MB+ PDFs leak for session lifetime.
- **Fix**: Add to `resetState()`:
  ```typescript
  const resetState = async () => {
    await DocumentProxy.value?.destroy()
    DocumentProxy.value = undefined
    pdfLoadingTask.value = null
    // ...existing resets
  }
  ```

#### [HIGH] Full canvas re-render on every zoom increment
- **File**: `PdfViewer.vue:106, 249-263`
- **Issue**: Scale watcher triggers full `renderPage()` with only 100ms debounce. At 5x zoom on DPR 2, canvas buffer is `renderDpr=10` — buffers of ~6000x8000+ pixels.
- **Impact**: Frame drops during continuous zoom. High zoom may exceed GPU texture limits on integrated GPUs.
- **Fix**: Two-tier zoom: CSS scale for intermediate levels (instant, GPU-composited), bitmap re-render after debounce. Cap `renderDpr` to max 4x.

#### [LOW] `canvasStyle` computed triggers debugLog on every recomputation
- **File**: `PdfViewer.vue:35-38`
- **Issue**: `debugLog()` inside computed property. String interpolation + object creation runs on every scale/position change in dev mode.

---

### 2. SVG Layer Alignment & Scaling

**CLEAN** — SVG `viewBox` maps 1:1 to PDF logical dimensions. Both canvas and SVG share identical CSS transform via `viewportStore.getCanvasTransform`. `preserveAspectRatio="xMidYMid meet"` set correctly. `transformOrigin: "center center"` consistent. No alignment issues detected.

---

### 3. Drawing & Interaction Performance

#### [HIGH] `getScreenCTM().inverse()` on every mousemove unconditionally
- **File**: `components/Editor/AnnotationLayer.vue:230-235`
- **Issue**: `handleMove()` runs coordinate conversion on every move to track `lastCursorPosition` for paste — even when no tool is active. Also duplicated inside tool handlers.
- **Impact**: `getScreenCTM()` forces style/layout recalc in some browsers (0.1-0.5ms per call). On high-refresh displays, eats into 16ms frame budget.
- **Fix**: Only track position on paste shortcut, or cache CTM and invalidate on transform changes.

#### [HIGH] MouseEvent used instead of PointerEvent — no pen/stylus support
- **File**: `AnnotationLayer.vue:286-290`
- **Issue**: SVG binds `@mousedown/move/up/leave`. No `@pointerdown/move/up`. Missing `pressure`, `tiltX`, `tiltY`, `pointerType` from `PointerEvent`.
- **Impact**: No pressure sensitivity for pen input. Touch may not fire reliably. Blocks tablet/stylus use case.
- **Fix**: Migrate to PointerEvent handlers, add `touch-action: none`, use `setPointerCapture()`.

#### [MEDIUM] `getAnnotationsByType()` in template v-for v-if — O(n*t) per render
- **File**: `AnnotationLayer.vue:306`
- **Issue**: `annotationStore.getAnnotationsByType(toolDef.type).length > 0` evaluated per tool per render. Full `.filter()` call. 7 tools × n annotations = 7n iterations per cycle.
- **Impact**: Quadratic scaling. At 500 annotations = 3,500 array iterations per render.
- **Fix**: Pre-compute annotation counts per type in a computed Map.

#### [LOW] No RAF scheduling on mousemove → SVG updates
- **Issue**: Tool handlers update reactive refs synchronously. On 120Hz+ displays, redundant DOM work between frames.
- **Impact**: Minor on 60Hz. Noticeable on high-refresh displays with complex annotations.

---

### 4. Memory Management

#### [HIGH] Deep watcher on annotations array in production code
- **File**: `stores/annotations.ts:509-521`
- **Issue**: `watch(annotations, ..., { deep: true })` guarded by `import.meta.client` (NOT `import.meta.env.DEV`). Calls `newVal.map(a => a.type)` + `console.log` on every deep change.
- **Impact**: O(n) on every annotation property change — fires hundreds of times during drag. Creates array + serializes to console on each trigger.
- **Fix**: Gate behind `import.meta.env.DEV` or remove entirely.

#### [MEDIUM] Full `structuredClone` snapshots for every undo step
- **File**: `stores/history.ts:276-277`
- **Issue**: `structuredClone(toRaw(before))` and `structuredClone(toRaw(after))` per changed annotation. 100 undo steps × batch operations = thousands of clones.
- **Impact**: Memory grows with undo depth × annotations per operation. Area annotations with 50+ points are non-trivial to clone.
- **Fix**: Store minimal diffs: `{ id, points }` or `{ id, x, y }` instead of full annotation objects.

#### [MEDIUM] `JSON.stringify` for equality check in undo recording
- **File**: `stores/history.ts:274`
- **Issue**: `.filter(({ before, after }) => JSON.stringify(before) !== JSON.stringify(after))` — serializes two full objects to check equality.
- **Impact**: O(n) serialization per annotation per batch commit on mouseup.
- **Fix**: Compare only mutated fields, or use a dirty flag.

#### [LOW] Raw `console.log` in `getAnnotationsByTypeAndPage` (production)
- **File**: `stores/annotations.ts:40-46`
- **Issue**: Unconditional `console.log` on every call (not behind `debugLog`). Called on every render cycle for tool components.
- **Impact**: Console spam + object retention prevents GC.

---

### 5. State Management & Reactivity

#### [HIGH] Annotation lookup functions are plain functions, not cached
- **File**: `stores/annotations.ts:30-51`
- **Issue**: `getAnnotationsByPage()`, `getAnnotationsByType()`, `getAnnotationById()` are plain functions doing `.filter()/.find()`. Re-run on every reactive dependency change, not cached.
- **Impact**: Combined with template v-for + v-if, causes redundant O(n) scans on tool switch, selection, drawing state change.
- **Fix**: Create indexed computed maps:
  ```typescript
  const annotationsByPage = computed(() => {
    const map = new Map<number, Annotation[]>()
    for (const a of annotations.value) {
      const arr = map.get(a.pageNum) || []
      arr.push(a)
      map.set(a.pageNum, arr)
    }
    return map
  })
  ```

#### [MEDIUM] Reactive store updated on every mousemove for cursor tracking
- **File**: `AnnotationLayer.vue:230-235`
- **Issue**: `viewportStore.setLastCursorPosition()` on every move. Mutates reactive ref, triggers downstream watchers/computeds.
- **Impact**: Any watcher on `lastCursorPosition` re-evaluates on every mouse move. Only used for paste.
- **Fix**: Track in non-reactive variable, snapshot to store only on paste command.

---

### 6. Zoom, Pan & Viewport — Measurement Accuracy

**CLEAN** — Scale chain correct: PDF points → mm (`points / 72 * 25.4`) → real-world (`mm * scale`). All calculations use PDF-space coordinates from SVG viewBox. Zoom-independent via `getScreenCTM().inverse()`. No double-scaling risk. Pan via CSS `translate()` on compositor layer.

---

### 7. Asset & Bundle

**CLEAN** — PDF.js lazily loaded via dynamic import + worker split. Icons bundled inline via `@nuxt/icon` client scanning. Routes auto-chunked by Nuxt 4 groups. SSR disabled. ESNEXT target. No unnecessary polyfills.

#### [LOW] Static CSS constants using reactive `v-bind()` in scoped styles
- **File**: `PdfViewer.vue:329-362`
- **Issue**: `v-bind("ERROR_COLORS.BACKGROUND")` generates reactive inline CSS custom properties for values that never change.

---

### 8. Browser & Device Edge Cases

#### [MEDIUM] No `touch-action: none` on SVG layer
- **File**: `AnnotationLayer.vue` styles
- **Issue**: Browser may interpret touch gestures as scroll/zoom instead of drawing.
- **Impact**: Drawing on tablets unreliable — browser may scroll page or add 300ms click delay.
- **Fix**: Add `touch-action: none` when a drawing tool is active.

#### [LOW] No DPR change listener for multi-monitor
- **File**: `viewport.ts` / `PdfViewer.vue:100`
- **Issue**: `devicePixelRatio` read at render time but no `matchMedia` listener for changes. Moving window between Retina/non-Retina shows wrong DPR until next zoom.
- **Fix**:
  ```typescript
  const dprQuery = matchMedia(`(resolution: ${devicePixelRatio}dppx)`)
  dprQuery.addEventListener('change', () => renderPage(currentPage))
  ```

---

### 9. Architecture & Code Quality

#### [HIGH] 76 raw console.log/warn/error calls in stores + composables
- **Files**: 18 in `stores/`, 58 in `composables/editor/`
- **Issue**: Many in hot paths without `debugLog()` guard. `getAnnotationsByTypeAndPage` (line 40), `updateAnnotation` rotation logging (lines 247-256, 276-280), deep watcher (line 512).
- **Impact**: Production console spam. `console.log` with objects prevents GC until console cleared. Memory leak in long sessions.
- **Fix**: Replace all with `debugLog()` or remove.

#### [MEDIUM] Tool modes use string + booleans instead of state machine
- **File**: `stores/annotations.ts:15-21`
- **Issue**: `activeTool` string, `isDrawing` boolean, `rotationDragDelta`, `isMarqueeSelecting`, `isDragJustFinished()` — independent flags that can reach impossible combinations.
- **Impact**: Defensive checks scattered across handlers. Risk of state bugs as tool complexity grows.
- **Fix**: Consider discriminated union or XState: `{ mode: 'idle' } | { mode: 'drawing', tool } | { mode: 'selecting', marquee } | ...`

#### [LOW] Debug logging for specific annotation type hardcoded in rotation transform
- **File**: `annotations.ts:107-114, 133-143`
- **Issue**: Conditional `debugLog` for `count` type only in `getRotationTransform()`. Leftover debugging code.

---

### 10. UX Performance Signals

#### [MEDIUM] 100ms zoom debounce creates visible blurriness window
- **File**: `PdfViewer.vue:259-263`
- **Issue**: CSS transform scales instantly but canvas re-renders after 100ms. During this window, user sees scaled-up blurry bitmap.
- **Impact**: Every zoom shows brief quality degradation. Continuous zoom = perpetually blurry.
- **Fix**: Increase debounce to 250ms (fewer intermediate renders) or implement two-tier zoom.

---

## Architecture Health Summary

The architecture is **fundamentally sound**. Clear separation between PDF rendering (viewport store), annotation model (annotation store), undo/redo (history store/command pattern), and tool system (composable factory). Coordinates correctly stored in PDF-space with SVG viewBox 1:1 mapping. Lazy PDF.js worker loading and `markRaw()` show performance awareness. Main weaknesses: debug/logging code in hot paths, uncached annotation lookups, and absent PDF.js memory lifecycle management.

## Performance Budget Assessment

**Can hit 60fps** for target use case (building plans, tens to low hundreds of annotations per page) after fixing P1-P2 items. Critical bottleneck is the deep watcher + console.log overhead. SVG approach appropriate for expected annotation density. Two areas that break 60fps under load: continuous zoom re-renders and uncached annotation filtering.
