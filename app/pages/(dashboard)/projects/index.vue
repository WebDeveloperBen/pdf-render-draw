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

// ============================================
// CREATE PROJECT MODAL - Full Redesign
// ============================================

const showCreateDialog = ref(false)
const activeSection = ref<"details" | "location" | "files" | "notes">("details")
const isUploading = ref(false)
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Navigation sections
const sections = [
  { id: "details" as const, label: "Project Details", icon: "lucide:clipboard-list", required: true },
  { id: "location" as const, label: "Location & Client", icon: "lucide:map-pin", required: false },
  { id: "files" as const, label: "Upload Files", icon: "lucide:file-up", required: true },
  { id: "notes" as const, label: "Additional Info", icon: "lucide:sticky-note", required: false }
]

// Project categories for trades
const projectCategories = [
  { value: "new-build", label: "New Build", icon: "lucide:building-2" },
  { value: "renovation", label: "Renovation", icon: "lucide:hammer" },
  { value: "extension", label: "Extension", icon: "lucide:expand" },
  { value: "inspection", label: "Inspection", icon: "lucide:search" },
  { value: "quote", label: "Quote/Estimate", icon: "lucide:calculator" },
  { value: "maintenance", label: "Maintenance", icon: "lucide:wrench" },
  { value: "commercial", label: "Commercial", icon: "lucide:store" },
  { value: "residential", label: "Residential", icon: "lucide:home" },
  { value: "other", label: "Other", icon: "lucide:folder" }
]

// Priority levels
const priorityLevels = [
  { value: "low", label: "Low", color: "bg-slate-500" },
  { value: "normal", label: "Normal", color: "bg-blue-500" },
  { value: "high", label: "High", color: "bg-amber-500" },
  { value: "urgent", label: "Urgent", color: "bg-red-500" }
]

// Form state
const newProject = ref({
  // Details
  name: "",
  description: "",
  category: "",
  reference: "",
  // Location & Client
  siteAddress: "",
  suburb: "",
  postcode: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  // Additional
  notes: "",
  priority: "normal",
  tags: [] as string[]
})

// Tag input
const tagInput = ref("")

function addTag() {
  const tag = tagInput.value.trim()
  if (tag && !newProject.value.tags.includes(tag)) {
    newProject.value.tags.push(tag)
    tagInput.value = ""
  }
}

function removeTag(tag: string) {
  newProject.value.tags = newProject.value.tags.filter((t) => t !== tag)
}

// Uploaded file data from R2
const uploadedFile = ref<{
  pdfUrl: string
  fileName: string
  fileSize: number
  pageCount: number
} | null>(null)

// Section validation
const sectionStatus = computed(() => ({
  details: !!newProject.value.name,
  location: true, // Optional section
  files: !!uploadedFile.value,
  notes: true // Optional section
}))

const canCreate = computed(() => sectionStatus.value.details && sectionStatus.value.files)

// Reset dialog state
function resetCreateDialog() {
  activeSection.value = "details"
  newProject.value = {
    name: "",
    description: "",
    category: "",
    reference: "",
    siteAddress: "",
    suburb: "",
    postcode: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    notes: "",
    priority: "normal",
    tags: []
  }
  uploadedFile.value = null
  isUploading.value = false
  isDragging.value = false
  tagInput.value = ""
}

// Close dialog and reset
function closeCreateDialog() {
  showCreateDialog.value = false
  resetCreateDialog()
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
  if (!canCreate.value) {
    toast.error("Please complete required sections")
    return
  }

  isCreating.value = true
  try {
    const project = await $fetch<ProjectWithRelations>("/api/projects", {
      method: "POST",
      body: {
        name: newProject.value.name,
        description: newProject.value.description || null,
        pdfUrl: uploadedFile.value!.pdfUrl,
        pdfFileName: uploadedFile.value!.fileName,
        pdfFileSize: uploadedFile.value!.fileSize,
        pageCount: uploadedFile.value!.pageCount
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

    <!-- Create Project Dialog - Full Redesign -->
    <UiDialog v-model:open="showCreateDialog" @update:open="(open) => !open && resetCreateDialog()">
      <UiDialogContent class="sm:max-w-5xl h-[85vh] p-0 gap-0 overflow-hidden" :hide-close="true">
        <div class="flex h-full">
          <!-- Sidebar Navigation -->
          <div class="w-64 bg-muted/30 border-r flex flex-col shrink-0">
            <!-- Header -->
            <div class="p-6 border-b">
              <h2 class="text-lg font-semibold">New Project</h2>
              <p class="text-sm text-muted-foreground mt-1">Set up your building plan project</p>
            </div>

            <!-- Navigation -->
            <nav class="flex-1 p-3 space-y-1">
              <button
                v-for="section in sections"
                :key="section.id"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                :class="[
                  activeSection === section.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                ]"
                @click="activeSection = section.id"
              >
                <Icon :name="section.icon" class="size-5" />
                <span class="flex-1 font-medium text-sm">{{ section.label }}</span>
                <!-- Status indicator -->
                <div
                  v-if="section.required"
                  class="size-2 rounded-full transition-colors"
                  :class="sectionStatus[section.id] ? 'bg-green-500' : 'bg-amber-500'"
                />
              </button>
            </nav>

            <!-- Footer actions -->
            <div class="p-4 border-t space-y-2">
              <UiButton class="w-full" :disabled="!canCreate || isCreating" @click="handleCreateProject">
                <Icon v-if="isCreating" name="svg-spinners:90-ring-with-bg" class="size-4 mr-2" />
                <Icon v-else name="lucide:plus" class="size-4 mr-2" />
                Create Project
              </UiButton>
              <UiButton variant="ghost" class="w-full" @click="closeCreateDialog">Cancel</UiButton>
            </div>
          </div>

          <!-- Main Content Area -->
          <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
            <!-- Section Header -->
            <div class="px-8 py-6 border-b bg-background">
              <div class="flex items-center gap-3">
                <div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon :name="sections.find((s) => s.id === activeSection)?.icon || ''" class="size-5 text-primary" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold">{{ sections.find((s) => s.id === activeSection)?.label }}</h3>
                  <p class="text-sm text-muted-foreground">
                    <template v-if="activeSection === 'details'">Basic project information</template>
                    <template v-else-if="activeSection === 'location'">Job site and client details</template>
                    <template v-else-if="activeSection === 'files'">Upload building plans and documents</template>
                    <template v-else>Additional notes and organisation</template>
                  </p>
                </div>
              </div>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto">
              <div class="p-8">
                <!-- PROJECT DETAILS SECTION -->
                <div v-if="activeSection === 'details'" class="space-y-6 max-w-2xl">
                  <!-- Project Name -->
                  <div class="space-y-2">
                    <UiLabel for="project-name" class="text-sm font-medium">
                      Project Name <span class="text-destructive">*</span>
                    </UiLabel>
                    <UiInput
                      id="project-name"
                      v-model="newProject.name"
                      placeholder="e.g., 123 Smith St - Kitchen Renovation"
                      class="h-11"
                    />
                    <p class="text-xs text-muted-foreground">A clear name helps you find this project later</p>
                  </div>

                  <!-- Reference Number -->
                  <div class="space-y-2">
                    <UiLabel for="project-ref" class="text-sm font-medium">Reference / Job Number</UiLabel>
                    <UiInput id="project-ref" v-model="newProject.reference" placeholder="e.g., JOB-2024-001" class="h-11" />
                  </div>

                  <!-- Category Selection -->
                  <div class="space-y-3">
                    <UiLabel class="text-sm font-medium">Project Type</UiLabel>
                    <div class="grid grid-cols-3 gap-2">
                      <button
                        v-for="cat in projectCategories"
                        :key="cat.value"
                        type="button"
                        class="flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left"
                        :class="
                          newProject.category === cat.value
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground'
                        "
                        @click="newProject.category = cat.value"
                      >
                        <Icon :name="cat.icon" class="size-4 shrink-0" />
                        <span class="text-sm font-medium truncate">{{ cat.label }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Description -->
                  <div class="space-y-2">
                    <UiLabel for="project-desc" class="text-sm font-medium">Description</UiLabel>
                    <UiTextarea
                      id="project-desc"
                      v-model="newProject.description"
                      placeholder="Brief description of the project scope, requirements, or notes..."
                      :rows="4"
                    />
                  </div>
                </div>

                <!-- LOCATION & CLIENT SECTION -->
                <div v-else-if="activeSection === 'location'" class="space-y-8 max-w-2xl">
                  <!-- Site Location -->
                  <div class="space-y-4">
                    <div class="flex items-center gap-2">
                      <Icon name="lucide:map-pin" class="size-5 text-primary" />
                      <h4 class="font-medium">Job Site Location</h4>
                    </div>

                    <div class="space-y-4 pl-7">
                      <div class="space-y-2">
                        <UiLabel for="site-address" class="text-sm font-medium">Street Address</UiLabel>
                        <UiInput
                          id="site-address"
                          v-model="newProject.siteAddress"
                          placeholder="123 Example Street"
                          class="h-11"
                        />
                      </div>

                      <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                          <UiLabel for="suburb" class="text-sm font-medium">Suburb</UiLabel>
                          <UiInput id="suburb" v-model="newProject.suburb" placeholder="Suburb" class="h-11" />
                        </div>
                        <div class="space-y-2">
                          <UiLabel for="postcode" class="text-sm font-medium">Postcode</UiLabel>
                          <UiInput id="postcode" v-model="newProject.postcode" placeholder="0000" class="h-11" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <UiDivider />

                  <!-- Client Information -->
                  <div class="space-y-4">
                    <div class="flex items-center gap-2">
                      <Icon name="lucide:user" class="size-5 text-primary" />
                      <h4 class="font-medium">Client Information</h4>
                    </div>

                    <div class="space-y-4 pl-7">
                      <div class="space-y-2">
                        <UiLabel for="client-name" class="text-sm font-medium">Client Name</UiLabel>
                        <UiInput id="client-name" v-model="newProject.clientName" placeholder="John Smith" class="h-11" />
                      </div>

                      <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                          <UiLabel for="client-email" class="text-sm font-medium">Email</UiLabel>
                          <UiInput
                            id="client-email"
                            v-model="newProject.clientEmail"
                            type="email"
                            placeholder="client@example.com"
                            class="h-11"
                          />
                        </div>
                        <div class="space-y-2">
                          <UiLabel for="client-phone" class="text-sm font-medium">Phone</UiLabel>
                          <UiInput
                            id="client-phone"
                            v-model="newProject.clientPhone"
                            type="tel"
                            placeholder="0400 000 000"
                            class="h-11"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- FILES SECTION -->
                <div v-else-if="activeSection === 'files'" class="space-y-6">
                  <!-- Upload Area -->
                  <div
                    v-if="!uploadedFile"
                    class="border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer"
                    :class="
                      isDragging
                        ? 'border-primary bg-primary/5 scale-[1.02]'
                        : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                    "
                    @click="fileInputRef?.click()"
                    @dragover="handleDragOver"
                    @dragleave="handleDragLeave"
                    @drop="handleDrop"
                  >
                    <input ref="fileInputRef" type="file" accept="application/pdf" class="hidden" @change="handleFileSelect" />

                    <div v-if="isUploading" class="space-y-4">
                      <div class="size-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon name="svg-spinners:ring-resize" class="size-8 text-primary" />
                      </div>
                      <div>
                        <p class="font-medium">Uploading your file...</p>
                        <p class="text-sm text-muted-foreground mt-1">This may take a moment</p>
                      </div>
                    </div>

                    <div v-else class="space-y-4">
                      <div class="size-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                        <Icon name="lucide:upload-cloud" class="size-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p class="text-lg font-medium">Drop your PDF here</p>
                        <p class="text-muted-foreground mt-1">or click to browse your files</p>
                      </div>
                      <div class="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                        <span class="flex items-center gap-1">
                          <Icon name="lucide:file-text" class="size-3" />
                          PDF files only
                        </span>
                        <span class="flex items-center gap-1">
                          <Icon name="lucide:hard-drive" class="size-3" />
                          Max 50MB
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Uploaded File Preview -->
                  <div v-else class="space-y-4">
                    <div class="border rounded-xl p-6 bg-muted/30">
                      <div class="flex items-start gap-4">
                        <!-- PDF Preview Placeholder -->
                        <div
                          class="w-32 h-40 rounded-lg bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 flex flex-col items-center justify-center shrink-0"
                        >
                          <Icon name="lucide:file-text" class="size-12 text-red-500/70" />
                          <span class="text-xs font-medium text-red-500/70 mt-2">PDF</span>
                        </div>

                        <!-- File Info -->
                        <div class="flex-1 min-w-0 space-y-3">
                          <div>
                            <h4 class="font-semibold text-lg truncate">{{ uploadedFile.fileName }}</h4>
                            <p class="text-sm text-muted-foreground mt-1">Uploaded successfully</p>
                          </div>

                          <div class="flex flex-wrap gap-3">
                            <UiBadge variant="secondary" class="gap-1.5">
                              <Icon name="lucide:hard-drive" class="size-3" />
                              {{ formatFileSize(uploadedFile.fileSize) }}
                            </UiBadge>
                            <UiBadge v-if="uploadedFile.pageCount" variant="secondary" class="gap-1.5">
                              <Icon name="lucide:file-text" class="size-3" />
                              {{ uploadedFile.pageCount }} {{ uploadedFile.pageCount === 1 ? "page" : "pages" }}
                            </UiBadge>
                            <UiBadge variant="outline" class="gap-1.5 text-green-600 border-green-600/30 bg-green-500/10">
                              <Icon name="lucide:check-circle" class="size-3" />
                              Ready
                            </UiBadge>
                          </div>

                          <UiButton variant="outline" size="sm" @click="uploadedFile = null">
                            <Icon name="lucide:trash-2" class="size-4 mr-2" />
                            Remove & Upload Different File
                          </UiButton>
                        </div>
                      </div>
                    </div>

                    <p class="text-sm text-muted-foreground text-center">
                      You can add more files to this project after creation
                    </p>
                  </div>
                </div>

                <!-- ADDITIONAL INFO SECTION -->
                <div v-else-if="activeSection === 'notes'" class="space-y-6 max-w-2xl">
                  <!-- Priority -->
                  <div class="space-y-3">
                    <UiLabel class="text-sm font-medium">Priority Level</UiLabel>
                    <div class="flex gap-2">
                      <button
                        v-for="priority in priorityLevels"
                        :key="priority.value"
                        type="button"
                        class="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all"
                        :class="
                          newProject.priority === priority.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/50'
                        "
                        @click="newProject.priority = priority.value"
                      >
                        <div class="size-2.5 rounded-full" :class="priority.color" />
                        <span class="text-sm font-medium">{{ priority.label }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Tags -->
                  <div class="space-y-3">
                    <UiLabel class="text-sm font-medium">Tags</UiLabel>
                    <div class="flex gap-2">
                      <UiInput
                        v-model="tagInput"
                        placeholder="Add a tag and press Enter..."
                        class="h-11"
                        @keyup.enter="addTag"
                      />
                      <UiButton variant="outline" @click="addTag">
                        <Icon name="lucide:plus" class="size-4" />
                      </UiButton>
                    </div>
                    <div v-if="newProject.tags.length" class="flex flex-wrap gap-2">
                      <UiBadge v-for="tag in newProject.tags" :key="tag" variant="secondary" class="gap-1 pr-1">
                        {{ tag }}
                        <button
                          class="ml-1 hover:bg-muted rounded p-0.5 transition-colors"
                          @click.stop="removeTag(tag)"
                        >
                          <Icon name="lucide:x" class="size-3" />
                        </button>
                      </UiBadge>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      Suggested: electrical, plumbing, structural, council, urgent
                    </p>
                  </div>

                  <!-- Notes -->
                  <div class="space-y-2">
                    <UiLabel for="project-notes" class="text-sm font-medium">Internal Notes</UiLabel>
                    <UiTextarea
                      id="project-notes"
                      v-model="newProject.notes"
                      placeholder="Any additional notes, special requirements, or reminders..."
                      :rows="6"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
