<template>
  <SelectItemIndicator data-slot="select-item-indicator" v-bind="forwarded" class="flex items-center justify-center">
    <slot>
      <component :is="icon" :class="styles({ class: props.class })" />
    </slot>
  </SelectItemIndicator>
</template>

<script lang="ts" setup>
import { Check } from "lucide-vue-next"
import { SelectItemIndicator } from "reka-ui"
import type { SelectItemIndicatorProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<
    SelectItemIndicatorProps & {
      /** Icon to render */
      icon?: Component
      /** Custom class(es) to add to the parent */
      class?: HTMLAttributes["class"]
    }
  >(),
  {
    icon: () => Check
  }
)
const forwarded = reactiveOmit(props, "class", "icon")
const styles = tv({
  base: "size-4"
})
</script>
