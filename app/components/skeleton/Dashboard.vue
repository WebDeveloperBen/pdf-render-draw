<script setup lang="ts">
/**
 * Full dashboard skeleton for initial page load
 */
</script>

<template>
  <div class="space-y-6">
    <!-- Welcome Header -->
    <div class="flex items-center justify-between">
      <div class="space-y-2">
        <div class="h-9 w-72 bg-muted rounded animate-pulse" />
        <div class="h-4 w-56 bg-muted rounded animate-pulse" />
      </div>
      <div class="h-9 w-24 bg-muted rounded animate-pulse" />
    </div>

    <!-- Quick Actions -->
    <div class="grid gap-4 md:grid-cols-3">
      <UiCard v-for="i in 3" :key="i">
        <UiCardHeader class="flex flex-row items-center justify-between pb-2">
          <div class="h-4 w-24 bg-muted rounded animate-pulse" />
          <div class="size-4 bg-muted rounded animate-pulse" />
        </UiCardHeader>
        <UiCardContent>
          <div class="h-8 w-12 bg-muted rounded animate-pulse" />
          <div class="h-3 w-32 bg-muted rounded animate-pulse mt-2" />
        </UiCardContent>
      </UiCard>
    </div>

    <!-- Recent Projects -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <div class="space-y-1">
          <div class="h-7 w-40 bg-muted rounded animate-pulse" />
          <div class="h-4 w-52 bg-muted rounded animate-pulse" />
        </div>
        <div class="h-9 w-20 bg-muted rounded animate-pulse" />
      </div>
      <SkeletonCardGrid :count="3" />
    </div>

    <!-- Getting Started -->
    <UiCard>
      <UiCardHeader>
        <div class="h-6 w-36 bg-muted rounded animate-pulse" />
        <div class="h-4 w-64 bg-muted rounded animate-pulse mt-1" />
      </UiCardHeader>
      <UiCardContent class="space-y-4">
        <div v-for="i in 3" :key="i" class="flex items-start gap-3">
          <div class="size-8 bg-muted rounded-full animate-pulse" />
          <div class="flex-1 space-y-2">
            <div class="h-4 w-48 bg-muted rounded animate-pulse" />
            <div class="h-3 w-full bg-muted rounded animate-pulse" />
          </div>
        </div>
      </UiCardContent>
    </UiCard>
  </div>
</template>
