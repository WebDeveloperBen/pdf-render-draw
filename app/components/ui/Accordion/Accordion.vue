<template>
  <AccordionRoot v-slot="rootSlotProps" data-slot="accordion" v-bind="forwarded">
    <slot v-bind="rootSlotProps" :items="items">
      <template v-for="(item, i) in items" :key="i">
        <UiAccordionItem v-slot="itemSlotProps" :disabled="item.disabled" :value="item.value">
          <slot v-bind="{ ...itemSlotProps, ...rootSlotProps, items, item }" name="header">
            <UiAccordionHeader>
              <slot v-bind="{ ...itemSlotProps, ...rootSlotProps, items, item }" name="trigger">
                <UiAccordionTrigger :title="item.title" :icon="item.icon" />
              </slot>
            </UiAccordionHeader>
          </slot>
          <slot name="content" v-bind="{ ...itemSlotProps, ...rootSlotProps, items, item }">
            <UiAccordionContent :content="item.content" />
          </slot>
        </UiAccordionItem>
      </template>
    </slot>
  </AccordionRoot>
</template>

<script lang="ts">
  import { AccordionRoot, useForwardPropsEmits } from "reka-ui";
  import type { AccordionRootEmits, AccordionRootProps } from "reka-ui";

  /**
   * Interface that represents a single item in the accordion
   */
  export interface AccordionItem {
    title?: string;
    content?: string;
    value: string;
    disabled?: boolean;
    icon?: string;
    [key: string]: any;
  }
</script>

<script setup lang="ts">
  const props = withDefaults(
    defineProps<
      AccordionRootProps & {
        items?: AccordionItem[];
      }
    >(),
    { type: "single", collapsible: true, items: () => [] }
  );

  const emits = defineEmits<AccordionRootEmits>();
  const forwarded = useForwardPropsEmits(reactiveOmit(props, "items"), emits);
</script>
