import * as PDFJS from "pdfjs-dist"
import PDFWorker from "pdfjs-dist/build/pdf.worker.min?url"

import type { PDFDocumentLoadingTask } from "pdfjs-dist"
import type { UsePDFOptions, UsePDFSrc } from "../types/pdf"

// Configuration for PDF.js worker
let isWorkerConfigured = false

function configWorker(workerSrc: string) {
  if (!isWorkerConfigured && typeof window !== 'undefined') {
    PDFJS.GlobalWorkerOptions.workerPort = new Worker(workerSrc, { type: "module" })
    // PDFJS.GlobalWorkerOptions.workerSrc = workerSrc
    isWorkerConfigured = true
  }
}

/**
 * Main function to use PDF.
 * @param {UsePDFSrc | Ref<UsePDFSrc>} src - The source of the PDF.
 * @param {UsePDFOptions} options - The options for the PDF.
 * @returns An object containing refs to the PDF, total pages, and page images.
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
        console.error(error)
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
