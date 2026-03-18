<template>
  <ListboxItemIndicator data-slot="listbox-indicator" v-bind="forwarded">
    <slot>
      <component :is="icon" :class="styles({ class: props.class })" />
    </slot>
  </ListboxItemIndicator>
</template>

<script lang="ts" setup>
import { Check } from "lucide-vue-next"
import { ListboxItemIndicator, useForwardPropsEmits } from "reka-ui"
import type { ListboxItemIndicatorProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<ListboxItemIndicatorProps & { class?: HTMLAttributes["class"]; icon?: Component }>(),
  {
    icon: () => Check
  }
)
const forwarded = useForwardPropsEmits(reactiveOmit(props, "class"))

const styles = tv({
  base: "size-4 shrink-0 text-primary"
})
</script>
