<template>
  <UiSeparator
    orientation="horizontal"
    data-slot="item-separator"
    :decorative="props.decorative"
    :class="itemSeparatorStyles({ class: props.class })"
  />
</template>

<script lang="ts">
  import type { UiSeparatorProps } from "@/components/ui/Separator.vue";

  export const itemSeparatorStyles = tv({
    base: "my-0",
  });
</script>

<script lang="ts" setup>
  const props = withDefaults(defineProps<Omit<UiSeparatorProps, "orientation">>(), {});
</script>
