<template>
  <ComboboxArrow
    data-slot="autocomplete-arrow"
    v-bind="props"
    :class="styles({ class: props.class })"
  />
</template>

<script lang="ts" setup>
  import { ComboboxArrow } from "reka-ui";
  import type { ComboboxArrowProps } from "reka-ui";
  import type { HTMLAttributes } from "vue";

  const props = defineProps<
    ComboboxArrowProps & {
      class?: HTMLAttributes["class"];
    }
  >();

  const styles = tv({ base: "fill-muted stroke-border" });
</script>
