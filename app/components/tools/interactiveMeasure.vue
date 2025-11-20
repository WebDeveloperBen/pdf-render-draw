<script setup lang="ts">
/**
 * State
 */

// const useMeasure = useMeasureTool()
const { handleRemoveMeasurement } = useMeasure()
const { getSelectedMeasurement, getSelectedAnnotationType } = storeToRefs(useMainStore())
const { getCanvasPos, getScale } = storeToRefs(useRendererStore())

/**
 * Computed
 */

const trashButtonStyle = computed(() => {
  // Assuming you want to position the popover at the midpoint of the first line
  const firstLine = getSelectedMeasurement.value?.lines[0]

  if (!firstLine || !firstLine.midpoint) {
    return {}
  }

  const top = getCanvasPos.value.scrollTop + firstLine.midpoint.y * getScale.value - 10
  const left = getCanvasPos.value.scrollLeft + firstLine.midpoint.x * getScale.value - 10

  return {
    top: `${top}px`,
    left: `${left}px`,
  }
})
const showTrashCan = computed(
  () => getSelectedMeasurement.value && getSelectedAnnotationType.value === "measure"
)
</script>

<template>
  <button
    v-if="showTrashCan"
    :style="trashButtonStyle"
    aria-label="delete text button"
    type="button"
    class="absolute z-20 bg-white border border-gray-300 hover:border-gray-600 rounded-full shadow-lg"
    @click="handleRemoveMeasurement"
  >
    <UiIconsTrash
      class="w-10 h-10 hover:scale-105 p-2 hover:bg-gray-200 hover:shadow-lg rounded-full text-red-500"
    />
  </button>
</template>
