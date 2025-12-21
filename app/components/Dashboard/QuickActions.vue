<script setup lang="ts">
/**
 * Async component that fetches stats for quick action cards
 * Must be wrapped in <Suspense> by parent
 */
defineProps<{
  organizationId: string
}>()

// Fetch project count during async setup
const projects = await $fetch<ProjectWithRelations[]>("/api/projects", {
  query: {
    limit: 1
  }
})

// For now just show if they have projects - could fetch actual count from a stats endpoint
const projectCount = projects.length > 0 ? "View" : "0"
</script>

<template>
  <div class="grid gap-4 md:grid-cols-3">
    <UiCard class="hover:shadow-md transition-shadow cursor-pointer" @click="navigateTo('/projects')">
      <UiCardHeader class="flex flex-row items-center justify-between pb-2">
        <UiCardTitle class="text-sm font-medium">All Projects</UiCardTitle>
        <Icon name="lucide:folder-open" class="size-4 text-muted-foreground" />
      </UiCardHeader>
      <UiCardContent>
        <div class="text-2xl font-bold">{{ projectCount }}</div>
        <p class="text-xs text-muted-foreground mt-1">View all your projects</p>
      </UiCardContent>
    </UiCard>

    <UiCard class="hover:shadow-md transition-shadow cursor-pointer" @click="navigateTo('/editor')">
      <UiCardHeader class="flex flex-row items-center justify-between pb-2">
        <UiCardTitle class="text-sm font-medium">Open Editor</UiCardTitle>
        <Icon name="lucide:edit" class="size-4 text-muted-foreground" />
      </UiCardHeader>
      <UiCardContent>
        <div class="text-2xl font-bold">
          <Icon name="lucide:arrow-right" class="size-6" />
        </div>
        <p class="text-xs text-muted-foreground mt-1">Start annotating PDFs</p>
      </UiCardContent>
    </UiCard>

    <UiCard class="hover:shadow-md transition-shadow cursor-pointer" @click="navigateTo('/support')">
      <UiCardHeader class="flex flex-row items-center justify-between pb-2">
        <UiCardTitle class="text-sm font-medium">Help & Support</UiCardTitle>
        <Icon name="lucide:help-circle" class="size-4 text-muted-foreground" />
      </UiCardHeader>
      <UiCardContent>
        <div class="text-2xl font-bold">
          <Icon name="lucide:arrow-right" class="size-6" />
        </div>
        <p class="text-xs text-muted-foreground mt-1">Get help and resources</p>
      </UiCardContent>
    </UiCard>
  </div>
</template>
