<script setup lang="ts">
import type { ProjectListItem } from "#shared/types/projects.types"
import { FolderOpen, Plus, FileText, File, MessageSquare, ArrowRight } from "lucide-vue-next"

/**
 * Async component that fetches and displays recent projects
 * Must be wrapped in <Suspense> by parent
 */
defineProps<{
  organizationId: string
}>()

// Fetch projects during async setup
const projects = await $fetch<ProjectListItem[]>("/api/projects", {
  query: {
    sortBy: "updatedAt",
    sortOrder: "desc",
    limit: 6
  }
})

// Format date
const formatDate = (date: Date | string | null) => {
  if (!date) return "Never"
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = diff / (1000 * 60 * 60)

  if (hours < 1) return "Just now"
  if (hours < 24) return `${Math.floor(hours)}h ago`
  if (hours < 48) return "Yesterday"
  if (hours < 168) return `${Math.floor(hours / 24)}d ago`

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  })
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-2xl font-semibold">Recent Projects</h2>
        <p class="text-sm text-muted-foreground">Your recently updated projects</p>
      </div>
      <UiButton variant="outline" @click="navigateTo('/projects')"> View All </UiButton>
    </div>

    <div v-if="projects.length === 0" class="text-center py-12 border-2 border-dashed rounded-lg">
      <FolderOpen class="size-16 mx-auto text-muted-foreground mb-4" />
      <h3 class="text-lg font-semibold mb-2">No projects yet</h3>
      <p class="text-muted-foreground mb-4">Get started by creating your first project</p>
      <UiButton @click="navigateTo('/projects')">
        <Plus class="size-4 mr-2" />
        Create Project
      </UiButton>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <UiCard
        v-for="project in projects"
        :key="project.id"
        class="group overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
        @click="navigateTo(`/projects/${project.id}`)"
      >
        <UiCardHeader class="p-0">
          <div class="aspect-video bg-muted flex items-center justify-center">
            <FileText class="size-16 text-muted-foreground/30" />
          </div>
        </UiCardHeader>
        <UiCardContent class="p-4">
          <h3 class="font-semibold mb-1 group-hover:text-primary transition-colors line-clamp-1">
            {{ project.name }}
          </h3>
          <p v-if="project.description" class="text-sm text-muted-foreground mb-3 line-clamp-2">
            {{ project.description }}
          </p>

          <div class="flex items-center gap-4 text-xs text-muted-foreground">
            <div class="flex items-center gap-1">
              <File class="size-3" />
              {{ project._count.files }} {{ project._count.files === 1 ? "file" : "files" }}
            </div>
            <div class="flex items-center gap-1">
              <MessageSquare class="size-3" />
              {{ project.annotationCount }}
            </div>
          </div>

          <UiDivider class="my-3" />

          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>Updated {{ formatDate(project.updatedAt) }}</span>
            <ArrowRight class="size-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </UiCardContent>
      </UiCard>
    </div>
  </div>
</template>
