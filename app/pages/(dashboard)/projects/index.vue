<script setup lang="ts">
import type { ProjectWithRelations } from "#shared/types/projects.types"
import { toast } from "vue-sonner"

useSeoMeta({ title: "Projects" })

const isCreating = ref(false)
const isLoading = ref(true)
const projects = ref<ProjectWithRelations[]>([])
const searchQuery = ref("")

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

// Multi-step create project dialog
const showCreateDialog = ref(false)
const createStep = ref<1 | 2>(1)
const isUploading = ref(false)
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const newProject = ref({
  name: "",
  description: ""
})

// Uploaded file data from R2
const uploadedFile = ref<{
  pdfUrl: string
  fileName: string
  fileSize: number
  pageCount: number
} | null>(null)

// Reset dialog state
function resetCreateDialog() {
  createStep.value = 1
  newProject.value = { name: "", description: "" }
  uploadedFile.value = null
  isUploading.value = false
  isDragging.value = false
}

// Close dialog and reset
function closeCreateDialog() {
  showCreateDialog.value = false
  resetCreateDialog()
}

// Go to next step
function goToStep2() {
  if (!newProject.value.name) {
    toast.error("Please enter a project name")
    return
  }
  createStep.value = 2
}

// Go back to step 1
function goToStep1() {
  createStep.value = 1
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

  const files = event.dataTransfer?.files
  if (files && files[0]) {
    if (files[0].type !== "application/pdf") {
      toast.error("Please upload a PDF file")
      return
    }
    uploadFile(files[0])
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
    toast.success("File uploaded successfully")
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to upload file")
  } finally {
    isUploading.value = false
  }
}

// Create project with uploaded file
async function handleCreateProject() {
  if (!newProject.value.name || !uploadedFile.value) {
    toast.error("Please complete all steps")
    return
  }

  isCreating.value = true
  try {
    const project = await $fetch<ProjectWithRelations>("/api/projects", {
      method: "POST",
      body: {
        name: newProject.value.name,
        description: newProject.value.description || null,
        pdfUrl: uploadedFile.value.pdfUrl,
        pdfFileName: uploadedFile.value.fileName,
        pdfFileSize: uploadedFile.value.fileSize,
        pageCount: uploadedFile.value.pageCount
      }
    })

    projects.value.unshift(project)
    toast.success("Project created successfully")
    closeCreateDialog()
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to create project")
  } finally {
    isCreating.value = false
  }
}

// Format file size
function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
                  {{ project.creator.name.slice(0, 2).toUpperCase() }}
                </UiAvatarFallback>
              </UiAvatar>
              <span class="text-muted-foreground">{{ project.creator.name }}</span>
            </div>
            <span class="text-muted-foreground">{{ formatDate(project.updatedAt) }}</span>
          </div>
        </UiCardContent>
      </UiCard>
    </div>

    <!-- Create Project Dialog (Multi-step) -->
    <UiDialog v-model:open="showCreateDialog" @update:open="(open) => !open && resetCreateDialog()">
      <UiDialogContent class="sm:max-w-lg">
        <UiDialogHeader>
          <UiDialogTitle>
            {{ createStep === 1 ? "Create New Project" : "Upload PDF" }}
          </UiDialogTitle>
          <UiDialogDescription>
            {{ createStep === 1 ? "Give your project a name and description" : "Upload a PDF file to get started" }}
          </UiDialogDescription>
        </UiDialogHeader>

        <!-- Step indicators -->
        <div class="flex items-center justify-center gap-2 py-2">
          <div
            class="flex items-center justify-center size-8 rounded-full text-sm font-medium transition-colors"
            :class="createStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          >
            1
          </div>
          <div class="w-12 h-0.5" :class="createStep >= 2 ? 'bg-primary' : 'bg-muted'" />
          <div
            class="flex items-center justify-center size-8 rounded-full text-sm font-medium transition-colors"
            :class="createStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          >
            2
          </div>
        </div>

        <!-- Step 1: Project Details -->
        <div v-if="createStep === 1" class="space-y-4 py-4">
          <div class="space-y-2">
            <UiLabel for="project-name">Project Name</UiLabel>
            <UiInput
              id="project-name"
              v-model="newProject.name"
              placeholder="e.g., Building Plan A"
              @keyup.enter="goToStep2"
            />
          </div>

          <div class="space-y-2">
            <UiLabel for="project-description">Description (Optional)</UiLabel>
            <UiTextarea
              id="project-description"
              v-model="newProject.description"
              placeholder="Add a brief description..."
              :rows="3"
            />
          </div>
        </div>

        <!-- Step 2: File Upload -->
        <div v-else class="space-y-4 py-4">
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
          <template v-if="createStep === 1">
            <UiButton variant="outline" @click="closeCreateDialog">Cancel</UiButton>
            <UiButton :disabled="!newProject.name" @click="goToStep2">
              Next
              <Icon name="lucide:arrow-right" class="size-4 ml-2" />
            </UiButton>
          </template>

          <template v-else>
            <UiButton variant="outline" @click="goToStep1">
              <Icon name="lucide:arrow-left" class="size-4 mr-2" />
              Back
            </UiButton>
            <UiButton :disabled="!uploadedFile || isCreating" @click="handleCreateProject">
              <Icon v-if="isCreating" name="svg-spinners:90-ring-with-bg" class="size-4 mr-2" />
              Create Project
            </UiButton>
          </template>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
