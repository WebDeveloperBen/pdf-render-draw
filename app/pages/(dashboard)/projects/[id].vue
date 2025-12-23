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

// Priority config
const priorityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  low: { label: "Low", color: "text-slate-600", bgColor: "bg-slate-100" },
  normal: { label: "Normal", color: "text-blue-600", bgColor: "bg-blue-100" },
  high: { label: "High", color: "text-amber-600", bgColor: "bg-amber-100" },
  urgent: { label: "Urgent", color: "text-red-600", bgColor: "bg-red-100" }
}

// Category config
const categoryConfig: Record<string, { label: string; icon: string }> = {
  "new-build": { label: "New Build", icon: "lucide:building-2" },
  renovation: { label: "Renovation", icon: "lucide:hammer" },
  extension: { label: "Extension", icon: "lucide:expand" },
  inspection: { label: "Inspection", icon: "lucide:search" },
  quote: { label: "Quote/Estimate", icon: "lucide:calculator" },
  maintenance: { label: "Maintenance", icon: "lucide:wrench" },
  commercial: { label: "Commercial", icon: "lucide:store" },
  residential: { label: "Residential", icon: "lucide:home" },
  other: { label: "Other", icon: "lucide:folder" }
}

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
  return new Date(date).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}

const formatDateTime = (date: Date | string | null) => {
  if (!date) return "Never"
  return new Date(date).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

// Check if project has location info
const hasLocationInfo = computed(() => {
  if (!project.value) return false
  return project.value.siteAddress || project.value.suburb || project.value.postcode
})

// Check if project has client info
const hasClientInfo = computed(() => {
  if (!project.value) return false
  return project.value.clientName || project.value.clientEmail || project.value.clientPhone
})

// Format full address
const fullAddress = computed(() => {
  if (!project.value) return ""
  const parts = [project.value.siteAddress, project.value.suburb, project.value.postcode].filter(Boolean)
  return parts.join(", ")
})

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

  <div v-else-if="project" class="space-y-8">
    <!-- Header Section -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="space-y-3">
        <!-- Back button & Title -->
        <div class="flex items-center gap-3">
          <UiButton variant="ghost" size="icon" class="shrink-0" @click="navigateTo('/projects')">
            <Icon name="lucide:arrow-left" class="size-4" />
          </UiButton>
          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="text-2xl font-bold lg:text-3xl">{{ project.name }}</h1>
            <!-- Priority Badge -->
            <UiBadge
              v-if="project.priority && project.priority !== 'normal'"
              :class="[priorityConfig[project.priority]?.color, priorityConfig[project.priority]?.bgColor]"
            >
              {{ priorityConfig[project.priority]?.label }}
            </UiBadge>
            <!-- Category Badge -->
            <UiBadge v-if="project.category" variant="outline" class="gap-1">
              <Icon :name="categoryConfig[project.category]?.icon || 'lucide:folder'" class="size-3" />
              {{ categoryConfig[project.category]?.label || project.category }}
            </UiBadge>
          </div>
        </div>

        <!-- Reference & Description -->
        <div class="ml-11 space-y-1">
          <p v-if="project.reference" class="text-sm text-muted-foreground">
            <span class="font-medium">Ref:</span> {{ project.reference }}
          </p>
          <p v-if="project.description" class="text-muted-foreground max-w-2xl">
            {{ project.description }}
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 ml-11 lg:ml-0">
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

    <!-- Quick Stats -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UiCard>
        <UiCardContent class="pt-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Files</p>
              <p class="text-3xl font-bold">{{ files.length }}</p>
            </div>
            <div class="size-12 rounded-full bg-muted flex items-center justify-center">
              <Icon name="lucide:file-text" class="size-6 text-muted-foreground" />
            </div>
          </div>
        </UiCardContent>
      </UiCard>

      <UiCard>
        <UiCardContent class="pt-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Annotations</p>
              <p class="text-3xl font-bold">{{ project.annotationCount }}</p>
            </div>
            <div class="size-12 rounded-full bg-muted flex items-center justify-center">
              <Icon name="lucide:message-square" class="size-6 text-muted-foreground" />
            </div>
          </div>
        </UiCardContent>
      </UiCard>

      <UiCard>
        <UiCardContent class="pt-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Shares</p>
              <p class="text-3xl font-bold">{{ shares.length }}</p>
            </div>
            <div class="size-12 rounded-full bg-muted flex items-center justify-center">
              <Icon name="lucide:share-2" class="size-6 text-muted-foreground" />
            </div>
          </div>
        </UiCardContent>
      </UiCard>

      <UiCard>
        <UiCardContent class="pt-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Last Viewed</p>
              <p class="text-lg font-semibold">{{ formatDate(project.lastViewedAt) }}</p>
            </div>
            <div class="size-12 rounded-full bg-muted flex items-center justify-center">
              <Icon name="lucide:eye" class="size-6 text-muted-foreground" />
            </div>
          </div>
        </UiCardContent>
      </UiCard>
    </div>

    <!-- Main Content Grid -->
    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Left Column - Files & Shares (2/3 width) -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Files List -->
        <UiCard>
          <UiCardHeader>
            <div class="flex items-center justify-between">
              <div>
                <UiCardTitle class="flex items-center gap-2">
                  <Icon name="lucide:files" class="size-5 text-muted-foreground" />
                  Files
                </UiCardTitle>
                <UiCardDescription>PDF files in this project</UiCardDescription>
              </div>
              <UiButton size="sm" @click="showAddFileDialog = true">
                <Icon name="lucide:plus" class="size-4 mr-2" />
                Add File
              </UiButton>
            </div>
          </UiCardHeader>
          <UiCardContent>
            <div v-if="files.length === 0" class="text-center py-12 text-muted-foreground">
              <Icon name="lucide:file-text" class="size-16 mx-auto mb-3 opacity-30" />
              <p class="font-medium">No files yet</p>
              <p class="text-sm mt-1">Upload a PDF to get started</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="file in files"
                :key="file.id"
                class="group flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 hover:border-primary/20 transition-all"
              >
                <!-- File info -->
                <div class="flex items-center gap-4 min-w-0">
                  <div class="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/20 dark:to-red-800/10 shrink-0">
                    <Icon name="lucide:file-text" class="size-6 text-red-500" />
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium truncate">{{ file.pdfFileName }}</p>
                    <div class="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span class="flex items-center gap-1">
                        <Icon name="lucide:hard-drive" class="size-3" />
                        {{ formatFileSize(file.pdfFileSize) }}
                      </span>
                      <span class="flex items-center gap-1">
                        <Icon name="lucide:file" class="size-3" />
                        {{ file.pageCount }} pages
                      </span>
                      <span class="flex items-center gap-1">
                        <Icon name="lucide:message-square" class="size-3" />
                        {{ file.annotationCount }} annotations
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
                <UiCardTitle class="flex items-center gap-2">
                  <Icon name="lucide:link" class="size-5 text-muted-foreground" />
                  Share Links
                </UiCardTitle>
                <UiCardDescription>Manage access to this project</UiCardDescription>
              </div>
              <UiButton size="sm" @click="showShareDialog = true">
                <Icon name="lucide:plus" class="size-4 mr-2" />
                New Share
              </UiButton>
            </div>
          </UiCardHeader>
          <UiCardContent>
            <div v-if="shares.length === 0" class="text-center py-12 text-muted-foreground">
              <Icon name="lucide:link" class="size-16 mx-auto mb-3 opacity-30" />
              <p class="font-medium">No share links yet</p>
              <p class="text-sm mt-1">Create a link to share this project</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="share in shares"
                :key="share.id"
                class="p-4 border rounded-xl hover:bg-muted/50 transition-colors"
              >
                <!-- Header row -->
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <UiBadge :variant="share.shareType === 'private' ? 'default' : 'secondary'" class="shrink-0">
                      <Icon :name="share.shareType === 'private' ? 'lucide:users' : 'lucide:globe'" class="size-3 mr-1" />
                      {{ share.shareType === "private" ? "Private" : "Public" }}
                    </UiBadge>
                    <span v-if="share.name" class="font-medium truncate">{{ share.name }}</span>
                    <code v-else class="text-xs bg-muted px-2 py-1 rounded">{{ share.token.slice(0, 12) }}...</code>
                    <UiBadge v-if="share.password" variant="outline" class="text-xs shrink-0">
                      <Icon name="lucide:lock" class="size-3 mr-1" />
                      Protected
                    </UiBadge>
                  </div>

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
                  <span class="text-xs text-muted-foreground truncate">
                    {{ share.recipients.slice(0, 2).map((r) => r.user?.name || r.email.split("@")[0]).join(", ") }}
                    <span v-if="share.recipients.length > 2">, +{{ share.recipients.length - 2 }} more</span>
                  </span>
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
                </div>
              </div>
            </div>
          </UiCardContent>
        </UiCard>
      </div>

      <!-- Right Column - Project Details (1/3 width) -->
      <div class="space-y-6">
        <!-- Location & Client -->
        <UiCard v-if="hasLocationInfo || hasClientInfo">
          <UiCardHeader class="pb-3">
            <UiCardTitle class="text-base flex items-center gap-2">
              <Icon name="lucide:map-pin" class="size-4 text-muted-foreground" />
              Location & Client
            </UiCardTitle>
          </UiCardHeader>
          <UiCardContent class="space-y-4">
            <!-- Location -->
            <div v-if="hasLocationInfo" class="space-y-1">
              <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Site</p>
              <p class="text-sm">{{ fullAddress }}</p>
            </div>

            <!-- Client -->
            <div v-if="hasClientInfo" class="space-y-2">
              <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client</p>
              <div class="space-y-1.5">
                <p v-if="project.clientName" class="text-sm font-medium">{{ project.clientName }}</p>
                <a
                  v-if="project.clientEmail"
                  :href="`mailto:${project.clientEmail}`"
                  class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name="lucide:mail" class="size-3.5" />
                  {{ project.clientEmail }}
                </a>
                <a
                  v-if="project.clientPhone"
                  :href="`tel:${project.clientPhone}`"
                  class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name="lucide:phone" class="size-3.5" />
                  {{ project.clientPhone }}
                </a>
              </div>
            </div>
          </UiCardContent>
        </UiCard>

        <!-- Tags -->
        <UiCard v-if="project.tags && project.tags.length > 0">
          <UiCardHeader class="pb-3">
            <UiCardTitle class="text-base flex items-center gap-2">
              <Icon name="lucide:tags" class="size-4 text-muted-foreground" />
              Tags
            </UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <div class="flex flex-wrap gap-2">
              <UiBadge v-for="tag in project.tags" :key="tag" variant="secondary">
                {{ tag }}
              </UiBadge>
            </div>
          </UiCardContent>
        </UiCard>

        <!-- Notes -->
        <UiCard v-if="project.notes">
          <UiCardHeader class="pb-3">
            <UiCardTitle class="text-base flex items-center gap-2">
              <Icon name="lucide:sticky-note" class="size-4 text-muted-foreground" />
              Internal Notes
            </UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <p class="text-sm text-muted-foreground whitespace-pre-wrap">{{ project.notes }}</p>
          </UiCardContent>
        </UiCard>

        <!-- Project Metadata -->
        <UiCard>
          <UiCardHeader class="pb-3">
            <UiCardTitle class="text-base flex items-center gap-2">
              <Icon name="lucide:info" class="size-4 text-muted-foreground" />
              Details
            </UiCardTitle>
          </UiCardHeader>
          <UiCardContent class="space-y-3">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Created By</span>
              <div class="flex items-center gap-2">
                <UiAvatar class="size-5">
                  <UiAvatarFallback class="text-[10px]">
                    {{ project.creator?.name?.slice(0, 2)?.toUpperCase() || "?" }}
                  </UiAvatarFallback>
                </UiAvatar>
                <span class="font-medium">{{ project.creator?.name || "Unknown" }}</span>
              </div>
            </div>
            <UiDivider />
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Created</span>
              <span class="font-medium">{{ formatDate(project.createdAt) }}</span>
            </div>
            <UiDivider />
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Updated</span>
              <span class="font-medium">{{ formatDate(project.updatedAt) }}</span>
            </div>
            <template v-if="project.organization">
              <UiDivider />
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">Organisation</span>
                <span class="font-medium">{{ project.organization.name }}</span>
              </div>
            </template>
          </UiCardContent>
        </UiCard>
      </div>
    </div>

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

          <!-- Permissions -->
          <div class="space-y-3">
            <span class="text-sm font-medium">Permissions</span>
            <div class="flex flex-wrap gap-x-8 gap-y-3">
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
            </div>
          </div>
        </div>

        <UiDialogFooter class="gap-3">
          <UiButton variant="outline" :disabled="isCreatingShare" @click="showShareDialog = false">Cancel</UiButton>
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
          <div
            v-if="!uploadedFile"
            class="border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer"
            :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'"
            @click="fileInputRef?.click()"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          >
            <input ref="fileInputRef" type="file" accept="application/pdf" class="hidden" @change="handleFileSelect" />

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
          <UiButton :disabled="!uploadedFile" @click="handleAddFile">Add to Project</UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
