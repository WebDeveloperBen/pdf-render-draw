<template>
  <UiButton
    :title="label"
    data-sidebar="trigger"
    data-slot="sidebar-trigger"
    variant="ghost"
    size="icon"
    :class="sideBarTriggerStyles({ class: props.class })"
    @click="toggleSidebar"
  >
    <slot v-bind="{ state }">
      <component :is="icon" v-if="icon" />
      <span class="sr-only">{{ label }}</span>
    </slot>
  </UiButton>
</template>

<script lang="ts">
import { PanelLeft } from "lucide-vue-next"
import type { Component, HTMLAttributes } from "vue"

export const sideBarTriggerStyles = tv({
  base: "size-7"
})
</script>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /**
     * The icon to display in the trigger.
     * @default "lucide:panel-left"
     */
    icon?: Component
    /**
     * Additional classes to apply to the parent element.
     */
    class?: HTMLAttributes["class"]
    /**
     * The label for the trigger.
     * @default "Toggle Sidebar"
     */
    label?: string
  }>(),
  {
    icon: () => PanelLeft,
    label: "Toggle Sidebar"
  }
)

const { toggleSidebar, state } = useSidebar()
</script>
