import { describe, it, expect, vi, beforeEach } from "vitest"

// Use vi.hoisted() so mock references are available inside vi.mock() factories
const {
  mockStripeSubUpdate,
  mockStripeSubCancel,
  mockStripeBillingPortalCreate,
  mockDbQuery,
  mockDbUpdate
} = vi.hoisted(() => ({
  mockStripeSubUpdate: vi.fn(),
  mockStripeSubCancel: vi.fn(),
  mockStripeBillingPortalCreate: vi.fn(),
  mockDbQuery: {
    subscription: { findFirst: vi.fn() }
  },
  mockDbUpdate: vi.fn()
}))

vi.mock("@auth", () => ({
  stripeClient: {
    subscriptions: {
      update: (...args: unknown[]) => mockStripeSubUpdate(...args),
      cancel: (...args: unknown[]) => mockStripeSubCancel(...args)
    },
    billingPortal: {
      sessions: {
        create: (...args: unknown[]) => mockStripeBillingPortalCreate(...args)
      }
    }
  }
}))

vi.mock("../../utils/drizzle", () => ({
  db: {
    query: mockDbQuery,
    update: (...args: unknown[]) => mockDbUpdate(...args)
  }
}))

vi.mock("@shared/db/schema", () => ({
  subscription: { id: "id" }
}))

vi.mock("./billing.service", () => ({
  billingService: {
    recordActivity: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock("../../utils/audit", () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined)
}))

vi.stubGlobal(
  "createError",
  (opts: { statusCode: number; message: string }) => {
    const err = new Error(opts.message) as Error & { statusCode: number }
    err.statusCode = opts.statusCode
    return err
  }
)

import { billingActionsService } from "./billing.actions"
import { billingService } from "./billing.service"
import { logAdminAction } from "../../utils/audit"

const mockLocalSub = {
  id: "local-sub-1",
  stripeSubscriptionId: "sub_stripe_123",
  stripeCustomerId: "cus_stripe_123",
  referenceId: "org-123",
  cancelAtPeriodEnd: false
}

describe("billingActionsService.cancelSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
      })
    })
  })

  it("cancels at period end via Stripe", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(mockLocalSub)

    // Mock Stripe response for cancel_at_period_end update
    mockStripeSubUpdate.mockResolvedValue({
      id: "sub_stripe_123",
      status: "active",
      cancel_at_period_end: true,
      cancel_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      canceled_at: Math.floor(Date.now() / 1000),
      ended_at: null
    })

    await billingActionsService.cancelSubscription({
      subscriptionId: "local-sub-1",
      mode: "at_period_end",
      reason: "Customer requested",
      adminId: "admin-1"
    })

    expect(mockStripeSubUpdate).toHaveBeenCalledWith("sub_stripe_123", {
      cancel_at_period_end: true
    })
    expect(mockDbUpdate).toHaveBeenCalled()
  })

  it("cancels immediately via Stripe", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(mockLocalSub)

    mockStripeSubCancel.mockResolvedValue({
      id: "sub_stripe_123",
      status: "canceled",
      cancel_at_period_end: false,
      cancel_at: null,
      canceled_at: Math.floor(Date.now() / 1000),
      ended_at: Math.floor(Date.now() / 1000)
    })

    await billingActionsService.cancelSubscription({
      subscriptionId: "local-sub-1",
      mode: "immediately",
      reason: "Fraud detected",
      adminId: "admin-1"
    })

    expect(mockStripeSubCancel).toHaveBeenCalledWith("sub_stripe_123")
    expect(mockDbUpdate).toHaveBeenCalled()
  })

  it("throws 404 when subscription not found", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    await expect(
      billingActionsService.cancelSubscription({
        subscriptionId: "nonexistent",
        mode: "at_period_end",
        reason: "test",
        adminId: "admin-1"
      })
    ).rejects.toThrow(/not found/)
  })

  it("throws 404 when subscription has no Stripe ID", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue({
      id: "local-sub-1",
      stripeSubscriptionId: null
    })

    await expect(
      billingActionsService.cancelSubscription({
        subscriptionId: "local-sub-1",
        mode: "at_period_end",
        reason: "test",
        adminId: "admin-1"
      })
    ).rejects.toThrow(/not found/)
  })
})

describe("billingActionsService.reactivateSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
      })
    })
  })

  it("reactivates a scheduled cancellation via Stripe", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue({
      ...mockLocalSub,
      cancelAtPeriodEnd: true
    })

    mockStripeSubUpdate.mockResolvedValue({
      id: "sub_stripe_123",
      status: "active",
      cancel_at_period_end: false
    })

    await billingActionsService.reactivateSubscription({
      subscriptionId: "local-sub-1",
      reason: "Customer changed mind",
      adminId: "admin-1"
    })

    expect(mockStripeSubUpdate).toHaveBeenCalledWith("sub_stripe_123", {
      cancel_at_period_end: false
    })
    expect(mockDbUpdate).toHaveBeenCalled()
  })

  it("throws 404 when subscription not found", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    await expect(
      billingActionsService.reactivateSubscription({
        subscriptionId: "nonexistent",
        reason: "test",
        adminId: "admin-1"
      })
    ).rejects.toThrow(/not found/)
  })

  it("throws 400 when subscription is not scheduled for cancellation", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue({
      ...mockLocalSub,
      cancelAtPeriodEnd: false
    })

    await expect(
      billingActionsService.reactivateSubscription({
        subscriptionId: "local-sub-1",
        reason: "test",
        adminId: "admin-1"
      })
    ).rejects.toThrow(/not scheduled for cancellation/)
  })
})

describe("billingActionsService.generateBillingPortalLink", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("generates a billing portal URL", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(mockLocalSub)

    mockStripeBillingPortalCreate.mockResolvedValue({
      url: "https://billing.stripe.com/session/test_session"
    })

    const url = await billingActionsService.generateBillingPortalLink({
      subscriptionId: "local-sub-1",
      returnUrl: "https://app.example.com/billing",
      adminId: "admin-1"
    })

    expect(url).toBe("https://billing.stripe.com/session/test_session")
    expect(mockStripeBillingPortalCreate).toHaveBeenCalledWith({
      customer: "cus_stripe_123",
      return_url: "https://app.example.com/billing"
    })
  })

  it("throws 404 when subscription has no Stripe customer", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue({
      id: "local-sub-1",
      stripeCustomerId: null
    })

    await expect(
      billingActionsService.generateBillingPortalLink({
        subscriptionId: "local-sub-1",
        returnUrl: "https://app.example.com",
        adminId: "admin-1"
      })
    ).rejects.toThrow(/not found/)
  })
})

describe("billing activity and audit logging", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
      })
    })
  })

  it("records billing activity on cancel at_period_end", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(mockLocalSub)
    mockStripeSubUpdate.mockResolvedValue({
      id: "sub_stripe_123",
      status: "active",
      cancel_at_period_end: true,
      cancel_at: null,
      canceled_at: null,
      ended_at: null
    })

    await billingActionsService.cancelSubscription({
      subscriptionId: "local-sub-1",
      mode: "at_period_end",
      reason: "Too expensive",
      adminId: "admin-1"
    })

    expect(billingService.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: "local-sub-1",
        type: "admin_action",
        actorId: "admin-1",
        description: expect.stringContaining("period end")
      })
    )
  })

  it("records billing activity on immediate cancel", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(mockLocalSub)
    mockStripeSubCancel.mockResolvedValue({
      id: "sub_stripe_123",
      status: "canceled",
      cancel_at_period_end: false,
      cancel_at: null,
      canceled_at: Math.floor(Date.now() / 1000),
      ended_at: Math.floor(Date.now() / 1000)
    })

    await billingActionsService.cancelSubscription({
      subscriptionId: "local-sub-1",
      mode: "immediately",
      reason: "Fraud",
      adminId: "admin-1"
    })

    expect(billingService.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("immediately")
      })
    )
  })

  it("calls logAdminAction on cancel", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(mockLocalSub)
    mockStripeSubUpdate.mockResolvedValue({
      id: "sub_stripe_123",
      status: "active",
      cancel_at_period_end: true,
      cancel_at: null,
      canceled_at: null,
      ended_at: null
    })

    await billingActionsService.cancelSubscription({
      subscriptionId: "local-sub-1",
      mode: "at_period_end",
      reason: "Customer request",
      adminId: "admin-1",
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0"
    })

    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin-1",
        actionType: "billing.subscription.cancel",
        targetOrgId: "org-123",
        ipAddress: "1.2.3.4",
        userAgent: "Mozilla/5.0"
      })
    )
  })

  it("calls logAdminAction on reactivate", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue({
      ...mockLocalSub,
      cancelAtPeriodEnd: true
    })
    mockStripeSubUpdate.mockResolvedValue({
      id: "sub_stripe_123",
      status: "active",
      cancel_at_period_end: false
    })

    await billingActionsService.reactivateSubscription({
      subscriptionId: "local-sub-1",
      reason: "Changed mind",
      adminId: "admin-1"
    })

    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "billing.subscription.reactivate",
        targetOrgId: "org-123"
      })
    )
  })

  it("calls logAdminAction on billing portal link generation", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(mockLocalSub)
    mockStripeBillingPortalCreate.mockResolvedValue({
      url: "https://billing.stripe.com/session/test"
    })

    await billingActionsService.generateBillingPortalLink({
      subscriptionId: "local-sub-1",
      returnUrl: "https://app.example.com",
      adminId: "admin-1"
    })

    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "billing.portal_link_generated"
      })
    )
  })
})

describe("Stripe API failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
      })
    })
  })

  it("propagates Stripe error on cancel at_period_end", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(mockLocalSub)
    mockStripeSubUpdate.mockRejectedValue(new Error("Stripe: card_declined"))

    await expect(
      billingActionsService.cancelSubscription({
        subscriptionId: "local-sub-1",
        mode: "at_period_end",
        reason: "test",
        adminId: "admin-1"
      })
    ).rejects.toThrow("Stripe: card_declined")

    // Should not update local DB or log activity
    expect(mockDbUpdate).not.toHaveBeenCalled()
  })

  it("propagates Stripe error on immediate cancel", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(mockLocalSub)
    mockStripeSubCancel.mockRejectedValue(new Error("Stripe: resource_missing"))

    await expect(
      billingActionsService.cancelSubscription({
        subscriptionId: "local-sub-1",
        mode: "immediately",
        reason: "test",
        adminId: "admin-1"
      })
    ).rejects.toThrow("Stripe: resource_missing")
  })

  it("propagates Stripe error on reactivate", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue({
      ...mockLocalSub,
      cancelAtPeriodEnd: true
    })
    mockStripeSubUpdate.mockRejectedValue(new Error("Stripe: api_error"))

    await expect(
      billingActionsService.reactivateSubscription({
        subscriptionId: "local-sub-1",
        reason: "test",
        adminId: "admin-1"
      })
    ).rejects.toThrow("Stripe: api_error")
  })

  it("propagates Stripe error on billing portal creation", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(mockLocalSub)
    mockStripeBillingPortalCreate.mockRejectedValue(
      new Error("Stripe: portal_not_configured")
    )

    await expect(
      billingActionsService.generateBillingPortalLink({
        subscriptionId: "local-sub-1",
        returnUrl: "https://app.example.com",
        adminId: "admin-1"
      })
    ).rejects.toThrow("Stripe: portal_not_configured")
  })
})
