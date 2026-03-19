<script setup lang="ts">
import type { ProjectFileWithUploader } from "#shared/types/projects.types"
import { toast } from "vue-sonner"
import { FileText, UploadCloud, X } from "lucide-vue-next"

const props = defineProps<{
  projectId: string
}>()

const open = defineModel<boolean>("open", { default: false })

const emit = defineEmits<{
  added: [file: ProjectFileWithUploader]
}>()

const isUploading = ref(false)
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadedFile = ref<{
  pdfUrl: string
  fileName: string
  fileSize: number
  pageCount: number
} | null>(null)

function reset() {
  uploadedFile.value = null
  isUploading.value = false
  isDragging.value = false
}

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

  const droppedFiles = event.dataTransfer?.files
  if (droppedFiles && droppedFiles[0]) {
    if (droppedFiles[0].type !== "application/pdf") {
      toast.error("Please upload a PDF file")
      return
    }
    uploadFile(droppedFiles[0])
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

async function handleAddFile() {
  if (!uploadedFile.value) return

  try {
    const newFile = await $fetch<ProjectFileWithUploader>(`/api/projects/${props.projectId}/files`, {
      method: "POST",
      body: {
        pdfUrl: uploadedFile.value.pdfUrl,
        pdfFileName: uploadedFile.value.fileName,
        pdfFileSize: uploadedFile.value.fileSize,
        pageCount: uploadedFile.value.pageCount
      }
    })

    emit("added", newFile)
    toast.success("File added to project")
    open.value = false
    reset()
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to add file")
  }
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}
</script>

<template>
  <UiDialog v-model:open="open" @update:open="(v) => !v && reset()">
    <UiDialogContent class="w-full sm:min-w-3xl">
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
            <UiSpinner class="size-10 mx-auto text-primary" />
            <p class="text-sm text-muted-foreground">Uploading...</p>
          </div>

          <div v-else class="space-y-3">
            <UploadCloud class="size-10 mx-auto text-muted-foreground" />
            <div>
              <p class="font-medium">Drop your PDF here or click to browse</p>
              <p class="text-sm text-muted-foreground mt-1">Maximum file size: 50MB</p>
            </div>
          </div>
        </div>

        <div v-else class="border rounded-lg p-4">
          <div class="flex items-start gap-3">
            <div class="shrink-0 size-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <FileText class="size-5 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">{{ uploadedFile.fileName }}</p>
              <p class="text-sm text-muted-foreground">
                {{ formatFileSize(uploadedFile.fileSize) }}
                <span v-if="uploadedFile.pageCount"> &bull; {{ uploadedFile.pageCount }} pages</span>
              </p>
            </div>
            <UiButton variant="ghost" size="sm" @click="uploadedFile = null">
              <X class="size-4" />
            </UiButton>
          </div>
        </div>
      </div>

      <UiDialogFooter>
        <UiButton variant="outline" @click="open = false">Cancel</UiButton>
        <UiButton :disabled="!uploadedFile" @click="handleAddFile">Add to Project</UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
