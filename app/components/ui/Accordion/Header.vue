<template>
  <AccordionHeader
    data-slot="accordion-header"
    v-bind="forwarded"
    :class="accordionHeaderStyle({ class: props.class })"
  >
    <slot />
  </AccordionHeader>
</template>

<script lang="ts">
  import { AccordionHeader } from "reka-ui";
  import type { AccordionHeaderProps } from "reka-ui";
  import type { HTMLAttributes } from "vue";

  export const accordionHeaderStyle = tv({ base: "flex" });
</script>

<script lang="ts" setup>
  const props = defineProps<
    AccordionHeaderProps & {
      /**
       * Custom class to apply to the component
       */
      class?: HTMLAttributes["class"];
    }
  >();

  const forwarded = reactiveOmit(props, "class");
</script>
