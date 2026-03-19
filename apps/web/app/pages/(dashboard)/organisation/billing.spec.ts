import { beforeEach, describe, expect, it, vi } from "vitest"
import { mountSuspended, mockNuxtImport } from "@nuxt/test-utils/runtime"
import { ref } from "vue"
import BillingPage from "./billing.vue"

interface MockSubscriptionState {
  subscription: {
    periodEnd: string
    billingInterval: string
    seats: number
  } | null
  planName: string
  isFreeTier: boolean
  isPaid: boolean
  isTrialing: boolean
  isCanceling: boolean
  trialEnd: Date | null
  limits: {
    projects: number
    fileSizeMb: number
    storageMb: number
  }
}

const mockState = vi.hoisted(() => ({
  subscriptionState: {
    subscription: null,
    planName: "free",
    isFreeTier: true,
    isPaid: false,
    isTrialing: false,
    isCanceling: false,
    trialEnd: null as Date | null,
    limits: {
      projects: 1,
      fileSizeMb: 10,
      storageMb: 100
    }
  } as MockSubscriptionState,
  openBillingPortal: vi.fn(),
  isLoading: false
}))

mockNuxtImport("useSubscription", () => {
  return () => ({
    subscription: ref(mockState.subscriptionState.subscription),
    planName: ref(mockState.subscriptionState.planName),
    isFreeTier: ref(mockState.subscriptionState.isFreeTier),
    isPaid: ref(mockState.subscriptionState.isPaid),
    isTrialing: ref(mockState.subscriptionState.isTrialing),
    isCanceling: ref(mockState.subscriptionState.isCanceling),
    trialEnd: ref(mockState.subscriptionState.trialEnd),
    limits: ref(mockState.subscriptionState.limits)
  })
})

mockNuxtImport("useCheckout", () => {
  return () => ({
    openBillingPortal: (...args: unknown[]) => mockState.openBillingPortal(...args),
    isLoading: ref(mockState.isLoading)
  })
})

describe("Organisation billing page", () => {
  beforeEach(() => {
    mockState.subscriptionState = {
      subscription: null,
      planName: "free",
      isFreeTier: true,
      isPaid: false,
      isTrialing: false,
      isCanceling: false,
      trialEnd: null,
      limits: {
        projects: 1,
        fileSizeMb: 10,
        storageMb: 100
      }
    }
    mockState.openBillingPortal.mockReset()
    mockState.isLoading = false
  })

  it("shows the upgrade path for free users", async () => {
    const wrapper = await mountSuspended(BillingPage, {
      global: {
        stubs: {
          UiButton: { template: "<button><slot /></button>" },
          UiCard: { template: "<div><slot /></div>" },
          UiCardHeader: { template: "<div><slot /></div>" },
          UiCardTitle: { template: "<div><slot /></div>" },
          UiCardDescription: { template: "<div><slot /></div>" },
          UiCardContent: { template: "<div><slot /></div>" },
          UiBadge: { template: "<span><slot /></span>" }
        }
      }
    })

    expect(wrapper.text()).toContain("Upgrade")
    expect(wrapper.text()).toContain("You're on the free plan")
  })

  it("shows billing portal controls for paid users", async () => {
    mockState.subscriptionState = {
      subscription: {
        periodEnd: "2026-05-01T00:00:00.000Z",
        billingInterval: "month",
        seats: 5
      },
      planName: "starter",
      isFreeTier: false,
      isPaid: true,
      isTrialing: false,
      isCanceling: false,
      trialEnd: null,
      limits: {
        projects: 10,
        fileSizeMb: 50,
        storageMb: 500
      }
    }

    const wrapper = await mountSuspended(BillingPage, {
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
          UiBadge: { template: "<span><slot /></span>" }
        }
      }
    })

    const portalButton = wrapper.findAll("button").find((button) => button.text().includes("Open Billing Portal"))
    expect(wrapper.text()).toContain("Manage Subscription")
    expect(portalButton).toBeTruthy()

    await portalButton?.trigger("click")

    expect(mockState.openBillingPortal).toHaveBeenCalledWith("/organisation/billing")
  })
})
