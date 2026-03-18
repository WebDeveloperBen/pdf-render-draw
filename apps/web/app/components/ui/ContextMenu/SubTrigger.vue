<template>
  <ContextMenuSubTrigger
    data-slot="context-menu-sub-trigger"
    :data-inset="inset"
    v-bind="forwarded"
    :class="styles({ inset, class: props.class })"
  >
    <slot>
      <span v-if="title">{{ title }}</span>
    </slot>
    <component :is="icon" class="ml-auto size-4" />
  </ContextMenuSubTrigger>
</template>

<script lang="ts" setup>
import { ChevronRight } from "lucide-vue-next"
import { ContextMenuSubTrigger } from "reka-ui"
import type { ContextMenuSubTriggerProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<
    ContextMenuSubTriggerProps & {
      /**Custom class(es) to add to the element */
      class?: HTMLAttributes["class"]
      /** Wether an indentation should be added to the item or not */
      inset?: boolean
      /** The icon to display */
      icon?: Component
      /** The title for the item */
      title?: string
    }
  >(),
  {
    icon: () => ChevronRight
  }
)
const forwarded = reactiveOmit(props, "class", "inset", "icon", "title")
const styles = tv({
  base: "flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset=true]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  variants: {
    inset: {
      true: "pl-8"
    }
  }
})
</script>
