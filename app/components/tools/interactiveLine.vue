<script setup lang="ts">
/**
 * State
 */

// const useLine = useLineTool()
const { handleRemoveLineByName } = useLine()
const { getSelectedLine, getSelectedAnnotationType } = storeToRefs(useMainStore())

const rendererStore = useRendererStore()

/**
 * Computed
 */

const trashButtonStyle = computed(() => {
  if (!getSelectedLine.value) return {}

  const position = getSelectedLine.value.iconLocation
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
  () => getSelectedLine.value && getSelectedAnnotationType.value === "line"
)

async function handleAsyncDelete() {
  await handleRemoveLineByName()
}
</script>

<template>
  <button
    v-if="showTrashCan"
    :style="trashButtonStyle"
    aria-label="delete text button"
    type="button"
    class="absolute z-20 bg-white rounded-full shadow-lg"
    @click="handleAsyncDelete"
  >
    <UiIconsTrash
      class="w-10 h-10 p-2 hover:bg-gray-200 hover:shadow-lg rounded-full text-red-500"
    />
  </button>
</template>
