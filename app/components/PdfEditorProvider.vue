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
// Auto-cleanup on component unmount via useEventListener
useEventListener(window, 'keydown', modifierKeys.handleKeyDown)
useEventListener(window, 'keyup', modifierKeys.handleKeyUp)
useEventListener(window, 'blur', modifierKeys.resetAll)
</script>
