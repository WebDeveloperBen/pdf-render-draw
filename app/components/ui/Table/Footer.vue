<template>
  <tfoot data-slot="table-footer" :class="styles({ class: props.class })">
    <slot />
  </tfoot>
</template>

<script lang="ts" setup>
  import type { HTMLAttributes } from "vue";

  const props = defineProps<{
    class?: HTMLAttributes["class"];
  }>();

  const styles = tv({
    base: "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
  });
</script>
