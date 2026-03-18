<template>
  <ContextMenuItemIndicator v-bind="forwarded" :class="styles({ class: props.class })">
    <slot>
      <component :is="icon" v-if="icon" class="size-4" />
    </slot>
  </ContextMenuItemIndicator>
</template>

<script lang="ts" setup>
import { ContextMenuItemIndicator } from "reka-ui"
import type { ContextMenuItemIndicatorProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = defineProps<
  ContextMenuItemIndicatorProps & {
    /** The icon to display */
    icon?: Component
    class?: HTMLAttributes["class"]
  }
>()
const forwarded = reactiveOmit(props, "icon")

const styles = tv({
  base: "flex items-center justify-center"
})
</script>
