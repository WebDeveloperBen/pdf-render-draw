<!--
  V2 Editor Test Page

  Tests the new modular V2 editor implementation
  Built from PLAN.md architecture
-->
<script setup lang="ts">
import V2Editor from "~/components/editor/v2/V2Editor.vue"
</script>

<template>
  <div class="debug-page">
    <V2Editor />
  </div>
</template>

<style scoped>
.debug-page {
  min-height: 100vh;
  background: #f9fafb;
}
</style>
