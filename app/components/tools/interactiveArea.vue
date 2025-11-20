<script setup lang="ts">
/**
 * State
 */

// const useArea = useAreaTool()
const { handleRemoveAreaByName } = useArea()
const { getSelectedArea, getSelectedAnnotationType } = storeToRefs(useMainStore())
const rendererStore = useRendererStore()

/**
 * Computed
 */

const trashButtonStyle = computed(() => {
  if (!getSelectedArea.value) return {}

  const position = getSelectedArea.value.iconLocation
  if (!position) return
  const iconSize = 40
  const scale = rendererStore.getScale
  const canvasPos = rendererStore.getCanvasPos
  // Adjust position based on scale
  const posX = position.x * scale - iconSize / 2
  const posY = position.y * scale - iconSize / 2

  const top = canvasPos.scrollTop + posY
  const left = canvasPos.scrollLeft + posX

  return {
    top: `${top}px`,
    left: `${left}px`,
  }
})

const showTrashCan = computed(
  () => getSelectedArea.value && getSelectedAnnotationType.value === "area"
)

async function handleAsyncRemove() {
  await handleRemoveAreaByName()
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
    <UiIconsTrash
      class="w-10 h-10 transition-colors p-2 hover:bg-gray-200 hover:shadow-lg rounded-full text-red-500"
    />
  </button>
</template>
