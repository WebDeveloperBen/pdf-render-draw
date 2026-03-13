# Tool State Machine — Design Spec

> Architectural refactor proposal for replacing independent boolean flags with a
> unified state machine for editor tool modes.

---

## Problem Statement

The editor tracks interaction state across **11+ independent boolean/string flags** spread
across 6 composables and 1 Pinia store. These flags can theoretically reach impossible
combinations (e.g., `isDragging=true` AND `isRotating=true` simultaneously), and the
codebase relies on scattered defensive checks to prevent this.

### Current flags

| Flag | Location | Purpose |
|---|---|---|
| `activeTool` | `annotations.ts` (store) | Which tool is selected (`"measure"`, `"selection"`, `""`, etc.) |
| `isDrawing` | `annotations.ts` (store) | Mid-drawing with a tool (clicking points) |
| `selectedAnnotationIds` | `annotations.ts` (store) | Currently selected annotations |
| `rotationDragDelta` | `annotations.ts` (store) | Accumulated rotation during drag |
| `persistenceSuppressed` | `annotations.ts` (store) | Prevents auto-save during transforms |
| `isDragging` | `useEditorMove.ts` | Move drag in progress |
| `isRotating` | `useEditorRotation.ts` | Rotation drag in progress |
| `isScaling` | `useEditorScale.ts` | Resize drag in progress |
| `isMarqueeSelecting` | `useEditorMarquee.ts` | Drag-to-select rectangle active |
| `justFinishedDragging` | `useEditorDragState.ts` | 150ms window after drag ends |
| `justFinishedInteraction` | `useEditorEventHandlers.ts` | 100ms window after any interaction ends |
| `marqueeJustFinished` | `useEditorMarquee.ts` | 100ms window after marquee ends |
| `frozenBounds` | `useEditorBounds.ts` | Locked bounds during rotation |
| `selectionRotation` | `useEditorBounds.ts` | Accumulated rotation for transform handles |
| `editingId` | `useTextEditingState.ts` | Text annotation being inline-edited |

### Why this is a problem

1. **Impossible states are possible.** Nothing prevents `isDragging=true` and `isRotating=true`
   at the same time except implicit event ordering assumptions.

2. **Defensive checks are scattered.** Background click prevention alone requires checking
   6 flags in a compound condition across 2 files (`useEditorEventHandlers.ts` line 43,
   `AnnotationLayer.vue` lines 190-197).

3. **Timeout-based state transitions.** Three separate `setTimeout` calls (100ms, 100ms, 150ms)
   create `justFinished*` windows to prevent click events from firing after drag/rotate/scale.
   These are race-condition-prone and inconsistent in duration.

4. **Auto-switching is implicit.** `setActiveTool()` auto-clears selection. Selecting an
   annotation auto-switches `activeTool` to `"selection"`. These side effects are buried in
   store actions and easy to break.

5. **New tool/interaction additions require updating guards everywhere.** Adding a new interaction
   type means updating every compound condition that checks `isDragging || isRotating || isScaling`.

---

## Current State Transitions (Observed)

```
                    ┌────────────────────────────────────────────────┐
                    │                    IDLE                         │
                    │  activeTool = "selection" | ""                  │
                    │  isDrawing = false                              │
                    │  no interaction flags set                       │
                    └──┬──────────┬──────────┬──────────┬────────────┘
                       │          │          │          │
              click    │  click   │  click   │  drag    │  select
              on SVG   │  annot.  │  handle  │  bg      │  tool
                       │          │          │          │
                       ▼          ▼          ▼          ▼
                   DRAWING    SELECTED    TRANSFORM   TOOL_ACTIVE
                   isDrawing  selected    isDragging  activeTool
                   = true     Ids=[id]    |isRotating = "measure"
                              activeTool  |isScaling   isDrawing
                              = selection = true       = false
                              auto                     (ready)
                                  │
                                  │ drag handle
                                  ▼
                              TRANSFORM
                              (isDragging|isRotating|isScaling)
                              persistenceSuppressed = true
                                  │
                                  │ pointerup
                                  ▼
                              COOLDOWN
                              justFinished* = true
                              100-150ms timeout
                                  │
                                  │ timeout expires
                                  ▼
                                IDLE / SELECTED
```

---

## Proposed Solution: Discriminated Union State

Replace the scattered flags with a single reactive state object using a TypeScript
discriminated union. Each state variant carries only the data relevant to that state.

### State definition

```typescript
type EditorState =
  | { mode: "idle" }
  | { mode: "tool-ready"; tool: ToolType }
  | { mode: "drawing"; tool: ToolType; points: Point[]; tempEndPoint: Point | null }
  | { mode: "selected"; annotationIds: string[] }
  | { mode: "dragging"; annotationIds: string[]; startPoint: Point; originalPositions: Map<string, Point> }
  | { mode: "rotating"; annotationIds: string[]; center: Point; startAngle: number; currentDelta: number }
  | { mode: "scaling"; annotationIds: string[]; handle: ScaleHandle; startPoint: Point; originalBounds: Bounds }
  | { mode: "marquee"; startPoint: Point; currentPoint: Point }
  | { mode: "text-editing"; annotationId: string; content: string }
  | { mode: "cooldown"; previousMode: "dragging" | "rotating" | "scaling" | "marquee"; returnTo: EditorState }
```

### Benefits

1. **Impossible states are unrepresentable.** You can't be `dragging` and `rotating` at the
   same time — the discriminant `mode` only has one value.

2. **All guards become simple mode checks.** Instead of:
   ```typescript
   if (move.isDragging.value || rotation.isRotating.value || scale.isScaling.value || justFinishedInteraction.value)
   ```
   You write:
   ```typescript
   if (state.mode === "dragging" || state.mode === "rotating" || state.mode === "scaling" || state.mode === "cooldown")
   ```
   Or better, define a helper:
   ```typescript
   const isInteracting = computed(() => ["dragging", "rotating", "scaling", "marquee"].includes(state.mode))
   ```

3. **Transitions are explicit.** A `transition(event)` function handles all state changes
   in one place, making it easy to audit what can happen from each state.

4. **Cooldown is a proper state**, not a timeout-based flag that might race.

5. **Data is colocated with state.** `startPoint`, `originalPositions`, etc. live inside the
   state variant, not in separate refs that might go stale.

---

## Implementation Approaches

### Option A: Plain Reactive Ref + Transition Functions

Simplest approach — a single `ref<EditorState>` with pure functions that transition between states.

```typescript
// composables/editor/useEditorStateMachine.ts
export const useEditorStateMachine = createSharedComposable(() => {
  const state = ref<EditorState>({ mode: "idle" })

  // Computed helpers
  const isInteracting = computed(() =>
    ["dragging", "rotating", "scaling", "marquee"].includes(state.value.mode)
  )
  const isIdle = computed(() => state.value.mode === "idle" || state.value.mode === "selected")
  const selectedIds = computed(() =>
    "annotationIds" in state.value ? state.value.annotationIds : []
  )

  // Transition functions
  function startDrag(annotationIds: string[], startPoint: Point, originalPositions: Map<string, Point>) {
    if (!isIdle.value) return // Can only start drag from idle/selected
    state.value = { mode: "dragging", annotationIds, startPoint, originalPositions }
  }

  function endInteraction() {
    const prev = state.value.mode
    if (prev === "dragging" || prev === "rotating" || prev === "scaling" || prev === "marquee") {
      const returnTo = "annotationIds" in state.value
        ? { mode: "selected" as const, annotationIds: state.value.annotationIds }
        : { mode: "idle" as const }
      state.value = { mode: "cooldown", previousMode: prev, returnTo }
      setTimeout(() => {
        if (state.value.mode === "cooldown") {
          state.value = state.value.returnTo
        }
      }, 100)
    }
  }

  return { state: readonly(state), isInteracting, isIdle, selectedIds, startDrag, endInteraction, /* ... */ }
})
```

**Pros:** No dependencies. Uses standard Vue reactivity. Easy to understand.
**Cons:** Transition validation is manual. No formal transition graph.

### Option B: XState (Formal State Machine Library)

Use [XState](https://xstate.js.org/) for a formally defined state machine with visual tooling.

```typescript
import { createMachine, interpret } from "xstate"

const editorMachine = createMachine({
  id: "editor",
  initial: "idle",
  states: {
    idle: {
      on: {
        SELECT_TOOL: "toolReady",
        SELECT_ANNOTATION: "selected",
      }
    },
    toolReady: {
      on: {
        CLICK_CANVAS: "drawing",
        SELECT_ANNOTATION: "selected",
      }
    },
    drawing: {
      on: {
        ADD_POINT: { actions: "addPoint" },
        COMPLETE: "idle",
        CANCEL: "toolReady",
      }
    },
    selected: {
      on: {
        DRAG_START: "dragging",
        ROTATE_START: "rotating",
        SCALE_START: "scaling",
        MARQUEE_START: "marquee",
        DESELECT: "idle",
        SELECT_TOOL: "toolReady",
      }
    },
    dragging: {
      on: { POINTER_UP: "cooldown" }
    },
    rotating: {
      on: { POINTER_UP: "cooldown" }
    },
    scaling: {
      on: { POINTER_UP: "cooldown" }
    },
    marquee: {
      on: { POINTER_UP: "cooldown" }
    },
    cooldown: {
      after: { 100: "selected" } // Auto-transition after 100ms
    },
    textEditing: {
      on: {
        COMMIT: "selected",
        CANCEL: "selected",
      }
    }
  }
})
```

**Pros:** Formal model — impossible transitions are rejected. Visual state chart tooling
for debugging. `after` transitions handle cooldown natively.
**Cons:** Adds ~15KB dependency. Learning curve. Integrating with Vue reactivity requires
`@xstate/vue`. Context management for carrying data between states adds boilerplate.

### Option C: Hybrid — Discriminated Union + Transition Map

Define allowed transitions as a lookup table, but keep implementation in plain Vue.

```typescript
const TRANSITIONS: Record<EditorMode, EditorMode[]> = {
  "idle":          ["tool-ready", "selected", "marquee"],
  "tool-ready":    ["drawing", "selected", "idle"],
  "drawing":       ["tool-ready", "idle"],
  "selected":      ["dragging", "rotating", "scaling", "marquee", "text-editing", "idle", "tool-ready"],
  "dragging":      ["cooldown"],
  "rotating":      ["cooldown"],
  "scaling":       ["cooldown"],
  "marquee":       ["cooldown", "selected"],
  "cooldown":      ["idle", "selected"],
  "text-editing":  ["selected"],
}

function transition(to: EditorMode, data?: Partial<EditorState>) {
  const from = state.value.mode
  if (!TRANSITIONS[from]?.includes(to)) {
    console.warn(`Invalid transition: ${from} → ${to}`)
    return false
  }
  state.value = { mode: to, ...data } as EditorState
  return true
}
```

**Pros:** Self-documenting transition rules. No external dependency. Validates transitions
at runtime with clear error messages. Easy to extend.
**Cons:** Slightly more code than Option A. Transition map must be kept in sync manually.

---

## Recommendation

**Option C (Hybrid)** is the best fit for this codebase:

1. **No new dependencies** — the project already has significant dependency surface. XState
   adds bundle weight and API complexity for a problem that doesn't need full actor-model
   capabilities.

2. **Explicit transition map** — makes it obvious which state changes are legal. New developers
   (or future Claude sessions) can read the map and understand the full system without tracing
   event handlers.

3. **Vue-native** — works with standard `ref()` and `computed()`. No adapter layer needed.

4. **Incremental adoption** — can be introduced alongside existing flags, with a migration
   path that moves one interaction at a time:
   - Phase 1: Introduce `useEditorStateMachine`, have it track `mode` alongside existing flags
   - Phase 2: Move `isDragging` / `isRotating` / `isScaling` into state machine
   - Phase 3: Move `isDrawing` and tool lifecycle into state machine
   - Phase 4: Remove old flags, update all guards to use `state.mode`

---

## Migration Strategy

### Phase 1 — Shadow Mode (Non-Breaking)

Create `useEditorStateMachine.ts` that mirrors existing flags into a unified state.
Existing code continues working. State machine is read-only, used for debugging/logging.

```typescript
// Derive mode from existing flags (read-only mirror)
const derivedMode = computed<EditorMode>(() => {
  if (move.isDragging.value) return "dragging"
  if (rotation.isRotating.value) return "rotating"
  if (scale.isScaling.value) return "scaling"
  if (marquee.isMarqueeSelecting.value) return "marquee"
  if (annotationStore.isDrawing) return "drawing"
  if (textEditState.editingId.value) return "text-editing"
  if (annotationStore.selectedAnnotationIds.length > 0) return "selected"
  if (annotationStore.activeTool && annotationStore.activeTool !== "selection") return "tool-ready"
  return "idle"
})
```

This immediately surfaces impossible states in dev tools without changing any behavior.

### Phase 2 — Replace Transform Flags

Replace `isDragging` / `isRotating` / `isScaling` / `isMarqueeSelecting` with state machine
transitions. These are the most tightly coupled flags and the source of most compound guards.

### Phase 3 — Replace Drawing + Tool Lifecycle

Move `isDrawing`, `activeTool`, and the drawing point accumulation into state machine states.

### Phase 4 — Remove Cooldown Timeouts

Replace `justFinished*` timeout flags with a proper `cooldown` state that auto-transitions.

---

## Files Affected

| File | Change |
|---|---|
| `composables/editor/useEditorStateMachine.ts` | **New** — state machine definition |
| `composables/editor/useEditorEventHandlers.ts` | Replace compound guards with `state.mode` checks |
| `composables/editor/useEditorMove.ts` | Remove `isDragging`, delegate to state machine |
| `composables/editor/useEditorRotation.ts` | Remove `isRotating`, delegate to state machine |
| `composables/editor/useEditorScale.ts` | Remove `isScaling`, delegate to state machine |
| `composables/editor/useEditorMarquee.ts` | Remove `isMarqueeSelecting`, delegate to state machine |
| `composables/editor/useEditorDragState.ts` | Remove entirely (replaced by `cooldown` state) |
| `composables/editor/useTextEditingState.ts` | Remove `editingId`, delegate to state machine |
| `stores/annotations.ts` | Remove `isDrawing`, `activeTool` reactivity (move to state machine) |
| `components/Editor/AnnotationLayer.vue` | Simplify click/deselect guards |
| `components/Editor/Handles/Transform.vue` | Read from state machine instead of individual composables |
| `components/Editor/Annotation.vue` | Read interaction state from state machine |
| `utils/annotations.ts` | `isSelectionMode()` reads from state machine |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Large refactor surface | Incremental migration via shadow mode (Phase 1) |
| Breaking existing interactions | Phase 1 is read-only — no behavior changes |
| Performance (reactive state object) | Single `shallowRef<EditorState>` — cheaper than 11 separate refs |
| Testing | State machine is pure functions — unit test transitions in isolation |
| Frozen bounds / selection rotation complexity | Keep these as separate concerns outside the mode state machine — they're persistent UI state, not interaction mode |
