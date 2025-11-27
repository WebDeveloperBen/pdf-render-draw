<template>
  <Icon v-bind="props" :icon="props.name" />
</template>

<script lang="ts" setup>
  import { Icon } from "@iconify/vue";
  import type { IconProps } from "@iconify/vue";

  const props = defineProps<
    Omit<IconProps, "icon"> & {
      /**
       * The name of the icon to display.
       */
      name: string;
    }
  >();
</script>
