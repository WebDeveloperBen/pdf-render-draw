import { describe, expect, it } from "vitest"
import { mountSuspended } from "@nuxt/test-utils/runtime"
import SingleFileUploader from "./SingleFileUploader.vue"

describe("SingleFileUploader", () => {
  it("shows the seeded file and allows it to be removed", async () => {
    const wrapper = await mountSuspended(SingleFileUploader, {
      global: {
        stubs: {
          LayoutGroup: { template: "<div><slot /></div>" },
          Motion: { template: "<div><slot /></div>" },
          AnimatePresence: { template: "<div><slot /></div>" },
          UiButton: {
            template: "<button :aria-label=\"$attrs['aria-label']\" @click=\"$emit('click')\"><slot /></button>"
          }
        }
      }
    })

    expect(wrapper.text()).toContain("Behon Baker - Software Developer.png")

    await wrapper.get("button[aria-label='Remove file']").trigger("click")

    expect(wrapper.text()).not.toContain("Behon Baker - Software Developer.png")
    expect(wrapper.text()).toContain("Upload file")
  })
})
