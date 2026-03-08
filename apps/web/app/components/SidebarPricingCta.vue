<script setup lang="ts">

const { state } = useSidebar()
const isCollapsed = computed(() => state.value === "collapsed")
</script>

<template>
  <div class="px-2 pb-2">
    <!-- Collapsed state: just show icon -->
    <NuxtLink v-if="isCollapsed" to="/pricing"
      class="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-primary/20 to-primary/5 text-primary transition-colors hover:from-primary/30 hover:to-primary/10">
      <Icon name="lucide:sparkles" class="size-4" />
    </NuxtLink>

    <!-- Expanded state: full CTA card -->
    <div v-else
      class="relative overflow-hidden rounded-lg border border-primary/20 bg-linear-to-br from-primary/10 via-primary/5 to-transparent p-3">
      <!-- Subtle shine effect -->
      <div
        class="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]" />

      <div class="relative space-y-2">
        <div class="flex items-center gap-2">
          <div class="flex size-6 items-center justify-center rounded-md bg-primary/20">
            <Icon name="lucide:sparkles" class="size-3.5 text-primary" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs font-semibold text-foreground">Free Plan</span>
            <span class="text-[10px] text-muted-foreground">1 project</span>
          </div>
        </div>

        <NuxtLink to="/pricing">
          <UiButton size="sm" variant="default" class="w-full justify-center text-xs" icon="lucide:arrow-right"
            icon-placement="right">
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
