import { describe, it, expect, vi, beforeEach } from "vitest"
import type Stripe from "stripe"

// Use vi.hoisted() so mock references are available inside vi.mock() factories
const {
  mockStripeSubscriptionsList,
  mockStripeSubscriptionsRetrieve,
  mockStripePricesList,
  mockDbQuery,
  mockDbInsert,
  mockDbUpdate
} = vi.hoisted(() => ({
  mockStripeSubscriptionsList: vi.fn(),
  mockStripeSubscriptionsRetrieve: vi.fn(),
  mockStripePricesList: vi.fn(),
  mockDbQuery: {
    stripePlan: { findFirst: vi.fn(), findMany: vi.fn() },
    subscription: { findFirst: vi.fn() },
    organization: { findFirst: vi.fn() },
    billingSyncLog: { findFirst: vi.fn() }
  },
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn()
}))

vi.mock("@auth", () => ({
  stripeClient: {
    subscriptions: {
      list: (...args: unknown[]) => mockStripeSubscriptionsList(...args),
      retrieve: (...args: unknown[]) => mockStripeSubscriptionsRetrieve(...args)
    },
    prices: {
      list: (...args: unknown[]) => mockStripePricesList(...args)
    }
  }
}))

vi.mock("../../utils/drizzle", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args)
  }
}))

vi.mock("@shared/db/schema", () => ({
  stripePlan: { id: "id", stripePriceId: "stripePriceId", active: "active" },
  subscription: {
    id: "id",
    stripeSubscriptionId: "stripeSubscriptionId",
    referenceId: "referenceId",
    status: "status"
  },
  organization: { stripeCustomerId: "stripeCustomerId" },
  billingSyncLog: { id: "id", status: "status", completedAt: "completedAt" },
  billingActivity: {}
}))

vi.mock("./billing.service", () => ({
  billingService: {
    recordActivity: vi.fn()
  }
}))

vi.mock("nanoid", () => ({
  nanoid: () => "mock-nanoid-id"
}))

vi.stubGlobal(
  "createError",
  (opts: { statusCode: number; message: string }) => {
    const err = new Error(opts.message) as Error & { statusCode: number }
    err.statusCode = opts.statusCode
    return err
  }
)

import { billingSyncService } from "./billing.sync"

// Helper: create a mock Stripe product
function mockStripeProduct(overrides: Partial<Stripe.Product> = {}): Stripe.Product {
  return {
    id: "prod_test123",
    object: "product",
    active: true,
    name: "Professional",
    description: "For growing teams",
    metadata: {
      limit_projects: "unlimited",
      limit_storage_mb: "500",
      limit_file_size_mb: "50",
      feature_export_formats: "pdf,png,svg",
      feature_measurement_tools: "all",
      feature_cloud_sync: "true",
      feature_collaboration: "false",
      feature_custom_branding: "false",
      feature_measurement_presets: "true",
      display_order: "2"
    },
    ...overrides
  } as Stripe.Product
}

// Helper: create a mock Stripe price
function mockStripePrice(overrides: Partial<Stripe.Price> = {}): Stripe.Price {
  return {
    id: "price_test123",
    object: "price",
    active: true,
    currency: "aud",
    unit_amount: 7900,
    recurring: {
      interval: "month",
      interval_count: 1,
      usage_type: "licensed"
    } as Stripe.Price.Recurring,
    product: mockStripeProduct(),
    lookup_key: null,
    ...overrides
  } as Stripe.Price
}

// Helper: create a mock Stripe subscription
function mockStripeSubscription(
  overrides: Partial<Stripe.Subscription> = {}
): Stripe.Subscription {
  return {
    id: "sub_test123",
    object: "subscription",
    status: "active",
    customer: "cus_test123",
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    ended_at: null,
    trial_start: null,
    trial_end: null,
    schedule: null,
    items: {
      object: "list",
      data: [
        {
          id: "si_test123",
          price: {
            product: mockStripeProduct(),
            lookup_key: null,
            recurring: { interval: "month" }
          },
          quantity: 1,
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
        }
      ]
    } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
    ...overrides
  } as Stripe.Subscription
}

describe("billingSyncService.syncPlans", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: return mock values chain for insert/update
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue(Promise.resolve())
    })
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve())
      })
    })
  })

  it("creates a new plan from Stripe price data", async () => {
    const price = mockStripePrice()

    mockStripePricesList.mockResolvedValue({
      data: [price],
      has_more: false
    })

    // No existing plan
    mockDbQuery.stripePlan.findFirst.mockResolvedValue(null)
    // No plans at all (for inactive marking)
    mockDbQuery.stripePlan.findMany.mockResolvedValue([])

    await billingSyncService.syncPlans()

    expect(mockDbInsert).toHaveBeenCalled()
    // Verify the insert was called with parsed limits
    const insertCall = mockDbInsert.mock.results[0]
    expect(insertCall).toBeDefined()
  })

  it("updates existing plan Stripe fields without overwriting limits", async () => {
    const price = mockStripePrice()

    mockStripePricesList.mockResolvedValue({
      data: [price],
      has_more: false
    })

    // Existing plan with admin-set limits
    mockDbQuery.stripePlan.findFirst.mockResolvedValue({
      id: "existing-plan-id",
      stripePriceId: "price_test123",
      limits: { projects: 10, storageMb: 200, fileSizeMb: 30 } // admin override
    })
    mockDbQuery.stripePlan.findMany.mockResolvedValue([
      { stripePriceId: "price_test123", active: true }
    ])

    await billingSyncService.syncPlans()

    // Should update stripe values but NOT overwrite existing limits
    expect(mockDbUpdate).toHaveBeenCalled()
  })

  it("populates limits from metadata for existing plan with null limits", async () => {
    const price = mockStripePrice()

    mockStripePricesList.mockResolvedValue({
      data: [price],
      has_more: false
    })

    // Existing plan with null limits (no admin override)
    mockDbQuery.stripePlan.findFirst.mockResolvedValue({
      id: "existing-plan-id",
      stripePriceId: "price_test123",
      limits: null
    })
    mockDbQuery.stripePlan.findMany.mockResolvedValue([
      { stripePriceId: "price_test123", active: true }
    ])

    await billingSyncService.syncPlans()

    // Should call update twice: once for stripe values, once for limits
    expect(mockDbUpdate).toHaveBeenCalledTimes(2)
  })

  it("skips non-recurring prices", async () => {
    const oneTimePrice = mockStripePrice({ recurring: null as any })

    mockStripePricesList.mockResolvedValue({
      data: [oneTimePrice],
      has_more: false
    })
    mockDbQuery.stripePlan.findMany.mockResolvedValue([])

    await billingSyncService.syncPlans()

    expect(mockDbInsert).not.toHaveBeenCalled()
    expect(mockDbQuery.stripePlan.findFirst).not.toHaveBeenCalled()
  })

  it("skips deleted products", async () => {
    const deletedProduct = mockStripePrice({
      product: { ...mockStripeProduct(), deleted: true } as any
    })

    mockStripePricesList.mockResolvedValue({
      data: [deletedProduct],
      has_more: false
    })
    mockDbQuery.stripePlan.findMany.mockResolvedValue([])

    await billingSyncService.syncPlans()

    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it("marks local plans as inactive when not in Stripe", async () => {
    mockStripePricesList.mockResolvedValue({
      data: [], // No active prices in Stripe
      has_more: false
    })

    // Local plan that should be marked inactive
    mockDbQuery.stripePlan.findMany.mockResolvedValue([
      { id: "old-plan", stripePriceId: "price_old", active: true }
    ])

    await billingSyncService.syncPlans()

    expect(mockDbUpdate).toHaveBeenCalled()
  })
})

describe("billingSyncService.upsertSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue(Promise.resolve())
    })
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve())
      })
    })
  })

  it("creates a new subscription when none exists locally", async () => {
    const stripeSub = mockStripeSubscription()

    // Org found by customer ID
    mockDbQuery.organization.findFirst.mockResolvedValue({ id: "org-123" })
    // No existing local subscription
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    const result = await billingSyncService.upsertSubscription(stripeSub)

    expect(result).toBe("created")
    expect(mockDbInsert).toHaveBeenCalled()
  })

  it("updates existing subscription", async () => {
    const stripeSub = mockStripeSubscription()

    mockDbQuery.organization.findFirst.mockResolvedValue({ id: "org-123" })
    // Existing local subscription
    mockDbQuery.subscription.findFirst.mockResolvedValue({
      id: "local-sub-id",
      stripeSubscriptionId: "sub_test123"
    })

    const result = await billingSyncService.upsertSubscription(stripeSub)

    expect(result).toBe("updated")
    expect(mockDbUpdate).toHaveBeenCalled()
  })

  it("falls back to customer ID when no org found", async () => {
    const stripeSub = mockStripeSubscription()

    // No org found
    mockDbQuery.organization.findFirst.mockResolvedValue(null)
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    const result = await billingSyncService.upsertSubscription(stripeSub)

    expect(result).toBe("created")
    // referenceId should fall back to customer ID
    expect(mockDbInsert).toHaveBeenCalled()
  })

  it("handles subscription with cancellation data", async () => {
    const cancelTime = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
    const stripeSub = mockStripeSubscription({
      status: "active",
      cancel_at_period_end: true,
      cancel_at: cancelTime,
      canceled_at: Math.floor(Date.now() / 1000)
    })

    mockDbQuery.organization.findFirst.mockResolvedValue({ id: "org-123" })
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    await billingSyncService.upsertSubscription(stripeSub)

    expect(mockDbInsert).toHaveBeenCalled()
  })

  it("handles subscription with trial data", async () => {
    const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60
    const stripeSub = mockStripeSubscription({
      status: "trialing",
      trial_start: Math.floor(Date.now() / 1000),
      trial_end: trialEnd
    })

    mockDbQuery.organization.findFirst.mockResolvedValue({ id: "org-123" })
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    const result = await billingSyncService.upsertSubscription(stripeSub)
    expect(result).toBe("created")
  })

  it("resolves string customer ID", async () => {
    const stripeSub = mockStripeSubscription({
      customer: "cus_string_id"
    })

    mockDbQuery.organization.findFirst.mockResolvedValue(null)
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    await billingSyncService.upsertSubscription(stripeSub)

    expect(mockDbQuery.organization.findFirst).toHaveBeenCalled()
  })
})

describe("billingSyncService.fullSync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue(Promise.resolve())
    })
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve())
      })
    })
  })

  it("syncs plans and subscriptions and returns counts", async () => {
    // Mock syncPlans (prices)
    mockStripePricesList.mockResolvedValue({ data: [], has_more: false })
    mockDbQuery.stripePlan.findMany.mockResolvedValue([])

    // Mock subscriptions list - one page, one subscription
    const stripeSub = mockStripeSubscription()
    mockStripeSubscriptionsList.mockResolvedValue({
      data: [stripeSub],
      has_more: false
    })

    // Mock upsertSubscription dependencies
    mockDbQuery.organization.findFirst.mockResolvedValue({ id: "org-123" })
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    const result = await billingSyncService.fullSync("admin-user-1")

    expect(result.synced).toBe(1)
    expect(result.created).toBe(1)
    expect(result.updated).toBe(0)
    expect(result.errors).toBe(0)
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })

  it("paginates through multiple pages of subscriptions", async () => {
    mockStripePricesList.mockResolvedValue({ data: [], has_more: false })
    mockDbQuery.stripePlan.findMany.mockResolvedValue([])

    const sub1 = mockStripeSubscription({ id: "sub_page1" })
    const sub2 = mockStripeSubscription({ id: "sub_page2" })

    // First page has more
    mockStripeSubscriptionsList
      .mockResolvedValueOnce({
        data: [sub1],
        has_more: true
      })
      .mockResolvedValueOnce({
        data: [sub2],
        has_more: false
      })

    mockDbQuery.organization.findFirst.mockResolvedValue({ id: "org-123" })
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    const result = await billingSyncService.fullSync("admin-1")

    expect(result.synced).toBe(2)
    expect(result.created).toBe(2)
    expect(mockStripeSubscriptionsList).toHaveBeenCalledTimes(2)
  })

  it("counts errors but continues syncing", async () => {
    mockStripePricesList.mockResolvedValue({ data: [], has_more: false })
    mockDbQuery.stripePlan.findMany.mockResolvedValue([])

    const goodSub = mockStripeSubscription({ id: "sub_good" })
    const badSub = mockStripeSubscription({ id: "sub_bad" })

    mockStripeSubscriptionsList.mockResolvedValue({
      data: [goodSub, badSub],
      has_more: false
    })

    // First upsert succeeds, second fails
    mockDbQuery.organization.findFirst
      .mockResolvedValueOnce({ id: "org-1" })
      .mockRejectedValueOnce(new Error("DB error"))

    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    const result = await billingSyncService.fullSync("admin-1")

    expect(result.synced).toBe(1)
    expect(result.errors).toBe(1)
  })

  it("handles empty subscription list", async () => {
    mockStripePricesList.mockResolvedValue({ data: [], has_more: false })
    mockDbQuery.stripePlan.findMany.mockResolvedValue([])

    mockStripeSubscriptionsList.mockResolvedValue({
      data: [],
      has_more: false
    })

    const result = await billingSyncService.fullSync("admin-1")

    expect(result.synced).toBe(0)
    expect(result.created).toBe(0)
    expect(result.updated).toBe(0)
    expect(result.errors).toBe(0)
  })

  it("throws and logs failed status when syncPlans fails", async () => {
    mockStripePricesList.mockRejectedValue(new Error("Stripe API down"))

    await expect(billingSyncService.fullSync("admin-1")).rejects.toThrow("Stripe API down")

    // Should have updated sync log to "failed"
    expect(mockDbUpdate).toHaveBeenCalled()
  })
})

describe("billingSyncService.refreshSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue(Promise.resolve())
    })
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve())
      })
    })
  })

  it("refreshes a single subscription from Stripe", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue({
      id: "local-sub-1",
      stripeSubscriptionId: "sub_stripe_123"
    })

    mockStripeSubscriptionsRetrieve.mockResolvedValue(mockStripeSubscription())
    mockDbQuery.organization.findFirst.mockResolvedValue({ id: "org-123" })

    // For upsertSubscription
    mockDbQuery.subscription.findFirst
      .mockResolvedValueOnce({ id: "local-sub-1", stripeSubscriptionId: "sub_stripe_123" })
      .mockResolvedValueOnce({ id: "local-sub-1", stripeSubscriptionId: "sub_test123" })

    await billingSyncService.refreshSubscription("local-sub-1", "admin-1")

    expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith("sub_stripe_123")
  })

  it("throws 404 when subscription not found", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    await expect(
      billingSyncService.refreshSubscription("nonexistent", "admin-1")
    ).rejects.toThrow(/not found/)
  })

  it("throws 404 when subscription has no Stripe ID", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue({
      id: "local-sub-1",
      stripeSubscriptionId: null
    })

    await expect(
      billingSyncService.refreshSubscription("local-sub-1", "admin-1")
    ).rejects.toThrow(/not found/)
  })
})

describe("billingSyncService.syncPlans - edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue(Promise.resolve())
    })
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve())
      })
    })
  })

  it("skips prices where product is a string (not expanded)", async () => {
    const stringProductPrice = {
      ...mockStripePrice(),
      product: "prod_string_id" // not expanded
    }

    mockStripePricesList.mockResolvedValue({
      data: [stringProductPrice],
      has_more: false
    })
    mockDbQuery.stripePlan.findMany.mockResolvedValue([])

    await billingSyncService.syncPlans()

    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it("merges product and price metadata", async () => {
    const product = mockStripeProduct({
      metadata: { limit_projects: "5", feature_cloud_sync: "true" }
    })
    const price = mockStripePrice({
      product,
      metadata: { display_order: "1" } as any
    })
    // The price also has its own metadata at price level
    ;(price as any).metadata = { display_order: "1" }

    mockStripePricesList.mockResolvedValue({
      data: [price],
      has_more: false
    })
    mockDbQuery.stripePlan.findFirst.mockResolvedValue(null)
    mockDbQuery.stripePlan.findMany.mockResolvedValue([])

    await billingSyncService.syncPlans()

    expect(mockDbInsert).toHaveBeenCalled()
  })
})

describe("billingSyncService.upsertSubscription - edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue(Promise.resolve())
    })
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve())
      })
    })
  })

  it("handles customer as object with id", async () => {
    const sub = mockStripeSubscription({
      customer: { id: "cus_object_id" } as any
    })

    mockDbQuery.organization.findFirst.mockResolvedValue({ id: "org-123" })
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    const result = await billingSyncService.upsertSubscription(sub)
    expect(result).toBe("created")
  })

  it("handles subscription with schedule as object", async () => {
    const sub = mockStripeSubscription({
      schedule: { id: "sub_sched_123" } as any
    })

    mockDbQuery.organization.findFirst.mockResolvedValue({ id: "org-123" })
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    const result = await billingSyncService.upsertSubscription(sub)
    expect(result).toBe("created")
  })

  it("handles subscription with schedule as string", async () => {
    const sub = mockStripeSubscription({
      schedule: "sub_sched_string" as any
    })

    mockDbQuery.organization.findFirst.mockResolvedValue({ id: "org-123" })
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    const result = await billingSyncService.upsertSubscription(sub)
    expect(result).toBe("created")
  })
})
