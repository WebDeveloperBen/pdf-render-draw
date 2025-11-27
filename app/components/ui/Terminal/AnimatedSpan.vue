<template>
  <motion.div
    :initial="{ opacity: 0, y: -5 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: 0.3, delay: delay / 1000 }"
    :class="styles({ class: props.class })"
  >
    <slot />
  </motion.div>
</template>
<script lang="ts">
  import { motion } from "motion-v";
  import type { MotionProps } from "motion-v";
  import type { PrimitiveProps } from "reka-ui";
  import type { HTMLAttributes } from "vue";

  export interface AnimatedSpanProps extends Omit<MotionProps, "as" | "asChild">, PrimitiveProps {
    class?: HTMLAttributes["class"];
    delay?: number;
  }

  const styles = tv({ base: "grid text-sm font-normal tracking-tight" });
</script>

<script lang="ts" setup>
  const props = withDefaults(defineProps<AnimatedSpanProps>(), {
    delay: 0,
    as: "span",
  });
</script>
