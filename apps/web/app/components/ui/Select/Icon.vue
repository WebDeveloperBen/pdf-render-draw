<template>
  <SelectIcon data-slot="select-icon" v-bind="forwarded" class="flex items-center justify-center">
    <slot>
      <component :is="icon" :class="styles({ class: props.class })" />
    </slot>
  </SelectIcon>
</template>

<script lang="ts" setup>
import { ChevronDown } from "lucide-vue-next"
import { SelectIcon, useForwardProps } from "reka-ui"
import type { SelectIconProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<
    SelectIconProps & {
      /** Icon to render */
      icon?: Component
      /** Custom class(es) to add to the parent */
      class?: HTMLAttributes["class"]
    }
  >(),
  {
    icon: () => ChevronDown
  }
)
const forwarded = useForwardProps(reactiveOmit(props, "class"))

const styles = tv({
  base: "size-4 shrink-0 opacity-50"
})
</script>
