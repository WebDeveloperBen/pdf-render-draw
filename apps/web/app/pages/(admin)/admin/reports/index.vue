<script setup lang="ts">
definePageMeta({
  layout: "admin"
})

useSeoMeta({ title: "Reports - Admin" })
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold">Reports</h1>
      <p class="text-muted-foreground mt-1">Platform analytics and usage reports</p>
    </div>

    <!-- Coming Soon -->
    <UiCard class="border-dashed">
      <UiCardContent class="flex flex-col items-center justify-center py-16">
        <Icon name="lucide:bar-chart-3" class="size-16 text-muted-foreground/30 mb-4" />
        <h3 class="text-lg font-semibold mb-2">Reports Coming Soon</h3>
        <p class="text-muted-foreground text-center max-w-md">
          Platform analytics, usage metrics, and custom reports will be available here.
        </p>
      </UiCardContent>
    </UiCard>
  </div>
</template>
