<template>
  <NumberFieldDecrement data-slot="number-field-decrement" v-bind="forwarded" :class="styles({ class: props.class })">
    <slot>
      <component :is="props.icon" />
    </slot>
  </NumberFieldDecrement>
</template>

<script lang="ts" setup>
import { Minus } from "lucide-vue-next"
import { NumberFieldDecrement, useForwardProps } from "reka-ui"
import type { NumberFieldDecrementProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<
    NumberFieldDecrementProps & {
      class?: HTMLAttributes["class"]
      icon?: Component
    }
  >(),
  { icon: () => Minus }
)

const forwarded = useForwardProps(reactiveOmit(props, "class"))

const styles = tv({
  base: "flex h-full shrink-0 items-center justify-center bg-transparent p-3 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
})
</script>
