<script setup lang="ts">
/**
 * Auto-sizing SVG label with background.
 *
 * Measures the rendered text via getBBox() and draws a tight-fitting
 * background rect with configurable padding. Falls back to a character-
 * width estimate for SSR export contexts where getBBox() is unavailable.
 */

const props = withDefaults(
  defineProps<{
    text: string | number
    transform: string
    fontSize?: number
    fontWeight?: string
    fill?: string
    background?: string
    backgroundOpacity?: number
    borderRadius?: number
    paddingX?: number
    paddingY?: number
  }>(),
  {
    fontSize: 10,
    fontWeight: "bold",
    fill: "black",
    background: "white",
    backgroundOpacity: 1,
    borderRadius: 3,
    paddingX: 6,
    paddingY: 3
  }
)

const textEl = ref<SVGTextElement>()

// Character-width estimate for initial render and SSR export
function estimateWidth(): number {
  return String(props.text).length * props.fontSize * 0.6
}

const textWidth = ref(estimateWidth())
const textHeight = ref(props.fontSize * 1.2)

function measure() {
  if (!textEl.value) return
  try {
    const b = textEl.value.getBBox()
    textWidth.value = b.width
    textHeight.value = b.height
  } catch {
    // SSR or detached — keep estimate
  }
}

onMounted(measure)
watch(
  () => props.text,
  () => nextTick(measure)
)
</script>

<template>
  <g :transform="transform" class="tool-label">
    <rect
      :x="-(textWidth / 2 + paddingX)"
      :y="-(textHeight / 2 + paddingY)"
      :width="textWidth + paddingX * 2"
      :height="textHeight + paddingY * 2"
      :fill="background"
      :opacity="backgroundOpacity"
      :rx="borderRadius"
    />
    <text
      ref="textEl"
      x="0"
      y="0"
      :fill="fill"
      :font-size="fontSize"
      :font-weight="fontWeight"
      text-anchor="middle"
      dominant-baseline="central"
    >
      {{ text }}
    </text>
  </g>
</template>

<style scoped>
.tool-label text {
  pointer-events: none;
  user-select: none;
}
</style>
