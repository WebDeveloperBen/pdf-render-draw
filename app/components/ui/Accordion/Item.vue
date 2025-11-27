<template>
  <AccordionItem
    v-slot="slotProps"
    data-slot="accordion-item"
    v-bind="forwarded"
    :class="accordionItemStyle({ class: props.class })"
  >
    <slot v-bind="slotProps" />
  </AccordionItem>
</template>

<script lang="ts">
  import { AccordionItem } from "reka-ui";
  import type { AccordionItemProps } from "reka-ui";
  import type { HTMLAttributes } from "vue";

  export const accordionItemStyle = tv({ base: "border-b last:border-b-0" });
</script>

<script setup lang="ts">
  const props = defineProps<
    AccordionItemProps & {
      /**
       * Custom class to apply to the component
       */
      class?: HTMLAttributes["class"];
    }
  >();

  const forwarded = reactiveOmit(props, "class");
</script>
