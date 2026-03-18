<template>
  <UiButton
    data-slot="navbar-trigger"
    variant="ghost"
    :aria-label="ariaLabel"
    size="icon-sm"
    :class="styles({ class: props.class })"
    @click="
      ($event: MouseEvent) => {
        injectedValues?.toggleNav()
        props.onClick?.($event)
      }
    "
  >
    <component :is="icon" />
    <span class="sr-only">Toggle Navbar</span>
  </UiButton>
</template>

<script lang="ts" setup>
import { Menu } from "lucide-vue-next"
import type { Component, HTMLAttributes } from "vue"

import { navProviderKey } from "./Provider.vue"

const injectedValues = inject(navProviderKey)

if (!injectedValues) {
  throw createError({
    statusCode: 500,
    message: "Nav context not found. Make sure to wrap your component with <NavProvider>."
  })
}

const props = withDefaults(
  defineProps<{
    ariaLabel?: string
    class?: HTMLAttributes["class"]
    onClick?: (event: MouseEvent) => void
    icon?: Component
  }>(),
  {
    ariaLabel: "Toggle Navbar",
    icon: () => Menu
  }
)

const styles = tv({
  base: "-ml-2 min-lg:hidden"
})
</script>
