<script setup lang="ts">
import { Sparkles } from "lucide-vue-next"

defineProps<{
  feature: string
  requiredPlan?: string
}>()

const { planName } = useSubscription()
</script>

<template>
  <div
    class="flex flex-col items-center gap-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-center"
  >
    <div class="flex size-10 items-center justify-center rounded-full bg-primary/10">
      <Sparkles class="size-5 text-primary" />
    </div>
    <div class="space-y-1">
      <p class="font-semibold">{{ feature }} requires an upgrade</p>
      <p class="text-sm text-muted-foreground">
        <template v-if="requiredPlan"> Available on the {{ requiredPlan }} plan and above. </template>
        <template v-else> Upgrade your plan to unlock this feature. </template>
        You're currently on <span class="font-medium capitalize">{{ planName }}</span
        >.
      </p>
    </div>
    <UiButton to="/pricing" size="sm">
      <Sparkles class="mr-2 size-4" />
      View Plans
    </UiButton>
  </div>
</template>
