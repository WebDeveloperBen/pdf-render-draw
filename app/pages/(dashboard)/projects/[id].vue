<script setup lang="ts">
import type { ProjectWithRelations, ProjectShareWithRelations } from "#shared/types/projects.types"
import { toast } from "vue-sonner"

const route = useRoute("projects-id")
const projectId = route.params.id

// Breadcrumb management
const { setLabel, clearLabel } = useBreadcrumbs()

useSeoMeta({ title: "Project Details" })

const isLoading = ref(true)
const isDeleting = ref(false)
const project = ref<ProjectWithRelations | null>(null)
const shares = ref<ProjectShareWithRelations[]>([])

// Share creation
const showShareDialog = ref(false)
const isCreatingShare = ref(false)
const newShare = ref({
  expiresAt: null as Date | null,
  password: "",
  allowDownload: true,
  allowAnnotations: false
})

// Fetch project details
const fetchProject = async () => {
  isLoading.value = true
  try {
    const data = await $fetch<ProjectWithRelations>(`/api/projects/${projectId}`)
    project.value = data
    // Set breadcrumb label to project name
    if (data.name) {
      setLabel(projectId, data.name)
    }
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to load project")
    navigateTo("/projects")
  } finally {
    isLoading.value = false
  }
}

// Clean up breadcrumb label on unmount
onUnmounted(() => {
  clearLabel(projectId)
})

// Fetch shares
const fetchShares = async () => {
  try {
    const data = await $fetch<ProjectShareWithRelations[]>(`/api/projects/${projectId}/shares`)
    shares.value = data
  } catch (error: any) {
    toast.error("Failed to load shares")
  }
}

// Create share
const handleCreateShare = async () => {
  isCreatingShare.value = true
  try {
    const share = await $fetch<ProjectShareWithRelations>(`/api/projects/${projectId}/shares`, {
      method: "POST",
      body: {
        expiresAt: newShare.value.expiresAt,
        password: newShare.value.password || null,
        allowDownload: newShare.value.allowDownload,
        allowAnnotations: newShare.value.allowAnnotations
      }
    })

    shares.value.unshift(share)
    toast.success("Share link created")
    showShareDialog.value = false
    newShare.value = {
      expiresAt: null,
      password: "",
      allowDownload: true,
      allowAnnotations: false
    }
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to create share")
  } finally {
    isCreatingShare.value = false
  }
}

// Delete share
const handleDeleteShare = async (shareId: string) => {
  try {
    await $fetch(`/api/projects/${projectId}/shares/${shareId}`, {
      method: "DELETE"
    })

    shares.value = shares.value.filter((s: ProjectShareWithRelations) => s.id !== shareId)
    toast.success("Share deleted")
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to delete share")
  }
}

// Delete project
const handleDeleteProject = async () => {
  if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
    return
  }

  isDeleting.value = true
  try {
    await $fetch(`/api/projects/${projectId}`, {
      method: "DELETE"
    })

    toast.success("Project deleted")
    navigateTo("/projects")
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to delete project")
    isDeleting.value = false
  }
}

// Copy share link
const copyShareLink = (token: string) => {
  const url = `${window.location.origin}/share/${token}`
  navigator.clipboard.writeText(url)
  toast.success("Share link copied to clipboard")
}

// Format date
const formatDate = (date: Date | string | null) => {
  if (!date) return "Never"
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

onMounted(() => {
  fetchProject()
  fetchShares()
})
</script>

<template>
  <div v-if="isLoading" class="space-y-6">
    <div class="h-8 bg-muted rounded w-1/3 animate-pulse" />
    <div class="h-64 bg-muted rounded animate-pulse" />
  </div>

  <div v-else-if="project" class="space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <UiButton variant="ghost" size="icon" @click="navigateTo('/projects')">
            <Icon name="lucide:arrow-left" class="size-4" />
          </UiButton>
          <h1 class="text-3xl font-bold">{{ project.name }}</h1>
        </div>
        <p v-if="project.description" class="text-muted-foreground ml-12">
          {{ project.description }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UiButton variant="outline" @click="showShareDialog = true">
          <Icon name="lucide:share-2" class="size-4 mr-2" />
          Share
        </UiButton>
        <UiButton variant="outline" @click="navigateTo(`/editor?projectId=${projectId}`)">
          <Icon name="lucide:edit" class="size-4 mr-2" />
          Open Editor
        </UiButton>
        <UiDropdownMenu>
          <UiDropdownMenuTrigger as-child>
            <UiButton variant="ghost" size="icon">
              <Icon name="lucide:more-vertical" class="size-4" />
            </UiButton>
          </UiDropdownMenuTrigger>
          <UiDropdownMenuContent align="end">
            <UiDropdownMenuItem title="Delete Project" class="text-destructive" @click="handleDeleteProject">
              <template #icon>
                <Icon name="lucide:trash" class="size-4" />
              </template>
            </UiDropdownMenuItem>
          </UiDropdownMenuContent>
        </UiDropdownMenu>
      </div>
    </div>

    <!-- Project Info Cards -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <UiCard>
        <UiCardHeader class="flex flex-row items-center justify-between pb-2">
          <UiCardTitle class="text-sm font-medium">Pages</UiCardTitle>
          <Icon name="lucide:file" class="size-4 text-muted-foreground" />
        </UiCardHeader>
        <UiCardContent>
          <div class="text-2xl font-bold">{{ project.pageCount }}</div>
        </UiCardContent>
      </UiCard>

      <UiCard>
        <UiCardHeader class="flex flex-row items-center justify-between pb-2">
          <UiCardTitle class="text-sm font-medium">Annotations</UiCardTitle>
          <Icon name="lucide:message-square" class="size-4 text-muted-foreground" />
        </UiCardHeader>
        <UiCardContent>
          <div class="text-2xl font-bold">{{ project.annotationCount }}</div>
        </UiCardContent>
      </UiCard>

      <UiCard>
        <UiCardHeader class="flex flex-row items-center justify-between pb-2">
          <UiCardTitle class="text-sm font-medium">Shares</UiCardTitle>
          <Icon name="lucide:share-2" class="size-4 text-muted-foreground" />
        </UiCardHeader>
        <UiCardContent>
          <div class="text-2xl font-bold">{{ shares.length }}</div>
        </UiCardContent>
      </UiCard>

      <UiCard>
        <UiCardHeader class="flex flex-row items-center justify-between pb-2">
          <UiCardTitle class="text-sm font-medium">Last Viewed</UiCardTitle>
          <Icon name="lucide:eye" class="size-4 text-muted-foreground" />
        </UiCardHeader>
        <UiCardContent>
          <div class="text-sm font-medium">{{ formatDate(project.lastViewedAt) }}</div>
        </UiCardContent>
      </UiCard>
    </div>

    <!-- PDF Preview -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>PDF Preview</UiCardTitle>
      </UiCardHeader>
      <UiCardContent>
        <div class="aspect-video bg-muted rounded-lg flex items-center justify-center border">
          <div class="text-center">
            <Icon name="lucide:file-text" class="size-24 mx-auto mb-4 text-muted-foreground/30" />
            <p class="text-lg font-medium">{{ project.pdfFileName }}</p>
            <p class="text-sm text-muted-foreground">Click "Open Editor" to view and annotate</p>
          </div>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Share Links -->
    <UiCard>
      <UiCardHeader>
        <div class="flex items-center justify-between">
          <div>
            <UiCardTitle>Share Links</UiCardTitle>
            <UiCardDescription>Manage public share links for this project</UiCardDescription>
          </div>
          <UiButton size="sm" @click="showShareDialog = true">
            <Icon name="lucide:plus" class="size-4 mr-2" />
            New Share
          </UiButton>
        </div>
      </UiCardHeader>
      <UiCardContent>
        <div v-if="shares.length === 0" class="text-center py-8 text-muted-foreground">
          <Icon name="lucide:link" class="size-12 mx-auto mb-2 opacity-50" />
          <p>No share links yet</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="share in shares"
            :key="share.id"
            class="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <code class="text-xs bg-muted px-2 py-1 rounded">{{ share.token.slice(0, 12) }}...</code>
                <UiBadge v-if="share.password" variant="outline" class="text-xs">Password Protected</UiBadge>
              </div>
              <div class="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Views: {{ share.viewCount }}</span>
                <span v-if="share.expiresAt">Expires: {{ formatDate(share.expiresAt) }}</span>
                <span v-else>No expiration</span>
                <span v-if="share.allowAnnotations">Annotations: Enabled</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <UiButton variant="ghost" size="sm" @click="copyShareLink(share.token)">
                <Icon name="lucide:copy" class="size-4" />
              </UiButton>
              <UiButton variant="ghost" size="sm" class="text-destructive" @click="handleDeleteShare(share.id)">
                <Icon name="lucide:trash" class="size-4" />
              </UiButton>
            </div>
          </div>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Project Metadata -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Project Information</UiCardTitle>
      </UiCardHeader>
      <UiCardContent class="space-y-3">
        <div class="flex items-center justify-between py-2 border-b">
          <span class="text-sm text-muted-foreground">Created By</span>
          <div class="flex items-center gap-2">
            <UiAvatar class="size-6">
              <UiAvatarFallback class="text-xs">
                {{ project.creator.name.slice(0, 2).toUpperCase() }}
              </UiAvatarFallback>
            </UiAvatar>
            <span class="text-sm font-medium">{{ project.creator.name }}</span>
          </div>
        </div>
        <div class="flex items-center justify-between py-2 border-b">
          <span class="text-sm text-muted-foreground">Created</span>
          <span class="text-sm font-medium">{{ formatDate(project.createdAt) }}</span>
        </div>
        <div class="flex items-center justify-between py-2 border-b">
          <span class="text-sm text-muted-foreground">Last Updated</span>
          <span class="text-sm font-medium">{{ formatDate(project.updatedAt) }}</span>
        </div>
        <div v-if="project.organization" class="flex items-center justify-between py-2">
          <span class="text-sm text-muted-foreground">Organization</span>
          <span class="text-sm font-medium">{{ project.organization.name }}</span>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Create Share Dialog -->
    <UiDialog v-model:open="showShareDialog">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>Create Share Link</UiDialogTitle>
          <UiDialogDescription>Generate a shareable link for this project</UiDialogDescription>
        </UiDialogHeader>

        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <UiLabel for="share-password">Password (Optional)</UiLabel>
            <UiInput
              id="share-password"
              v-model="newShare.password"
              type="password"
              placeholder="Leave empty for no password"
              :disabled="isCreatingShare"
            />
          </div>

          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <UiLabel>Allow Download</UiLabel>
              <p class="text-xs text-muted-foreground">Users can download the PDF</p>
            </div>
            <UiSwitch v-model:checked="newShare.allowDownload" :disabled="isCreatingShare" />
          </div>

          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <UiLabel>Allow Annotations</UiLabel>
              <p class="text-xs text-muted-foreground">Users can add annotations</p>
            </div>
            <UiSwitch v-model:checked="newShare.allowAnnotations" :disabled="isCreatingShare" />
          </div>
        </div>

        <UiDialogFooter>
          <UiButton variant="outline" :disabled="isCreatingShare" @click="showShareDialog = false"> Cancel </UiButton>
          <UiButton :disabled="isCreatingShare" @click="handleCreateShare">
            <Icon v-if="isCreatingShare" name="svg-spinners:90-ring-with-bg" class="size-4 mr-2" />
            Create Share Link
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
