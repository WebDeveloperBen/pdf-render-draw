import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { setActivePinia, createPinia } from "pinia"
import GroupTransform from "./GroupTransform.vue"
import { useAnnotationStore } from "~/stores/annotations"

// Mock debug utils
vi.mock("~/utils/debug", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn()
}))

describe("GroupTransform Component", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe("Component Rendering", () => {
    it("should render when multiple annotations are selected", () => {
      const store = useAnnotationStore()

      // Add multiple annotations
      store.addAnnotation({
        id: "test-1",
        type: "measure",
        pageNum: 1,
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        distance: 141.42,
        midpoint: { x: 150, y: 150 },
        labelRotation: 0,
        rotation: 0
      })

      store.addAnnotation({
        id: "test-2",
        type: "measure",
        pageNum: 1,
        points: [{ x: 300, y: 300 }, { x: 400, y: 400 }],
        distance: 141.42,
        midpoint: { x: 350, y: 350 },
        labelRotation: 0,
        rotation: 0
      })

      // Select both annotations
      store.selectAnnotations(["test-1", "test-2"])

      const wrapper = mount(GroupTransform, {
        props: {
          annotation: store.getAnnotationById("test-1")!
        }
      })

      expect(wrapper.exists()).toBe(true)
      // Component should render without crashing
    })

    it("should handle empty selection gracefully", () => {
      const wrapper = mount(GroupTransform, {
        props: {
          annotation: {
            id: "test-1",
            type: "measure",
            pageNum: 1,
            points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
            distance: 141.42,
            midpoint: { x: 150, y: 150 },
            labelRotation: 0,
            rotation: 0
          }
        }
      })

      expect(wrapper.exists()).toBe(true)
      // Component should render without crashing even with no selection
    })
  })

  describe("Error Handling", () => {
    it("should handle invalid annotation gracefully", () => {
      const wrapper = mount(GroupTransform, {
        props: {
          annotation: null as any
        }
      })

      expect(wrapper.exists()).toBe(true)
      // Component should not crash with invalid props
    })
  })
})