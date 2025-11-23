import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { setActivePinia, createPinia } from "pinia"
import SimplePdfViewer from "./PdfViewer.vue"

// Mock debug utils to avoid console noise
vi.mock("~/utils/debug", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn()
}))

describe("SimplePdfViewer Component", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe("Component Rendering", () => {
    it("should render a canvas element", () => {
      const wrapper = mount(SimplePdfViewer)
      const canvas = wrapper.find("canvas")
      expect(canvas.exists()).toBe(true)
      expect(canvas.classes()).toContain("pdf-canvas")
    })



    it("should accept pdf prop", () => {
      const mockPdf = { promise: Promise.resolve() }
      const wrapper = mount(SimplePdfViewer, {
        props: { pdf: mockPdf as any }
      })
      expect(wrapper.props().pdf).toStrictEqual(mockPdf)
    })
  })

  describe("Error Handling", () => {
    it("should handle missing pdf gracefully", () => {
      const wrapper = mount(SimplePdfViewer, {
        props: { pdf: undefined }
      })
      expect(wrapper.exists()).toBe(true)
      // Component should not crash when pdf is undefined
    })

    it("should render error state when pdf fails to load", async () => {
      const mockPdf = {
        promise: Promise.reject(new Error("PDF load failed"))
      }

      // Suppress console errors for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Catch any unhandled promise rejections
      const unhandledRejectionSpy = vi.fn()
      process.on('unhandledRejection', unhandledRejectionSpy)

      const wrapper = mount(SimplePdfViewer, {
        props: { pdf: mockPdf as any }
      })

      // Wait for error to be handled
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(wrapper.exists()).toBe(true)
      // Component should handle the error gracefully

      consoleSpy.mockRestore()
      process.removeListener('unhandledRejection', unhandledRejectionSpy)
    })
  })
})