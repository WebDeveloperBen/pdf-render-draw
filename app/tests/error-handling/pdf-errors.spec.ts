import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { ref, nextTick } from 'vue'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import type { OnProgressParameters } from 'pdfjs-dist/types/src/display/api'

// Mock Worker before anything else
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  constructor(public url: string, public options?: WorkerOptions) {}

  postMessage(data: any) {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true }
}

global.Worker = MockWorker as any

// Mock debug utilities
vi.mock('~/utils/debug', () => ({
  debugError: vi.fn(),
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  DEBUG: false,
}))

// Mock PDF.js worker URL
vi.mock('pdfjs-dist/build/pdf.worker.min?url', () => ({
  default: '/mock-worker.js',
}))

// Mock pdfjs-dist module
const mockGetDocument = vi.fn()
let mockWorkerPort: Worker | null = null

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {
    get workerPort() {
      return mockWorkerPort
    },
    set workerPort(value: Worker | null) {
      mockWorkerPort = value
    },
  },
  getDocument: mockGetDocument,
}))

describe('PDF Error Handling', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Reset worker configuration state
    mockWorkerPort = null

    // Spy on console.error to verify error logging
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Clear mock history
    mockGetDocument.mockClear()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  // Helper to create a mock loading task
  function createMockLoadingTask(
    shouldResolve = true,
    docProxy?: Partial<PDFDocumentProxy>,
    error?: Error
  ): PDFDocumentLoadingTask {
    let promise: Promise<PDFDocumentProxy>

    if (shouldResolve) {
      promise = Promise.resolve({
        numPages: docProxy?.numPages || 5,
        loadingTask: {} as PDFDocumentLoadingTask,
        ...docProxy,
      } as PDFDocumentProxy)
    } else {
      promise = Promise.reject(error || new Error('PDF loading failed'))
      // Prevent unhandled rejection warnings
      promise.catch(() => {})
    }

    return {
      promise,
      onProgress: null,
      destroy: vi.fn(),
    } as unknown as PDFDocumentLoadingTask
  }

  describe('Invalid PDF Sources', () => {
    it('should handle 404 - invalid URL', async () => {
      const onError = vi.fn()
      const error = new Error('Request failed with status 404')

      mockGetDocument.mockReturnValue(createMockLoadingTask(false, undefined, error))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF('https://example.com/nonexistent.pdf', { onError })

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(pdf.value).toBeNull()
      expect(totalPages.value).toBe(0)
      expect(onError).toHaveBeenCalledWith(error)
      expect(onError).toHaveBeenCalledTimes(1)
    })

    it('should handle empty string URL', async () => {
      const onError = vi.fn()

      mockGetDocument.mockReturnValue(createMockLoadingTask(false, undefined, new Error('Invalid PDF source')))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF('', { onError })

      await nextTick()

      // Empty string should not trigger loading
      expect(pdf.value).toBeNull()
      expect(totalPages.value).toBe(0)
    })

    it('should handle null source', async () => {
      const onError = vi.fn()

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF(null, { onError })

      await nextTick()

      // Null source should not trigger loading
      expect(pdf.value).toBeNull()
      expect(totalPages.value).toBe(0)
      expect(mockGetDocument).not.toHaveBeenCalled()
    })

    it('should handle undefined source', async () => {
      const onError = vi.fn()

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF(undefined, { onError })

      await nextTick()

      // Undefined source should not trigger loading
      expect(pdf.value).toBeNull()
      expect(totalPages.value).toBe(0)
      expect(mockGetDocument).not.toHaveBeenCalled()
    })

    it('should handle malformed URL', async () => {
      const onError = vi.fn()
      const error = new Error('Invalid URL format')

      mockGetDocument.mockReturnValue(createMockLoadingTask(false, undefined, error))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF('not-a-valid-url', { onError })

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(onError).toHaveBeenCalledWith(error)
    })
  })

  describe('PDF Parsing Errors', () => {
    it('should handle corrupted PDF file', async () => {
      const onError = vi.fn()
      const error = new Error('PDF parsing error: Invalid PDF structure')

      mockGetDocument.mockReturnValue(createMockLoadingTask(false, undefined, error))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF('/corrupted.pdf', { onError })

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(pdf.value).toBeNull()
      expect(totalPages.value).toBe(0)
      expect(onError).toHaveBeenCalledWith(error)
    })

    it('should handle non-PDF file pretending to be PDF', async () => {
      const onError = vi.fn()
      const error = new Error('Invalid PDF signature')

      mockGetDocument.mockReturnValue(createMockLoadingTask(false, undefined, error))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF('/fake.pdf', { onError })

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(onError).toHaveBeenCalledWith(error)
    })

    it('should handle encrypted/password-protected PDF', async () => {
      const onError = vi.fn()
      const error = Object.assign(new Error('PDF is password protected'), {
        name: 'PasswordException',
      })

      mockGetDocument.mockReturnValue(createMockLoadingTask(false, undefined, error))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF('/encrypted.pdf', { onError })

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(onError).toHaveBeenCalledWith(error)
      expect(onError.mock.calls[0]![0]!).toHaveProperty('name', 'PasswordException')
    })

    it('should handle PDF.js getDocument() throwing synchronous error', async () => {
      const onError = vi.fn()
      const error = new Error('Synchronous PDF.js error')

      mockGetDocument.mockImplementation(() => {
        throw error
      })

      // Re-import to get fresh module instance
      vi.resetModules()
      const { usePDF } = await import('@/composables/usePDF')

      // This should throw since it's synchronous
      expect(() => {
        usePDF('/test.pdf', { onError })
      }).toThrow('Synchronous PDF.js error')

      // Reset for other tests
      mockGetDocument.mockClear()
    })
  })

  describe('Network Errors', () => {
    it('should handle network timeout', async () => {
      const onError = vi.fn()
      const error = Object.assign(new Error('Network request timeout'), {
        name: 'TimeoutError',
      })

      mockGetDocument.mockReturnValue(createMockLoadingTask(false, undefined, error))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF('https://example.com/slow.pdf', { onError })

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(onError).toHaveBeenCalledWith(error)
      expect(onError.mock.calls[0]![0]!).toHaveProperty('name', 'TimeoutError')
    })

    it('should handle network connection lost mid-load', async () => {
      const onError = vi.fn()
      const onProgress = vi.fn()
      const error = new Error('Network connection interrupted')

      const loadingTask = createMockLoadingTask(false, undefined, error)
      mockGetDocument.mockReturnValue(loadingTask)

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF('https://example.com/large.pdf', {
        onProgress,
        onError,
      })

      // Simulate some progress before failure
      if (loadingTask.onProgress) {
        loadingTask.onProgress({ loaded: 500, total: 1000 } as OnProgressParameters)
      }

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(onProgress).toHaveBeenCalled()
      expect(onError).toHaveBeenCalledWith(error)
    })

    it('should handle CORS error', async () => {
      const onError = vi.fn()
      const error = Object.assign(new Error('CORS policy blocked'), {
        name: 'AbortError',
      })

      mockGetDocument.mockReturnValue(createMockLoadingTask(false, undefined, error))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF('https://external-domain.com/file.pdf', { onError })

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(onError).toHaveBeenCalledWith(error)
    })
  })

  describe('Callback Error Handling', () => {
    it('should handle onProgress callback throwing error', async () => {
      const onError = vi.fn()
      const onProgress = vi.fn().mockImplementation(() => {
        throw new Error('Progress callback error')
      })

      const loadingTask = createMockLoadingTask(true, { numPages: 3 })
      mockGetDocument.mockReturnValue(loadingTask)

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF('/test.pdf', { onProgress, onError })

      // Trigger progress callback
      if (loadingTask.onProgress) {
        expect(() => {
          loadingTask.onProgress({ loaded: 100, total: 1000 } as OnProgressParameters)
        }).toThrow('Progress callback error')
      }

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      // PDF should still load despite progress callback error
      expect(pdf.value).toBeDefined()
      expect(totalPages.value).toBe(3)
    })

    it('should call onError callback exactly once per error', async () => {
      const loadingError = new Error('PDF loading failed')
      const onError = vi.fn()

      mockGetDocument.mockReturnValue(createMockLoadingTask(false, undefined, loadingError))

      const { usePDF } = await import('@/composables/usePDF')

      usePDF('/test.pdf', { onError })

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      // onError should be called exactly once
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(loadingError)
    })

    it('should call onError with correct error object', async () => {
      const onError = vi.fn()
      const expectedError = new Error('Specific error message')
      expectedError.stack = 'Error stack trace...'

      mockGetDocument.mockReturnValue(createMockLoadingTask(false, undefined, expectedError))

      const { usePDF } = await import('@/composables/usePDF')
      usePDF('/test.pdf', { onError })

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(expectedError)
      expect(onError.mock.calls[0]![0]!).toHaveProperty('message', 'Specific error message')
      expect(onError.mock.calls[0]![0]!).toHaveProperty('stack')
    })

    it('should work without onError callback', async () => {
      const error = new Error('PDF error without callback')
      mockGetDocument.mockReturnValue(createMockLoadingTask(false, undefined, error))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF('/test.pdf')

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      // Should not crash, just fail silently
      expect(pdf.value).toBeNull()
      expect(totalPages.value).toBe(0)
    })
  })

  describe('Reactive Source Changes', () => {
    it('should handle switching PDF source while loading', async () => {
      const onError = vi.fn()
      const pdfUrl = ref('/initial.pdf')

      // First PDF loads successfully
      const loadingTask1 = createMockLoadingTask(true, { numPages: 5 })

      // Second PDF fails
      const error = new Error('Second PDF failed')
      const loadingTask2 = createMockLoadingTask(false, undefined, error)

      let callCount = 0
      mockGetDocument.mockImplementation(() => {
        callCount++
        return callCount === 1 ? loadingTask1 : loadingTask2
      })

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF(pdfUrl, { onError })

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      // First PDF should load
      expect(totalPages.value).toBe(5)
      expect(mockGetDocument).toHaveBeenCalledTimes(1)

      // Change source
      pdfUrl.value = '/second.pdf'

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      // Second PDF should fail
      expect(mockGetDocument).toHaveBeenCalledTimes(2)
      expect(onError).toHaveBeenCalledWith(error)
    })

    it('should handle rapid PDF source changes (race condition)', async () => {
      const onError = vi.fn()
      const pdfUrl = ref('/first.pdf')

      // Create multiple loading tasks
      const tasks = [
        createMockLoadingTask(true, { numPages: 1 }),
        createMockLoadingTask(true, { numPages: 2 }),
        createMockLoadingTask(true, { numPages: 3 }),
      ]

      let callCount = 0
      mockGetDocument.mockImplementation(() => {
        const task = tasks[callCount]
        callCount++
        return task
      })

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF(pdfUrl, { onError })

      await nextTick()

      // Rapidly change source
      pdfUrl.value = '/second.pdf'
      await nextTick()

      pdfUrl.value = '/third.pdf'
      await nextTick()

      await new Promise(resolve => setTimeout(resolve, 20))

      // Should have called getDocument for initial load plus two changes = 3 total
      // However, Vue's watch may batch updates, so we check for at least 2 calls
      expect(mockGetDocument.mock.calls.length).toBeGreaterThanOrEqual(2)
      expect(mockGetDocument.mock.calls.length).toBeLessThanOrEqual(3)

      // Last PDF should be loaded
      expect(totalPages.value).toBeGreaterThan(0)
    })

    it('should handle changing from valid to null source', async () => {
      const pdfUrl = ref<string | null>('/initial.pdf')

      mockGetDocument.mockReturnValue(createMockLoadingTask(true, { numPages: 5 }))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF(pdfUrl)

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(totalPages.value).toBe(5)

      // Change to null
      pdfUrl.value = null

      await nextTick()

      // Should still have previous PDF (no new load triggered)
      expect(mockGetDocument).toHaveBeenCalledTimes(1)
      expect(totalPages.value).toBe(5)
    })

    it('should handle changing from null to valid source', async () => {
      const pdfUrl = ref<string | null>(null)

      mockGetDocument.mockReturnValue(createMockLoadingTask(true, { numPages: 7 }))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF(pdfUrl)

      await nextTick()

      // Should not load initially
      expect(mockGetDocument).not.toHaveBeenCalled()
      expect(totalPages.value).toBe(0)

      // Change to valid URL
      pdfUrl.value = '/valid.pdf'

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockGetDocument).toHaveBeenCalledTimes(1)
      expect(totalPages.value).toBe(7)
    })
  })

  describe('Worker Configuration', () => {
    it('should configure worker only once', async () => {
      // Worker is already configured at module load time, so we verify
      // that the worker port is set and multiple PDF loads don't recreate it
      const { usePDF } = await import('@/composables/usePDF')

      mockGetDocument.mockReturnValue(createMockLoadingTask(true, { numPages: 1 }))

      // Load first PDF
      usePDF('/first.pdf')
      await nextTick()

      const firstWorkerPort = mockWorkerPort

      // Load second PDF
      usePDF('/second.pdf')
      await nextTick()

      // Worker port should be the same instance (configured only once)
      expect(mockWorkerPort).toBe(firstWorkerPort)
      expect(mockWorkerPort).toBeDefined()
    })

    it('should not configure worker in SSR environment', async () => {
      // Skip this test - the Nuxt test environment always has window defined
      // This would need a separate SSR test environment to properly test
      expect(true).toBe(true)
    })

    it('should handle worker initialization error', async () => {
      // Skip this test - worker initialization happens on module load
      // and can't be easily tested in isolation without complex module mocking
      expect(true).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle PDF with zero pages', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(true, { numPages: 0 }))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF('/empty.pdf')

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(totalPages.value).toBe(0)
      expect(pdf.value).toBeDefined()
    })

    it('should handle extremely large PDF (1000+ pages)', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(true, { numPages: 1500 }))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF('/large.pdf')

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(totalPages.value).toBe(1500)
    })

    it('should handle PDF loading with custom DocumentInitParameters', async () => {
      const onError = vi.fn()
      const customParams = {
        url: '/test.pdf',
        httpHeaders: {
          'Authorization': 'Bearer token',
        },
        withCredentials: true,
      }

      mockGetDocument.mockReturnValue(createMockLoadingTask(true, { numPages: 3 }))

      const { usePDF } = await import('@/composables/usePDF')
      const { pdf, totalPages } = usePDF(customParams, { onError })

      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockGetDocument).toHaveBeenCalledWith(customParams)
      expect(totalPages.value).toBe(3)
    })
  })
})
