<template>
  <ComboboxItemIndicator data-slot="autocomplete-item-indicator" v-bind="props">
    <slot><component :is="icon" class="size-4" /></slot>
  </ComboboxItemIndicator>
</template>

<script lang="ts" setup>
import { Check } from "lucide-vue-next"
import { ComboboxItemIndicator } from "reka-ui"
import type { ComboboxItemIndicatorProps } from "reka-ui"
import type { Component } from "vue"

const props = withDefaults(
  defineProps<
    ComboboxItemIndicatorProps & {
      icon?: Component
    }
  >(),
  {
    icon: () => Check
  }
)
</script>
