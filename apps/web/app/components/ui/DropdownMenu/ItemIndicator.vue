<template>
  <DropdownMenuItemIndicator
    data-slot="dropdown-menu-item-indicator"
    v-bind="forwarded"
    :class="styles({ class: props.class })"
  >
    <slot>
      <component :is="icon" v-if="icon" class="size-4" />
    </slot>
  </DropdownMenuItemIndicator>
</template>

<script lang="ts" setup>
import { DropdownMenuItemIndicator } from "reka-ui"
import type { DropdownMenuItemIndicatorProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = defineProps<
  DropdownMenuItemIndicatorProps & {
    /** The icon to display */
    icon?: Component
    /** Custom class(es) to add to the parent */
    class?: HTMLAttributes["class"]
  }
>()
const forwarded = reactiveOmit(props, "class", "icon")

const styles = tv({
  base: "flex items-center justify-center"
})
</script>
