<script setup lang="ts">
import { toast } from "vue-sonner"

useSeoMeta({ title: "Dashboard" })

const session = authClient.useSession()
const isLoading = ref(true)
const recentProjects = ref<ProjectWithRelations[]>([])

// Fetch recent projects
const fetchRecentProjects = async () => {
  isLoading.value = true
  try {
    const response = await $fetch<ProjectWithRelations[]>("/api/projects", {
      query: {
        sortBy: "updatedAt",
        sortOrder: "desc",
        limit: 6
      }
    })
    recentProjects.value = response
  } catch (error: any) {
    toast.error("Failed to load recent projects")
  } finally {
    isLoading.value = false
  }
}

const handleSignOut = async () => {
  await authClient.signOut()
  navigateTo("/login")
}

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

onMounted(() => {
  if (session.value) {
    fetchRecentProjects()
  }
})
</script>

<template>
  <div v-if="!session" class="space-y-4">
    <p class="text-muted-foreground">Please sign in to continue.</p>
    <UiButton @click="navigateTo('/login')"> Go to Login </UiButton>
  </div>

  <div v-else class="space-y-6">
    <!-- Welcome Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Welcome back, {{ session.data?.user.name }}!</h1>
        <p class="text-muted-foreground mt-1">Here's what's happening with your projects</p>
      </div>
      <UiButton variant="outline" @click="handleSignOut"> Sign Out </UiButton>
    </div>

    <!-- Quick Actions -->
    <div class="grid gap-4 md:grid-cols-3">
      <UiCard class="hover:shadow-md transition-shadow cursor-pointer" @click="navigateTo('/projects')">
        <UiCardHeader class="flex flex-row items-center justify-between pb-2">
          <UiCardTitle class="text-sm font-medium">All Projects</UiCardTitle>
          <Icon name="lucide:folder-open" class="size-4 text-muted-foreground" />
        </UiCardHeader>
        <UiCardContent>
          <div class="text-2xl font-bold">{{ recentProjects.length }}</div>
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

    <!-- Recent Projects -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-2xl font-semibold">Recent Projects</h2>
          <p class="text-sm text-muted-foreground">Your recently updated projects</p>
        </div>
        <UiButton variant="outline" @click="navigateTo('/projects')"> View All </UiButton>
      </div>

      <div v-if="isLoading" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <UiCard v-for="i in 3" :key="i" class="overflow-hidden">
          <UiCardHeader class="p-0">
            <div class="aspect-video bg-muted animate-pulse" />
          </UiCardHeader>
          <UiCardContent class="p-4 space-y-2">
            <div class="h-4 bg-muted rounded animate-pulse" />
            <div class="h-3 bg-muted rounded w-2/3 animate-pulse" />
          </UiCardContent>
        </UiCard>
      </div>

      <div v-else-if="recentProjects.length === 0" class="text-center py-12 border-2 border-dashed rounded-lg">
        <Icon name="lucide:folder-open" class="size-16 mx-auto text-muted-foreground mb-4" />
        <h3 class="text-lg font-semibold mb-2">No projects yet</h3>
        <p class="text-muted-foreground mb-4">Get started by creating your first project</p>
        <UiButton @click="navigateTo('/projects')">
          <Icon name="lucide:plus" class="size-4 mr-2" />
          Create Project
        </UiButton>
      </div>

      <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <UiCard
          v-for="project in recentProjects"
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
                <Icon name="lucide:file" class="size-3" />
                {{ project.pageCount }} {{ project.pageCount === 1 ? "page" : "pages" }}
              </div>
              <div class="flex items-center gap-1">
                <Icon name="lucide:message-square" class="size-3" />
                {{ project.annotationCount }}
              </div>
            </div>

            <UiDivider class="my-3" />

            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span>Updated {{ formatDate(project.updatedAt) }}</span>
              <Icon name="lucide:arrow-right" class="size-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </UiCardContent>
        </UiCard>
      </div>
    </div>

    <!-- Getting Started Guide -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Getting Started with MetreMate</UiCardTitle>
        <UiCardDescription>Quick guide to help you get the most out of the app</UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="space-y-4">
        <div class="flex items-start gap-3">
          <div
            class="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold"
          >
            1
          </div>
          <div class="flex-1">
            <h4 class="font-medium mb-1">Upload Your Building Plans</h4>
            <p class="text-sm text-muted-foreground">
              Create a new project and upload your PDF building plans to get started.
            </p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <div
            class="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold"
          >
            2
          </div>
          <div class="flex-1">
            <h4 class="font-medium mb-1">Measure and Annotate</h4>
            <p class="text-sm text-muted-foreground">
              Use the powerful editor tools to measure distances, areas, and add annotations directly on your plans.
            </p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <div
            class="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold"
          >
            3
          </div>
          <div class="flex-1">
            <h4 class="font-medium mb-1">Share with Your Team</h4>
            <p class="text-sm text-muted-foreground">
              Generate shareable links to collaborate with clients and team members.
            </p>
          </div>
        </div>
      </UiCardContent>
      <UiCardFooter>
        <UiButton variant="outline" @click="navigateTo('/support')"> Learn More </UiButton>
      </UiCardFooter>
    </UiCard>
  </div>
</template>
