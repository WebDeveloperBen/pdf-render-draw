import * as PDFJS from "pdfjs-dist"
import PDFWorker from "pdfjs-dist/build/pdf.worker.min?url"

import type { PDFDocumentLoadingTask } from "pdfjs-dist"
import type { UsePDFOptions, UsePDFSrc } from "../types/pdf"
import { debugError } from "~/utils/debug"

// Configuration for PDF.js worker
let isWorkerConfigured = false

/**
 * Configure PDF.js Web Worker for background PDF parsing
 *
 * Sets up the PDF.js worker once globally to offload CPU-intensive
 * PDF parsing to a separate thread. Only configures on first call
 * and only in browser environment.
 *
 * @param workerSrc - URL or path to the PDF.js worker script
 * @internal
 */
function configWorker(workerSrc: string) {
  if (!isWorkerConfigured && typeof window !== 'undefined') {
    PDFJS.GlobalWorkerOptions.workerPort = new Worker(workerSrc, { type: "module" })
    isWorkerConfigured = true
  }
}

/**
 * Composable for loading and managing PDF documents
 *
 * Wraps PDF.js functionality in a reactive Vue composable. Automatically
 * configures the Web Worker for background parsing and provides reactive
 * refs for the PDF document and metadata.
 *
 * Supports both static and reactive PDF sources - if a ref is passed,
 * the PDF will automatically reload when the ref changes.
 *
 * @param src - PDF source as URL string, TypedArray, or reactive ref
 * @param options - Optional callbacks for progress and error handling
 * @param options.onProgress - Called with loading progress updates
 * @param options.onError - Called if PDF loading fails
 * @returns Object containing reactive refs for pdf and totalPages
 *
 * @example
 * // Static PDF URL
 * const { pdf, totalPages } = usePDF('/document.pdf')
 *
 * @example
 * // Reactive PDF URL
 * const pdfUrl = ref('/document.pdf')
 * const { pdf, totalPages } = usePDF(pdfUrl, {
 *   onProgress: (progress) => console.log(`${progress.loaded}/${progress.total}`),
 *   onError: (error) => console.error('Failed to load PDF:', error)
 * })
 */
export function usePDF(
  src: UsePDFSrc | Ref<UsePDFSrc>,
  options: UsePDFOptions = {
    onProgress: undefined,
    onError: undefined,
  }
) {
  configWorker(PDFWorker)

  const pdf: Ref<PDFDocumentLoadingTask | null> = ref(null)
  const totalPages: Ref<number> = ref(0)

  /**
   * Process a PDF loading task with progress and error handling
   * @param source - PDF source to load
   * @internal
   */
  function processLoadingTask(source: UsePDFSrc) {
    if (!source) return
    const loadingTask = PDFJS.getDocument(source)
    if (options.onProgress) {
      loadingTask.onProgress = options.onProgress
    }

    loadingTask.promise.then(
      (doc) => {
        pdf.value = doc.loadingTask
        totalPages.value = doc.numPages
      },
      (error) => {
        if (typeof options.onError === "function") {
          options.onError(error)
        }
        debugError("usePDF", "PDF loading error:", error)
      }
    )
  }

  if (isRef(src)) {
    // Watch for changes to the source ref
    watch(src, (newSrc) => {
      processLoadingTask(newSrc)
    }, { immediate: true })
  } else {
    processLoadingTask(src)
  }

  return {
    pdf,
    totalPages,
  }
}
