/**
 * useInteractionMode - Interaction state machine
 *
 * Single source of truth for editor interaction mode (drag, rotate, scale, marquee).
 * Replaces scattered boolean flags and timeout hacks with a typed transition map.
 *
 * Does NOT own tool drawing state (isDrawing, points, etc.) — that stays in useBaseTool.
 */

const COOLDOWN_MS = 100

export type InteractionMode = "idle" | "selected" | "dragging" | "rotating" | "scaling" | "marquee" | "cooldown"

const TRANSITIONS: Record<InteractionMode, readonly InteractionMode[]> = {
  idle: ["selected", "marquee"],
  selected: ["dragging", "rotating", "scaling", "marquee", "idle"],
  dragging: ["cooldown"],
  rotating: ["cooldown"],
  scaling: ["cooldown"],
  marquee: ["cooldown", "selected"],
  cooldown: ["idle", "selected"]
}

/** Modes that are not active pointer interactions */
const PASSIVE_MODES: ReadonlySet<InteractionMode> = new Set(["idle", "selected", "cooldown"])

export const useInteractionMode = createSharedComposable(() => {
  const mode = ref<InteractionMode>("idle")
  const annotationStore = useAnnotationStore()

  /** True during any active pointer interaction (drag/rotate/scale/marquee) */
  const isInteracting = computed(() => !PASSIVE_MODES.has(mode.value))

  /** True when interactions are blocked (active interaction or cooldown) */
  const isLocked = computed(() => isInteracting.value || mode.value === "cooldown")

  /** True when a new interaction can begin */
  const canStartInteraction = computed(() => mode.value === "idle" || mode.value === "selected")

  /** True when click-to-select should be suppressed.
   *  Combines interaction-layer lock with tool-layer isDrawing. */
  const shouldSuppressClick = computed(() => isLocked.value || annotationStore.isDrawing)

  /** Type-safe mode check — reactive in templates and computeds */
  function isMode(target: InteractionMode): boolean {
    return mode.value === target
  }

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

  let cooldownTimer: ReturnType<typeof setTimeout> | null = null

  function enterCooldown(returnTo: "idle" | "selected" = "idle") {
    if (cooldownTimer) clearTimeout(cooldownTimer)
    mode.value = "cooldown"
    cooldownTimer = setTimeout(() => {
      cooldownTimer = null
      if (mode.value === "cooldown") {
        mode.value = returnTo
      }
    }, COOLDOWN_MS)
  }

  /** End an interaction and enter cooldown.
   *  returnTo controls where cooldown exits to (default: idle) */
  function endInteraction(returnTo: "idle" | "selected" = "idle") {
    if (!isInteracting.value) return
    enterCooldown(returnTo)
  }

  // --- Selection ↔ mode sync ---
  // Keep idle/selected in sync with whether annotations are selected.
  // flush: 'sync' ensures the mode is updated before any code that runs
  // after a selection change (e.g. startDrag) reads it.
  watch(
    () => annotationStore.selectedAnnotationIds.length > 0,
    (hasSelection) => {
      if (hasSelection && (mode.value === "idle" || mode.value === "cooldown")) {
        if (cooldownTimer) {
          clearTimeout(cooldownTimer)
          cooldownTimer = null
        }
        mode.value = "selected"
      } else if (!hasSelection && mode.value === "selected") {
        mode.value = "idle"
      }
    },
    { flush: "sync" }
  )

  /** Clean up timers */
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
    isMode,
    transition,
    endInteraction,
    dispose
  }
})
