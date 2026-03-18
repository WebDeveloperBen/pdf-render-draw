import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Tests for billing.service.ts:
 * 1. Pure helper functions (reimplemented since they're module-private)
 * 2. billingService methods (with mocked DB)
 */

// ---- Mock setup for service methods ----

const { mockDbQuery, mockDbSelect, mockDbInsert } = vi.hoisted(() => ({
  mockDbQuery: {
    subscription: { findFirst: vi.fn() },
    stripePlan: { findFirst: vi.fn(), findMany: vi.fn() },
    organization: { findFirst: vi.fn() },
    billingActivity: { findFirst: vi.fn() },
    billingSyncLog: { findFirst: vi.fn() },
    member: { findFirst: vi.fn() }
  },
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn()
}))

vi.mock("../../utils/drizzle", () => ({
  db: {
    query: mockDbQuery,
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args)
  }
}))

vi.mock("@shared/db/schema", () => ({
  subscription: { status: "status", referenceId: "referenceId", plan: "plan" },
  organization: { id: "id", name: "name", slug: "slug", logo: "logo" },
  stripePlan: { active: "active", amount: "amount", name: "name" },
  billingActivity: {
    subscriptionId: "subscriptionId",
    type: "type",
    createdAt: "createdAt"
  },
  billingSyncLog: { status: "status", completedAt: "completedAt" },
  user: { name: "name", email: "email" },
  member: { organizationId: "organizationId" }
}))

vi.mock("nanoid", () => ({
  nanoid: () => "mock-nanoid-id"
}))

import { billingService } from "./billing.service"

// ---- Part 1: Pure helper function tests (reimplemented) ----

type PlanTier = "free" | "starter" | "professional" | "team" | "enterprise"
type BillingHealth = "healthy" | "at_risk" | "action_needed" | "inactive"
type DataFreshness = "fresh" | "stale" | "unknown"
type AllowedAction =
  | "refresh"
  | "cancel_at_period_end"
  | "cancel_immediately"
  | "reactivate"
  | "send_billing_portal_link"

function planTierFromName(planName: string): PlanTier {
  const lower = planName.toLowerCase()
  if (lower === "starter") return "starter"
  if (lower === "professional") return "professional"
  if (lower === "team") return "team"
  if (lower === "enterprise") return "enterprise"
  return "free"
}

function computeBillingHealth(status: string, cancelAtPeriodEnd: boolean | null): BillingHealth {
  if (status === "active" && !cancelAtPeriodEnd) return "healthy"
  if (status === "trialing") return "healthy"
  if (status === "active" && cancelAtPeriodEnd) return "at_risk"
  if (status === "past_due") return "at_risk"
  if (status === "incomplete" || status === "unpaid") return "action_needed"
  return "inactive"
}

function computeDataFreshness(lastActivityAt: Date | null): DataFreshness {
  if (!lastActivityAt) return "unknown"
  const hoursSince = (Date.now() - lastActivityAt.getTime()) / (1000 * 60 * 60)
  if (hoursSince < 1) return "fresh"
  if (hoursSince < 24) return "fresh"
  return "stale"
}

function computeAllowedActions(
  status: string,
  cancelAtPeriodEnd: boolean | null,
  adminTier: string
): AllowedAction[] {
  const actions: AllowedAction[] = []
  if (["support", "admin", "owner"].includes(adminTier)) actions.push("refresh")
  if (
    ["support", "admin", "owner"].includes(adminTier) &&
    ["active", "trialing", "past_due"].includes(status)
  )
    actions.push("send_billing_portal_link")
  if (
    ["admin", "owner"].includes(adminTier) &&
    ["active", "trialing"].includes(status) &&
    !cancelAtPeriodEnd
  )
    actions.push("cancel_at_period_end")
  if (["admin", "owner"].includes(adminTier) && cancelAtPeriodEnd) actions.push("reactivate")
  if (adminTier === "owner" && ["active", "trialing", "past_due"].includes(status))
    actions.push("cancel_immediately")
  return actions
}

describe("planTierFromName", () => {
  it.each([
    ["Starter", "starter"],
    ["Professional", "professional"],
    ["Team", "team"],
    ["Enterprise", "enterprise"],
    ["unknown", "free"],
    ["", "free"],
    ["STARTER", "starter"],
    ["professional", "professional"]
  ])("maps %s to %s", (input, expected) => {
    expect(planTierFromName(input)).toBe(expected)
  })
})

describe("computeBillingHealth", () => {
  it.each([
    ["active", false, "healthy"],
    ["active", null, "healthy"],
    ["trialing", false, "healthy"],
    ["trialing", true, "healthy"],
    ["active", true, "at_risk"],
    ["past_due", false, "at_risk"],
    ["past_due", null, "at_risk"],
    ["incomplete", false, "action_needed"],
    ["unpaid", false, "action_needed"],
    ["canceled", false, "inactive"],
    ["incomplete_expired", false, "inactive"],
    ["paused", false, "inactive"]
  ] as const)("status=%s cancelAtPeriodEnd=%s → %s", (status, cap, expected) => {
    expect(computeBillingHealth(status, cap)).toBe(expected)
  })
})

describe("computeDataFreshness", () => {
  it("returns unknown for null", () => {
    expect(computeDataFreshness(null)).toBe("unknown")
  })

  it("returns fresh for recent activity", () => {
    expect(computeDataFreshness(new Date(Date.now() - 30 * 60 * 1000))).toBe("fresh")
  })

  it("returns fresh within 24 hours", () => {
    expect(computeDataFreshness(new Date(Date.now() - 12 * 60 * 60 * 1000))).toBe("fresh")
  })

  it("returns stale after 24 hours", () => {
    expect(computeDataFreshness(new Date(Date.now() - 48 * 60 * 60 * 1000))).toBe("stale")
  })
})

describe("computeAllowedActions", () => {
  it("support can refresh and send portal link for active subs", () => {
    const actions = computeAllowedActions("active", false, "support")
    expect(actions).toContain("refresh")
    expect(actions).toContain("send_billing_portal_link")
    expect(actions).not.toContain("cancel_at_period_end")
  })

  it("admin can cancel at period end for active subs", () => {
    const actions = computeAllowedActions("active", false, "admin")
    expect(actions).toContain("cancel_at_period_end")
    expect(actions).not.toContain("cancel_immediately")
  })

  it("admin can reactivate scheduled cancellation", () => {
    const actions = computeAllowedActions("active", true, "admin")
    expect(actions).toContain("reactivate")
    expect(actions).not.toContain("cancel_at_period_end")
  })

  it("owner has all actions for active subs", () => {
    const actions = computeAllowedActions("active", false, "owner")
    expect(actions).toContain("refresh")
    expect(actions).toContain("send_billing_portal_link")
    expect(actions).toContain("cancel_at_period_end")
    expect(actions).toContain("cancel_immediately")
  })

  it("regular member gets no actions", () => {
    expect(computeAllowedActions("active", false, "member")).toHaveLength(0)
  })

  it("canceled subs only allow refresh", () => {
    const actions = computeAllowedActions("canceled", false, "admin")
    expect(actions).toContain("refresh")
    expect(actions).not.toContain("send_billing_portal_link")
  })
})

// ---- Part 2: billingService method tests (with mocked DB) ----

describe("billingService.getOverview", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns billing overview with status counts", async () => {
    // getOverview calls select().from().groupBy() then select().from() twice more
    // We need to return correct chain results for each call

    // Call 1: status counts with groupBy
    // Call 2: org count
    // Call 3: orgs with subscription count
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([
            { status: "active", count: 10 },
            { status: "trialing", count: 3 },
            { status: "past_due", count: 1 },
            { status: "canceled", count: 5 }
          ])
        })
      })
      .mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([{ count: 20 }])
      })
      .mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([{ count: 15 }])
      })

    // Last sync query
    mockDbQuery.billingSyncLog.findFirst.mockResolvedValue({
      completedAt: new Date("2025-03-18T10:00:00Z")
    })

    const result = await billingService.getOverview()

    expect(result.statuses.active).toBe(10)
    expect(result.statuses.trialing).toBe(3)
    expect(result.statuses.pastDue).toBe(1)
    expect(result.statuses.canceled).toBe(5)
    expect(result.totalOrganizations).toBe(20)
    expect(result.noSubscription).toBe(5) // 20 - 15
    expect(result.lastSyncedAt).toBe("2025-03-18T10:00:00.000Z")
  })
})

describe("billingService.getOrganizationBilling", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns no subscription for org without one", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue(null)

    const result = await billingService.getOrganizationBilling("org-123")

    expect(result.hasSubscription).toBe(false)
    expect(result.subscription).toBeNull()
    expect(result.planTier).toBe("free")
    expect(result.billingHealth).toBe("inactive")
  })

  it("returns subscription data for org with active sub", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue({
      id: "sub-1",
      plan: "Professional",
      status: "active",
      periodEnd: new Date("2025-04-01"),
      cancelAtPeriodEnd: false,
      billingInterval: "month",
      referenceId: "org-123"
    })

    const result = await billingService.getOrganizationBilling("org-123")

    expect(result.hasSubscription).toBe(true)
    expect(result.subscription?.plan).toBe("Professional")
    expect(result.planTier).toBe("professional")
    expect(result.billingHealth).toBe("healthy")
  })

  it("returns at_risk health for canceling subscription", async () => {
    mockDbQuery.subscription.findFirst.mockResolvedValue({
      id: "sub-1",
      plan: "Starter",
      status: "active",
      periodEnd: new Date("2025-04-01"),
      cancelAtPeriodEnd: true,
      billingInterval: "month",
      referenceId: "org-123"
    })

    const result = await billingService.getOrganizationBilling("org-123")

    expect(result.billingHealth).toBe("at_risk")
  })
})

describe("billingService.getPlans", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns active plans ordered by amount", async () => {
    const mockPlans = [
      { id: "1", name: "Starter", amount: 2900, active: true },
      { id: "2", name: "Professional", amount: 7900, active: true }
    ]
    mockDbQuery.stripePlan.findMany.mockResolvedValue(mockPlans)

    const result = await billingService.getPlans()

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe("Starter")
    expect(result[1].name).toBe("Professional")
  })

  it("returns empty list when no active plans", async () => {
    mockDbQuery.stripePlan.findMany.mockResolvedValue([])

    const result = await billingService.getPlans()
    expect(result).toHaveLength(0)
  })
})

describe("billingService.recordActivity", () => {
  beforeEach(() => vi.clearAllMocks())

  it("inserts activity with all fields", async () => {
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined)
    })

    await billingService.recordActivity({
      subscriptionId: "sub-1",
      type: "admin_action",
      description: "Cancelled at period end",
      actorId: "admin-1",
      metadata: { reason: "Customer request" }
    })

    expect(mockDbInsert).toHaveBeenCalled()
  })

  it("handles optional actorId and metadata", async () => {
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined)
    })

    await billingService.recordActivity({
      subscriptionId: "sub-1",
      type: "lifecycle",
      description: "Subscription activated via webhook"
    })

    expect(mockDbInsert).toHaveBeenCalled()
  })
})
