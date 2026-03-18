<template>
  <MenubarRadioItem data-slot="menubar-radio-item" v-bind="forwarded" :class="styles({ class: props.class })">
    <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <UiMenubarItemIndicator>
        <component :is="icon" v-if="icon" class="size-4" />
        <span v-else class="block size-2 rounded-full bg-current" />
      </UiMenubarItemIndicator>
    </span>
    <slot>{{ title }}</slot>
  </MenubarRadioItem>
</template>

<script lang="ts" setup>
import { MenubarRadioItem, useForwardPropsEmits } from "reka-ui"
import type { MenubarRadioItemEmits, MenubarRadioItemProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = defineProps<
  MenubarRadioItemProps & {
    /** Custom class(es) to add to the parent */
    class?: HTMLAttributes["class"]
    /** The icon to display */
    icon?: Component
    /** The title of the component */
    title?: string
  }
>()

const emits = defineEmits<MenubarRadioItemEmits>()
const forwarded = useForwardPropsEmits(reactiveOmit(props, "class", "icon", "title"), emits)

const styles = tv({
  base: "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
})
</script>
