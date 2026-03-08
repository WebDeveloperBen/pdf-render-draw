import { PDFDocument } from "pdf-lib"
import { toast } from "vue-sonner"
import type { Annotation } from "#shared/types/annotations.types"

interface ExportOptions {
  pdfUrl: string
  annotations: Annotation[]
  filename?: string
}

/**
 * Composable for exporting PDFs with annotations embedded as vectors.
 *
 * Pipeline: Vue SSR → SVG string → svg2pdf → jsPDF → embed into original PDF
 */
export function useExportPdf() {
  const isExporting = ref(false)

  async function renderAnnotationsToSvg(
    annotations: Annotation[],
    width: number,
    height: number
  ): Promise<SVGSVGElement> {
    const { createSSRApp } = await import("vue")
    const { renderToString } = await import("vue/server-renderer")
    const { createPinia } = await import("pinia")
    const AnnotationRenderer = (await import("~/components/Editor/AnnotationRenderer.vue")).default

    const app = createSSRApp(AnnotationRenderer, { annotations, width, height })
    app.use(createPinia())

    const raw = await renderToString(app)
    const svg = parseSvg(cleanSvgString(raw))

    console.log(`[Export] ${annotations.length} annotations → SVG (${raw.length} chars)`)
    return svg
  }

  async function exportWithAnnotations(options: ExportOptions): Promise<void> {
    if (isExporting.value) return
    isExporting.value = true

    try {
      const { jsPDF } = await import("jspdf")
      const { svg2pdf } = await import("svg2pdf.js")

      const pdfBytes = await fetch(options.pdfUrl).then((r) => r.arrayBuffer())
      const originalPdf = await PDFDocument.load(pdfBytes)
      const pages = originalPdf.getPages()

      const annotationsByPage = groupBy(options.annotations, (a) => a.pageNum)

      for (const [pageNum, pageAnnotations] of annotationsByPage) {
        const page = pages[pageNum - 1]
        if (!page) continue

        // pdf-lib getSize() returns raw media box (ignores /Rotate).
        // Annotations live in PDF.js viewport space which applies /Rotate.
        const { width: mediaW, height: mediaH } = page.getSize()
        const rot = page.getRotation().angle
        const swapped = rot === 90 || rot === 270
        const viewW = swapped ? mediaH : mediaW
        const viewH = swapped ? mediaW : mediaH

        const svgElement = await renderAnnotationsToSvg(pageAnnotations, viewW, viewH)

        // If page has /Rotate, counter-rotate annotations back to media box space
        if (rot !== 0) {
          applyRotationTransform(svgElement, rot, viewW, viewH, mediaW, mediaH)
        }

        const annotationPdf = new jsPDF({
          orientation: mediaW > mediaH ? "landscape" : "portrait",
          unit: "pt",
          format: [mediaW, mediaH]
        })

        await svg2pdf(svgElement, annotationPdf, { x: 0, y: 0, width: mediaW, height: mediaH })

        const annotationPdfDoc = await PDFDocument.load(annotationPdf.output("arraybuffer"))
        const [embeddedPage] = await originalPdf.embedPages(annotationPdfDoc.getPages())
        if (embeddedPage) page.drawPage(embeddedPage, { x: 0, y: 0 })
      }

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

  async function exportFromEditor(pdfUrl: string, filename?: string): Promise<void> {
    const annotationStore = useAnnotationStore()
    if (!pdfUrl) {
      toast.error("No PDF loaded")
      return
    }
    console.log(`[Export] Starting export: ${annotationStore.annotations.length} annotations`)
    await exportWithAnnotations({ pdfUrl, annotations: annotationStore.annotations, filename })
  }

  return { exportWithAnnotations, exportFromEditor, isExporting }
}

// ── Helpers ──

/** Strip Vue SSR artifacts that break XML parsing */
function cleanSvgString(s: string): string {
  return s
    .replace(/\s+data-v-[a-f0-9]+/g, "")  // scoped style attrs
    .replace(/\s+transform=""/g, "")        // empty transforms
    .replace(/\s+transform(?=[\s>])/g, "")  // bare transform attrs
    .replace(/\s+class=""/g, "")            // empty classes
    .replace(/<!--\[-->/g, "")              // Vue SSR comments
    .replace(/<!--\]-->/g, "")
}

/** Parse an SVG string into a DOM element */
function parseSvg(svgString: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml")
  const error = doc.querySelector("parsererror")
  if (error) throw new Error(`SVG parsing failed: ${error.textContent}`)
  return doc.documentElement as unknown as SVGSVGElement
}

/**
 * Wrap SVG content in a <g> that counter-rotates from viewport space
 * back to media box space, matching the PDF's /Rotate property.
 */
function applyRotationTransform(
  svg: SVGSVGElement,
  rotation: number,
  viewW: number, viewH: number,
  mediaW: number, mediaH: number
): void {
  const g = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g")
  while (svg.firstChild) g.appendChild(svg.firstChild)

  const transforms: Record<number, string> = {
    90: `rotate(-90) translate(${-viewW}, 0)`,
    180: `rotate(-180) translate(${-viewW}, ${-viewH})`,
    270: `rotate(-270) translate(0, ${-viewH})`
  }

  g.setAttribute("transform", transforms[rotation] || "")
  svg.appendChild(g)
  svg.setAttribute("viewBox", `0 0 ${mediaW} ${mediaH}`)
  svg.setAttribute("width", String(mediaW))
  svg.setAttribute("height", String(mediaH))
}

/** Group items by key */
function groupBy<T>(items: T[], keyFn: (item: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const list = map.get(key) || []
    list.push(item)
    map.set(key, list)
  }
  return map
}

