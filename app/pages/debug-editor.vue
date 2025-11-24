<!--
  Debug Editor Test Page

  This page is for testing the spec-driven SVG editor rebuild
  Following PLAN.md incremental approach
-->
<script setup lang="ts">
import DebugEditor from '~/components/debug-svg-editor/DebugEditor.vue'
</script>

<template>
  <div class="debug-page">
    <DebugEditor />
  </div>
</template>

<style scoped>
.debug-page {
  min-height: 100vh;
  background: #f9fafb;
}
</style>
