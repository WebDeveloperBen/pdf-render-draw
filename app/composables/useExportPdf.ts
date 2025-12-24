import { createSSRApp } from "vue"
import { renderToString } from "vue/server-renderer"
import { jsPDF } from "jspdf"
import { svg2pdf } from "svg2pdf.js"
import { PDFDocument } from "pdf-lib"
import { toast } from "vue-sonner"
import AnnotationRenderer from "~/components/Editor/AnnotationRenderer.vue"
import type { Annotation } from "#shared/types/annotations.types"

interface ExportOptions {
  /** URL to the original PDF file */
  pdfUrl: string
  /** All annotations to embed in the PDF */
  annotations: Annotation[]
  /** Optional filename for the download (defaults to 'annotated.pdf') */
  filename?: string
}

/**
 * Composable for exporting PDFs with annotations embedded as vectors.
 *
 * Uses Vue SSR to render annotations with the same tool components used in the editor,
 * then converts them to PDF vector commands using svg2pdf.js.
 */
export function useExportPdf() {
  const isExporting = ref(false)

  /**
   * Render annotations to SVG string using Vue SSR.
   * This uses the exact same tool components as the editor.
   */
  async function renderAnnotationsToSvg(
    annotations: Annotation[],
    width: number,
    height: number
  ): Promise<SVGSVGElement> {
    console.log(`[Export] Rendering ${annotations.length} annotations to SVG (${width}x${height})`)

    // Dynamically import tool components for SSR
    const [
      ToolsMeasure,
      ToolsCount,
      ToolsArea,
      ToolsPerimeter,
      ToolsLine,
      ToolsFill,
      ToolsText
    ] = await Promise.all([
      import("~/components/Editor/Tools/Measure.vue").then((m) => m.default),
      import("~/components/Editor/Tools/Count.vue").then((m) => m.default),
      import("~/components/Editor/Tools/Area.vue").then((m) => m.default),
      import("~/components/Editor/Tools/Perimeter.vue").then((m) => m.default),
      import("~/components/Editor/Tools/Line.vue").then((m) => m.default),
      import("~/components/Editor/Tools/Fill.vue").then((m) => m.default),
      import("~/components/Editor/Tools/Text.vue").then((m) => m.default)
    ])

    // Create a mini Vue app with the AnnotationRenderer component
    const app = createSSRApp(AnnotationRenderer, {
      annotations,
      width,
      height
    })

    // Register tool components globally for SSR
    app.component("ToolsMeasure", ToolsMeasure)
    app.component("ToolsCount", ToolsCount)
    app.component("ToolsArea", ToolsArea)
    app.component("ToolsPerimeter", ToolsPerimeter)
    app.component("ToolsLine", ToolsLine)
    app.component("ToolsFill", ToolsFill)
    app.component("ToolsText", ToolsText)

    // Render to string (works in browser!)
    let svgString = await renderToString(app)

    // Strip Vue scoped style attributes (data-v-xxxxxx) as they break XML parsing
    // These are boolean attributes without values, which is invalid in XML/SVG
    svgString = svgString.replace(/\s+data-v-[a-f0-9]+/g, "")

    // Also remove Vue SSR comments that aren't needed
    svgString = svgString.replace(/<!--\[-->/g, "").replace(/<!--\]-->/g, "")

    console.log(`[Export] Generated SVG (${svgString.length} chars)`)

    // Parse the SVG string to an element
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgString, "image/svg+xml")

    // Check for parsing errors
    const parserError = doc.querySelector("parsererror")
    if (parserError) {
      console.error("[Export] SVG parsing error:", parserError.textContent)
      throw new Error(`SVG parsing failed: ${parserError.textContent}`)
    }

    return doc.documentElement as unknown as SVGSVGElement
  }

  /**
   * Export PDF with all annotations embedded as vectors.
   * Supports multi-page PDFs with annotations on different pages.
   */
  async function exportWithAnnotations(options: ExportOptions): Promise<void> {
    if (isExporting.value) return
    isExporting.value = true

    try {
      // 1. Fetch original PDF
      const pdfBytes = await fetch(options.pdfUrl).then((r) => r.arrayBuffer())
      const originalPdf = await PDFDocument.load(pdfBytes)
      const pages = originalPdf.getPages()

      // 2. Group annotations by page
      const annotationsByPage = new Map<number, Annotation[]>()
      for (const ann of options.annotations) {
        const pageAnns = annotationsByPage.get(ann.pageNum) || []
        pageAnns.push(ann)
        annotationsByPage.set(ann.pageNum, pageAnns)
      }

      // 3. For each page with annotations
      for (const [pageNum, pageAnnotations] of annotationsByPage) {
        const pageIndex = pageNum - 1 // Convert to 0-indexed
        if (pageIndex < 0 || pageIndex >= pages.length) continue

        const page = pages[pageIndex]
        if (!page) continue

        const { width, height } = page.getSize()

        // Render annotations to SVG using Vue SSR
        const svgElement = await renderAnnotationsToSvg(pageAnnotations, width, height)

        // Create jsPDF for this page's annotations
        const annotationPdf = new jsPDF({
          orientation: width > height ? "landscape" : "portrait",
          unit: "pt",
          format: [width, height]
        })

        // Convert SVG to PDF vector commands
        await svg2pdf(svgElement, annotationPdf, { x: 0, y: 0, width, height })

        // Get the annotation PDF as bytes and embed into original
        const annotationBytes = annotationPdf.output("arraybuffer")
        const annotationPdfDoc = await PDFDocument.load(annotationBytes)
        const embeddedPages = await originalPdf.embedPages(annotationPdfDoc.getPages())
        const embeddedPage = embeddedPages[0]
        if (!embeddedPage) continue

        // Overlay on original page
        page.drawPage(embeddedPage, { x: 0, y: 0, width, height })
      }

      // 4. Save and download
      const modifiedPdfBytes = await originalPdf.save()
      downloadBlob(modifiedPdfBytes, options.filename || "annotated.pdf")

      toast.success("PDF exported successfully")
    } catch (error) {
      console.error("Export failed:", error)
      toast.error("Failed to export PDF")
      throw error
    } finally {
      isExporting.value = false
    }
  }

  /**
   * Export PDF from the editor (uses annotation store for annotations)
   * @param pdfUrl - URL to the original PDF file
   * @param filename - Optional filename for the download
   */
  async function exportFromEditor(pdfUrl: string, filename?: string): Promise<void> {
    const annotationStore = useAnnotationStore()

    if (!pdfUrl) {
      toast.error("No PDF loaded")
      return
    }

    console.log(`[Export] Starting export: ${annotationStore.annotations.length} annotations`)

    await exportWithAnnotations({
      pdfUrl,
      annotations: annotationStore.annotations,
      filename
    })
  }

  return {
    exportWithAnnotations,
    exportFromEditor,
    isExporting
  }
}

/**
 * Helper to download a Uint8Array as a file
 */
function downloadBlob(bytes: Uint8Array, filename: string): void {
  // Create blob from Uint8Array (cast to satisfy TS - pdf-lib returns Uint8Array<ArrayBufferLike>)
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
