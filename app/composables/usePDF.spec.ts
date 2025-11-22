import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { ref, nextTick } from "vue"
import { usePDF } from "./usePDF"
import type { OnProgressParameters } from "pdfjs-dist/types/src/display/api"

// Mock pdfjs-dist module
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerPort: null },
  getDocument: vi.fn()
}))

// Mock the worker URL import
vi.mock("pdfjs-dist/build/pdf.worker.min?url", () => ({
  default: "/mock-worker.js"
}))

// Mock debug utilities
vi.mock("~/utils/debug", () => ({
  debugError: vi.fn()
}))

// Mock Worker class
class MockWorker {
  constructor(
    public url: string,
    public options?: any
  ) {}
  postMessage() {}
  terminate() {}
}

global.Worker = MockWorker as any

// Helper to setup composable in component context
function withSetup<T>(composable: () => T): T {
  let result: T
  const app = {
    setup() {
      result = composable()
      return () => {}
    }
  }

  // Minimal mock of component setup
  const setupFn = app.setup()

  return result!
}

describe("usePDF Composable", () => {
  let mockGetDocument: ReturnType<typeof vi.fn>
  let mockLoadingTask: any
  let mockPDFDocument: any
  let PDFJS: any

  beforeEach(async () => {
    // Get mock of getDocument
    PDFJS = await import("pdfjs-dist")
    mockGetDocument = PDFJS.getDocument as ReturnType<typeof vi.fn>

    // Note: We do NOT reset GlobalWorkerOptions.workerPort here
    // because worker configuration is meant to persist across calls
    // Individual tests can reset it if needed

    // Create mock PDF document
    mockPDFDocument = {
      numPages: 10,
      loadingTask: null as any
    }

    // Create mock loading task
    mockLoadingTask = {
      promise: Promise.resolve(mockPDFDocument),
      onProgress: null
    }

    // Link document back to loading task
    mockPDFDocument.loadingTask = mockLoadingTask

    // Setup getDocument to return the loading task
    mockGetDocument.mockReturnValue(mockLoadingTask)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("Worker Configuration", () => {
    it("should configure worker with valid worker URL", async () => {
      // This test should run first to ensure worker gets configured
      // Ensure window exists for browser environment
      if (typeof global.window === "undefined") {
        global.window = {} as any
      }

      // Call usePDF which should configure worker
      withSetup(() => usePDF("/test.pdf"))

      // Worker should be configured with MockWorker
      expect(PDFJS.GlobalWorkerOptions.workerPort).toBeTruthy()
      expect(PDFJS.GlobalWorkerOptions.workerPort).toBeInstanceOf(MockWorker)
    })

    it("should configure worker once globally", async () => {
      // Worker should already be configured from previous test
      const firstWorker = PDFJS.GlobalWorkerOptions.workerPort
      expect(firstWorker).toBeTruthy()

      // Second call should use same worker
      withSetup(() => usePDF("/test2.pdf"))
      expect(PDFJS.GlobalWorkerOptions.workerPort).toBe(firstWorker)
    })

    it("should not re-configure worker on subsequent calls", async () => {
      const workerSpy = vi.spyOn(global, "Worker" as any)

      // Get initial call count (worker already configured)
      const initialCallCount = workerSpy.mock.calls.length
      withSetup(() => usePDF("/test1.pdf"))

      const callsAfterFirst = workerSpy.mock.calls.length

      // Second call should not create new worker
      withSetup(() => usePDF("/test2.pdf"))
      expect(workerSpy.mock.calls.length).toBe(callsAfterFirst)

      workerSpy.mockRestore()
    })

    it("should only configure worker in browser environment", async () => {
      // Mock SSR environment
      const originalWindow = global.window
      // @ts-expect-error - Testing SSR
      delete global.window

      // Get current worker state (should be configured from previous tests)
      const workerBeforeCall = PDFJS.GlobalWorkerOptions.workerPort

      withSetup(() => usePDF("/test.pdf"))

      // Worker state should not change in SSR
      expect(PDFJS.GlobalWorkerOptions.workerPort).toBe(workerBeforeCall)

      // Restore window
      global.window = originalWindow
    })
  })

  describe("PDF Loading - Success Cases", () => {
    it("should load PDF from URL string", async () => {
      const { pdf, totalPages } = withSetup(() => usePDF("/test.pdf"))

      expect(mockGetDocument).toHaveBeenCalledWith("/test.pdf")

      await nextTick()
      await mockLoadingTask.promise

      expect(pdf.value).toEqual(mockLoadingTask)
      expect(totalPages.value).toBe(10)
    })

    it("should load PDF from Uint8Array", async () => {
      const uint8Array = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // %PDF header
      const { pdf, totalPages } = withSetup(() => usePDF(uint8Array))

      expect(mockGetDocument).toHaveBeenCalledWith(uint8Array)

      await nextTick()
      await mockLoadingTask.promise

      expect(pdf.value).toEqual(mockLoadingTask)
      expect(totalPages.value).toBe(10)
    })

    it("should load PDF and get correct totalPages", async () => {
      // Create document with different page count
      const customDoc = { numPages: 25, loadingTask: mockLoadingTask }
      const customTask = { promise: Promise.resolve(customDoc), onProgress: null }
      customDoc.loadingTask = customTask
      mockGetDocument.mockReturnValue(customTask)

      const { totalPages } = withSetup(() => usePDF("/multi-page.pdf"))

      await nextTick()
      await customTask.promise

      expect(totalPages.value).toBe(25)
    })

    it("should load PDF and get DocumentProxy", async () => {
      const { pdf } = withSetup(() => usePDF("/test.pdf"))

      await nextTick()
      await mockLoadingTask.promise

      expect(pdf.value).toBeTruthy()
      expect(pdf.value).toEqual(mockLoadingTask)
    })

    it("should call onProgress callback during load", async () => {
      const onProgress = vi.fn()
      const progressData: OnProgressParameters = { loaded: 5000, total: 10000 }

      withSetup(() => usePDF("/test.pdf", { onProgress }))

      // Simulate progress callback
      expect(mockLoadingTask.onProgress).toBe(onProgress)
      mockLoadingTask.onProgress(progressData)

      expect(onProgress).toHaveBeenCalledWith(progressData)
    })
  })

  describe("PDF Loading - Reactive Source", () => {
    it("should load PDF from reactive ref", async () => {
      const pdfUrl = ref("/test1.pdf")
      const { pdf, totalPages } = withSetup(() => usePDF(pdfUrl))

      expect(mockGetDocument).toHaveBeenCalledWith("/test1.pdf")

      await nextTick()
      await mockLoadingTask.promise

      expect(pdf.value).toEqual(mockLoadingTask)
      expect(totalPages.value).toBe(10)
    })

    it("should change ref value triggers new PDF load", async () => {
      const pdfUrl = ref("/test1.pdf")
      const { pdf, totalPages } = withSetup(() => usePDF(pdfUrl))

      await nextTick()
      await mockLoadingTask.promise

      // Create new loading task for second PDF
      const newDoc = { numPages: 15, loadingTask: null as any }
      const newTask = { promise: Promise.resolve(newDoc), onProgress: null }
      newDoc.loadingTask = newTask
      mockGetDocument.mockReturnValue(newTask)

      // Change URL
      pdfUrl.value = "/test2.pdf"

      await nextTick()

      expect(mockGetDocument).toHaveBeenCalledWith("/test2.pdf")
      expect(mockGetDocument).toHaveBeenCalledTimes(2)

      await newTask.promise

      expect(totalPages.value).toBe(15)
    })

    it("should watch fire immediately on setup", async () => {
      const pdfUrl = ref("/test.pdf")

      withSetup(() => usePDF(pdfUrl))

      // Should be called immediately with watch({ immediate: true })
      expect(mockGetDocument).toHaveBeenCalledWith("/test.pdf")
      expect(mockGetDocument).toHaveBeenCalledTimes(1)
    })

    it("should cleanup previous PDF when source changes", async () => {
      const pdfUrl = ref("/test1.pdf")
      const { pdf } = withSetup(() => usePDF(pdfUrl))

      await nextTick()
      await mockLoadingTask.promise

      const firstPDF = pdf.value

      // Create new loading task
      const newDoc = { numPages: 20, loadingTask: null as any }
      const newTask = { promise: Promise.resolve(newDoc), onProgress: null }
      newDoc.loadingTask = newTask
      mockGetDocument.mockReturnValue(newTask)

      // Change URL
      pdfUrl.value = "/test2.pdf"
      await nextTick()
      await newTask.promise

      // PDF should be updated to new document
      expect(pdf.value).toEqual(newTask)
      expect(pdf.value).not.toBe(firstPDF)
    })
  })

  describe("Progress Tracking", () => {
    it("should call onProgress callback with progress updates", async () => {
      const onProgress = vi.fn()

      withSetup(() => usePDF("/test.pdf", { onProgress }))

      const progressData: OnProgressParameters = { loaded: 3000, total: 10000 }
      mockLoadingTask.onProgress(progressData)

      expect(onProgress).toHaveBeenCalledWith(progressData)
      expect(onProgress).toHaveBeenCalledTimes(1)
    })

    it("should receive progress with loaded and total bytes", async () => {
      const onProgress = vi.fn()

      withSetup(() => usePDF("/test.pdf", { onProgress }))

      const progressData: OnProgressParameters = { loaded: 5000, total: 10000 }
      mockLoadingTask.onProgress(progressData)

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          loaded: 5000,
          total: 10000
        })
      )
    })

    it("should calculate progress percentage correctly", async () => {
      const onProgress = vi.fn()

      withSetup(() => usePDF("/test.pdf", { onProgress }))

      const progressData: OnProgressParameters = { loaded: 7500, total: 10000 }
      mockLoadingTask.onProgress(progressData)

      const { loaded, total } = onProgress.mock.calls[0]![0]!
      const percentage = (loaded / total) * 100

      expect(percentage).toBe(75)
    })
  })

  describe("Error Handling", () => {
    it("should invoke onError callback on load failure", async () => {
      const onError = vi.fn()
      const error = new Error("Failed to load PDF")

      // Create failing loading task
      const failingTask = {
        promise: Promise.reject(error),
        onProgress: null
      }
      mockGetDocument.mockReturnValue(failingTask)

      withSetup(() => usePDF("/bad.pdf", { onError }))

      await nextTick()

      try {
        await failingTask.promise
      } catch (e) {
        // Expected to fail
      }

      // Wait for error handler
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(onError).toHaveBeenCalledWith(error)
    })

    it("should log error to console via debugError", async () => {
      const { debugError } = await import("~/utils/debug")
      const error = new Error("PDF parse error")

      const failingTask = {
        promise: Promise.reject(error),
        onProgress: null
      }
      mockGetDocument.mockReturnValue(failingTask)

      withSetup(() => usePDF("/bad.pdf"))

      await nextTick()

      try {
        await failingTask.promise
      } catch (e) {
        // Expected
      }

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(debugError).toHaveBeenCalledWith("usePDF", "PDF loading error:", error)
    })

    it("should keep pdf ref null on error", async () => {
      const error = new Error("Load failed")

      const failingTask = {
        promise: Promise.reject(error),
        onProgress: null
      }
      mockGetDocument.mockReturnValue(failingTask)

      const { pdf } = withSetup(() => usePDF("/bad.pdf"))

      await nextTick()

      try {
        await failingTask.promise
      } catch (e) {
        // Expected
      }

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(pdf.value).toBeNull()
    })

    it("should keep totalPages at 0 on error", async () => {
      const error = new Error("Load failed")

      const failingTask = {
        promise: Promise.reject(error),
        onProgress: null
      }
      mockGetDocument.mockReturnValue(failingTask)

      const { totalPages } = withSetup(() => usePDF("/bad.pdf"))

      await nextTick()

      try {
        await failingTask.promise
      } catch (e) {
        // Expected
      }

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(totalPages.value).toBe(0)
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty source (falsy value)", () => {
      const { pdf, totalPages } = withSetup(() => usePDF(null))

      expect(mockGetDocument).not.toHaveBeenCalled()
      expect(pdf.value).toBeNull()
      expect(totalPages.value).toBe(0)
    })

    it("should handle undefined source", () => {
      const { pdf, totalPages } = withSetup(() => usePDF(undefined))

      expect(mockGetDocument).not.toHaveBeenCalled()
      expect(pdf.value).toBeNull()
      expect(totalPages.value).toBe(0)
    })

    it("should load PDF with no callbacks (both undefined)", async () => {
      const { pdf, totalPages } = withSetup(() => usePDF("/test.pdf"))

      expect(mockGetDocument).toHaveBeenCalledWith("/test.pdf")

      await nextTick()
      await mockLoadingTask.promise

      expect(pdf.value).toEqual(mockLoadingTask)
      expect(totalPages.value).toBe(10)
    })

    it("should load multiple PDFs sequentially", async () => {
      // First PDF
      const { pdf: pdf1, totalPages: pages1 } = withSetup(() => usePDF("/test1.pdf"))

      await nextTick()
      await mockLoadingTask.promise

      expect(pdf1.value).toEqual(mockLoadingTask)
      expect(pages1.value).toBe(10)

      // Second PDF
      const newDoc = { numPages: 20, loadingTask: null as any }
      const newTask = { promise: Promise.resolve(newDoc), onProgress: null }
      newDoc.loadingTask = newTask
      mockGetDocument.mockReturnValue(newTask)

      const { pdf: pdf2, totalPages: pages2 } = withSetup(() => usePDF("/test2.pdf"))

      await nextTick()
      await newTask.promise

      expect(pdf2.value).toEqual(newTask)
      expect(pages2.value).toBe(20)
      expect(mockGetDocument).toHaveBeenCalledTimes(2)
    })

    it("should handle reactive ref with falsy initial value", async () => {
      const pdfUrl = ref<string | null>(null)
      const { pdf, totalPages } = withSetup(() => usePDF(pdfUrl))

      // Should not load initially
      expect(mockGetDocument).not.toHaveBeenCalled()
      expect(pdf.value).toBeNull()
      expect(totalPages.value).toBe(0)

      // Set valid URL
      pdfUrl.value = "/test.pdf"
      await nextTick()

      expect(mockGetDocument).toHaveBeenCalledWith("/test.pdf")
    })

    it("should handle reactive ref changing to falsy value", async () => {
      const pdfUrl = ref<string | null>("/test.pdf")
      const { pdf } = withSetup(() => usePDF(pdfUrl))

      await nextTick()
      await mockLoadingTask.promise

      expect(pdf.value).toEqual(mockLoadingTask)

      // Change to null
      pdfUrl.value = null
      await nextTick()

      // Should not call getDocument with null
      expect(mockGetDocument).toHaveBeenCalledTimes(1) // Only initial call
    })
  })

  describe("Integration with PDF.js", () => {
    it("should call getDocument with correct source", async () => {
      const source = "/my-document.pdf"
      withSetup(() => usePDF(source))

      expect(mockGetDocument).toHaveBeenCalledWith(source)
      expect(mockGetDocument).toHaveBeenCalledTimes(1)
    })

    it("should await loading task promise", async () => {
      const { pdf } = withSetup(() => usePDF("/test.pdf"))

      // Initially null, not yet loaded
      expect(pdf.value).toBeNull()

      await nextTick()
      await mockLoadingTask.promise

      // After promise resolves, pdf should be set
      expect(pdf.value).toEqual(mockLoadingTask)
    })

    it("should map document numPages to totalPages ref", async () => {
      // Create document with specific page count
      const customDoc = { numPages: 42, loadingTask: null as any }
      const customTask = { promise: Promise.resolve(customDoc), onProgress: null }
      customDoc.loadingTask = customTask
      mockGetDocument.mockReturnValue(customTask)

      const { totalPages } = withSetup(() => usePDF("/test.pdf"))

      await nextTick()
      await customTask.promise

      expect(totalPages.value).toBe(42)
    })

    it("should attach onProgress handler to loading task", () => {
      const onProgress = vi.fn()

      withSetup(() => usePDF("/test.pdf", { onProgress }))

      expect(mockLoadingTask.onProgress).toBe(onProgress)
    })

    it("should not attach onProgress if callback not provided", () => {
      withSetup(() => usePDF("/test.pdf"))

      expect(mockLoadingTask.onProgress).toBeNull()
    })

    it("should handle DocumentInitParameters as source", async () => {
      const initParams = {
        url: "/test.pdf",
        withCredentials: true
      }

      const { pdf } = withSetup(() => usePDF(initParams))

      expect(mockGetDocument).toHaveBeenCalledWith(initParams)

      await nextTick()
      await mockLoadingTask.promise

      expect(pdf.value).toEqual(mockLoadingTask)
    })
  })
})
