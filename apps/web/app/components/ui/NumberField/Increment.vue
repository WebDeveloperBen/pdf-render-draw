<template>
  <NumberFieldIncrement data-slot="number-field-increment" v-bind="forwarded" :class="styles({ class: props.class })">
    <slot>
      <component :is="props.icon" />
    </slot>
  </NumberFieldIncrement>
</template>

<script lang="ts" setup>
import { Plus } from "lucide-vue-next"
import { NumberFieldIncrement, useForwardProps } from "reka-ui"
import type { NumberFieldIncrementProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<
    NumberFieldIncrementProps & {
      class?: HTMLAttributes["class"]
      icon?: Component
    }
  >(),
  { icon: () => Plus }
)

const forwarded = useForwardProps(reactiveOmit(props, "class"))

const styles = tv({
  base: "flex h-full shrink-0 items-center justify-center bg-transparent p-3 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
})
</script>
