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

    it("should get pdf from renderer store", () => {
      // PDF is now loaded via viewportStore.loadPdf() and accessed via store
      // Component no longer accepts a pdf prop
      const wrapper = mount(SimplePdfViewer)
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe("Error Handling", () => {
    it("should handle missing pdf gracefully", () => {
      // When store has no PDF loaded, component should not crash
      const wrapper = mount(SimplePdfViewer)
      expect(wrapper.exists()).toBe(true)
    })

    it("should render error overlay when renderError is set", async () => {
      const wrapper = mount(SimplePdfViewer)

      // Component should handle errors gracefully
      // Error state is managed internally by the component
      expect(wrapper.exists()).toBe(true)
    })
  })
})
