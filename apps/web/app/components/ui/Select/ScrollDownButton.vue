<template>
  <SelectScrollDownButton
    data-slot="select-scroll-down-button"
    :class="styles({ class: props.class })"
    v-bind="forwarded"
  >
    <slot> <component :is="icon" class="size-4" /></slot>
  </SelectScrollDownButton>
</template>

<script lang="ts" setup>
import { ChevronDown } from "lucide-vue-next"
import { SelectScrollDownButton } from "reka-ui"
import type { SelectScrollDownButtonProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<
    SelectScrollDownButtonProps & {
      /** Icon to render */
      icon?: Component
      class?: HTMLAttributes["class"]
    }
  >(),
  {
    icon: () => ChevronDown
  }
)
const forwarded = reactiveOmit(props, "icon")
const styles = tv({
  base: "flex cursor-default items-center justify-center py-1"
})
</script>
