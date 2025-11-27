<template>
  <tbody data-slot="table-body" :class="styles({ class: props.class })">
    <slot />
  </tbody>
</template>

<script lang="ts" setup>
  import type { HTMLAttributes } from "vue";

  const props = defineProps<{
    class?: HTMLAttributes["class"];
  }>();

  const styles = tv({
    base: "[&_tr:last-child]:border-0",
  });
</script>
