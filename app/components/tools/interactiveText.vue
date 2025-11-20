<script setup lang="ts">
/**
 * State
 */

const { handleRemoveText } = useText()
const { getSelectedText, isTextEditing, getSelectedAnnotationType } = storeToRefs(useMainStore())
const { setTextEditingStatus, updateTextWidth } = useMainStore()
const rendererStore = useRendererStore()

/**
 * Computed
 */

const popoverStyle = computed(() => {
  let text = getSelectedText.value

  if (!text)
    return {
      top: 0,
      left: 0,
    }
  const canvasPos = rendererStore.getCanvasPos
  const pageScale = rendererStore.getScale

  // Determine if the text is flipped
  const isFlipped = text.scaleY < 0

  // Calculate the adjusted top position based on whether the text is flipped
  let adjustedTop = text.y
  if (isFlipped) {
    // If the text is flipped, adjust the top position to be at the 'new' bottom
    adjustedTop + text.height
  } else {
    // If the text is not flipped, position the popover at the actual bottom
    adjustedTop += text.height * Math.abs(text.scaleY)
  }

  // The popover should be centered horizontally, so calculate the left position accordingly
  const left =
    canvasPos.scrollLeft + text.x * pageScale + (text.width * pageScale * Math.abs(text.scaleX)) / 4
  const top = canvasPos.scrollTop + adjustedTop * pageScale
  return {
    top: `${top}px`,
    left: `${left}px`,
  }
})
async function handleRemoveAsync() {
  await handleRemoveText()
}
</script>

<template>
  <div class="absolute" :style="popoverStyle" v-if="isTextEditing">
    <ViewerCanvasPopover
      :isOpen="
        (isTextEditing && getSelectedAnnotationType === 'text') ||
        getSelectedAnnotationType === 'selection'
      "
      size="sm"
    >
      <template #content>
        <div>
          <form
            @submit.prevent="setTextEditingStatus(false)"
            class="flex gap-2 h-14 justify-between px-2 items-center"
          >
            <input
              v-if="getSelectedText"
              type="text"
              v-focus
              class="px-2 w-full h-8"
              @input="updateTextWidth"
              v-model="getSelectedText.text"
              placeholder="add text here..."
            />
            <div class="flex items-center justify-center gap-2">
              <button aria-label="update text button" type="submit">
                <IconCheck class="w-5 h-5 text-green-600" />
              </button>
              <button aria-label="delete text button" type="button" @click="handleRemoveAsync">
                <UiIconsTrash class="w-5 h-5 text-red-500" />
              </button>
            </div>
          </form>
        </div>
      </template>
    </ViewerCanvasPopover>
  </div>
</template>
