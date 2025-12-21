<script setup lang="ts">
/**
 * Skeleton loading state for a general section with header
 */
withDefaults(
  defineProps<{
    showHeader?: boolean
    showSubheader?: boolean
    showAction?: boolean
    lines?: number
  }>(),
  {
    showHeader: true,
    showSubheader: true,
    showAction: false,
    lines: 3
  }
)
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div v-if="showHeader" class="flex items-center justify-between">
      <div class="space-y-1">
        <div class="h-7 w-48 bg-muted rounded animate-pulse" />
        <div v-if="showSubheader" class="h-4 w-64 bg-muted rounded animate-pulse" />
      </div>
      <div v-if="showAction" class="h-9 w-24 bg-muted rounded animate-pulse" />
    </div>

    <!-- Content lines -->
    <div class="space-y-3">
      <div
        v-for="i in lines"
        :key="i"
        class="h-4 bg-muted rounded animate-pulse"
        :class="i === lines ? 'w-2/3' : 'w-full'"
      />
    </div>
  </div>
</template>
