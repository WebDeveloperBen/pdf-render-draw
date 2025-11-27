<template>
  <AlertDialogTitle
    data-slot="alert-dialog-title"
    v-bind="forwarded"
    :class="styles({ class: props.class })"
  >
    <slot>{{ title }}</slot>
  </AlertDialogTitle>
</template>

<script lang="ts" setup>
  import { AlertDialogTitle } from "reka-ui";
  import type { AlertDialogTitleProps } from "reka-ui";
  import type { HTMLAttributes } from "vue";

  const props = defineProps<
    AlertDialogTitleProps & {
      /** Text to display in the title */
      title?: string;
      /** Custom class(es) to add to the title */
      class?: HTMLAttributes["class"];
    }
  >();
  const forwarded = reactiveOmit(props, "class", "title");
  const styles = tv({ base: "text-lg font-semibold" });
</script>
