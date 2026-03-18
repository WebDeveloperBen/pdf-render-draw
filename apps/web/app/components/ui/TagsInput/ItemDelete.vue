<template>
  <TagsInputItemDelete data-slot="tags-input-item-delete" v-bind="forwarded" :class="styles({ class: props.class })">
    <slot>
      <component :is="icon" v-if="icon" class="m-auto size-3" />
    </slot>
  </TagsInputItemDelete>
</template>

<script lang="ts" setup>
import { X } from "lucide-vue-next"
import { TagsInputItemDelete } from "reka-ui"
import type { TagsInputItemDeleteProps } from "reka-ui"
import type { Component, HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<TagsInputItemDeleteProps & { icon?: Component; class?: HTMLAttributes["class"] }>(),
  {
    icon: () => X
  }
)
const forwarded = reactiveOmit(props, "class", "icon")
const styles = tv({
  base: "flex items-center justify-center p-0 text-muted-foreground/80 transition-[color,box-shadow] outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
})
</script>
