<template>
  <MenubarSubTrigger
    data-slot="menubar-sub-trigger"
    v-bind="forwarded"
    :data-inset="inset"
    :class="styles({ inset, class: props.class })"
  >
    <slot>
      <component :is="icon" v-if="icon" class="size-4" />
      <span v-if="title">{{ title }}</span>
    </slot>
    <component :is="trailingIcon" class="ml-auto size-4 text-muted-foreground" />
  </MenubarSubTrigger>
</template>

<script lang="ts" setup>
import { ChevronRight } from "lucide-vue-next"
import { MenubarSubTrigger } from "reka-ui"
import type { MenubarSubTriggerProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<
    MenubarSubTriggerProps & {
      class?: HTMLAttributes["class"]
      inset?: boolean
      icon?: Component
      title?: string
      trailingIcon?: Component
    }
  >(),
  {
    trailingIcon: () => ChevronRight
  }
)
const forwarded = reactiveOmit(props, "class", "inset", "icon", "title", "trailingIcon")
const styles = tv({
  base: "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[inset=true]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
  variants: {
    inset: {
      true: "pl-8"
    }
  }
})
</script>
