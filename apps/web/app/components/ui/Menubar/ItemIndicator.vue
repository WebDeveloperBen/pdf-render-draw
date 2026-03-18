<template>
  <MenubarItemIndicator v-bind="forwarded" :class="styles({ class: props.class })">
    <slot>
      <component :is="icon" v-if="icon" class="size-4" />
    </slot>
  </MenubarItemIndicator>
</template>

<script lang="ts" setup>
import { MenubarItemIndicator } from "reka-ui"
import type { MenubarItemIndicatorProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = defineProps<
  MenubarItemIndicatorProps & {
    /** The icon to display */
    icon?: Component
    /** The class(es) to apply to the parent */
    class?: HTMLAttributes["class"]
  }
>()
const forwarded = reactiveOmit(props, "class", "icon")
const styles = tv({
  base: "flex shrink-0 items-center justify-center"
})
</script>
