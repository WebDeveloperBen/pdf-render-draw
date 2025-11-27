<template>
  <PopoverArrow data-slot="popover-arrow" v-bind="forwarded" />
</template>

<script lang="ts" setup>
  import { PopoverArrow, useForwardProps } from "reka-ui";
  import type { PopoverArrowProps } from "reka-ui";

  const props = withDefaults(defineProps<PopoverArrowProps>(), {
    width: 10,
    height: 5,
  });

  const forwarded = useForwardProps(props);
</script>
