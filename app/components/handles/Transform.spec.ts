import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { setActivePinia, createPinia } from "pinia"
import Transform from "./Transform.vue"
import { useAnnotationStore } from "~/stores/annotations"

// Mock debug utils
vi.mock("~/utils/debug", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn()
}))

describe("Transform Component", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe("Component Rendering", () => {
    it("should render when annotation is selected", () => {
      const store = useAnnotationStore()

      const annotation = {
        id: "test-1",
        type: "measure",
        pageNum: 1,
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: 0
      }

      store.addAnnotation(annotation)
      store.selectAnnotation("test-1")

      const wrapper = mount(Transform, {
        props: {
          annotation: annotation
        }
      })

      expect(wrapper.exists()).toBe(true)
      // Component should render transform handles
    })

    it("should handle unselected annotation gracefully", () => {
      const annotation = {
        id: "test-1",
        type: "measure",
        pageNum: 1,
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: 0
      }

      const wrapper = mount(Transform, {
        props: {
          annotation: annotation
        }
      })

      expect(wrapper.exists()).toBe(true)
      // Component should render without crashing
    })
  })

  describe("Error Handling", () => {
    it("should handle invalid annotation gracefully", () => {
      const wrapper = mount(Transform, {
        props: {
          annotation: null as any
        }
      })

      expect(wrapper.exists()).toBe(true)
      // Component should not crash with invalid props
    })
  })
})