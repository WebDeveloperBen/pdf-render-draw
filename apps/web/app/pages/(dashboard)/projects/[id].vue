<script setup lang="ts">
import type {
  ProjectWithRelations,
  ProjectShareWithRelations,
  ProjectFileWithUploader
} from "#shared/types/projects.types"
import type { Annotation } from "#shared/types/annotations.types"
import { toast } from "vue-sonner"
import {
  ArrowLeft,
  Building2,
  Calculator,
  Clock,
  Copy,
  Download,
  Expand,
  Eye,
  File,
  FilePen,
  FilePlus,
  FileText,
  Files,
  Folder,
  Globe,
  Hammer,
  Home,
  Infinity as InfinityIcon,
  Info,
  Link,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  MoreVertical,
  Pencil,
  PenTool,
  PencilRuler,
  Phone,
  Plus,
  Search,
  Share2,
  StickyNote,
  Store,
  Tags,
  Trash,
  Upload,
  Users,
  Wrench
} from "lucide-vue-next"
import type { Component } from "vue"
import { SCRATCHPAD_PRESETS } from "~/composables/useScratchpad"

const route = useRoute("projects-id")
const projectId = route.params.id

// PDF Export
const { exportWithAnnotations } = useExportPdf()
const exportingFileId = ref<string | null>(null)

async function handleExportFile(file: ProjectFileWithUploader) {
  if (exportingFileId.value) return
  exportingFileId.value = file.id

  try {
    // Fetch annotations for this file
    const response = await $fetch<{ annotations: Annotation[] }>(`/api/files/${file.id}/annotations`)

    // Export the PDF with annotations
    const exportFileName = file.pdfFileName.replace(/\.pdf$/i, "-annotated.pdf")
    await exportWithAnnotations({
      pdfUrl: file.pdfUrl,
      annotations: response.annotations,
      filename: exportFileName
    })
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to export PDF")
  } finally {
    exportingFileId.value = null
  }
}

// Download original file without annotations
const downloadingFileId = ref<string | null>(null)

async function handleDownloadOriginal(file: ProjectFileWithUploader) {
  if (downloadingFileId.value) return
  downloadingFileId.value = file.id

  try {
    const response = await fetch(file.pdfUrl)
    if (!response.ok) throw new Error("Failed to fetch file")

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = file.pdfFileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error: any) {
    toast.error("Failed to download file")
  } finally {
    downloadingFileId.value = null
  }
}

// Breadcrumb management
const { setLabel, clearLabel } = useBreadcrumbs()

useSeoMeta({ title: "Project Details" })

const isLoading = ref(true)
const isDeleting = ref(false)
const isDeletingFile = ref<string | null>(null)
const project = ref<ProjectWithRelations | null>(null)
const shares = ref<ProjectShareWithRelations[]>([])
const files = ref<ProjectFileWithUploader[]>([])

// Delete confirmation modals
const showDeleteProjectModal = ref(false)
const showDeleteFileModal = ref(false)
const fileToDelete = ref<ProjectFileWithUploader | null>(null)

// File selector for editor
const showFileSelector = ref(false)

// Most recent file for quick access
const mostRecentFile = computed(() => {
  if (files.value.length === 0) return null
  // Sort by updatedAt descending and return the first
  return [...files.value].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt).getTime()
    const dateB = new Date(b.updatedAt || b.createdAt).getTime()
    return dateB - dateA
  })[0]
})

// Handle Open Editor click - show selector if multiple files
function handleOpenEditor() {
  if (files.value.length === 1 && mostRecentFile.value) {
    navigateTo(`/editor?projectId=${projectId}&fileId=${mostRecentFile.value.id}`)
  } else {
    showFileSelector.value = true
  }
}

// Share creation
const showShareDialog = ref(false)

// Priority config
const priorityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  low: { label: "Low", color: "text-slate-600", bgColor: "bg-slate-100" },
  normal: { label: "Normal", color: "text-blue-600", bgColor: "bg-blue-100" },
  high: { label: "High", color: "text-amber-600", bgColor: "bg-amber-100" },
  urgent: { label: "Urgent", color: "text-red-600", bgColor: "bg-red-100" }
}

// Category config
const categoryConfig: Record<string, { label: string; icon: Component }> = {
  "new-build": { label: "New Build", icon: Building2 },
  renovation: { label: "Renovation", icon: Hammer },
  extension: { label: "Extension", icon: Expand },
  inspection: { label: "Inspection", icon: Search },
  quote: { label: "Quote/Estimate", icon: Calculator },
  maintenance: { label: "Maintenance", icon: Wrench },
  commercial: { label: "Commercial", icon: Store },
  residential: { label: "Residential", icon: Home },
  other: { label: "Other", icon: Folder }
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

// Scratchpad — one-click blank page creation
const { isCreating: isCreatingScratchpad, createScratchpad } = useScratchpad()

async function handleCreateScratchpad() {
  try {
    const newFile = await createScratchpad(projectId, {
      preset: SCRATCHPAD_PRESETS[0]!
    })

    files.value.unshift(newFile)
    toast.success("Scratchpad created")
    navigateTo(`/editor?projectId=${projectId}&fileId=${newFile.id}`)
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to create scratchpad")
  }
}

// Sorted files — newest first
const sortedFiles = computed(() =>
  [...files.value].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime()
    const dateB = new Date(b.createdAt).getTime()
    return dateB - dateA
  })
)

function handleFileAdded(newFile: ProjectFileWithUploader) {
  files.value.unshift(newFile)
}

// Edit file metadata
const showEditFileDialog = ref(false)
const fileToEdit = ref<ProjectFileWithUploader | null>(null)

function promptEditFile(file: ProjectFileWithUploader) {
  fileToEdit.value = file
  showEditFileDialog.value = true
}

function handleFileUpdated(updated: ProjectFileWithUploader) {
  const idx = files.value.findIndex((f) => f.id === updated.id)
  if (idx !== -1) files.value[idx] = updated
}

// Delete file - show confirmation modal
function promptDeleteFile(file: ProjectFileWithUploader) {
  fileToDelete.value = file
  showDeleteFileModal.value = true
}

// Confirm file deletion
async function confirmDeleteFile() {
  if (!fileToDelete.value) return

  const fileId = fileToDelete.value.id
  isDeletingFile.value = fileId

  try {
    await $fetch(`/api/projects/${projectId}/files/${fileId}`, {
      method: "DELETE"
    })

    files.value = files.value.filter((f) => f.id !== fileId)
    toast.success("File deleted")
    showDeleteFileModal.value = false
    fileToDelete.value = null
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

// Delete project - show confirmation modal
function promptDeleteProject() {
  showDeleteProjectModal.value = true
}

// Confirm project deletion
async function confirmDeleteProject() {
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
            <ArrowLeft class="size-4" />
          </UiButton>
          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="text-2xl font-bold lg:text-3xl">{{ project.name }}</h1>
            <!-- Priority Badge -->
            <UiBadge v-if="project.priority && project.priority !== 'normal'"
              :class="[priorityConfig[project.priority]?.color, priorityConfig[project.priority]?.bgColor]">
              {{ priorityConfig[project.priority]?.label }}
            </UiBadge>
            <!-- Category Badge -->
            <UiBadge v-if="project.category" variant="outline" class="gap-1">
              <component :is="categoryConfig[project.category]?.icon || Folder" class="size-3" />
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
        <!-- Primary CTA: Open Editor (when files exist) -->
        <UiButton v-if="files.length > 0" size="lg" @click="handleOpenEditor">
          <PencilRuler class="size-5 mr-2" />
          Open Editor
        </UiButton>
        <!-- Upload CTA (when no files) -->
        <UiButton v-else size="lg" @click="showAddFileDialog = true">
          <Upload class="size-5 mr-2" />
          Upload PDF
        </UiButton>
        <UiButton variant="outline" @click="showShareDialog = true">
          <Share2 class="size-4 mr-2" />
          Share
        </UiButton>
        <UiDropdownMenu>
          <UiDropdownMenuTrigger as-child>
            <UiButton variant="ghost" size="icon">
              <MoreVertical class="size-4" />
            </UiButton>
          </UiDropdownMenuTrigger>
          <UiDropdownMenuContent align="end">
            <UiDropdownMenuItem title="Delete Project" class="text-destructive" @click="promptDeleteProject">
              <template #icon>
                <Trash class="size-4" />
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
              <FileText class="size-6 text-muted-foreground" />
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
              <MessageSquare class="size-6 text-muted-foreground" />
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
              <Share2 class="size-6 text-muted-foreground" />
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
              <Eye class="size-6 text-muted-foreground" />
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
                  <Files class="size-5 text-muted-foreground" />
                  Building Plans
                </UiCardTitle>
                <UiCardDescription>PDF plans and scratchpads in this project</UiCardDescription>
              </div>
              <div class="flex items-center gap-2">
                <UiButton size="sm" variant="outline" :disabled="isCreatingScratchpad" @click="handleCreateScratchpad">
                  <UiSpinner v-if="isCreatingScratchpad" class="size-4" />
                  <FilePlus v-else class="size-4" />
                  Scratchpad
                </UiButton>
                <UiButton size="sm" @click="showAddFileDialog = true">
                  <Plus class="size-4" />
                  Add File
                </UiButton>
              </div>
            </div>
          </UiCardHeader>
          <UiCardContent>
            <!-- Empty state with prominent CTA -->
            <div v-if="files.length === 0" class="text-center py-16">
              <div
                class="mx-auto size-20 rounded-2xl bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4">
                <FilePlus class="size-10 text-primary" />
              </div>
              <h3 class="font-semibold text-lg mb-1">No files yet</h3>
              <p class="text-muted-foreground mb-6 max-w-sm mx-auto">
                Upload a PDF to start annotating, measuring, and marking up your building plans.
              </p>
              <div class="flex items-center gap-3">
                <UiButton size="lg" @click="showAddFileDialog = true">
                  <Upload class="size-5" />
                  Upload PDF
                </UiButton>
                <span class="text-muted-foreground text-sm">or</span>
                <UiButton size="lg" variant="outline" :disabled="isCreatingScratchpad" @click="handleCreateScratchpad">
                  <UiSpinner v-if="isCreatingScratchpad" class="size-5" />
                  <FilePlus v-else class="size-5" />
                  Scratchpad
                </UiButton>
              </div>
            </div>

            <!-- File cards grid -->
            <div v-else class="grid gap-4 sm:grid-cols-2">
              <div v-for="file in sortedFiles" :key="file.id"
                class="group relative border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                @click="navigateTo(`/editor?projectId=${projectId}&fileId=${file.id}`)">
                <!-- Card header with PDF preview placeholder -->
                <div
                  class="relative h-32 bg-linear-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                  <FileText class="size-16 text-slate-300 dark:text-slate-600" />
                  <!-- Overlay on hover -->
                  <div
                    class="absolute inset-0 bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div class="text-center text-primary-foreground">
                      <PencilRuler class="size-8 mx-auto mb-2" />
                      <span class="font-medium">Open in Editor</span>
                    </div>
                  </div>
                  <!-- Annotation badge -->
                  <div v-if="file.annotationCount > 0"
                    class="absolute top-3 right-3 flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium">
                    <PenTool class="size-3 text-primary" />
                    {{ file.annotationCount }}
                  </div>
                </div>

                <!-- Card content -->
                <div class="p-4">
                  <h4 class="font-medium truncate mb-1" :title="file.pdfFileName">{{ file.pdfFileName }}</h4>
                  <div class="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{{ file.pageCount }} {{ file.pageCount === 1 ? "page" : "pages" }}</span>
                    <span class="text-border">•</span>
                    <span>{{ formatFileSize(file.pdfFileSize) }}</span>
                  </div>
                </div>

                <!-- Always visible actions bar -->
                <div class="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
                  <UiButton size="sm" class="flex-1 mr-2"
                    @click.stop="navigateTo(`/editor?projectId=${projectId}&fileId=${file.id}`)">
                    <PencilRuler class="size-4 mr-2" />
                    Edit
                  </UiButton>
                  <div class="flex items-center gap-1">
                    <!-- Download dropdown -->
                    <UiDropdownMenu>
                      <UiDropdownMenuTrigger as-child>
                        <UiButton variant="ghost" size="icon"
                          :disabled="exportingFileId === file.id || downloadingFileId === file.id" @click.stop>
                          <UiSpinner v-if="exportingFileId === file.id || downloadingFileId === file.id"
                            class="size-4" />
                          <Download v-else class="size-4" />
                        </UiButton>
                      </UiDropdownMenuTrigger>
                      <UiDropdownMenuContent align="end" @click.stop>
                        <UiDropdownMenuItem title="Download with Annotations" :disabled="exportingFileId === file.id"
                          @click="handleExportFile(file)">
                          <template #icon>
                            <FilePen class="size-4" />
                          </template>
                        </UiDropdownMenuItem>
                        <UiDropdownMenuItem title="Download Original" :disabled="downloadingFileId === file.id"
                          @click="handleDownloadOriginal(file)">
                          <template #icon>
                            <File class="size-4" />
                          </template>
                        </UiDropdownMenuItem>
                      </UiDropdownMenuContent>
                    </UiDropdownMenu>
                    <!-- More actions dropdown -->
                    <UiDropdownMenu>
                      <UiDropdownMenuTrigger as-child>
                        <UiButton variant="ghost" size="icon" @click.stop>
                          <MoreVertical class="size-4" />
                        </UiButton>
                      </UiDropdownMenuTrigger>
                      <UiDropdownMenuContent align="end" @click.stop>
                        <UiDropdownMenuItem title="Rename" @click="promptEditFile(file)">
                          <template #icon>
                            <Pencil class="size-4" />
                          </template>
                        </UiDropdownMenuItem>
                        <UiDropdownMenuItem title="Delete File" class="text-destructive focus:text-destructive"
                          @click="promptDeleteFile(file)">
                          <template #icon>
                            <Trash class="size-4" />
                          </template>
                        </UiDropdownMenuItem>
                      </UiDropdownMenuContent>
                    </UiDropdownMenu>
                  </div>
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
                  <Link class="size-5 text-muted-foreground" />
                  Share Links
                </UiCardTitle>
                <UiCardDescription>Manage access to this project</UiCardDescription>
              </div>
              <UiButton size="sm" @click="showShareDialog = true">
                <Plus class="size-4 mr-2" />
                New Share
              </UiButton>
            </div>
          </UiCardHeader>
          <UiCardContent>
            <div v-if="shares.length === 0" class="text-center py-12 text-muted-foreground">
              <Link class="size-16 mx-auto mb-3 opacity-30" />
              <p class="font-medium">No share links yet</p>
              <p class="text-sm mt-1">Create a link to share this project</p>
            </div>

            <div v-else class="space-y-3">
              <div v-for="share in shares" :key="share.id"
                class="p-4 border rounded-xl hover:bg-muted/50 transition-colors">
                <!-- Header row -->
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <UiBadge :variant="share.shareType === 'private' ? 'default' : 'secondary'" class="shrink-0">
                      <component :is="share.shareType === 'private' ? Users : Globe" class="size-3 mr-1" />
                      {{ share.shareType === "private" ? "Private" : "Public" }}
                    </UiBadge>
                    <span v-if="share.name" class="font-medium truncate">{{ share.name }}</span>
                    <code v-else class="text-xs bg-muted px-2 py-1 rounded">{{ share.token.slice(0, 12) }}...</code>
                    <UiBadge v-if="share.password" variant="outline" class="text-xs shrink-0">
                      <Lock class="size-3 mr-1" />
                      Protected
                    </UiBadge>
                  </div>

                  <div class="flex items-center gap-1 shrink-0">
                    <UiButton variant="ghost" size="sm" @click="copyShareLink(share.token)">
                      <Copy class="size-4" />
                    </UiButton>
                    <UiButton variant="ghost" size="sm" class="text-destructive" @click="handleDeleteShare(share.id)">
                      <Trash class="size-4" />
                    </UiButton>
                  </div>
                </div>

                <!-- Recipients row (for private shares) -->
                <div v-if="share.shareType === 'private' && share.recipients?.length"
                  class="flex items-center gap-2 mb-2">
                  <div class="flex -space-x-2">
                    <UiAvatar v-for="(recipient, idx) in share.recipients.slice(0, 4)" :key="recipient.id"
                      class="size-6 border-2 border-background" :style="{ zIndex: share.recipients.length - idx }">
                      <UiAvatarImage v-if="recipient.user?.image" :src="recipient.user.image" />
                      <UiAvatarFallback class="text-[10px] bg-secondary">
                        {{ recipient.email[0]?.toUpperCase() || "?" }}
                      </UiAvatarFallback>
                    </UiAvatar>
                    <div v-if="share.recipients.length > 4"
                      class="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium border-2 border-background">
                      +{{ share.recipients.length - 4 }}
                    </div>
                  </div>
                  <span class="text-xs text-muted-foreground truncate">
                    {{
                      share.recipients
                        .slice(0, 2)
                        .map((r) => r.user?.name || r.email.split("@")[0])
                        .join(", ")
                    }}
                    <span v-if="share.recipients.length > 2">, +{{ share.recipients.length - 2 }} more</span>
                  </span>
                </div>

                <!-- Stats row -->
                <div class="flex items-center gap-4 text-xs text-muted-foreground">
                  <span class="flex items-center gap-1">
                    <Eye class="size-3" />
                    {{ share.viewCount }} views
                  </span>
                  <span v-if="share.expiresAt" class="flex items-center gap-1">
                    <Clock class="size-3" />
                    Expires {{ formatDate(share.expiresAt) }}
                  </span>
                  <span v-else class="flex items-center gap-1">
                    <InfinityIcon class="size-3" />
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
              <MapPin class="size-4 text-muted-foreground" />
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
                <a v-if="project.clientEmail" :href="`mailto:${project.clientEmail}`"
                  class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Mail class="size-3.5" />
                  {{ project.clientEmail }}
                </a>
                <a v-if="project.clientPhone" :href="`tel:${project.clientPhone}`"
                  class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Phone class="size-3.5" />
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
              <Tags class="size-4 text-muted-foreground" />
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
              <StickyNote class="size-4 text-muted-foreground" />
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
              <Info class="size-4 text-muted-foreground" />
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

    <!-- Modals -->
    <ModalsCreateShareModal v-model:open="showShareDialog" :project-id="projectId" :project-name="project?.name || ''"
      @created="(share) => shares.unshift(share)" />
    <ModalsAddFileModal v-model:open="showAddFileDialog" :project-id="projectId" @added="handleFileAdded" />
    <ModalsFileSelectorModal v-model:open="showFileSelector" :project-id="projectId" :files="files" />
    <ModalsEditFileModal v-model:open="showEditFileDialog" :project-id="projectId" :file="fileToEdit"
      @updated="handleFileUpdated" />

    <!-- Delete Project Confirmation Modal -->
    <UiDeleteConfirmModal v-model:open="showDeleteProjectModal" title="Delete Project"
      description="This will permanently delete the project, all files, annotations, and shares. This action cannot be undone."
      :item-name="project?.name || ''" :is-deleting="isDeleting" :require-confirmation="true"
      confirm-text="Delete Project" @confirm="confirmDeleteProject" />

    <!-- Delete File Confirmation Modal -->
    <UiDeleteConfirmModal v-model:open="showDeleteFileModal" title="Delete File"
      description="This will permanently delete the file and all its annotations. This action cannot be undone."
      :item-name="fileToDelete?.pdfFileName || ''" :is-deleting="isDeletingFile === fileToDelete?.id"
      confirm-text="Delete File" @confirm="confirmDeleteFile" />

  </div>
</template>
