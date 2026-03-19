import { beforeEach, describe, expect, it, vi } from "vitest"
import { mockNuxtImport } from "@nuxt/test-utils/runtime"
import { ref } from "vue"

const mockState = vi.hoisted(() => ({
  activeOrgId: "org-123",
  subscription: null as { stripeSubscriptionId?: string | null } | null,
  upgrade: vi.fn(),
  billingPortal: vi.fn(),
  toastError: vi.fn()
}))

mockNuxtImport("useActiveOrganization", () => {
  return () => ({
    activeOrg: ref(
      mockState.activeOrgId
        ? {
            data: {
              id: mockState.activeOrgId
            }
          }
        : null
    )
  })
})

mockNuxtImport("useSubscription", () => {
  return () => ({
    subscription: ref(mockState.subscription)
  })
})

vi.mock("~/utils/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => (args.length > 0 ? { data: ref(null) } : ref(null))
  },
  subscriptionClient$: {
    upgrade: (...args: unknown[]) => mockState.upgrade(...args),
    billingPortal: (...args: unknown[]) => mockState.billingPortal(...args)
  }
}))

vi.mock("vue-sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-sonner")>()
  return {
    ...actual,
    toast: {
      ...actual.toast,
      error: (...args: unknown[]) => mockState.toastError(...args)
    }
  }
})

import { useCheckout } from "./useCheckout"

describe("useCheckout", () => {
  beforeEach(() => {
    mockState.activeOrgId = "org-123"
    mockState.subscription = null
    mockState.upgrade.mockReset()
    mockState.billingPortal.mockReset()
    mockState.toastError.mockReset()
  })

  it("refuses checkout when there is no active organisation", async () => {
    mockState.activeOrgId = ""

    const { checkout } = useCheckout()
    await checkout("Professional")

    expect(mockState.upgrade).not.toHaveBeenCalled()
    expect(mockState.toastError).toHaveBeenCalledWith("No active organization. Please select an organization first.")
  })

  it("starts checkout with the normalised plan name and organisation context", async () => {
    mockState.upgrade.mockResolvedValue({ error: null })

    const { checkout } = useCheckout()
    await checkout("Team", { seats: 5, annual: true })

    expect(mockState.upgrade).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "team",
        referenceId: "org-123",
        customerType: "organization",
        seats: 5,
        annual: true,
        successUrl: "http://localhost:3000/checkout/success",
        cancelUrl: "http://localhost:3000/checkout/cancel"
      })
    )
  })

  it("passes the existing Stripe subscription ID when upgrading an active organisation subscription", async () => {
    mockState.subscription = {
      stripeSubscriptionId: "sub_existing_123"
    }
    mockState.upgrade.mockResolvedValue({ error: null })

    const { checkout } = useCheckout()
    await checkout("Professional")

    expect(mockState.upgrade).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "professional",
        referenceId: "org-123",
        customerType: "organization",
        subscriptionId: "sub_existing_123"
      })
    )
  })

  it("opens the billing portal with a return path for the active organisation", async () => {
    mockState.billingPortal.mockResolvedValue(undefined)

    const { openBillingPortal } = useCheckout()
    await openBillingPortal("/organisation/billing")

    expect(mockState.billingPortal).toHaveBeenCalledWith({
      referenceId: "org-123",
      customerType: "organization",
      returnUrl: "http://localhost:3000/organisation/billing"
    })
  })
})
