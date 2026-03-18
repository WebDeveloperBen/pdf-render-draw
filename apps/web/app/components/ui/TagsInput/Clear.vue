<template>
  <TagsInputClear data-slot="tags-input-clear" v-bind="props" :class="styles({ class: props.class })">
    <slot>
      <component :is="icon" v-if="icon" class="h-3.5 w-3.5" />
    </slot>
  </TagsInputClear>
</template>

<script lang="ts" setup>
import { X } from "lucide-vue-next"
import { TagsInputClear } from "reka-ui"
import type { TagsInputClearProps } from "reka-ui"
import type { Component, HtmlHTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<TagsInputClearProps & { icon?: Component; class?: HtmlHTMLAttributes["class"] }>(),
  {
    icon: () => X
  }
)
const styles = tv({
  base: "flex items-center justify-center rounded bg-transparent p-1 opacity-40 transition hover:bg-muted-foreground hover:opacity-100 focus:opacity-100 focus-visible:outline-none"
})
</script>
