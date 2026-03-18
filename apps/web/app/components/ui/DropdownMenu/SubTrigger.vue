<template>
  <DropdownMenuSubTrigger
    data-slot="dropdown-menu-sub-trigger"
    v-bind="forwarded"
    :class="styles({ inset, class: props.class })"
  >
    <slot>
      <component :is="icon" v-if="icon" class="size-4" />
      <span v-if="title">{{ title }}</span>
    </slot>
    <component :is="trailingIcon" class="ml-auto size-4 text-muted-foreground" />
  </DropdownMenuSubTrigger>
</template>

<script lang="ts" setup>
import { ChevronRight } from "lucide-vue-next"
import { DropdownMenuSubTrigger } from "reka-ui"
import type { DropdownMenuSubTriggerProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<
    DropdownMenuSubTriggerProps & {
      /**Custom class(es) to add to the element */
      class?: HTMLAttributes["class"]
      /** Wether an indentation should be added to the item or not */
      inset?: boolean
      /** The icon to display */
      icon?: Component
      /** The title for the item */
      title?: string
      /** The trailing icon to display */
      trailingIcon?: Component
    }
  >(),
  {
    trailingIcon: () => ChevronRight
  }
)
const forwarded = reactiveOmit(props, "class", "inset", "icon", "title", "trailingIcon")
const styles = tv({
  base: "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
  variants: {
    inset: {
      true: "pl-8"
    }
  }
})
</script>
