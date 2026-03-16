# Interaction State Machine — Design Spec

> Coordination layer for editor interactions (drag, rotate, scale, marquee).
> Does NOT touch the tool drawing system — that stays composable.

---

## Scope

This state machine governs **interaction mode only** — the thing that answers
"is the user currently dragging, rotating, scaling, marquee-selecting, or idle?"

### What it owns

The 4 interaction boolean flags and 3 timing hacks that currently live across
6 composables:

| Current flag | Current location | Becomes |
|---|---|---|
| `isDragging` | `useEditorMove.ts` | `mode === "dragging"` |
| `isRotating` | `useEditorRotation.ts` | `mode === "rotating"` |
| `isScaling` | `useEditorScale.ts` | `mode === "scaling"` |
| `isMarqueeSelecting` | `useEditorMarquee.ts` | `mode === "marquee"` |
| `justFinishedDragging` | `useEditorDragState.ts` | `mode === "cooldown"` |
| `justFinishedInteraction` | `useEditorEventHandlers.ts` | `mode === "cooldown"` |
| `marqueeJustFinished` | `useEditorMarquee.ts` | `mode === "cooldown"` |

### What it does NOT own

These stay exactly where they are:

| State | Location | Why it stays |
|---|---|---|
| `activeTool` | `annotations.ts` store | Tool identity, not interaction mode |
| `isDrawing` | `useBaseTool.ts` | Tool drawing lifecycle — composable pattern |
| `points`, `tempEndPoint` | `useBaseTool.ts` | Tool-specific drawing state |
| `selectedAnnotationIds` | `annotations.ts` store | Selection model, not interaction mode |
| `frozenBounds`, `selectionRotation` | `useEditorBounds.ts` | Persistent UI state that survives across interactions |
| `editingId` | `useTextEditingState.ts` | Tool-specific inline editing |
| `persistenceSuppressed` | `annotations.ts` store | Save coordination |
| `dragStartPoint`, `rotationCenter`, etc. | Each interaction composable | Interaction-specific data (see below) |

**Key principle:** Adding a new drawing tool (e.g., `useStampTool`) should require
0 changes to the state machine. The tool composes `useBaseTool` + `useDrawingTool`
and registers via `useToolRegistry`. The state machine doesn't know it exists.

---

## Problem Statement

The interaction layer has 4 boolean flags across 4 composables plus 3 timeout-based
`justFinished*` flags across 3 more composables. This causes:

1. **Compound guard conditions** — `useEditorEventHandlers.handleBackgroundClick()`
   checks `move.isDragging || rotation.isRotating || scale.isScaling || justFinishedInteraction`.
   `AnnotationLayer.vue` click handler checks 6 flags. Every new interaction type
   means updating these conditions.

2. **Three inconsistent cooldown timeouts** — `justFinishedDragging` (150ms),
   `justFinishedInteraction` (100ms), `marqueeJustFinished` (100ms). Three separate
   `setTimeout` calls doing the same job with different durations. Race-prone.

3. **Implicit mutual exclusion** — Nothing in the type system prevents
   `isDragging=true && isRotating=true`. It works today because browser event ordering
   prevents it, but it's not enforced.

4. **Adding a new interaction is error-prone** — If you add `isPanning`, you need to
   find and update every compound guard, add another `justFinished*` flag, wire up
   another timeout, and hope you didn't miss a check.

---

## Architecture: Where the State Machine Fits

```
┌──────────────────────────────────────────────────────────────────┐
│                        Tool Layer (UNCHANGED)                     │
│                                                                   │
│  useBaseTool ──► useDrawingTool ──► useMeasureTool               │
│                                 ──► useAreaTool                   │
│                                 ──► useCountTool                  │
│                                 ──► ... (add new tools here)      │
│                                                                   │
│  Owns: points, tempEndPoint, isDrawing, getSvgPoint              │
│  Pattern: compose useBaseTool + config object                     │
│  Registers via: useToolRegistry                                   │
└──────────────────────────────────────────────────────────────────┘
                              │
                    onClick / onMouseDown / onMouseUp
                              │
┌──────────────────────────────────────────────────────────────────┐
│                   Interaction Layer (THIS SPEC)                    │
│                                                                   │
│  useInteractionMode (NEW) ◄── single source of truth              │
│    mode: idle | selected | dragging | rotating | scaling |        │
│          marquee | cooldown                                       │
│    TRANSITIONS map: defines all legal state changes               │
│                                                                   │
│  useEditorMove         ──► owns drag data, calls mode.transition  │
│  useEditorRotation     ──► owns rotation data, calls transition   │
│  useEditorScale        ──► owns scale data, calls transition      │
│  useEditorMarquee      ──► owns marquee data, calls transition    │
│  useEditorEventHandlers ──► reads mode, routes events             │
│                                                                   │
│  DELETED: useEditorDragState (replaced by cooldown mode)          │
└──────────────────────────────────────────────────────────────────┘
                              │
                    selection changes / bounds updates
                              │
┌──────────────────────────────────────────────────────────────────┐
│                     Selection & Bounds (UNCHANGED)                │
│                                                                   │
│  useEditorSelection    ──► selectShape, toggleShape, clear        │
│  useEditorBounds       ──► frozenBounds, selectionRotation        │
│  annotations.ts store  ──► selectedAnnotationIds, activeTool      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Design

### Interaction modes

```typescript
// Derived from the transition map — add a mode here, TS catches every unhandled case
const TRANSITIONS = {
  "idle":      ["selected", "marquee"],
  "selected":  ["dragging", "rotating", "scaling", "marquee", "idle"],
  "dragging":  ["cooldown"],
  "rotating":  ["cooldown"],
  "scaling":   ["cooldown"],
  "marquee":   ["cooldown", "selected"],
  "cooldown":  ["idle", "selected"],
} as const satisfies Record<string, readonly InteractionMode[]>

type InteractionMode = keyof typeof TRANSITIONS
```

Note: `"idle"` and `"selected"` are the only modes you can start an interaction from.
The distinction matters — `"selected"` means annotations are highlighted and transform
handles are visible, so drag/rotate/scale can begin. `"idle"` means nothing is selected,
so only marquee is available.

### The composable

```typescript
// composables/editor/useInteractionMode.ts
export const useInteractionMode = createSharedComposable(() => {
  const mode = ref<InteractionMode>("idle")

  // --- Computed helpers ---

  /** True during any active pointer interaction (drag/rotate/scale/marquee/etc.)
   *  Derived from the transition map — new interaction modes are included automatically */
  const PASSIVE_MODES: ReadonlySet<InteractionMode> = new Set(["idle", "selected", "cooldown"])
  const isInteracting = computed(() => !PASSIVE_MODES.has(mode.value))

  /** True when interactions are blocked (active interaction or cooldown) */
  const isLocked = computed(() => isInteracting.value || mode.value === "cooldown")

  /** True when a new interaction can begin */
  const canStartInteraction = computed(() =>
    mode.value === "idle" || mode.value === "selected"
  )

  /** True when click-to-select should be suppressed.
   *  Single DRY guard for AnnotationLayer / Annotation click handlers.
   *  Combines interaction-layer lock with tool-layer isDrawing. */
  const shouldSuppressClick = computed(() =>
    isLocked.value || useAnnotationStore().isDrawing
  )

  // --- Transition ---

  function transition(to: InteractionMode): boolean {
    const from = mode.value
    const allowed = TRANSITIONS[from] as readonly InteractionMode[]
    if (!allowed.includes(to)) {
      if (import.meta.env.DEV) {
        debugLog("InteractionMode", `Blocked transition: ${from} → ${to}`)
      }
      return false
    }
    mode.value = to
    return true
  }

  // --- Cooldown ---
  // Replaces all 3 justFinished* timeouts with a single proper state

  let cooldownTimer: ReturnType<typeof setTimeout> | null = null

  function enterCooldown() {
    if (cooldownTimer) clearTimeout(cooldownTimer)
    mode.value = "cooldown"
    cooldownTimer = setTimeout(() => {
      cooldownTimer = null
      // Return to selected or idle based on whether annotations are selected
      // The caller passes this context via exitCooldown, or we read from store
      if (mode.value === "cooldown") {
        mode.value = "idle" // Default — callers can override via transition()
      }
    }, 100)
  }

  /** End an interaction and enter cooldown.
   *  returnTo controls where cooldown exits to (default: idle) */
  function endInteraction(returnTo: "idle" | "selected" = "idle") {
    if (!isInteracting.value) return
    enterCooldown()
    // Override the default cooldown exit
    if (cooldownTimer && returnTo === "selected") {
      clearTimeout(cooldownTimer)
      cooldownTimer = setTimeout(() => {
        cooldownTimer = null
        if (mode.value === "cooldown") {
          mode.value = "selected"
        }
      }, 100)
    }
  }

  // Cleanup
  function dispose() {
    if (cooldownTimer) {
      clearTimeout(cooldownTimer)
      cooldownTimer = null
    }
  }

  return {
    mode: readonly(mode),
    isInteracting,
    isLocked,
    canStartInteraction,
    shouldSuppressClick,
    transition,
    endInteraction,
    dispose,
  }
})
```

### How interaction composables change

Each composable keeps its own interaction data (start points, original positions, etc.)
but **delegates mode tracking** to `useInteractionMode`. The pattern is the same across
all four:

**Before (useEditorMove.ts):**
```typescript
const isDragging = ref(false)

function startDrag(event) {
  if (!selection.hasSelection) return
  isDragging.value = true
  // ... cache start data ...
}

function updateDrag(event) {
  if (!isDragging.value) return
  // ... apply delta ...
}

function endDrag() {
  if (!isDragging.value) return
  isDragging.value = false
  dragState.markDragEnd() // 150ms timeout hack
  // ... finalize ...
}
```

**After:**
```typescript
const interactionMode = useInteractionMode()

function startDrag(event) {
  if (!selection.hasSelection) return
  if (!interactionMode.transition("dragging")) return // ← single guard
  // ... cache start data (unchanged) ...
}

function updateDrag(event) {
  if (interactionMode.mode.value !== "dragging") return // ← reads from mode
  // ... apply delta (unchanged) ...
}

function endDrag() {
  if (interactionMode.mode.value !== "dragging") return
  interactionMode.endInteraction("selected") // ← replaces isDragging=false + markDragEnd()
  // ... finalize (unchanged) ...
}
```

The interaction-specific data (`dragStartPoint`, `dragOriginalPositions`, etc.) stays
in `useEditorMove`. Only the boolean flag moves out.

### How event handlers simplify

**Before (useEditorEventHandlers.ts):**
```typescript
function handleBackgroundClick() {
  if (
    move.isDragging.value ||
    rotation.isRotating.value ||
    scale.isScaling.value ||
    justFinishedInteraction.value
  ) {
    return
  }
  selection.clearSelection()
}
```

**After:**
```typescript
function handleBackgroundClick() {
  if (interactionMode.isLocked.value) return  // ← one check
  selection.clearSelection()
}
```

**Before (AnnotationLayer.vue click handler):**
```typescript
if (
  !annotationId &&
  !isTransformHandle &&
  !selectionMarquee.isMarqueeSelecting.value &&
  !selectionMarquee.isMarqueeJustFinished() &&
  !annotationStore.isDrawing &&
  !dragState.isDragJustFinished()
) {
  annotationStore.selectAnnotation(null)
}
```

**After:**
```typescript
if (
  !annotationId &&
  !isTransformHandle &&
  !interactionMode.shouldSuppressClick.value
) {
  annotationStore.selectAnnotation(null)
}
```

`shouldSuppressClick` is a single computed on `useInteractionMode` that combines
`isLocked` (interaction-layer) with `isDrawing` (tool-layer). Every click guard
in the codebase reads from this one property — no ad-hoc multi-flag checks.

### What gets deleted

- **`useEditorDragState.ts`** — Entire file. `justFinishedDragging` + `isDragJustFinished()`
  replaced by `mode === "cooldown"` / `isLocked`.

- **`justFinishedInteraction` in `useEditorEventHandlers.ts`** — The ref and its 100ms
  timeout. Replaced by reading `interactionMode.isLocked`.

- **`marqueeJustFinished` in `useEditorMarquee.ts`** — The ref and its 100ms timeout.
  Replaced by cooldown state after marquee ends.

- **`isDragging` ref in `useEditorMove.ts`** — Replaced by `mode === "dragging"`.

- **`isRotating` ref in `useEditorRotation.ts`** — Replaced by `mode === "rotating"`.

- **`isScaling` ref in `useEditorScale.ts`** — Replaced by `mode === "scaling"`.

- **`isMarqueeSelecting` ref in `useEditorMarquee.ts`** — Replaced by `mode === "marquee"`.

---

## Adding a New Interaction Type

Example: adding a `"panning"` interaction for two-finger touch pan.

**Step 1 — Add to transition map (1 line):**

```typescript
const TRANSITIONS = {
  "idle":      ["selected", "marquee", "panning"],  // ← added
  "selected":  ["dragging", "rotating", "scaling", "marquee", "panning", "idle"],  // ← added
  "dragging":  ["cooldown"],
  "rotating":  ["cooldown"],
  "scaling":   ["cooldown"],
  "marquee":   ["cooldown", "selected"],
  "panning":   ["cooldown"],  // ← new row
  "cooldown":  ["idle", "selected"],
}
```

TypeScript immediately derives `"panning"` as a valid `InteractionMode`. The
`isInteracting` computed already includes it (any mode not in `["idle", "selected", "cooldown"]`).
All guard checks via `isLocked` automatically block clicks during panning.

**Step 2 — Create the composable (1 file):**

```typescript
// composables/editor/useEditorPan.ts
export const useEditorPan = createSharedComposable(() => {
  const interactionMode = useInteractionMode()
  const panStart = ref<Point | null>(null)

  function startPan(event: EditorInputEvent) {
    if (!interactionMode.transition("panning")) return
    panStart.value = { x: event.clientX, y: event.clientY }
  }

  function updatePan(event: EditorInputEvent) {
    if (interactionMode.mode.value !== "panning") return
    // ... apply pan delta ...
  }

  function endPan() {
    if (interactionMode.mode.value !== "panning") return
    interactionMode.endInteraction("idle")
    panStart.value = null
  }

  return { startPan, updatePan, endPan }
})
```

**Step 3 — Wire into event handlers:**

Add `pan.updatePan(event)` to `processMoveFrame()` and `pan.endPan()` to
`handleGlobalMouseUp()` in `useEditorEventHandlers.ts`.

**That's it.** No boolean flags. No timeout hacks. No compound guard updates.
The transition map prevents panning while dragging. The cooldown state prevents
accidental clicks after panning ends. All existing guards work automatically.

---

## What Stays Unchanged

### Tool layer (0 changes)

| File | Why no change needed |
|---|---|
| `useBaseTool.ts` | Owns drawing state (`points`, `isDrawing`). Doesn't know about interactions. |
| `useCreateBaseTool.ts` | Shared store access, rotation helpers. No interaction awareness. |
| `useDrawingTool.ts` | Tool lifecycle (`onCreate`, `calculate`). Composes `useBaseTool`. |
| `useMeasureTool.ts` | Config + overrides. Composes `useDrawingTool`. |
| `useAreaTool.ts` | Same pattern. |
| `useCountTool.ts` | Same pattern. |
| `useFillTool.ts` | Same pattern. |
| `useTextTool.ts` | Same pattern. |
| `useLineTool.ts` | Same pattern. |
| `usePerimeterTool.ts` | Same pattern. |
| `useToolRegistry.ts` | Registration system. No interaction awareness. |

### Selection & bounds (0 changes)

| File | Why no change needed |
|---|---|
| `useEditorSelection.ts` | Shape selection logic. Called by interactions, doesn't track mode. |
| `useEditorBounds.ts` | Frozen bounds pattern. Watches `selectedIds`, not interaction mode. |
| `useEditorTransformFinalise.ts` | Batches history. Called at end of interactions, mode-agnostic. |
| `useEditorCoordinates.ts` | SVG coordinate conversion. Pure utility. |
| `useTextEditingState.ts` | Text inline editing. Tool-specific, not an interaction mode. |

### Stores (0 changes)

| File | Why no change needed |
|---|---|
| `annotations.ts` | `activeTool`, `isDrawing`, `selectedAnnotationIds` stay. |
| `viewport.ts` | Viewport state. No interaction awareness. |
| `history.ts` | Undo/redo. Mode-agnostic. |

---

## Files Changed

| File | Change | Size |
|---|---|---|
| `composables/editor/useInteractionMode.ts` | **New** — transition map + mode ref | ~80 lines |
| `composables/editor/useEditorMove.ts` | Replace `isDragging` ref with `mode` reads | Small |
| `composables/editor/useEditorRotation.ts` | Replace `isRotating` ref with `mode` reads | Small |
| `composables/editor/useEditorScale.ts` | Replace `isScaling` ref with `mode` reads | Small |
| `composables/editor/useEditorMarquee.ts` | Replace `isMarqueeSelecting` + timeout with `mode` reads | Small |
| `composables/editor/useEditorEventHandlers.ts` | Replace compound guards with `isLocked` / `isInteracting` | Small |
| `composables/editor/useEditorDragState.ts` | **Delete** | -25 lines |
| `components/Editor/AnnotationLayer.vue` | Simplify click guards | Small |
| `components/Editor/Annotation.vue` | Replace `dragState.isDragJustFinished()` with `isLocked` | 1 line |
| `components/Editor/Handles/Transform.vue` | Read `mode` instead of `move.isDragging` | 1 line |

**Total:** 1 new file (~80 lines), 1 deleted file, 8 files with small edits.
Zero changes to tool composables, stores, or selection/bounds layer.

---

## Implementation Strategy

Direct cutover — no intermediate shadow mode or phased rollout. The change set
is small (~80 new lines, 8 small edits, 1 deletion) and fully testable in isolation.

### Steps

1. **Create `useInteractionMode.ts`** with transition map, mode ref, computed helpers,
   `transition()`, `endInteraction()`, and `shouldSuppressClick`.

2. **Update all 4 interaction composables** in one pass:
   - `useEditorMarquee` — remove `isMarqueeSelecting` ref + `marqueeJustFinished` timeout
   - `useEditorMove` — remove `isDragging` ref
   - `useEditorScale` — remove `isScaling` ref
   - `useEditorRotation` — remove `isRotating` ref
   - Each: call `transition()` in start, read `mode` in update, call `endInteraction()` in end

3. **Update `useEditorEventHandlers.ts`** — replace compound guards and
   `justFinishedInteraction` timeout with `isLocked` / `shouldSuppressClick`.

4. **Update components** — `AnnotationLayer.vue`, `Annotation.vue`, `Transform.vue`
   replace multi-flag checks with `shouldSuppressClick` / `isLocked`.

5. **Delete `useEditorDragState.ts`** — entirely replaced by cooldown mode.

6. **Run full test suite**, fix any breakage from removed refs/exports.

---

## Testing

### Unit test the transition map directly

```typescript
describe("useInteractionMode", () => {
  it("allows idle → selected", () => {
    const { transition, mode } = useInteractionMode()
    expect(transition("selected")).toBe(true)
    expect(mode.value).toBe("selected")
  })

  it("blocks idle → dragging (must be selected first)", () => {
    const { transition, mode } = useInteractionMode()
    expect(transition("dragging")).toBe(false)
    expect(mode.value).toBe("idle")
  })

  it("blocks dragging → rotating (only one interaction at a time)", () => {
    const { transition, mode } = useInteractionMode()
    transition("selected")
    transition("dragging")
    expect(transition("rotating")).toBe(false)
    expect(mode.value).toBe("dragging")
  })

  it("cooldown auto-transitions after timeout", async () => {
    const { transition, endInteraction, mode } = useInteractionMode()
    transition("selected")
    transition("dragging")
    endInteraction("selected")
    expect(mode.value).toBe("cooldown")
    await vi.advanceTimersByTimeAsync(100)
    expect(mode.value).toBe("selected")
  })

  it("isLocked is true during interaction and cooldown", () => {
    const { transition, isLocked } = useInteractionMode()
    transition("selected")
    expect(isLocked.value).toBe(false)
    transition("dragging")
    expect(isLocked.value).toBe(true)
  })
})
```

These tests are pure — no DOM, no SVG, no stores. They validate the transition
rules in isolation.

### Existing tests continue to work

The interaction composables (`useEditorMove`, etc.) keep their existing APIs.
Tests that call `startDrag()` / `updateDrag()` / `endDrag()` continue working
because those functions still exist — they just delegate mode tracking internally.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Interaction data still scattered across composables | Intentional — each composable owns its own data. Mode coordination is the only shared concern. |
| Cooldown duration hardcoded to 100ms | Single constant in `useInteractionMode`. Easy to tune. Current system has 3 different durations. |
| `useTransformBase.ts` has its own parallel `isDragging` | `useTransformBase` is used by Transform.vue handles component and has its own isolated lifecycle. It delegates to the 4 composables via callbacks (`onMove`, `onResize`, `onRotate`). It should read from `useInteractionMode` in a follow-up, but it's not blocking. |
