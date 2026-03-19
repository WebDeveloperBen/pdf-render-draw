import { beforeEach, describe, expect, it, vi } from "vitest"
import { mountSuspended, mockNuxtImport } from "@nuxt/test-utils/runtime"
import { ref } from "vue"
import OnboardingPlanPage from "./plan.vue"

const mockState = vi.hoisted(() => ({
  wizardData: {} as Record<string, unknown>,
  checkout: vi.fn(),
  fetch: vi.fn(),
  navigateTo: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}))

mockNuxtImport("useState", () => () => ref(mockState.wizardData))
mockNuxtImport("useCheckout", () => {
  return () => ({
    checkout: (...args: unknown[]) => mockState.checkout(...args),
    isLoading: ref(false)
  })
})
mockNuxtImport("navigateTo", () => (...args: unknown[]) => mockState.navigateTo(...args))

vi.mock("~/utils/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => (args.length > 0 ? { data: ref(null) } : ref(null))
  }
}))

vi.mock("vue-sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-sonner")>()
  return {
    ...actual,
    toast: {
      ...actual.toast,
      success: (...args: unknown[]) => mockState.toastSuccess(...args),
      error: (...args: unknown[]) => mockState.toastError(...args)
    }
  }
})

describe("Onboarding plan page", () => {
  beforeEach(() => {
    mockState.wizardData = {
      companyName: "Acme Build",
      role: "Estimator"
    }
    mockState.checkout.mockReset()
    mockState.fetch.mockReset()
    mockState.navigateTo.mockReset()
    mockState.toastSuccess.mockReset()
    mockState.toastError.mockReset()
    mockState.fetch.mockResolvedValue({ success: true })
    mockState.checkout.mockResolvedValue(undefined)
    vi.stubGlobal("$fetch", (...args: unknown[]) => mockState.fetch(...args))
  })

  it("persists onboarding data and starts checkout for standard plans", async () => {
    const wrapper = await mountSuspended(OnboardingPlanPage, {
      global: {
        stubs: {
          UiButton: {
            template: "<button @click=\"$emit('click')\"><slot /></button>"
          },
          UiCard: { template: "<div><slot /></div>" },
          UiCardHeader: { template: "<div><slot /></div>" },
          UiCardTitle: { template: "<div><slot /></div>" },
          UiCardDescription: { template: "<div><slot /></div>" },
          UiCardContent: { template: "<div><slot /></div>" },
          UiBadge: { template: "<span><slot /></span>" },
          UiSpinner: { template: "<span>Loading</span>" }
        }
      }
    })

    const startTrialButton = wrapper.findAll("button").find((button) => button.text().includes("Start Free Trial"))
    expect(startTrialButton).toBeTruthy()

    await startTrialButton?.trigger("click")

    expect(mockState.fetch).toHaveBeenCalledWith("/api/user/onboarding", {
      method: "POST",
      body: expect.objectContaining({
        companyName: "Acme Build",
        role: "Estimator",
        selectedPlan: "professional"
      })
    })
    expect(mockState.checkout).toHaveBeenCalledWith("professional")
    expect(mockState.toastSuccess).toHaveBeenCalledWith("Profile completed!")
  })

  it("persists onboarding data and skips Stripe checkout for the free plan", async () => {
    const wrapper = await mountSuspended(OnboardingPlanPage, {
      global: {
        stubs: {
          UiButton: {
            template: "<button @click=\"$emit('click')\"><slot /></button>"
          },
          UiCard: { template: "<div><slot /></div>" },
          UiCardHeader: { template: "<div><slot /></div>" },
          UiCardTitle: { template: "<div><slot /></div>" },
          UiCardDescription: { template: "<div><slot /></div>" },
          UiCardContent: { template: "<div><slot /></div>" },
          UiBadge: { template: "<span><slot /></span>" },
          UiSpinner: { template: "<span>Loading</span>" }
        }
      }
    })

    const freeCardButton = wrapper.findAll("button").find((button) => button.text().includes("Select Free"))
    expect(freeCardButton).toBeTruthy()
    await freeCardButton?.trigger("click")

    const continueButton = wrapper.findAll("button").find((button) => button.text().includes("Continue on Free"))
    expect(continueButton).toBeTruthy()
    await continueButton?.trigger("click")

    expect(mockState.fetch).toHaveBeenCalledWith("/api/user/onboarding", {
      method: "POST",
      body: expect.objectContaining({
        companyName: "Acme Build",
        role: "Estimator",
        selectedPlan: "free"
      })
    })
    expect(mockState.checkout).not.toHaveBeenCalled()
    expect(mockState.navigateTo).toHaveBeenCalledWith("/")
  })
})
