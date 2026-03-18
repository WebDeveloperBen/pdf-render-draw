<template>
  <SelectScrollUpButton :class="styles({ class: props.class })" data-slot="select-scroll-up-button" v-bind="forwarded">
    <slot>
      <component :is="icon" class="size-4" />
    </slot>
  </SelectScrollUpButton>
</template>

<script lang="ts" setup>
import { ChevronUp } from "lucide-vue-next"
import { SelectScrollUpButton } from "reka-ui"
import type { SelectScrollUpButtonProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<
    SelectScrollUpButtonProps & {
      /** Icon to render */
      icon?: Component
      class?: HTMLAttributes["class"]
    }
  >(),
  {
    icon: () => ChevronUp
  }
)
const forwarded = reactiveOmit(props, "icon")
const styles = tv({
  base: "flex cursor-default items-center justify-center py-1"
})
</script>
