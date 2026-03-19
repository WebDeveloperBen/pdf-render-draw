<script setup lang="ts">
import type { ProjectFileWithUploader } from "#shared/types/projects.types"
import { ArrowRight, Clock, FileText, HardDrive, Layers, PenTool, PencilRuler, X } from "lucide-vue-next"

const props = defineProps<{
  projectId: string
  files: ProjectFileWithUploader[]
}>()

const open = defineModel<boolean>("open", { default: false })

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

const formatDate = (date: Date | string | null) => {
  if (!date) return "Never"
  return new Date(date).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}
</script>

<template>
  <UiDialog v-model:open="open">
    <UiDialogContent class="sm:max-w-3xl p-0 gap-0 overflow-hidden" :hide-close="true">
      <!-- Header -->
      <div class="px-6 py-5 border-b bg-muted/30">
        <div class="flex items-center gap-4">
          <div class="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <PencilRuler class="size-6 text-primary" />
          </div>
          <div class="flex-1">
            <h2 class="text-lg font-semibold">Open in Editor</h2>
            <p class="text-sm text-muted-foreground">Select a file to start editing</p>
          </div>
          <UiButton variant="ghost" size="icon" @click="open = false">
            <X class="size-5" />
          </UiButton>
        </div>
      </div>

      <!-- File Grid -->
      <div class="p-6 max-h-[60vh] overflow-y-auto">
        <div class="grid gap-4 sm:grid-cols-2">
          <button
            v-for="file in files"
            :key="file.id"
            type="button"
            class="group relative border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all text-left bg-background"
            @click="navigateTo(`/editor?projectId=${projectId}&fileId=${file.id}`)"
          >
            <!-- PDF Preview Area -->
            <div
              class="relative h-36 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center"
            >
              <FileText class="size-14 text-slate-300 dark:text-slate-600" />

              <!-- Hover Overlay -->
              <div
                class="absolute inset-0 bg-primary/95 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
              >
                <div class="size-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
                  <PencilRuler class="size-7 text-primary-foreground" />
                </div>
                <span class="font-semibold text-primary-foreground">Open in Editor</span>
              </div>

              <!-- Annotation Badge -->
              <div
                v-if="file.annotationCount > 0"
                class="absolute top-3 right-3 flex items-center gap-1.5 bg-background/95 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-medium shadow-sm"
              >
                <PenTool class="size-3.5 text-primary" />
                {{ file.annotationCount }}
              </div>

              <!-- Page Count Badge -->
              <div
                class="absolute bottom-3 left-3 flex items-center gap-1.5 bg-background/95 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-medium shadow-sm"
              >
                <Layers class="size-3.5 text-muted-foreground" />
                {{ file.pageCount }} {{ file.pageCount === 1 ? "page" : "pages" }}
              </div>
            </div>

            <!-- File Info -->
            <div class="p-4">
              <h4 class="font-medium truncate mb-2" :title="file.pdfFileName">
                {{ file.pdfFileName }}
              </h4>
              <div class="flex items-center justify-between text-xs text-muted-foreground">
                <span class="flex items-center gap-1.5">
                  <HardDrive class="size-3.5" />
                  {{ formatFileSize(file.pdfFileSize) }}
                </span>
                <span class="flex items-center gap-1.5">
                  <Clock class="size-3.5" />
                  {{ formatDate(file.updatedAt || file.createdAt) }}
                </span>
              </div>
            </div>

            <!-- Bottom Action Bar -->
            <div class="px-4 py-3 border-t bg-muted/30 flex items-center justify-between">
              <span class="text-xs text-muted-foreground">Click to edit</span>
              <ArrowRight
                class="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all"
              />
            </div>
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
        <p class="text-sm text-muted-foreground">
          {{ files.length }} {{ files.length === 1 ? "file" : "files" }} in this project
        </p>
        <UiButton variant="outline" @click="open = false">Cancel</UiButton>
      </div>
    </UiDialogContent>
  </UiDialog>
</template>
