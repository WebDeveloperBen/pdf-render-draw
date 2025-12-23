<script setup lang="ts">
import type {
  ProjectWithRelations,
  ProjectShareWithRelations,
  ProjectFileWithUploader
} from "#shared/types/projects.types"
import { toast } from "vue-sonner"

const route = useRoute("projects-id")
const projectId = route.params.id

// Breadcrumb management
const { setLabel, clearLabel } = useBreadcrumbs()

useSeoMeta({ title: "Project Details" })

const isLoading = ref(true)
const isDeleting = ref(false)
const isDeletingFile = ref<string | null>(null)
const project = ref<ProjectWithRelations | null>(null)
const shares = ref<ProjectShareWithRelations[]>([])
const files = ref<ProjectFileWithUploader[]>([])

// Share creation
const showShareDialog = ref(false)
const isCreatingShare = ref(false)
const newShare = ref({
  name: "",
  shareType: "public" as "public" | "private",
  recipients: [] as string[],
  message: "",
  expiresAt: null as Date | null,
  password: "",
  allowDownload: true,
  allowNotes: false
})

// Expiration options
const expirationOptions = [
  { label: "Never", value: null },
  { label: "1 day", value: 1 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 }
]
const selectedExpiration = ref<number | null>(null)

// Update expiresAt when selection changes
watch(selectedExpiration, (days) => {
  if (days === null) {
    newShare.value.expiresAt = null
  } else {
    const date = new Date()
    date.setDate(date.getDate() + days)
    newShare.value.expiresAt = date
  }
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

// Fetch files
const fetchFiles = async () => {
  try {
    const data = await $fetch<ProjectFileWithUploader[]>(`/api/projects/${projectId}/files`)
    files.value = data
  } catch (error: any) {
    toast.error("Failed to load files")
  }
}

// Add file dialog
const showAddFileDialog = ref(false)
const isUploading = ref(false)
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadedFile = ref<{
  pdfUrl: string
  fileName: string
  fileSize: number
  pageCount: number
} | null>(null)

// Reset add file dialog
function resetAddFileDialog() {
  uploadedFile.value = null
  isUploading.value = false
  isDragging.value = false
}

// Handle file selection
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    uploadFile(input.files[0])
  }
}

// Handle drag events
function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false

  const droppedFiles = event.dataTransfer?.files
  if (droppedFiles && droppedFiles[0]) {
    if (droppedFiles[0].type !== "application/pdf") {
      toast.error("Please upload a PDF file")
      return
    }
    uploadFile(droppedFiles[0])
  }
}

// Upload file to R2
async function uploadFile(file: File) {
  if (file.type !== "application/pdf") {
    toast.error("Please upload a PDF file")
    return
  }

  if (file.size > 50 * 1024 * 1024) {
    toast.error("File too large. Maximum size is 50MB.")
    return
  }

  isUploading.value = true
  try {
    const formData = new FormData()
    formData.append("pdf", file)

    const result = await $fetch<{
      pdfUrl: string
      fileName: string
      fileSize: number
      pageCount: number
    }>("/api/upload/pdf", {
      method: "POST",
      body: formData
    })

    uploadedFile.value = result
    toast.success("File uploaded")
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to upload file")
  } finally {
    isUploading.value = false
  }
}

// Add file to project
async function handleAddFile() {
  if (!uploadedFile.value) return

  try {
    const newFile = await $fetch<ProjectFileWithUploader>(`/api/projects/${projectId}/files`, {
      method: "POST",
      body: {
        pdfUrl: uploadedFile.value.pdfUrl,
        pdfFileName: uploadedFile.value.fileName,
        pdfFileSize: uploadedFile.value.fileSize,
        pageCount: uploadedFile.value.pageCount
      }
    })

    files.value.push(newFile)
    toast.success("File added to project")
    showAddFileDialog.value = false
    resetAddFileDialog()
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to add file")
  }
}

// Delete file
const handleDeleteFile = async (fileId: string) => {
  if (!confirm("Are you sure you want to delete this file? This action cannot be undone.")) {
    return
  }

  isDeletingFile.value = fileId
  try {
    await $fetch(`/api/projects/${projectId}/files/${fileId}`, {
      method: "DELETE"
    })

    files.value = files.value.filter((f) => f.id !== fileId)
    toast.success("File deleted")
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to delete file")
  } finally {
    isDeletingFile.value = null
  }
}

// Format file size
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

// Create share
const handleCreateShare = async () => {
  // Validate private shares have recipients
  if (newShare.value.shareType === "private" && newShare.value.recipients.length === 0) {
    toast.error("Please add at least one recipient for private shares")
    return
  }

  isCreatingShare.value = true
  try {
    const share = await $fetch<ProjectShareWithRelations>(`/api/projects/${projectId}/shares`, {
      method: "POST",
      body: {
        name: newShare.value.name || undefined,
        shareType: newShare.value.shareType,
        recipients: newShare.value.shareType === "private" ? newShare.value.recipients : undefined,
        message: newShare.value.message || undefined,
        expiresAt: newShare.value.expiresAt,
        password: newShare.value.password || null,
        allowDownload: newShare.value.allowDownload,
        allowNotes: newShare.value.allowNotes
      }
    })

    shares.value.unshift(share)

    // Show appropriate success message
    if (newShare.value.shareType === "private") {
      toast.success(`Invitations sent to ${newShare.value.recipients.length} recipient(s)`)
    } else {
      toast.success("Share link created")
    }

    showShareDialog.value = false
    resetShareForm()
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to create share")
  } finally {
    isCreatingShare.value = false
  }
}

// Reset share form
const resetShareForm = () => {
  newShare.value = {
    name: "",
    shareType: "public",
    recipients: [],
    message: "",
    expiresAt: null,
    password: "",
    allowDownload: true,
    allowNotes: false
  }
  selectedExpiration.value = null
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
  fetchFiles()
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
          <UiCardTitle class="text-sm font-medium">Files</UiCardTitle>
          <Icon name="lucide:file-text" class="size-4 text-muted-foreground" />
        </UiCardHeader>
        <UiCardContent>
          <div class="text-2xl font-bold">{{ files.length }}</div>
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

    <!-- Files List -->
    <UiCard>
      <UiCardHeader>
        <div class="flex items-center justify-between">
          <div>
            <UiCardTitle>Files</UiCardTitle>
            <UiCardDescription>PDF files in this project</UiCardDescription>
          </div>
          <UiButton size="sm" @click="showAddFileDialog = true">
            <Icon name="lucide:plus" class="size-4 mr-2" />
            Add File
          </UiButton>
        </div>
      </UiCardHeader>
      <UiCardContent>
        <div v-if="files.length === 0" class="text-center py-8 text-muted-foreground">
          <Icon name="lucide:file-text" class="size-12 mx-auto mb-2 opacity-50" />
          <p>No files yet</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="file in files"
            :key="file.id"
            class="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <!-- File info -->
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex size-10 items-center justify-center rounded-lg bg-muted shrink-0">
                <Icon name="lucide:file-text" class="size-5 text-muted-foreground" />
              </div>
              <div class="min-w-0">
                <p class="font-medium truncate">{{ file.pdfFileName }}</p>
                <div class="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{{ formatFileSize(file.pdfFileSize) }}</span>
                  <span>{{ file.pageCount }} pages</span>
                  <span>{{ file.annotationCount }} annotations</span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 shrink-0">
              <UiButton size="sm" @click="navigateTo(`/editor?projectId=${projectId}&fileId=${file.id}`)">
                <Icon name="lucide:edit" class="size-4 mr-2" />
                Edit
              </UiButton>
              <UiButton
                variant="ghost"
                size="icon"
                class="text-destructive hover:text-destructive"
                :disabled="isDeletingFile === file.id"
                @click="handleDeleteFile(file.id)"
              >
                <Icon v-if="isDeletingFile === file.id" name="svg-spinners:ring-resize" class="size-4" />
                <Icon v-else name="lucide:trash" class="size-4" />
              </UiButton>
            </div>
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
            class="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <!-- Header row -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2 min-w-0">
                <!-- Share type badge -->
                <UiBadge :variant="share.shareType === 'private' ? 'default' : 'secondary'" class="shrink-0">
                  <Icon :name="share.shareType === 'private' ? 'lucide:users' : 'lucide:globe'" class="size-3 mr-1" />
                  {{ share.shareType === "private" ? "Private" : "Public" }}
                </UiBadge>

                <!-- Share name or token -->
                <span v-if="share.name" class="font-medium truncate">{{ share.name }}</span>
                <code v-else class="text-xs bg-muted px-2 py-1 rounded">{{ share.token.slice(0, 12) }}...</code>

                <!-- Password badge -->
                <UiBadge v-if="share.password" variant="outline" class="text-xs shrink-0">
                  <Icon name="lucide:lock" class="size-3 mr-1" />
                  Protected
                </UiBadge>
              </div>

              <!-- Action buttons -->
              <div class="flex items-center gap-1 shrink-0">
                <UiButton variant="ghost" size="sm" @click="copyShareLink(share.token)">
                  <Icon name="lucide:copy" class="size-4" />
                </UiButton>
                <UiButton variant="ghost" size="sm" class="text-destructive" @click="handleDeleteShare(share.id)">
                  <Icon name="lucide:trash" class="size-4" />
                </UiButton>
              </div>
            </div>

            <!-- Recipients row (for private shares) -->
            <div v-if="share.shareType === 'private' && share.recipients?.length" class="flex items-center gap-2 mb-2">
              <!-- Recipient avatars stacked -->
              <div class="flex -space-x-2">
                <UiAvatar
                  v-for="(recipient, idx) in share.recipients.slice(0, 4)"
                  :key="recipient.id"
                  class="size-6 border-2 border-background"
                  :style="{ zIndex: share.recipients.length - idx }"
                >
                  <UiAvatarImage v-if="recipient.user?.image" :src="recipient.user.image" />
                  <UiAvatarFallback class="text-[10px] bg-secondary">
                    {{ recipient.email[0]?.toUpperCase() || "?" }}
                  </UiAvatarFallback>
                </UiAvatar>
                <div
                  v-if="share.recipients.length > 4"
                  class="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium border-2 border-background"
                >
                  +{{ share.recipients.length - 4 }}
                </div>
              </div>

              <!-- Recipient names/emails -->
              <span class="text-xs text-muted-foreground truncate">
                {{
                  share.recipients
                    .slice(0, 2)
                    .map((r) => r.user?.name || r.email.split("@")[0])
                    .join(", ")
                }}
                <span v-if="share.recipients.length > 2">, +{{ share.recipients.length - 2 }} more</span>
              </span>

              <!-- View stats for recipients -->
              <UiBadge variant="outline" class="text-xs ml-auto shrink-0">
                {{ share.recipients.filter((r) => r.status === "viewed").length }}/{{ share.recipients.length }} viewed
              </UiBadge>
            </div>

            <!-- Message preview (if any) -->
            <div
              v-if="share.message"
              class="text-xs text-muted-foreground italic line-clamp-1 mb-2 pl-1 border-l-2 border-muted"
            >
              "{{ share.message }}"
            </div>

            <!-- Stats row -->
            <div class="flex items-center gap-4 text-xs text-muted-foreground">
              <span class="flex items-center gap-1">
                <Icon name="lucide:eye" class="size-3" />
                {{ share.viewCount }} views
              </span>
              <span v-if="share.expiresAt" class="flex items-center gap-1">
                <Icon name="lucide:clock" class="size-3" />
                Expires {{ formatDate(share.expiresAt) }}
              </span>
              <span v-else class="flex items-center gap-1">
                <Icon name="lucide:infinity" class="size-3" />
                No expiration
              </span>
              <span v-if="share.allowDownload" class="flex items-center gap-1">
                <Icon name="lucide:download" class="size-3" />
                Download
              </span>
              <span v-if="share.allowNotes" class="flex items-center gap-1">
                <Icon name="lucide:message-square" class="size-3" />
                Notes
              </span>
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
      <UiDialogContent class="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <UiDialogHeader>
          <UiDialogTitle>Share Project</UiDialogTitle>
          <UiDialogDescription>
            Share <span class="font-medium text-foreground">{{ project?.name }}</span> with others
          </UiDialogDescription>
        </UiDialogHeader>

        <div class="space-y-5 py-4">
          <!-- Share Type Tabs -->
          <div class="space-y-2">
            <UiLabel>Share with</UiLabel>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                :class="[
                  'flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all',
                  newShare.shareType === 'public'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                ]"
                :disabled="isCreatingShare"
                @click="newShare.shareType = 'public'"
              >
                <div
                  :class="[
                    'flex size-9 items-center justify-center rounded-lg',
                    newShare.shareType === 'public' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  ]"
                >
                  <Icon name="lucide:globe" class="size-4" />
                </div>
                <div>
                  <p class="font-medium text-sm">Anyone with link</p>
                  <p class="text-xs text-muted-foreground">Public, view only</p>
                </div>
              </button>

              <button
                type="button"
                :class="[
                  'flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all',
                  newShare.shareType === 'private'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                ]"
                :disabled="isCreatingShare"
                @click="newShare.shareType = 'private'"
              >
                <div
                  :class="[
                    'flex size-9 items-center justify-center rounded-lg',
                    newShare.shareType === 'private' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  ]"
                >
                  <Icon name="lucide:users" class="size-4" />
                </div>
                <div>
                  <p class="font-medium text-sm">Specific people</p>
                  <p class="text-xs text-muted-foreground">Invite via email</p>
                </div>
              </button>
            </div>
          </div>

          <!-- Recipients (for private shares) -->
          <div v-if="newShare.shareType === 'private'" class="space-y-2">
            <UiLabel>Recipients</UiLabel>
            <ShareRecipientInput
              v-model="newShare.recipients"
              :disabled="isCreatingShare"
              placeholder="Enter email addresses..."
            />
          </div>

          <!-- Two column layout for optional fields -->
          <div class="grid gap-4 sm:grid-cols-2">
            <!-- Share Name (optional) -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <UiLabel for="share-name">Name</UiLabel>
                <span class="text-xs text-muted-foreground">optional</span>
              </div>
              <UiInput
                id="share-name"
                v-model="newShare.name"
                placeholder="e.g., Phase 1 Review"
                :disabled="isCreatingShare"
              />
            </div>

            <!-- Expiration -->
            <div class="space-y-2">
              <UiLabel for="share-expiration">Expires</UiLabel>
              <UiSelect v-model="selectedExpiration" :disabled="isCreatingShare">
                <UiSelectTrigger id="share-expiration">
                  <UiSelectValue placeholder="Never" />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectItem v-for="option in expirationOptions" :key="option.label" :value="option.value">
                    {{ option.label }}
                  </UiSelectItem>
                </UiSelectContent>
              </UiSelect>
            </div>

            <!-- Password Protection (public only) -->
            <div v-if="newShare.shareType === 'public'" class="space-y-2">
              <div class="flex items-center gap-2">
                <UiLabel for="share-password">Password</UiLabel>
                <span class="text-xs text-muted-foreground">optional</span>
              </div>
              <UiInput
                id="share-password"
                v-model="newShare.password"
                type="password"
                placeholder="Leave empty for no password"
                :disabled="isCreatingShare"
              />
            </div>

            <!-- Message (optional, for private shares) -->
            <div v-if="newShare.shareType === 'private'" class="space-y-2 sm:col-span-2">
              <div class="flex items-center gap-2">
                <UiLabel for="share-message">Message</UiLabel>
                <span class="text-xs text-muted-foreground">optional</span>
              </div>
              <UiTextarea
                id="share-message"
                v-model="newShare.message"
                placeholder="Add a message for recipients..."
                :disabled="isCreatingShare"
                :rows="2"
              />
            </div>
          </div>

          <UiDivider />

          <!-- Permissions - Simple horizontal layout -->
          <div class="space-y-3">
            <span class="text-sm font-medium">Permissions</span>

            <div class="flex flex-wrap gap-x-8 gap-y-3">
              <!-- Allow Download -->
              <label class="flex items-center gap-3 cursor-pointer">
                <UiSwitch
                  :checked="newShare.allowDownload"
                  :disabled="isCreatingShare"
                  @update:checked="newShare.allowDownload = $event"
                />
                <div class="flex items-center gap-2">
                  <Icon name="lucide:download" class="size-4 text-muted-foreground" />
                  <span class="text-sm">Allow download</span>
                </div>
              </label>

              <!-- Allow Notes (private only) -->
              <label v-if="newShare.shareType === 'private'" class="flex items-center gap-3 cursor-pointer">
                <UiSwitch
                  :checked="newShare.allowNotes"
                  :disabled="isCreatingShare"
                  @update:checked="newShare.allowNotes = $event"
                />
                <div class="flex items-center gap-2">
                  <Icon name="lucide:message-square" class="size-4 text-muted-foreground" />
                  <span class="text-sm">Allow notes</span>
                </div>
              </label>

              <!-- Info for public shares -->
              <div v-if="newShare.shareType === 'public'" class="flex items-center gap-2 text-muted-foreground">
                <Icon name="lucide:info" class="size-4" />
                <span class="text-xs">Notes require invite-only sharing</span>
              </div>
            </div>
          </div>
        </div>

        <UiDialogFooter class="gap-3">
          <UiButton variant="outline" :disabled="isCreatingShare" @click="showShareDialog = false"> Cancel </UiButton>
          <UiButton :disabled="isCreatingShare" @click="handleCreateShare">
            <Icon v-if="isCreatingShare" name="svg-spinners:ring-resize" class="size-4" />
            <template v-else>
              <Icon v-if="newShare.shareType === 'private'" name="lucide:send" class="size-4" />
              <Icon v-else name="lucide:link" class="size-4" />
            </template>
            {{ newShare.shareType === "private" ? "Send Invitations" : "Create Link" }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <!-- Add File Dialog -->
    <UiDialog v-model:open="showAddFileDialog" @update:open="(open) => !open && resetAddFileDialog()">
      <UiDialogContent class="sm:max-w-lg">
        <UiDialogHeader>
          <UiDialogTitle>Add File</UiDialogTitle>
          <UiDialogDescription>Upload a PDF file to add to this project</UiDialogDescription>
        </UiDialogHeader>

        <div class="space-y-4 py-4">
          <!-- Upload area -->
          <div
            v-if="!uploadedFile"
            class="border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer"
            :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'"
            @click="fileInputRef?.click()"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept="application/pdf"
              class="hidden"
              @change="handleFileSelect"
            />

            <div v-if="isUploading" class="space-y-3">
              <Icon name="svg-spinners:ring-resize" class="size-10 mx-auto text-primary" />
              <p class="text-sm text-muted-foreground">Uploading...</p>
            </div>

            <div v-else class="space-y-3">
              <Icon name="lucide:upload-cloud" class="size-10 mx-auto text-muted-foreground" />
              <div>
                <p class="font-medium">Drop your PDF here or click to browse</p>
                <p class="text-sm text-muted-foreground mt-1">Maximum file size: 50MB</p>
              </div>
            </div>
          </div>

          <!-- Uploaded file preview -->
          <div v-else class="border rounded-lg p-4">
            <div class="flex items-start gap-3">
              <div class="flex-shrink-0 size-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon name="lucide:file-text" class="size-5 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ uploadedFile.fileName }}</p>
                <p class="text-sm text-muted-foreground">
                  {{ formatFileSize(uploadedFile.fileSize) }}
                  <span v-if="uploadedFile.pageCount"> &bull; {{ uploadedFile.pageCount }} pages</span>
                </p>
              </div>
              <UiButton variant="ghost" size="sm" @click="uploadedFile = null">
                <Icon name="lucide:x" class="size-4" />
              </UiButton>
            </div>
          </div>
        </div>

        <UiDialogFooter>
          <UiButton variant="outline" @click="showAddFileDialog = false">Cancel</UiButton>
          <UiButton :disabled="!uploadedFile" @click="handleAddFile">
            Add to Project
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
