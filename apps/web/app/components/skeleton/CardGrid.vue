<script setup lang="ts">
/**
 * Skeleton loading state for a grid of cards
 */
withDefaults(
  defineProps<{
    count?: number
    columns?: 2 | 3 | 4
    showImage?: boolean
  }>(),
  {
    count: 3,
    columns: 3,
    showImage: true
  }
)

const gridClass = computed(() => {
  const cols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4"
  }
  return cols[3]
})
</script>

<template>
  <div :class="['grid gap-4', gridClass]">
    <UiCard v-for="i in count" :key="i" class="overflow-hidden">
      <UiCardHeader v-if="showImage" class="p-0">
        <div class="aspect-video bg-muted animate-pulse" />
      </UiCardHeader>
      <UiCardContent class="p-4 space-y-3">
        <div class="h-5 bg-muted rounded animate-pulse w-3/4" />
        <div class="h-3 bg-muted rounded animate-pulse w-full" />
        <div class="h-3 bg-muted rounded animate-pulse w-2/3" />
      </UiCardContent>
    </UiCard>
  </div>
</template>
