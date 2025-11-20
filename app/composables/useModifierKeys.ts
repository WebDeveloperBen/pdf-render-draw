/**
 * Feature-scoped Modifier Key Tracking
 *
 * Provides reactive state for modifier keys (Shift, Ctrl, Alt, Meta) that tools can use
 * to modify their behavior. Uses createInjectionState for feature-scoped state.
 *
 * Usage:
 * - Provider: useProvideModifierKeys() in PdfEditorProvider component
 * - Consumer: useModifierKeys() in any child component (tools, etc.)
 *
 * Common modifier patterns:
 * - Shift: Constrain, snap to increments, maintain proportions
 * - Alt/Option: From center, duplicate, inverse behavior
 * - Ctrl/Cmd: Precision mode, additional options
 */

import { createInjectionState } from '@vueuse/core'

const [useProvideModifierKeys, useModifierKeys] = createInjectionState(() => {
  // State - which keys are currently pressed
  const shift = ref(false)
  const ctrl = ref(false)
  const alt = ref(false)
  const meta = ref(false) // Cmd on Mac, Win key on Windows

  // Computed helpers for easy checking
  const isShiftPressed = computed(() => shift.value)
  const isCtrlPressed = computed(() => ctrl.value)
  const isAltPressed = computed(() => alt.value)
  const isMetaPressed = computed(() => meta.value)
  const isCmdOrCtrl = computed(() => meta.value || ctrl.value) // Cross-platform Cmd/Ctrl

  // Key down handler
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Shift') shift.value = true
    if (e.key === 'Control') ctrl.value = true
    if (e.key === 'Alt') alt.value = true
    if (e.key === 'Meta') meta.value = true
  }

  // Key up handler
  function handleKeyUp(e: KeyboardEvent) {
    if (e.key === 'Shift') shift.value = false
    if (e.key === 'Control') ctrl.value = false
    if (e.key === 'Alt') alt.value = false
    if (e.key === 'Meta') meta.value = false
  }

  // Reset all modifiers (useful when window loses focus)
  function resetAll() {
    shift.value = false
    ctrl.value = false
    alt.value = false
    meta.value = false
  }

  return {
    // State
    shift,
    ctrl,
    alt,
    meta,

    // Computed helpers
    isShiftPressed,
    isCtrlPressed,
    isAltPressed,
    isMetaPressed,
    isCmdOrCtrl,

    // Methods
    handleKeyDown,
    handleKeyUp,
    resetAll,
  }
})

export { useProvideModifierKeys, useModifierKeys }
