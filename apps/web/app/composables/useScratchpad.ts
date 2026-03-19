import { PDFDocument } from "pdf-lib"
import type { ProjectFileWithUploader } from "#shared/types/projects.types"

export interface ScratchpadPreset {
  key: string
  label: string
  description: string
  width: number
  height: number
  popular?: boolean
}

export const SCRATCHPAD_PRESETS: ScratchpadPreset[] = [
  { key: "building-plan", label: "Building Plan", description: "A3 Landscape", width: 1191, height: 842, popular: true },
  { key: "quick-sketch", label: "Quick Sketch", description: "A4 Landscape", width: 842, height: 595 },
  { key: "large-plan", label: "Large Plan", description: "A2 Landscape", width: 1684, height: 1191 },
  { key: "site-notes", label: "Site Notes", description: "A4 Portrait", width: 595, height: 842 }
]

interface UploadResult {
  pdfUrl: string
  fileName: string
  fileSize: number
  pageCount: number
}

/**
 * Generate a blank PDF and upload it. Returns the upload result (no project file record created).
 * Use this when you need just the uploaded file data (e.g. during project creation).
 */
export async function uploadBlankPdf(preset?: ScratchpadPreset): Promise<UploadResult> {
  const p = preset ?? SCRATCHPAD_PRESETS[0]!
  const randomId = Math.random().toString(36).substring(2, 10)
  const fileName = `scratchpad_${randomId}.pdf`

  const doc = await PDFDocument.create()
  doc.addPage([p.width, p.height])
  const pdfBytes = await doc.save()

  const file = new File([pdfBytes as unknown as BlobPart], fileName, { type: "application/pdf" })
  const formData = new FormData()
  formData.append("pdf", file)

  return await $fetch<UploadResult>("/api/upload/pdf", {
    method: "POST",
    body: formData
  })
}

interface ScratchpadOptions {
  preset?: ScratchpadPreset
  name?: string
}

/**
 * Composable for creating a scratchpad as a project file.
 * Generates a blank PDF, uploads it, and creates the project file record.
 */
export function useScratchpad() {
  const isCreating = ref(false)

  async function createScratchpad(
    projectId: string,
    options: ScratchpadOptions = {}
  ): Promise<ProjectFileWithUploader> {
    isCreating.value = true
    try {
      const uploadResult = await uploadBlankPdf(options.preset)

      const projectFile = await $fetch<ProjectFileWithUploader>(`/api/projects/${projectId}/files`, {
        method: "POST",
        body: {
          pdfUrl: uploadResult.pdfUrl,
          pdfFileName: options.name || uploadResult.fileName,
          pdfFileSize: uploadResult.fileSize,
          pageCount: 1
        }
      })

      return projectFile
    } finally {
      isCreating.value = false
    }
  }

  return { isCreating, createScratchpad }
}
