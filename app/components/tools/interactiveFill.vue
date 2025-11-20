<script setup lang="ts">
/**
 * State
 */

const { handleRemoveFillByName } = useFill()
const { getSelectedFill, isDrawingFill, getSelectedAnnotationType } = storeToRefs(useMainStore())
const rendererStore = useRendererStore()

/**
 * Computed
 */

const trashButtonStyle = computed(() => {
  if (!getSelectedFill.value) return {}
  const canvasPos = rendererStore.getCanvasPos
  const scale = rendererStore.getScale
  const iconSize = 40

  // Calculate the popover position based on the canvas position and scale
  const top =
    canvasPos.scrollTop +
    getSelectedFill.value!.y * scale +
    (getSelectedFill.value!.height / 2) * scale -
    iconSize / 2
  const left =
    canvasPos.scrollLeft +
    getSelectedFill.value!.x * scale +
    (getSelectedFill.value!.width / 2) * scale -
    iconSize / 2
  return {
    top: `${top}px`,
    left: `${left}px`,
  }
})

const showTrashCan = computed(() => {
  const result =
    getSelectedFill.value && getSelectedAnnotationType.value === "fill" && !isDrawingFill.value
  return result
})

async function handleAsyncRemove() {
  await handleRemoveFillByName()
}
</script>

<template>
  <button
    v-if="showTrashCan"
    :style="trashButtonStyle"
    aria-label="delete text button"
    type="button"
    class="absolute z-20 bg-white border border-gray-300 hover:border-gray-600 rounded-full shadow-lg"
    @click="handleAsyncRemove"
  >
    <!-- class="absolute z-20 bg-green-800 rounded-full shadow-lg" -->
    <UiIconsTrash
      class="w-10 h-10 transition-colors p-2 hover:bg-gray-200 hover:shadow-lg rounded-full text-red-500"
    />
  </button>
</template>
