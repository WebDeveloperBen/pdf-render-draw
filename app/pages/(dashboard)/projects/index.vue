<script setup lang="ts">
import type { ProjectWithRelations } from "#shared/types/projects.types"
import { toast } from "vue-sonner"

useSeoMeta({ title: "Projects" })

const route = useRoute()
const isLoading = ref(true)
const projects = ref<ProjectWithRelations[]>([])
const searchQuery = ref("")
const showCreateDialog = ref(false)

// Fetch projects
const fetchProjects = async () => {
  isLoading.value = true
  try {
    const response = await $fetch<ProjectWithRelations[]>("/api/projects", {
      query: {
        search: searchQuery.value || undefined,
        sortBy: "updatedAt",
        sortOrder: "desc"
      }
    })
    projects.value = response
  } catch (error: any) {
    toast.error(error.data?.message || "Failed to load projects")
  } finally {
    isLoading.value = false
  }
}

// Handle project created - refetch list to ensure consistency
function handleProjectCreated() {
  fetchProjects()
}

// Format date
const formatDate = (date: Date | string | null) => {
  if (!date) return "Never"
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}

// Search with debounce
let searchTimeout: NodeJS.Timeout
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchProjects()
  }, 300)
})

onMounted(() => {
  fetchProjects()

  // Auto-open create dialog if ?create=true is in URL
  if (route.query.create === "true") {
    showCreateDialog.value = true
    // Clean up the URL
    navigateTo("/projects", { replace: true })
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Projects</h1>
        <p class="text-muted-foreground mt-1">Manage your building plan projects</p>
      </div>
      <UiButton @click="showCreateDialog = true">
        <Icon name="lucide:plus" class="size-4 mr-2" />
        New Project
      </UiButton>
    </div>

    <!-- Search and filters -->
    <div class="flex items-center gap-4">
      <div class="relative flex-1 max-w-md">
        <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <UiInput v-model="searchQuery" placeholder="Search projects..." class="pl-9" />
      </div>
    </div>

    <!-- Projects Grid -->
    <div v-if="isLoading" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <UiCard v-for="i in 6" :key="i" class="overflow-hidden">
        <UiCardHeader class="p-0">
          <div class="aspect-video bg-muted animate-pulse" />
        </UiCardHeader>
        <UiCardContent class="p-4 space-y-2">
          <div class="h-4 bg-muted rounded animate-pulse" />
          <div class="h-3 bg-muted rounded w-2/3 animate-pulse" />
        </UiCardContent>
      </UiCard>
    </div>

    <div v-else-if="projects.length === 0" class="text-center py-12">
      <Icon name="lucide:folder-open" class="size-16 mx-auto text-muted-foreground mb-4" />
      <h3 class="text-lg font-semibold mb-2">No projects yet</h3>
      <p class="text-muted-foreground mb-4">Get started by creating your first project</p>
      <UiButton @click="showCreateDialog = true">
        <Icon name="lucide:plus" class="size-4 mr-2" />
        Create Project
      </UiButton>
    </div>

    <div v-else class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <UiCard
        v-for="project in projects"
        :key="project.id"
        class="group overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
        @click="navigateTo(`/projects/${project.id}`)"
      >
        <UiCardHeader class="p-0">
          <div class="aspect-video bg-muted flex items-center justify-center">
            <Icon name="lucide:file-text" class="size-16 text-muted-foreground/30" />
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
              <Icon name="lucide:file-text" class="size-3" />
              {{ project._count?.files ?? 0 }} {{ project._count?.files === 1 ? "file" : "files" }}
            </div>
            <div class="flex items-center gap-1">
              <Icon name="lucide:message-square" class="size-3" />
              {{ project.annotationCount }}
            </div>
            <div v-if="project._count?.shares" class="flex items-center gap-1">
              <Icon name="lucide:share-2" class="size-3" />
              {{ project._count.shares }}
            </div>
          </div>

          <UiDivider class="my-3" />

          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <UiAvatar class="size-5">
                <UiAvatarFallback class="text-[10px]">
                  {{ project.creator?.name?.slice(0, 2)?.toUpperCase() || "?" }}
                </UiAvatarFallback>
              </UiAvatar>
              <span class="text-muted-foreground">{{ project.creator?.name || "Unknown" }}</span>
            </div>
            <span class="text-muted-foreground">{{ formatDate(project.updatedAt) }}</span>
          </div>
        </UiCardContent>
      </UiCard>
    </div>

    <!-- Create Project Modal -->
    <ProjectsCreateProjectModal v-model:open="showCreateDialog" @created="handleProjectCreated" />
  </div>
</template>
