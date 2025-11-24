<template>
  <rect
    v-if="marqueeBounds"
    :x="marqueeBounds.x"
    :y="marqueeBounds.y"
    :width="marqueeBounds.width"
    :height="marqueeBounds.height"
    fill="rgba(59, 130, 246, 0.1)"
    stroke="#3b82f6"
    stroke-width="1"
    stroke-dasharray="4 4"
    class="marquee-box"
    pointer-events="none"
  />
</template>

<script setup lang="ts">
import { useEditorMarquee } from "~/composables/editor/useEditorMarquee"

const marquee = useEditorMarquee()
const { marqueeBounds } = marquee
</script>
