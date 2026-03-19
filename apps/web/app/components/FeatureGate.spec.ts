import { beforeEach, describe, expect, it, vi } from "vitest"
import { mountSuspended, mockNuxtImport } from "@nuxt/test-utils/runtime"
import { ref } from "vue"
import FeatureGate from "./FeatureGate.vue"

const mockState = vi.hoisted(() => ({
  planName: "free",
  canUseFeature: vi.fn((_: unknown) => false)
}))

mockNuxtImport("useSubscription", () => {
  return () => ({
    planName: ref(mockState.planName),
    canUseFeature: (feature: unknown) => mockState.canUseFeature(feature)
  })
})

describe("FeatureGate", () => {
  beforeEach(() => {
    mockState.planName = "free"
    mockState.canUseFeature.mockReset()
    mockState.canUseFeature.mockReturnValue(false)
  })

  it("renders the slot when the user has access to the feature", async () => {
    mockState.canUseFeature.mockReturnValue(true)

    const wrapper = await mountSuspended(FeatureGate, {
      props: {
        feature: "cloudSync",
        label: "Cloud Sync"
      },
      slots: {
        default: "<div data-test='allowed'>Allowed</div>"
      },
      global: {
        stubs: {
          UpgradePrompt: { template: "<div data-test='upgrade-prompt'>Upgrade</div>" }
        }
      }
    })

    expect(wrapper.find("[data-test='allowed']").exists()).toBe(true)
    expect(wrapper.find("[data-test='upgrade-prompt']").exists()).toBe(false)
  })

  it("shows the upgrade prompt when the minimum plan is not met", async () => {
    const wrapper = await mountSuspended(FeatureGate, {
      props: {
        minimumPlan: "professional",
        label: "Advanced Export"
      },
      slots: {
        default: "<div data-test='allowed'>Allowed</div>"
      },
      global: {
        stubs: {
          UpgradePrompt: { template: "<div data-test='upgrade-prompt'>Upgrade</div>" }
        }
      }
    })

    expect(wrapper.find("[data-test='allowed']").exists()).toBe(false)
    expect(wrapper.find("[data-test='upgrade-prompt']").exists()).toBe(true)
  })
})
