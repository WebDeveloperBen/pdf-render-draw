<template>
  <UiAlertDialogPortal :to="to">
    <slot name="overlay">
      <UiAlertDialogOverlay />
    </slot>
    <AlertDialogContent
      data-slot="alert-dialog-content"
      :class="styles({ class: props.class })"
      v-bind="{ ...forwarded, ...$attrs }"
    >
      <slot />
    </AlertDialogContent>
  </UiAlertDialogPortal>
</template>

<script lang="ts" setup>
  import { AlertDialogContent, useForwardPropsEmits } from "reka-ui";
  import type { AlertDialogContentEmits, AlertDialogContentProps } from "reka-ui";
  import type { HTMLAttributes } from "vue";

  defineOptions({ inheritAttrs: false });

  const props = defineProps<
    AlertDialogContentProps & {
      /** Custom class(es) to add to the `AlertDialogContent` */
      class?: HTMLAttributes["class"];
      /** The element to render the portal into */
      to?: string | HTMLElement;
    }
  >();
  const emit = defineEmits<AlertDialogContentEmits>();
  const forwarded = useForwardPropsEmits(reactiveOmit(props, "class", "to"), emit);

  const styles = tv({
    base: "fixed top-[50%] left-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 md:w-full",
  });
</script>
