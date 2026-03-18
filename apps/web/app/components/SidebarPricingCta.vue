<script setup lang="ts">
import { Sparkles } from "lucide-vue-next"

const { state } = useSidebar()
const isCollapsed = computed(() => state.value === "collapsed")
const { planName, isFreeTier, limits } = useSubscription()

// Only show CTA for users who could benefit from upgrading
const showCta = computed(() => isFreeTier.value || planName.value === "starter")

const displayPlanName = computed(() => {
  if (planName.value === "free") return "Free"
  if (planName.value === "starter") return "Starter"
  return planName.value
})

const projectsLabel = computed(() => {
  const p = limits.value.projects
  return p === -1 ? "Unlimited projects" : `${p} project${p !== 1 ? "s" : ""}`
})
</script>

<template>
  <div v-if="showCta" class="px-2 pb-2">
    <!-- Collapsed state: just show icon -->
    <NuxtLink
      v-if="isCollapsed"
      to="/pricing"
      class="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-primary/20 to-primary/5 text-primary transition-colors hover:from-primary/30 hover:to-primary/10"
    >
      <Sparkles class="size-4" />
    </NuxtLink>

    <!-- Expanded state: full CTA card -->
    <div
      v-else
      class="relative overflow-hidden rounded-lg border border-primary/20 bg-linear-to-br from-primary/10 via-primary/5 to-transparent p-3"
    >
      <!-- Subtle shine effect -->
      <div
        class="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]"
      />

      <div class="relative space-y-2">
        <div class="flex items-center gap-2">
          <div class="flex size-6 items-center justify-center rounded-md bg-primary/20">
            <Sparkles class="size-3.5 text-primary" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs font-semibold text-foreground">{{ displayPlanName }} Plan</span>
            <span class="text-[10px] text-muted-foreground">{{ projectsLabel }}</span>
          </div>
        </div>

        <NuxtLink to="/pricing">
          <UiButton
            size="sm"
            variant="default"
            class="w-full justify-center text-xs"
            icon="lucide:arrow-right"
            icon-placement="right"
          >
            Upgrade
          </UiButton>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style>
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }

  50%,
  100% {
    transform: translateX(100%);
  }
}
</style>
