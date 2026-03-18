<template>
  <RadioGroupIndicator data-slot="radio-group-indicator" v-bind="forwarded" :class="styles({ class: props.class })">
    <slot>
      <component
        :is="icon"
        v-if="icon"
        class="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary fill-primary stroke-primary"
      />
      <span
        v-else
        class="absolute top-1/2 left-1/2 block size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
      />
    </slot>
  </RadioGroupIndicator>
</template>

<script lang="ts" setup>
import { RadioGroupIndicator } from "reka-ui"
import type { RadioGroupIndicatorProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = defineProps<
  RadioGroupIndicatorProps & {
    /** Custom class(es) to add to the parent */
    class?: HTMLAttributes["class"]
    /** Icon to show */
    icon?: Component
  }
>()
const forwarded = reactiveOmit(props, "class", "icon")
const styles = tv({
  base: "relative flex items-center justify-center"
})
</script>
