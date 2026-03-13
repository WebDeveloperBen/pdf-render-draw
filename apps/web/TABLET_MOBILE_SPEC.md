# Tablet & Mobile Device Support — Technical Spec

> PDF Annotator editor: full touch, stylus, and gesture support roadmap.
> Created 2026-03-14.

---

## Current State

The editor was built desktop-first. A recent migration moved all event handling from `MouseEvent` to `PointerEvent` via the shared `EditorInputEvent` type alias. This means **pointer events from stylus, pen, and touch are now received** by all handlers — but receiving events is not the same as handling them correctly.

### What works today

| Feature | Desktop | Tablet stylus | Touch (finger) |
|---|---|---|---|
| Draw annotations | Yes | Yes | Partial — single finger only, no gesture rejection |
| Select / tap | Yes | Yes | Yes |
| Drag move | Yes | Yes | Unreliable — no pointer capture, events lost if finger leaves element |
| Resize handles | Yes | Yes | Unreliable — same pointer capture issue, handles too small for fingers |
| Rotation handle | Yes | Yes | Unreliable — handle dot is 4px radius |
| Zoom | Ctrl+Wheel / trackpad | N/A | No — pinch-to-zoom not implemented, browser zoom disabled |
| Pan | Space+click / middle mouse / wheel | Space+click | No — no two-finger pan |
| Marquee select | Yes | Yes | Conflicts with scroll gestures |
| Undo/redo | Ctrl+Z | Ctrl+Z | No keyboard on mobile |
| Hover feedback | Yes | Yes (pen hover) | No — touch has no hover state |
| Double-click edit | Yes | Yes | Sluggish — 200ms delay before single-click executes |
| Toolbar | Yes | Yes | No mobile adaptation — icons too small, no collapsing |

### Key gaps

1. **No pointer capture** — Drags fail when pointer leaves the SVG element boundary
2. **No pointer ID tracking** — Multiple simultaneous touches corrupt shared drag state
3. **No multi-touch gestures** — No pinch-to-zoom, no two-finger pan
4. **No mobile UI adaptation** — Toolbars, handles, and hit targets are desktop-sized
5. **No touch-specific UX** — No long-press context menu, no gesture disambiguation
6. **`touch-action: none` only on SVG layer** — Editor chrome (toolbar, panels) unaffected but the main canvas prevents all browser gestures with no custom replacements

---

## Architecture Overview

Understanding the current event flow is essential before planning changes.

```
User Input (pointer/touch/stylus)
  │
  ├─► editor.vue (@pointerdown/@pointermove/@pointerup)
  │     └─► Pan handling (space+click / middle mouse)
  │     └─► useZoom.ts (@wheel only)
  │
  ├─► AnnotationLayer.vue (SVG layer)
  │     ├─► @pointerdown → handleMouseDown()
  │     │     ├─► Marquee start (selection mode + empty space)
  │     │     └─► Tool onMouseDown (drawing tools)
  │     ├─► @pointermove → handleMove()
  │     │     └─► Tool onMouseMove (drawing preview, cursor tracking)
  │     ├─► @pointerup → handleMouseUp()
  │     ├─► @click → handleClick()
  │     │     ├─► Deselect logic (click on empty space)
  │     │     └─► Tool onClick (place annotation)
  │     └─► @pointerleave → handleMouseLeave()
  │
  ├─► Annotation.vue (@click per annotation)
  │     └─► Selection (single, shift+click, cmd+click)
  │     └─► Double-click detection (manual 200ms timer)
  │
  ├─► Transform handles (Handles/Transform.vue, Scale.vue, Rotation.vue)
  │     └─► @pointerdown on handle elements
  │     └─► useEditorMove / useEditorScale / useEditorRotation
  │
  └─► Global window listeners (useEditorEventHandlers.ts)
        ├─► window "pointermove" → routes to move/rotation/scale/marquee update
        └─► window "pointerup" → ends all active interactions
```

**Key composables involved:**
- `useEditorCoordinates` — Screen-to-SVG coordinate conversion via `getScreenCTM().inverse()`
- `useEditorMove` / `useEditorRotation` / `useEditorScale` — Three-phase start→update→end pattern
- `useEditorMarquee` — Drag-to-select rectangle
- `useEditorDragState` — Tracks "just finished drag" to prevent accidental clicks
- `useTransformBase` — Shared drag/resize/rotate base for transform handles
- `useZoom` — Wheel zoom with trackpad detection
- `useEditorBounds` — Frozen bounds pattern for stable transforms

**Viewport transform:**
```
translate(scrollLeft, scrollTop) scale(scale) rotate(rotation)
```
Applied identically to both the PDF canvas and SVG annotation layer via `viewportStore.getCanvasTransform`.

---

## Implementation Plan

### Phase 1 — Reliable Single-Pointer (Stylus & Touch)

**Goal:** Make every existing interaction work reliably with a single touch point or stylus. No new gestures — just fix what breaks.

**Estimated scope:** ~15 files, mostly small changes.

#### 1.1 Add Pointer Capture to All Drag Operations

**Problem:** When a finger or stylus moves outside the SVG element during a drag, pointermove events stop firing on that element. The drag silently breaks — the shape freezes mid-move and the user has to tap again.

**Solution:** Call `element.setPointerCapture(e.pointerId)` on pointerdown for any drag operation. This routes all subsequent pointer events for that pointer to the capturing element, regardless of where the pointer moves. Release on pointerup.

**Files:**
- `AnnotationLayer.vue` — Capture on SVG element for drawing and marquee
- `Handles/Transform.vue` — Capture on move drag start
- `Handles/Scale.vue` — Capture on resize drag start
- `Handles/Rotation.vue` — Capture on rotation drag start
- `RotationWheel.vue` — Capture on wheel drag start
- `useTransformBase.ts` — If centralising, capture in `startDrag()`

**Pattern:**
```typescript
function handlePointerDown(e: PointerEvent) {
  const target = e.currentTarget as Element
  target.setPointerCapture(e.pointerId)
  // ... existing drag start logic
}

function handlePointerUp(e: PointerEvent) {
  const target = e.currentTarget as Element
  target.releasePointerCapture(e.pointerId)
  // ... existing drag end logic
}
```

**Note:** With pointer capture, global window listeners for pointermove/pointerup become unnecessary for the captured pointer — events route to the capturing element. However, keep the global listeners as a safety net for edge cases (e.g., element removed from DOM during drag).

#### 1.2 Track Active Pointer ID

**Problem:** If the user touches the canvas with one finger (starting a draw), then accidentally touches with a second finger, both fingers fire pointermove into the same handler. This corrupts coordinates and can create garbage annotations.

**Solution:** Store `activePointerId` on drag/draw start. Ignore events from any other `pointerId`.

**Files:**
- `useEditorMove.ts` — Store pointerId in `startDrag()`, filter in `updateDrag()`
- `useEditorRotation.ts` — Same pattern
- `useEditorScale.ts` — Same pattern
- `useEditorMarquee.ts` — Same pattern
- `useDrawingTool.ts` / `useBaseTool.ts` — For active drawing operations
- `useTransformBase.ts` — For handle transforms

**Pattern:**
```typescript
const activePointerId = ref<number | null>(null)

function startDrag(event: EditorInputEvent) {
  if (activePointerId.value !== null) return // Already tracking a pointer
  activePointerId.value = event.pointerId
  // ... existing start logic
}

function updateDrag(event: EditorInputEvent) {
  if (event.pointerId !== activePointerId.value) return // Ignore other pointers
  // ... existing update logic
}

function endDrag(event?: EditorInputEvent) {
  if (event && event.pointerId !== activePointerId.value) return
  activePointerId.value = null
  // ... existing end logic
}
```

#### 1.3 Increase Touch Hit Targets

**Problem:** Resize handles are 6×6px. The rotation handle dot is 4px radius. These are impossible to hit with a finger (minimum recommended touch target: 44×44px per WCAG / Apple HIG).

**Solution:** Add invisible touch-expanded hit areas around interactive elements. The visual appearance stays the same; only the pointer-interactive area grows.

**Files:**
- `Handles/Scale.vue` — Add transparent expanded rect behind each handle
- `Handles/Rotation.vue` — Add transparent expanded circle behind rotation dot
- `RotationWheel.vue` — Increase handle dot hit area
- `Annotation.vue` — Consider expanding click targets for thin annotations (lines, measurements)

**Pattern (SVG):**
```svg
<!-- Invisible expanded hit area -->
<rect
  :x="handle.x - 20" :y="handle.y - 20"
  width="40" height="40"
  fill="transparent"
  @pointerdown="handleScaleStart($event, handle)"
/>
<!-- Visual handle (no pointer events) -->
<rect :x="handle.x - 3" :y="handle.y - 3" width="6" height="6" pointer-events="none" />
```

#### 1.4 Replace Hover States with Selection/Active States

**Problem:** `Annotation.vue` uses `@mouseenter`/`@mouseleave` for hover feedback (opacity change). Touch has no hover — annotations never show this feedback.

**Solution:** Keep hover for pointer devices, add focus/active visual states that work for touch.

**Files:**
- `Annotation.vue` — Use `@pointerenter`/`@pointerleave` (fires on pen hover but not touch), add visual feedback on pointerdown for touch
- Tool-specific components — Any hover-dependent preview states

**Detection approach:**
```typescript
// Detect coarse pointer (touch) vs fine pointer (mouse/stylus)
const isCoarsePointer = ref(false)
if (typeof window !== 'undefined') {
  isCoarsePointer.value = window.matchMedia('(pointer: coarse)').matches
}
```

#### 1.5 Fix Double-Click Timing for Touch

**Problem:** `Annotation.vue` delays single-click selection by 200ms to detect double-clicks. On touch, this makes selection feel laggy.

**Solution:** Execute selection immediately on first tap. If a second tap arrives within the threshold, also trigger double-click (edit mode). The selection that already happened is harmless — double-click clears it anyway before entering edit mode.

**File:** `Annotation.vue`

```typescript
function handleClick(e: EditorInputEvent) {
  if (dragState.isDragJustFinished()) return
  e.preventDefault()
  e.stopPropagation()

  const now = Date.now()
  if (now - lastClickTime < DOUBLE_CLICK_THRESHOLD) {
    lastClickTime = 0
    triggerDoubleClick()
  } else {
    lastClickTime = now
    performSelection() // Execute immediately — no setTimeout
  }
}
```

---

### Phase 2 — Multi-Touch Gestures

**Goal:** Add pinch-to-zoom and two-finger pan so the editor is navigable without a mouse wheel or keyboard.

**Estimated scope:** New composable + integration into editor.vue.

#### 2.1 Pinch-to-Zoom

**Problem:** `touch-action: none` disables browser pinch-zoom on the canvas. `useZoom.ts` only handles wheel events. There is no way to zoom on a touch-only device.

**Solution:** Create a `usePinchZoom` composable that tracks two active pointers and maps distance changes to zoom.

**New file:** `composables/editor/usePinchZoom.ts`

**Algorithm:**
1. On pointerdown, add pointer to a `Map<pointerId, {x, y}>` tracking set
2. When exactly 2 pointers are active, record initial distance and midpoint
3. On pointermove for either pointer, calculate new distance
4. Map `newDistance / initialDistance` to scale factor
5. Call `viewportStore.zoomToScale(newScale, midpoint)` — reuses existing cursor-aware zoom
6. On pointerup, remove pointer from tracking set

**Integration points:**
- `editor.vue` — Register pointerdown/move/up for gesture detection on the container
- Must coexist with single-pointer drawing — if 2 pointers detected, cancel any active single-pointer draw and switch to gesture mode
- `AnnotationLayer.vue` — Must not start drawing when a second pointer arrives

**Gesture state machine:**
```
IDLE → (1 pointer down) → SINGLE_POINTER → (tool interaction)
IDLE → (2 pointers down) → PINCH_ZOOM → (zoom/pan)
SINGLE_POINTER → (2nd pointer down) → PINCH_ZOOM (cancel active draw)
PINCH_ZOOM → (pointer up, 1 remaining) → IDLE (don't start draw from leftover finger)
```

#### 2.2 Two-Finger Pan

**Problem:** Pan requires space+click or middle mouse. Neither exists on touch devices.

**Solution:** Extend `usePinchZoom` to also track midpoint translation. When two fingers move together (similar delta), pan. When they move apart/together, zoom. Both can happen simultaneously.

**Math:**
```typescript
const midpoint = {
  x: (pointer1.x + pointer2.x) / 2,
  y: (pointer1.y + pointer2.y) / 2,
}
const panDelta = {
  x: midpoint.x - prevMidpoint.x,
  y: midpoint.y - prevMidpoint.y,
}
viewportStore.setCanvasPos({
  scrollLeft: currentPos.scrollLeft + panDelta.x,
  scrollTop: currentPos.scrollTop + panDelta.y,
})
```

#### 2.3 Gesture Disambiguation

**Problem:** A single pointerdown could be the start of a draw, a tap-select, or the first finger of a pinch. We need to disambiguate without adding perceptible delay.

**Strategy:**
- **Stylus (pen) input:** Always treat as single-pointer drawing. `e.pointerType === "pen"` — bypass gesture detection entirely. Pens have built-in palm rejection.
- **Touch input (`e.pointerType === "touch"`):**
  - Start interaction immediately on first pointer (no delay)
  - If a second pointer arrives within ~80ms, cancel the draw and switch to gesture mode
  - If only one pointer and it moves significantly, continue as draw/drag
- **Mouse input:** Behave exactly as today

**This means:** A brief accidental two-finger touch will cancel an in-progress stroke. This is acceptable — it matches how every drawing app handles this (Procreate, Figma, Notability).

---

### Phase 3 — Mobile-Adapted UI

**Goal:** Make the editor usable on phone-sized screens and adapt chrome for touch interaction.

#### 3.1 Responsive Toolbar

**Problem:** The toolbar and tool palette are desktop-sized with small icons. On a phone they consume too much space and are hard to tap.

**Solution:**
- Collapse toolbar to a floating action button (FAB) on small screens
- Tap FAB to expand a radial or bottom-sheet tool picker
- Use `@media (pointer: coarse)` and viewport width breakpoints

**Breakpoints:**
```css
/* Tablet landscape — compact toolbar */
@media (max-width: 1024px) { ... }

/* Tablet portrait / phone landscape — bottom sheet */
@media (max-width: 768px) { ... }

/* Phone portrait — minimal FAB + bottom sheet */
@media (max-width: 480px) { ... }
```

#### 3.2 Context Menu → Long-Press

**Problem:** Right-click context menus don't exist on touch. `Annotation.vue` has `@contextmenu` but no long-press equivalent.

**Solution:** Detect long-press (pointerdown held >500ms without significant movement) and trigger the same context menu handler.

**Pattern:**
```typescript
let longPressTimer: ReturnType<typeof setTimeout> | null = null

function handlePointerDown(e: EditorInputEvent) {
  if (e.pointerType === 'touch') {
    longPressTimer = setTimeout(() => {
      handleContextMenu(e)
    }, 500)
  }
}

function handlePointerMove(e: EditorInputEvent) {
  // Cancel long-press if finger moves significantly
  if (longPressTimer && distance > 10) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function handlePointerUp() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}
```

#### 3.3 Undo/Redo Without Keyboard

**Problem:** Undo (Ctrl+Z) and Redo (Ctrl+Shift+Z) require a keyboard. Mobile has none.

**Solution:**
- Add undo/redo buttons to the mobile toolbar
- Consider two-finger tap = undo, three-finger tap = redo (iOS convention)
- Shake-to-undo as an optional gesture (uses DeviceMotion API)

#### 3.4 Properties Panel Adaptation

**Problem:** Annotation property panels (color, line width, text editing) are likely sidebars or popovers designed for mouse interaction.

**Solution:**
- On touch devices, show properties as a bottom sheet that slides up when an annotation is selected
- Ensure all property inputs (color pickers, sliders, text fields) have adequate touch targets
- Text annotation editing should trigger the on-screen keyboard properly

#### 3.5 Safe Areas and Viewport

**Problem:** Mobile browsers have dynamic toolbars (URL bar, bottom nav), notches, and home indicators that overlap content.

**Solution:**
```css
.editor-container {
  height: 100dvh; /* Dynamic viewport height — adjusts for browser chrome */
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
           env(safe-area-inset-bottom) env(safe-area-inset-left);
}
```

Also add the viewport meta tag if not present:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
```

---

### Phase 4 — Stylus-Specific Features

**Goal:** Take advantage of stylus capabilities (pressure, tilt, barrel button) for a professional drawing experience.

#### 4.1 Pressure Sensitivity

**Problem:** `PointerEvent` provides `pressure` (0.0–1.0) and `tangentialPressure` for supported styli. Currently ignored.

**Opportunity:** Map pressure to line width for freehand annotations, or to opacity for fill tools.

**API:**
```typescript
function handlePointerMove(e: PointerEvent) {
  if (e.pointerType === 'pen') {
    const pressure = e.pressure // 0.0 to 1.0
    const width = MIN_WIDTH + pressure * (MAX_WIDTH - MIN_WIDTH)
  }
}
```

#### 4.2 Tilt for Angle Snapping

**Problem:** `PointerEvent` provides `tiltX` and `tiltY` (degrees of stylus tilt). Currently ignored.

**Opportunity:** Use tilt to influence brush angle for calligraphic strokes or to provide visual feedback about snap angles during rotation.

#### 4.3 Barrel Button / Eraser End

**Problem:** Many styli have a barrel button (`e.buttons` includes button 32 for eraser, or `e.button === 5`). The eraser end of an Apple Pencil or Wacom stylus reports as a separate pointer with `pointerType === "pen"`.

**Opportunity:**
- Barrel button → quick tool switch (e.g., hold barrel button = temporary selection mode)
- Eraser end → delete annotation under cursor

**Detection:**
```typescript
// Eraser end of stylus
if (e.pointerType === 'pen' && (e.buttons & 32)) {
  // Eraser mode
}
```

#### 4.4 Palm Rejection

PointerEvent handles this natively — when a stylus is in proximity, most OS/browser combinations automatically reject palm touches. No code needed, but important to **not break this** by treating all pointerType=touch events equally when a pen is active.

**Rule:** If any pointer with `pointerType === "pen"` is active, ignore all `pointerType === "touch"` events.

---

## File Impact Summary

| File | Phase | Changes |
|---|---|---|
| `types/editor.ts` | 1 | Extend `EditorInputEvent` if needed |
| `useEditorMove.ts` | 1 | Pointer capture, pointer ID tracking |
| `useEditorRotation.ts` | 1 | Pointer capture, pointer ID tracking |
| `useEditorScale.ts` | 1 | Pointer capture, pointer ID tracking |
| `useEditorMarquee.ts` | 1 | Pointer capture, pointer ID tracking |
| `useTransformBase.ts` | 1 | Pointer capture, pointer ID tracking (centralised) |
| `useDrawingTool.ts` | 1 | Pointer ID tracking |
| `useBaseTool.ts` | 1 | Pointer ID tracking |
| `Handles/Transform.vue` | 1 | Expanded hit areas |
| `Handles/Scale.vue` | 1 | Expanded hit areas (40×40 invisible rects) |
| `Handles/Rotation.vue` | 1 | Expanded hit area (larger invisible circle) |
| `RotationWheel.vue` | 1 | Pointer capture on drag, larger handle |
| `Annotation.vue` | 1, 3 | Immediate tap selection, long-press, hover→active |
| `AnnotationLayer.vue` | 1, 2 | Pointer capture on draw, gesture disambiguation |
| `editor.vue` | 2, 3 | Pinch-zoom integration, responsive layout, safe areas |
| `usePinchZoom.ts` | 2 | **New file** — pinch-to-zoom + two-finger pan |
| `useZoom.ts` | 2 | Integration with pinch gesture |
| `viewport.ts` | 2 | Possibly extend pan API |
| Toolbar components | 3 | Responsive breakpoints, mobile layout |
| `useKeyboardShortcuts.ts` | 3 | Expose undo/redo as callable functions for mobile UI |
| Tool composables | 4 | Pressure/tilt input mapping |

---

## Testing Strategy

### Unit Tests
- `useTransformBase.spec.ts` — Already uses PointerEvent. Add tests for pointer capture and ID filtering.
- New `usePinchZoom.spec.ts` — Test gesture state machine, zoom math, pan math.
- Annotation click/tap tests — Verify immediate selection, double-tap edit.

### Integration Tests (Playwright)
- **Device emulation:** Playwright supports `devices['iPad Pro']`, `devices['iPhone 13']` etc.
- **Touch simulation:** `page.touchscreen.tap()`, multi-touch via `page.dispatchEvent()`
- Test scenarios:
  - Draw a line with single touch
  - Pinch-to-zoom on canvas
  - Two-finger pan
  - Select annotation with tap
  - Resize annotation with touch drag on handle
  - Verify no accidental draws during pinch gesture

### Manual Testing
- iPad + Apple Pencil (primary tablet target)
- Android tablet + stylus (Samsung S Pen)
- iPhone / Android phone (touch only, no stylus)
- Test palm rejection with stylus devices
- Test with external keyboard connected to tablet

---

## Prioritised Execution Order

```
Phase 1.1  Pointer capture on drags          — Highest impact, prevents broken drags
Phase 1.2  Pointer ID tracking               — Prevents multi-touch corruption
Phase 1.5  Immediate tap selection            — Quick UX win
Phase 1.3  Expanded touch hit targets         — Makes handles usable on touch
Phase 1.4  Hover → active state fallback      — Visual polish for touch
Phase 2.1  Pinch-to-zoom                      — Unblocks touch-only navigation
Phase 2.2  Two-finger pan                     — Completes touch navigation
Phase 2.3  Gesture disambiguation             — Makes draw vs gesture reliable
Phase 3.5  Safe areas + dvh                   — Prevents layout issues on mobile
Phase 3.1  Responsive toolbar                 — Makes tools accessible on small screens
Phase 3.3  Undo/redo buttons                  — Essential without keyboard
Phase 3.2  Long-press context menu            — Replaces right-click
Phase 3.4  Properties bottom sheet            — Mobile editing workflow
Phase 4.1  Pressure sensitivity               — Pro stylus feature
Phase 4.3  Barrel button / eraser             — Pro stylus feature
Phase 4.4  Palm rejection awareness           — Prevents false inputs
Phase 4.2  Tilt mapping                       — Nice-to-have
```
