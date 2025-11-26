<script setup lang="ts">
interface Props {
  width?: number
  height?: number
  x?: number
  y?: number
  squares?: Array<[number, number]>
  strokeDasharray?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  width: 40,
  height: 40,
  x: -1,
  y: -1,
  strokeDasharray: "0",
  squares: undefined,
  class: undefined
})

// Generate unique ID for the pattern
const id = useId()
</script>

<template>
  <svg
    aria-hidden="true"
    :class="[
      'pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30 stroke-gray-400/30',
      props.class
    ]"
    v-bind="$attrs"
  >
    <defs>
      <pattern
        :id="id"
        :width="props.width"
        :height="props.height"
        patternUnits="userSpaceOnUse"
        :x="props.x"
        :y="props.y"
      >
        <path
          :d="`M.5 ${props.height}V.5H${props.width}`"
          fill="none"
          :stroke-dasharray="props.strokeDasharray"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" stroke-width="0" :fill="`url(#${id})`" />
    <svg v-if="props.squares" :x="props.x" :y="props.y" class="overflow-visible">
      <rect
        v-for="([squareX, squareY], index) in props.squares"
        :key="`${squareX}-${squareY}-${index}`"
        stroke-width="0"
        :width="props.width - 1"
        :height="props.height - 1"
        :x="squareX * props.width + 1"
        :y="squareY * props.height + 1"
      />
    </svg>
  </svg>
</template>
