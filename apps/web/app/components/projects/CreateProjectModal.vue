<script setup lang="ts">
import type { ProjectWithRelations } from "#shared/types/projects.types"
import { usePostApiProjects } from "@/models/api"
import { toast } from "vue-sonner"

// API mutation hook
const { mutateAsync: createProject, isPending: isCreating } = usePostApiProjects()

const isOpen = defineModel<boolean>("open", { required: true })

const emit = defineEmits<{
  created: [project: ProjectWithRelations]
}>()

// ============================================
// STEP DEFINITIONS
// ============================================

const steps = [
  { id: "details" as const, label: "Project Details", icon: "lucide:clipboard-list", required: true },
  { id: "location" as const, label: "Location & Client", icon: "lucide:map-pin", required: false },
  { id: "files" as const, label: "Upload Files", icon: "lucide:file-up", required: true },
  { id: "notes" as const, label: "Additional Info", icon: "lucide:sticky-note", required: false }
]

type StepId = (typeof steps)[number]["id"]

const activeStep = ref<StepId>("details")

// ============================================
// FORM STATE - Simple refs, no vee-validate complexity
// ============================================

const formData = ref({
  // Details
  name: "",
  reference: "",
  category: "",
  description: "",
  // Location
  siteAddress: "",
  suburb: "",
  postcode: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  // Notes
  priority: "normal",
  tags: [] as string[],
  notes: ""
})

// File upload state
const uploadedFile = ref<{
  pdfUrl: string
  fileName: string
  fileSize: number
  pageCount: number
} | null>(null)

const isUploading = ref(false)
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Field errors for inline validation
const fieldErrors = ref<Record<string, string>>({})

// ============================================
// STEP STATUS
// ============================================

const stepStatus = computed(() => ({
  details: !!formData.value.name.trim(),
  location: true,
  files: !!uploadedFile.value,
  notes: true
}))

const canCreate = computed(() => stepStatus.value.details && stepStatus.value.files)

// ============================================
// CATEGORIES & OPTIONS
// ============================================

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

const priorityLevels = [
  { value: "low", label: "Low", color: "bg-slate-500" },
  { value: "normal", label: "Normal", color: "bg-blue-500" },
  { value: "high", label: "High", color: "bg-amber-500" },
  { value: "urgent", label: "Urgent", color: "bg-red-500" }
]

// ============================================
// VALIDATION
// ============================================

function validateStep(stepId: StepId): boolean {
  fieldErrors.value = {}

  if (stepId === "details") {
    if (!formData.value.name.trim()) {
      fieldErrors.value.name = "Project name is required"
      return false
    }
    if (formData.value.name.trim().length < 3) {
      fieldErrors.value.name = "Name must be at least 3 characters"
      return false
    }
  }

  if (stepId === "files") {
    if (!uploadedFile.value) {
      toast.error("Please upload a PDF file")
      return false
    }
  }

  if (stepId === "location" && formData.value.clientEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.value.clientEmail)) {
      fieldErrors.value.clientEmail = "Invalid email address"
      return false
    }
  }

  return true
}

// ============================================
// NAVIGATION
// ============================================

function goToNextStep() {
  if (!validateStep(activeStep.value)) {
    return
  }

  const currentIndex = steps.findIndex((s) => s.id === activeStep.value)
  const nextStep = steps[currentIndex + 1]
  if (nextStep) {
    activeStep.value = nextStep.id
  }
}

function goToPreviousStep() {
  const currentIndex = steps.findIndex((s) => s.id === activeStep.value)
  const prevStep = steps[currentIndex - 1]
  if (prevStep) {
    activeStep.value = prevStep.id
  }
}

// ============================================
// TAGS
// ============================================

const tagInput = ref("")

function addTag() {
  const tag = tagInput.value.trim()
  if (tag && !formData.value.tags.includes(tag)) {
    formData.value.tags.push(tag)
    tagInput.value = ""
  }
}

function removeTag(tag: string) {
  formData.value.tags = formData.value.tags.filter((t) => t !== tag)
}

// ============================================
// FILE HANDLING
// ============================================

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    uploadFile(input.files[0])
  }
}

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
    const formDataUpload = new FormData()
    formDataUpload.append("pdf", file)

    const result = await $fetch<{
      pdfUrl: string
      fileName: string
      fileSize: number
      pageCount: number
    }>("/api/upload/pdf", {
      method: "POST",
      body: formDataUpload
    })

    uploadedFile.value = result
    toast.success("File uploaded successfully")
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to upload file")
  } finally {
    isUploading.value = false
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================
// FORM SUBMISSION
// ============================================

async function handleSubmit() {
  // Validate all required steps
  if (!validateStep("details")) {
    activeStep.value = "details"
    return
  }

  if (!uploadedFile.value) {
    activeStep.value = "files"
    toast.error("Please upload a PDF file")
    return
  }

  try {
    const response = await createProject({
      data: {
        name: formData.value.name,
        description: formData.value.description || null,
        reference: formData.value.reference || null,
        category: formData.value.category || null,
        siteAddress: formData.value.siteAddress || null,
        suburb: formData.value.suburb || null,
        postcode: formData.value.postcode || null,
        clientName: formData.value.clientName || null,
        clientEmail: formData.value.clientEmail || null,
        clientPhone: formData.value.clientPhone || null,
        priority: formData.value.priority as "low" | "normal" | "high" | "urgent",
        tags: formData.value.tags,
        notes: formData.value.notes || null,
        pdfUrl: uploadedFile.value.pdfUrl,
        pdfFileName: uploadedFile.value.fileName,
        pdfFileSize: uploadedFile.value.fileSize,
        pageCount: uploadedFile.value.pageCount
      }
    })

    // Response is the data directly from Orval mutation
    if (!response) {
      throw new Error("Failed to create project")
    }

    emit("created", response as unknown as ProjectWithRelations)
    toast.success("Project created successfully")
    closeModal()
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to create project")
  }
}

// ============================================
// MODAL LIFECYCLE
// ============================================

function resetForm() {
  activeStep.value = "details"
  formData.value = {
    name: "",
    reference: "",
    category: "",
    description: "",
    siteAddress: "",
    suburb: "",
    postcode: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    priority: "normal",
    tags: [],
    notes: ""
  }
  uploadedFile.value = null
  fieldErrors.value = {}
  isUploading.value = false
  isDragging.value = false
  tagInput.value = ""
}

function closeModal() {
  isOpen.value = false
  resetForm()
}

watch(isOpen, (open) => {
  if (!open) {
    resetForm()
  }
})
</script>

<template>
  <UiDialog v-model:open="isOpen">
    <UiDialogContent class="sm:max-w-5xl h-[85vh] p-0 gap-0 overflow-hidden" :hide-close="true">
      <div class="flex h-full">
        <!-- Sidebar Navigation -->
        <div class="w-64 bg-muted/30 border-r flex flex-col shrink-0">
          <div class="p-6 border-b">
            <h2 class="text-lg font-semibold">New Project</h2>
            <p class="text-sm text-muted-foreground mt-1">Set up your building plan project</p>
          </div>

          <nav class="flex-1 p-3 space-y-1">
            <button
              v-for="step in steps"
              :key="step.id"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
              :class="[
                activeStep === step.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              ]"
              @click="activeStep = step.id"
            >
              <Icon :name="step.icon" class="size-5" />
              <span class="flex-1 font-medium text-sm">{{ step.label }}</span>
              <div
                v-if="step.required"
                class="size-2 rounded-full transition-colors"
                :class="stepStatus[step.id] ? 'bg-green-500' : 'bg-amber-500'"
              />
            </button>
          </nav>

          <div class="p-4 border-t">
            <UiButton variant="ghost" class="w-full" @click="closeModal">
              <Icon name="lucide:x" class="size-4 mr-2" />
              Cancel
            </UiButton>
          </div>
        </div>

        <!-- Main Content -->
        <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
          <!-- Step Header -->
          <div class="px-8 py-6 border-b bg-background">
            <div class="flex items-center gap-3">
              <div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon :name="steps.find((s) => s.id === activeStep)?.icon || ''" class="size-5 text-primary" />
              </div>
              <div>
                <h3 class="text-lg font-semibold">{{ steps.find((s) => s.id === activeStep)?.label }}</h3>
                <p class="text-sm text-muted-foreground">
                  <template v-if="activeStep === 'details'">Basic project information</template>
                  <template v-else-if="activeStep === 'location'">Job site and client details</template>
                  <template v-else-if="activeStep === 'files'">Upload building plans and documents</template>
                  <template v-else>Additional notes and organisation</template>
                </p>
              </div>
            </div>
          </div>

          <!-- Scrollable Content -->
          <div class="flex-1 overflow-y-auto flex flex-col">
            <div class="p-8 flex-1 flex flex-col">
              <!-- DETAILS STEP -->
              <div v-if="activeStep === 'details'" class="space-y-6 max-w-2xl flex-1">
                <!-- Project Name -->
                <div class="space-y-2">
                  <UiLabel for="project-name" class="text-sm font-medium">
                    Project Name <span class="text-destructive">*</span>
                  </UiLabel>
                  <UiInput
                    id="project-name"
                    v-model="formData.name"
                    placeholder="e.g., 123 Smith St - Kitchen Renovation"
                    :class="{ 'border-destructive': fieldErrors.name }"
                    @input="fieldErrors.name = ''"
                  />
                  <p v-if="fieldErrors.name" class="text-sm text-destructive">{{ fieldErrors.name }}</p>
                  <p v-else class="text-xs text-muted-foreground">A clear name helps you find this project later</p>
                </div>

                <!-- Reference Number -->
                <div class="space-y-2">
                  <UiLabel for="project-ref" class="text-sm font-medium">Reference / Job Number</UiLabel>
                  <UiInput id="project-ref" v-model="formData.reference" placeholder="e.g., JOB-2024-001" />
                </div>

                <!-- Category Selection -->
                <div class="space-y-3">
                  <UiLabel class="text-sm font-medium">Project Type</UiLabel>
                  <div class="grid grid-cols-3 gap-3">
                    <button
                      v-for="cat in projectCategories"
                      :key="cat.value"
                      type="button"
                      class="flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left"
                      :class="
                        formData.category === cat.value
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground'
                      "
                      @click="formData.category = cat.value"
                    >
                      <Icon :name="cat.icon" class="size-5 shrink-0" />
                      <span class="text-sm font-medium">{{ cat.label }}</span>
                    </button>
                  </div>
                </div>

                <!-- Description -->
                <div class="space-y-2">
                  <UiLabel for="project-desc" class="text-sm font-medium">Description</UiLabel>
                  <UiTextarea
                    id="project-desc"
                    v-model="formData.description"
                    placeholder="Brief description of the project scope, requirements, or notes..."
                    :rows="6"
                  />
                </div>
              </div>

              <!-- LOCATION STEP -->
              <div v-else-if="activeStep === 'location'" class="space-y-8 max-w-2xl flex-1">
                <div class="space-y-4">
                  <div class="flex items-center gap-2">
                    <Icon name="lucide:map-pin" class="size-5 text-primary" />
                    <h4 class="font-medium">Job Site Location</h4>
                  </div>

                  <div class="space-y-4 pl-7">
                    <div class="space-y-2">
                      <UiLabel for="site-address" class="text-sm font-medium">Street Address</UiLabel>
                      <UiInput id="site-address" v-model="formData.siteAddress" placeholder="123 Example Street" />
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                      <div class="space-y-2">
                        <UiLabel for="suburb" class="text-sm font-medium">Suburb</UiLabel>
                        <UiInput id="suburb" v-model="formData.suburb" placeholder="Suburb" />
                      </div>
                      <div class="space-y-2">
                        <UiLabel for="postcode" class="text-sm font-medium">Postcode</UiLabel>
                        <UiInput id="postcode" v-model="formData.postcode" placeholder="0000" />
                      </div>
                    </div>
                  </div>
                </div>

                <UiDivider />

                <div class="space-y-4">
                  <div class="flex items-center gap-2">
                    <Icon name="lucide:user" class="size-5 text-primary" />
                    <h4 class="font-medium">Client Information</h4>
                  </div>

                  <div class="space-y-4 pl-7">
                    <div class="space-y-2">
                      <UiLabel for="client-name" class="text-sm font-medium">Client Name</UiLabel>
                      <UiInput id="client-name" v-model="formData.clientName" placeholder="John Smith" />
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                      <div class="space-y-2">
                        <UiLabel for="client-email" class="text-sm font-medium">Email</UiLabel>
                        <UiInput
                          id="client-email"
                          v-model="formData.clientEmail"
                          type="email"
                          placeholder="client@example.com"
                          :class="{ 'border-destructive': fieldErrors.clientEmail }"
                          @input="fieldErrors.clientEmail = ''"
                        />
                        <p v-if="fieldErrors.clientEmail" class="text-sm text-destructive">
                          {{ fieldErrors.clientEmail }}
                        </p>
                      </div>
                      <div class="space-y-2">
                        <UiLabel for="client-phone" class="text-sm font-medium">Phone</UiLabel>
                        <UiInput
                          id="client-phone"
                          v-model="formData.clientPhone"
                          type="tel"
                          placeholder="0400 000 000"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- FILES STEP -->
              <div v-else-if="activeStep === 'files'" class="flex-1 flex flex-col min-h-0">
                <div
                  v-if="!uploadedFile"
                  class="flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer min-h-100"
                  :class="
                    isDragging
                      ? 'border-primary bg-primary/5 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                  "
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

                  <div v-if="isUploading" class="space-y-4">
                    <div class="size-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon name="svg-spinners:ring-resize" class="size-10 text-primary" />
                    </div>
                    <div>
                      <p class="text-lg font-medium">Uploading your file...</p>
                      <p class="text-sm text-muted-foreground mt-1">This may take a moment</p>
                    </div>
                  </div>

                  <div v-else class="space-y-6">
                    <div class="size-24 mx-auto rounded-full bg-muted flex items-center justify-center">
                      <Icon name="lucide:upload-cloud" class="size-12 text-muted-foreground" />
                    </div>
                    <div>
                      <p class="text-xl font-semibold">Drop your PDF here</p>
                      <p class="text-muted-foreground mt-2">or click anywhere to browse your files</p>
                    </div>
                    <div class="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                      <span class="flex items-center gap-2">
                        <Icon name="lucide:file-text" class="size-4" />
                        PDF files only
                      </span>
                      <span class="flex items-center gap-2">
                        <Icon name="lucide:hard-drive" class="size-4" />
                        Max 50MB
                      </span>
                    </div>
                  </div>
                </div>

                <div v-else class="flex-1 flex flex-col min-h-100">
                  <div class="flex-1 border rounded-xl p-8 bg-muted/30 flex items-center justify-center">
                    <div class="flex items-start gap-6 max-w-xl">
                      <div
                        class="w-40 h-52 rounded-lg bg-linear-to-br from-red-500/20 to-red-600/20 border border-red-500/30 flex flex-col items-center justify-center shrink-0"
                      >
                        <Icon name="lucide:file-text" class="size-16 text-red-500/70" />
                        <span class="text-sm font-medium text-red-500/70 mt-2">PDF</span>
                      </div>

                      <div class="flex-1 min-w-0 space-y-4">
                        <div>
                          <h4 class="font-semibold text-xl truncate">{{ uploadedFile.fileName }}</h4>
                          <p class="text-sm text-muted-foreground mt-1">Uploaded successfully</p>
                        </div>

                        <div class="flex flex-wrap gap-3">
                          <UiBadge variant="secondary" class="gap-1.5 text-sm py-1 px-3">
                            <Icon name="lucide:hard-drive" class="size-3.5" />
                            {{ formatFileSize(uploadedFile.fileSize) }}
                          </UiBadge>
                          <UiBadge v-if="uploadedFile.pageCount" variant="secondary" class="gap-1.5 text-sm py-1 px-3">
                            <Icon name="lucide:file-text" class="size-3.5" />
                            {{ uploadedFile.pageCount }} {{ uploadedFile.pageCount === 1 ? "page" : "pages" }}
                          </UiBadge>
                          <UiBadge
                            variant="outline"
                            class="gap-1.5 text-sm py-1 px-3 text-green-600 border-green-600/30 bg-green-500/10"
                          >
                            <Icon name="lucide:check-circle" class="size-3.5" />
                            Ready
                          </UiBadge>
                        </div>

                        <UiButton variant="outline" @click="uploadedFile = null">
                          <Icon name="lucide:trash-2" class="size-4 mr-2" />
                          Remove & Upload Different File
                        </UiButton>
                      </div>
                    </div>
                  </div>

                  <p class="text-sm text-muted-foreground text-center mt-4">
                    You can add more files to this project after creation
                  </p>
                </div>
              </div>

              <!-- NOTES STEP -->
              <div v-else-if="activeStep === 'notes'" class="space-y-6 max-w-2xl flex-1">
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
                        formData.priority === priority.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/50'
                      "
                      @click="formData.priority = priority.value"
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
                    <UiInput v-model="tagInput" placeholder="Add a tag and press Enter..." @keyup.enter="addTag" />
                    <UiButton variant="outline" @click="addTag">
                      <Icon name="lucide:plus" class="size-4" />
                    </UiButton>
                  </div>
                  <div v-if="formData.tags.length" class="flex flex-wrap gap-2">
                    <UiBadge v-for="tag in formData.tags" :key="tag" variant="secondary" class="gap-1 pr-1">
                      {{ tag }}
                      <button class="ml-1 hover:bg-muted rounded p-0.5 transition-colors" @click.stop="removeTag(tag)">
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
                    v-model="formData.notes"
                    placeholder="Any additional notes, special requirements, or reminders..."
                    :rows="8"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Navigation -->
          <div class="px-8 py-4 border-t bg-muted/30 flex items-center justify-between">
            <UiButton v-if="activeStep !== 'details'" variant="outline" @click="goToPreviousStep">
              <Icon name="lucide:arrow-left" class="size-4 mr-2" />
              Back
            </UiButton>
            <div v-else />

            <UiButton v-if="activeStep !== 'notes'" @click="goToNextStep">
              Next
              <Icon name="lucide:arrow-right" class="size-4 ml-2" />
            </UiButton>
            <UiButton v-else :disabled="!canCreate || isCreating" @click="handleSubmit">
              <Icon v-if="isCreating" name="svg-spinners:90-ring-with-bg" class="size-4 mr-2" />
              <Icon v-else name="lucide:check" class="size-4 mr-2" />
              Create Project
            </UiButton>
          </div>
        </div>
      </div>
    </UiDialogContent>
  </UiDialog>
</template>
