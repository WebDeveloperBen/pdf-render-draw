<template>
  <ComboboxTrigger
    data-slot="autocomplete-trigger"
    v-bind="forwarded"
    :class="styles({ class: props.class })"
  >
    <slot />
  </ComboboxTrigger>
</template>

<script lang="ts" setup>
  import { ComboboxTrigger } from "reka-ui";
  import type { ComboboxTriggerProps } from "reka-ui";
  import type { HTMLAttributes } from "vue";

  const props = defineProps<
    ComboboxTriggerProps & {
      /** Custom class(es) to add to the trigger */
      class?: HTMLAttributes["class"];
    }
  >();
  const forwarded = reactiveOmit(props, "class");
  const styles = tv({ base: "inline-flex shrink-0 cursor-pointer items-center justify-center" });
</script>
