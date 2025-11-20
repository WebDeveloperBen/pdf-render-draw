<template>
  <slot />
</template>

<script setup lang="ts">
/**
 * PDF Editor Feature Provider
 *
 * Sets up feature-scoped state and event listeners for the PDF editor.
 * Only active when this component is mounted (i.e., on PDF editor pages).
 *
 * Provides:
 * - Modifier key tracking (Shift, Ctrl, Alt, Meta)
 * - Window-level keyboard event listeners
 * - Automatic cleanup on unmount/navigation
 *
 * Usage: Wrap your PDF editor page content with this component
 */

const modifierKeys = useProvideModifierKeys()

// Set up global keyboard listeners when PDF editor is active
onMounted(() => {
  window.addEventListener('keydown', modifierKeys.handleKeyDown)
  window.addEventListener('keyup', modifierKeys.handleKeyUp)
  window.addEventListener('blur', modifierKeys.resetAll)
})

// Clean up listeners when navigating away from PDF editor
onUnmounted(() => {
  window.removeEventListener('keydown', modifierKeys.handleKeyDown)
  window.removeEventListener('keyup', modifierKeys.handleKeyUp)
  window.removeEventListener('blur', modifierKeys.resetAll)
})
</script>
