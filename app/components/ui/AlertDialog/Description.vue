<template>
  <AlertDialogDescription
    data-slot="alert-dialog-description"
    v-bind="forwarded"
    :class="styles({ class: props.class })"
  >
    <slot>{{ description }}</slot>
  </AlertDialogDescription>
</template>

<script lang="ts" setup>
  import { AlertDialogDescription } from "reka-ui";
  import type { AlertDialogDescriptionProps } from "reka-ui";
  import type { HTMLAttributes } from "vue";

  const props = defineProps<
    AlertDialogDescriptionProps & {
      /** Text to display in the description */
      description?: string;
      /** Custom class(es) to add to the description */
      class?: HTMLAttributes["class"];
    }
  >();

  const forwarded = reactiveOmit(props, "class", "description");

  const styles = tv({
    base: "text-sm text-muted-foreground",
  });
</script>
