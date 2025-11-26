# Document Download

## Overview

Allow users to download documents from the editor/viewer with annotations baked into the PDF. Supports multiple export formats and configuration options for different use cases.

## Export Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| **PDF** | Original PDF with annotations embedded | Sharing, printing, archival |
| **PDF (Flattened)** | Annotations merged into PDF content | Final documents, no editing |
| **PNG/JPEG** | Rasterized image per page | Presentations, thumbnails |
| **SVG** | Vector export of annotations only | Design integration |
| **JSON** | Annotation data export | Backup, API integration |

## Download Options

```typescript
// types/download.ts
interface DownloadOptions {
  // Format
  format: 'pdf' | 'pdf-flat' | 'png' | 'jpeg' | 'svg' | 'json'

  // Page selection
  pages: 'all' | 'current' | number[]  // Specific page numbers

  // PDF options
  pdf?: {
    flatten: boolean        // Merge annotations into PDF
    includeAnnotations: boolean
    annotationOpacity?: number  // 0-1
    quality: 'screen' | 'print' | 'prepress'
  }

  // Image options (PNG/JPEG)
  image?: {
    dpi: number            // 72, 150, 300
    quality: number        // JPEG quality 1-100
    background: 'white' | 'transparent'  // PNG only
    scale: number          // 1x, 2x, etc.
  }

  // Filename
  filename?: string        // Custom filename
  includeDate?: boolean    // Append date to filename

  // Watermark (for shared docs)
  watermark?: string
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Download Request                           │
│  - Format selection                                             │
│  - Page selection                                               │
│  - Quality settings                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Server Processing                          │
├─────────────────────────────────────────────────────────────────┤
│  PDF Export:                                                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ Load PDF    │───▶│ Render      │───▶│ Embed       │        │
│  │ (pdf-lib)   │    │ Annotations │    │ Annotations │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                 │
│  Image Export:                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ Render PDF  │───▶│ Overlay     │───▶│ Export      │        │
│  │ (pdf.js)    │    │ Annotations │    │ (sharp)     │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      File Download                              │
│  - Stream to client                                             │
│  - Progress tracking                                            │
│  - Cleanup temp files                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation

### Server-Side PDF Export

```typescript
// server/api/documents/[id]/download.post.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { requireAuth } from '~/server/utils/auth-helpers'
import { db, schema } from '~/server/utils/db'
import { eq } from 'drizzle-orm'

interface DownloadBody {
  format: 'pdf' | 'pdf-flat' | 'png' | 'jpeg' | 'json'
  pages?: 'all' | 'current' | number[]
  currentPage?: number
  options?: Record<string, any>
}

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const documentId = getRouterParam(event, 'id')
  const body = await readBody<DownloadBody>(event)

  // Get document
  const [document] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId!))

  if (!document) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  // Fetch original PDF
  const pdfResponse = await fetch(document.pdfUrl)
  const pdfBytes = await pdfResponse.arrayBuffer()

  switch (body.format) {
    case 'pdf':
    case 'pdf-flat':
      return await exportPdf(pdfBytes, document.annotations, body)

    case 'png':
    case 'jpeg':
      return await exportImage(pdfBytes, document.annotations, body)

    case 'json':
      return await exportJson(document.annotations, body)

    default:
      throw createError({ statusCode: 400, message: 'Invalid format' })
  }
})

async function exportPdf(
  pdfBytes: ArrayBuffer,
  annotations: Annotation[],
  options: DownloadBody
) {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Get pages to export
  const pageIndices = getPageIndices(options.pages, options.currentPage, pages.length)

  // Draw annotations on each page
  for (const pageIndex of pageIndices) {
    const page = pages[pageIndex]
    const pageAnnotations = annotations.filter(a => a.page === pageIndex + 1)

    for (const annotation of pageAnnotations) {
      await drawAnnotation(page, annotation, font, options.format === 'pdf-flat')
    }
  }

  // If specific pages, create new document with only those pages
  let outputDoc = pdfDoc
  if (options.pages !== 'all' && pageIndices.length < pages.length) {
    outputDoc = await PDFDocument.create()
    const copiedPages = await outputDoc.copyPages(pdfDoc, pageIndices)
    copiedPages.forEach(page => outputDoc.addPage(page))
  }

  const outputBytes = await outputDoc.save()

  return new Response(outputBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="document.pdf"`
    }
  })
}

async function drawAnnotation(
  page: PDFPage,
  annotation: Annotation,
  font: PDFFont,
  flatten: boolean
) {
  const { width, height } = page.getSize()

  switch (annotation.type) {
    case 'line':
      drawLine(page, annotation, flatten)
      break

    case 'area':
      drawArea(page, annotation, flatten)
      break

    case 'perimeter':
      drawPerimeter(page, annotation, flatten)
      break

    case 'count':
      drawCount(page, annotation, font, flatten)
      break

    case 'text':
      drawText(page, annotation, font, flatten)
      break

    case 'measure':
      drawMeasure(page, annotation, font, flatten)
      break
  }
}

function drawLine(page: PDFPage, annotation: LineAnnotation, flatten: boolean) {
  const { height } = page.getSize()

  // PDF coordinates are bottom-left origin, SVG is top-left
  const points = annotation.points.map(p => ({
    x: p.x,
    y: height - p.y
  }))

  if (points.length >= 2) {
    page.drawLine({
      start: points[0],
      end: points[1],
      thickness: annotation.strokeWidth || 2,
      color: hexToRgb(annotation.strokeColor || '#000000'),
      opacity: flatten ? 1 : 0.8
    })
  }
}

function drawArea(page: PDFPage, annotation: AreaAnnotation, flatten: boolean) {
  const { height } = page.getSize()

  const points = annotation.points.map(p => ({
    x: p.x,
    y: height - p.y
  }))

  if (points.length >= 3) {
    // Draw filled polygon
    page.drawPolygon({
      points,
      color: hexToRgb(annotation.fillColor || '#f05a24'),
      opacity: 0.2,
      borderColor: hexToRgb(annotation.strokeColor || '#f05a24'),
      borderWidth: annotation.strokeWidth || 1
    })
  }
}

function drawText(page: PDFPage, annotation: TextAnnotation, font: PDFFont, flatten: boolean) {
  const { height } = page.getSize()

  page.drawText(annotation.text, {
    x: annotation.position.x,
    y: height - annotation.position.y,
    size: annotation.fontSize || 14,
    font,
    color: hexToRgb(annotation.color || '#000000'),
    opacity: flatten ? 1 : 0.9
  })
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return rgb(0, 0, 0)

  return rgb(
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  )
}

function getPageIndices(
  pages: 'all' | 'current' | number[] | undefined,
  currentPage: number | undefined,
  totalPages: number
): number[] {
  if (!pages || pages === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i)
  }

  if (pages === 'current') {
    return [Math.max(0, (currentPage || 1) - 1)]
  }

  return pages.map(p => p - 1).filter(i => i >= 0 && i < totalPages)
}
```

### Image Export

```typescript
// server/utils/image-export.ts
import sharp from 'sharp'
import { createCanvas } from 'canvas'
import * as pdfjs from 'pdfjs-dist'

interface ImageExportOptions {
  format: 'png' | 'jpeg'
  dpi?: number
  quality?: number
  background?: 'white' | 'transparent'
  pages?: number[]
}

export async function exportImage(
  pdfBytes: ArrayBuffer,
  annotations: Annotation[],
  options: ImageExportOptions
) {
  const dpi = options.dpi || 150
  const scale = dpi / 72  // PDF is 72 DPI

  // Load PDF
  const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise
  const pageCount = pdf.numPages

  const pageIndices = options.pages || Array.from({ length: pageCount }, (_, i) => i)
  const images: Buffer[] = []

  for (const pageIndex of pageIndices) {
    const page = await pdf.getPage(pageIndex + 1)
    const viewport = page.getViewport({ scale })

    // Create canvas
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')

    // White background for JPEG
    if (options.format === 'jpeg' || options.background === 'white') {
      context.fillStyle = 'white'
      context.fillRect(0, 0, viewport.width, viewport.height)
    }

    // Render PDF page
    await page.render({
      canvasContext: context,
      viewport
    }).promise

    // Draw annotations
    const pageAnnotations = annotations.filter(a => a.page === pageIndex + 1)
    drawAnnotationsToCanvas(context, pageAnnotations, scale)

    // Convert to buffer
    const buffer = options.format === 'jpeg'
      ? canvas.toBuffer('image/jpeg', { quality: (options.quality || 90) / 100 })
      : canvas.toBuffer('image/png')

    images.push(buffer)
  }

  // If single page, return directly
  if (images.length === 1) {
    return new Response(images[0], {
      headers: {
        'Content-Type': `image/${options.format}`,
        'Content-Disposition': `attachment; filename="page.${options.format}"`
      }
    })
  }

  // Multiple pages - create ZIP
  const zip = new JSZip()
  images.forEach((buffer, i) => {
    zip.file(`page-${i + 1}.${options.format}`, buffer)
  })

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

  return new Response(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="pages.zip"'
    }
  })
}

function drawAnnotationsToCanvas(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  scale: number
) {
  for (const annotation of annotations) {
    ctx.save()
    ctx.scale(scale, scale)

    switch (annotation.type) {
      case 'line':
        drawLineToCanvas(ctx, annotation)
        break
      case 'area':
        drawAreaToCanvas(ctx, annotation)
        break
      case 'text':
        drawTextToCanvas(ctx, annotation)
        break
      // ... other types
    }

    ctx.restore()
  }
}
```

### JSON Export

```typescript
// server/utils/json-export.ts
export async function exportJson(
  annotations: Annotation[],
  options: DownloadBody
) {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    annotations: annotations.map(a => ({
      ...a,
      // Normalize/clean data
      id: undefined,  // Remove internal IDs
      createdAt: undefined,
      updatedAt: undefined
    }))
  }

  const json = JSON.stringify(exportData, null, 2)

  return new Response(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="annotations.json"'
    }
  })
}
```

## Client-Side Download

### Download Composable

```typescript
// composables/useDocumentDownload.ts
export function useDocumentDownload(documentId: string) {
  const downloading = ref(false)
  const progress = ref(0)

  async function download(options: DownloadOptions) {
    downloading.value = true
    progress.value = 0

    try {
      const response = await $fetch(`/api/documents/${documentId}/download`, {
        method: 'POST',
        body: options,
        responseType: 'blob',
        onDownloadProgress: (event) => {
          if (event.total) {
            progress.value = Math.round((event.loaded / event.total) * 100)
          }
        }
      })

      // Generate filename
      const filename = generateFilename(options)

      // Trigger download
      const url = URL.createObjectURL(response as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Download complete')
    } catch (error) {
      toast.error('Download failed')
      throw error
    } finally {
      downloading.value = false
      progress.value = 0
    }
  }

  function generateFilename(options: DownloadOptions): string {
    const base = options.filename || 'document'
    const date = options.includeDate
      ? `-${new Date().toISOString().split('T')[0]}`
      : ''

    const ext = {
      pdf: 'pdf',
      'pdf-flat': 'pdf',
      png: options.pages === 'current' ? 'png' : 'zip',
      jpeg: options.pages === 'current' ? 'jpg' : 'zip',
      svg: 'svg',
      json: 'json'
    }[options.format]

    return `${base}${date}.${ext}`
  }

  return {
    download,
    downloading,
    progress
  }
}
```

## UI Components

### Download Button

```vue
<!-- components/document/DownloadButton.vue -->
<script setup lang="ts">
const props = defineProps<{
  documentId: string
  currentPage?: number
}>()

const { download, downloading, progress } = useDocumentDownload(props.documentId)

const showDialog = ref(false)
const selectedFormat = ref<'pdf' | 'pdf-flat' | 'png' | 'jpeg' | 'json'>('pdf')
const selectedPages = ref<'all' | 'current'>('all')
const imageQuality = ref(150)  // DPI

const formatOptions = [
  { value: 'pdf', label: 'PDF with Annotations', icon: 'file-text' },
  { value: 'pdf-flat', label: 'PDF (Flattened)', icon: 'file-lock' },
  { value: 'png', label: 'PNG Image', icon: 'image' },
  { value: 'jpeg', label: 'JPEG Image', icon: 'image' },
  { value: 'json', label: 'JSON Data', icon: 'code' }
]

async function handleDownload() {
  await download({
    format: selectedFormat.value,
    pages: selectedPages.value,
    currentPage: props.currentPage,
    image: ['png', 'jpeg'].includes(selectedFormat.value)
      ? { dpi: imageQuality.value }
      : undefined
  })
  showDialog.value = false
}
</script>

<template>
  <div>
    <!-- Simple download button -->
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="outline" :disabled="downloading">
          <Icon v-if="downloading" name="loader" class="mr-2 animate-spin" />
          <Icon v-else name="download" class="mr-2" />
          Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem @click="download({ format: 'pdf', pages: 'all' })">
          <Icon name="file-text" class="mr-2" />
          Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem @click="download({ format: 'png', pages: 'current', currentPage })">
          <Icon name="image" class="mr-2" />
          Download Page as Image
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="showDialog = true">
          <Icon name="settings" class="mr-2" />
          More Options...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Advanced download dialog -->
    <Dialog v-model:open="showDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download Document</DialogTitle>
          <DialogDescription>
            Choose format and options for download
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <!-- Format selection -->
          <div class="space-y-2">
            <Label>Format</Label>
            <RadioGroup v-model="selectedFormat" class="grid grid-cols-2 gap-2">
              <div
                v-for="format in formatOptions"
                :key="format.value"
                class="flex items-center space-x-2"
              >
                <RadioGroupItem :value="format.value" :id="format.value" />
                <Label :for="format.value" class="flex items-center gap-2 cursor-pointer">
                  <Icon :name="format.icon" size="16" />
                  {{ format.label }}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <!-- Page selection -->
          <div class="space-y-2">
            <Label>Pages</Label>
            <RadioGroup v-model="selectedPages" class="flex gap-4">
              <div class="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label for="all">All pages</Label>
              </div>
              <div class="flex items-center space-x-2">
                <RadioGroupItem value="current" id="current" />
                <Label for="current">Current page only</Label>
              </div>
            </RadioGroup>
          </div>

          <!-- Image quality (for PNG/JPEG) -->
          <div v-if="['png', 'jpeg'].includes(selectedFormat)" class="space-y-2">
            <Label>Quality (DPI)</Label>
            <Select v-model="imageQuality">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="72">72 DPI (Screen)</SelectItem>
                <SelectItem :value="150">150 DPI (Standard)</SelectItem>
                <SelectItem :value="300">300 DPI (Print)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Progress -->
          <div v-if="downloading" class="space-y-2">
            <Progress :value="progress" />
            <p class="text-sm text-muted-foreground text-center">
              Preparing download... {{ progress }}%
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showDialog = false">
            Cancel
          </Button>
          <Button @click="handleDownload" :loading="downloading">
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
```

### Editor Toolbar Integration

```vue
<!-- In Editor toolbar -->
<template>
  <div class="toolbar">
    <!-- ... other tools ... -->

    <Separator orientation="vertical" />

    <!-- Download -->
    <DownloadButton
      :document-id="documentId"
      :current-page="viewportStore.getCurrentPage"
    />

    <!-- Share -->
    <Button variant="outline" @click="showShareDialog = true">
      <Icon name="share" class="mr-2" />
      Share
    </Button>
  </div>
</template>
```

## Dependencies

```bash
# Server-side PDF manipulation
pnpm add pdf-lib

# Image processing
pnpm add sharp

# Server-side canvas (for image export)
pnpm add canvas

# ZIP creation (for multi-page images)
pnpm add jszip
```

## Acceptance Criteria

### PDF Export
- [ ] Export PDF with annotations
- [ ] Export flattened PDF
- [ ] All annotation types rendered correctly
- [ ] Page selection works (all/current/specific)
- [ ] Watermark applied when configured

### Image Export
- [ ] Export PNG per page
- [ ] Export JPEG per page
- [ ] DPI/quality settings work
- [ ] Multi-page creates ZIP
- [ ] Annotations rendered in images

### JSON Export
- [ ] Export annotation data
- [ ] Valid JSON format
- [ ] Can be re-imported (future)

### User Experience
- [ ] Download progress shown
- [ ] Quick download shortcuts
- [ ] Advanced options dialog
- [ ] Filename customization
- [ ] Error handling with retry

### Shared Documents
- [ ] Download respects share permissions
- [ ] Watermark included when set
- [ ] No download if disabled
