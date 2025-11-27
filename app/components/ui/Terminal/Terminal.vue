<template>
  <Primitive :as :as-child :class="styles({ class: props.class })">
    <div class="flex flex-col gap-y-2 border-b border-border p-4">
      <div class="flex flex-row gap-x-2">
        <div
          v-for="(item, i) in buttonColors"
          :key="i"
          class="size-2 rounded-full"
          :class="[item]"
        />
      </div>
    </div>
    <pre class="overflow-auto p-4"><code class="grid gap-y-1 overflow-auto"><slot /></code></pre>
  </Primitive>
</template>
<script lang="ts">
  import type { PrimitiveProps } from "reka-ui";
  import type { HTMLAttributes } from "vue";

  const styles = tv({
    base: "z-0 h-full max-h-[400px] w-full max-w-lg rounded-lg border border-border bg-background",
  });
</script>

<script lang="ts" setup>
  const props = withDefaults(
    defineProps<
      PrimitiveProps & {
        class?: HTMLAttributes["class"];
        buttonColors?: string[];
      }
    >(),
    {
      buttonColors: () => ["bg-red-500", "bg-yellow-500", "bg-green-500"],
    }
  );
</script>
