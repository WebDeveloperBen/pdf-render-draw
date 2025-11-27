<template>
  <UiSheetPortal :to="to">
    <slot name="overlay">
      <UiSheetOverlay :is-blurred />
    </slot>
    <DialogContent
      data-slot="sheet-content"
      :class="styles({ side, isBlurred, class: props.class })"
      v-bind="{ ...forwarded, ...$attrs }"
    >
      <slot>
        <slot name="header">
          <UiSheetHeader>
            <slot name="title">
              <UiSheetTitle v-if="title" :title="title" />
            </slot>
            <slot name="description">
              <UiSheetDescription v-if="description" :description="description" />
            </slot>
          </UiSheetHeader>
        </slot>
        <slot name="content" />
        <slot name="footer" />
      </slot>
      <slot name="close">
        <UiSheetClose :icon="icon" />
      </slot>
    </DialogContent>
  </UiSheetPortal>
</template>

<script lang="ts" setup>
  import { DialogContent, useForwardPropsEmits } from "reka-ui";
  import type { DialogContentEmits, DialogContentProps } from "reka-ui";
  import type { HTMLAttributes } from "vue";

  defineOptions({ inheritAttrs: false });

  const props = withDefaults(
    defineProps<
      DialogContentProps & {
        icon?: string;
        title?: string;
        description?: string;
        class?: HTMLAttributes["class"];
        side?: VariantProps<typeof styles>["side"];
        to?: string | HTMLElement;
        isBlurred?: boolean;
      }
    >(),
    { isBlurred: true }
  );
  const emits = defineEmits<DialogContentEmits>();
  const forwarded = useForwardPropsEmits(
    reactiveOmit(props, "icon", "title", "description", "class", "to", "side", "isBlurred"),
    emits
  );

  const styles = tv({
    base: "fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500",
    variants: {
      side: {
        top: "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
      isBlurred: {
        true: "backdrop-blur-sm",
        false: "backdrop-blur-none",
      },
    },
    defaultVariants: {
      side: "left",
    },
  });
</script>
