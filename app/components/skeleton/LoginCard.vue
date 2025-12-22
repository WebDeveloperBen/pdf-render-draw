<script setup lang="ts">
/**
 * Skeleton loading state for the login card
 */
</script>

<template>
  <UiCard class="w-full max-w-md">
    <UiCardHeader>
      <div class="h-7 w-24 bg-muted rounded animate-pulse" />
      <div class="h-4 w-56 bg-muted rounded animate-pulse mt-1" />
    </UiCardHeader>
    <UiCardContent class="space-y-4">
      <!-- Email field -->
      <div class="space-y-2">
        <div class="h-4 w-12 bg-muted rounded animate-pulse" />
        <div class="h-10 w-full bg-muted rounded-md animate-pulse" />
      </div>
      <!-- Password field -->
      <div class="space-y-2">
        <div class="h-4 w-16 bg-muted rounded animate-pulse" />
        <div class="h-10 w-full bg-muted rounded-md animate-pulse" />
      </div>
    </UiCardContent>
    <UiCardFooter class="flex flex-col gap-2">
      <div class="h-10 w-full bg-muted rounded-md animate-pulse" />
      <div class="h-10 w-full bg-muted rounded-md animate-pulse" />
    </UiCardFooter>
  </UiCard>
</template>
