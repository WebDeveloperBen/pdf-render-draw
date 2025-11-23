<script setup lang="ts">
import DrawingEditor from "~/components/DrawingEditor.vue"

// Page-level state management with v-model
const pdfUrl = ref("/house.pdf")
const pdfScale = ref("1:100")

// Handle file uploads from the editor (still emitted for parent awareness)
function handleFileUploaded(file: File) {
  console.log('File uploaded:', file.name)
  // URL is already updated via v-model
}

// Watch for scale changes to persist to settings
watch(pdfScale, (newScale) => {
  const settingsStore = useSettingStore()
  settingsStore.setPdfScale(newScale)
})

// Initialize scale from settings on mount
onMounted(() => {
  const settingsStore = useSettingStore()
  pdfScale.value = settingsStore.getPdfScale
})
</script>

<template>
  <DrawingEditor
    v-model:pdf-url="pdfUrl"
    v-model:pdf-scale="pdfScale"
    :initial-tool="'measure'"
    @file-uploaded="handleFileUploaded"
  />
</template>

<style>
/* Remove scrollbars from html and body for full-screen editor experience */
html, body {
  overflow: hidden;
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
}
</style>
