<script setup lang="ts">
import type { ProjectFileWithUploader } from "#shared/types/projects.types"
import { toast } from "vue-sonner"

const props = defineProps<{
  projectId: string
  file: ProjectFileWithUploader | null
}>()

const open = defineModel<boolean>("open", { default: false })

const emit = defineEmits<{
  updated: [file: ProjectFileWithUploader]
}>()

const editFileName = ref("")
const isSaving = ref(false)

watch(
  () => props.file,
  (file) => {
    if (file) editFileName.value = file.pdfFileName
  }
)

async function handleSave() {
  if (!props.file || !editFileName.value.trim()) return

  isSaving.value = true
  try {
    const updated = await $fetch<ProjectFileWithUploader>(`/api/projects/${props.projectId}/files/${props.file.id}`, {
      method: "PATCH",
      body: { pdfFileName: editFileName.value.trim() }
    })

    emit("updated", updated)
    toast.success("File updated")
    open.value = false
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to update file")
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open">
    <UiDialogContent class="sm:max-w-md">
      <UiDialogHeader>
        <UiDialogTitle>Rename File</UiDialogTitle>
        <UiDialogDescription>Update the display name for this file</UiDialogDescription>
      </UiDialogHeader>

      <div class="py-4">
        <div class="space-y-2">
          <UiLabel for="edit-file-name">File Name</UiLabel>
          <UiInput
            id="edit-file-name"
            v-model="editFileName"
            placeholder="Enter file name"
            :disabled="isSaving"
            @keydown.enter="handleSave"
          />
        </div>
      </div>

      <UiDialogFooter>
        <UiButton variant="outline" :disabled="isSaving" @click="open = false">Cancel</UiButton>
        <UiButton :disabled="isSaving || !editFileName.trim()" @click="handleSave">
          <UiSpinner v-if="isSaving" class="size-4" />
          Save
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
