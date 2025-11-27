<template>
  <MenubarArrow v-bind="props" />
</template>

<script lang="ts" setup>
  import { MenubarArrow } from "reka-ui";
  import type { MenubarArrowProps } from "reka-ui";

  const props = withDefaults(defineProps<MenubarArrowProps>(), {
    width: 10,
    height: 5,
  });
</script>
