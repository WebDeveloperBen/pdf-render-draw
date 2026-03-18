import { describe, it, expect, vi, beforeEach } from "vitest"
import { FREE_TIER_LIMITS, FREE_TIER_FEATURES } from "@shared/types/billing"
import type { OrgBillingContext } from "./billing.types"

// Use vi.hoisted() so mock references are available inside vi.mock() factories
const { mockRequireAuth, mockDbSelect } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockDbSelect: vi.fn()
}))

// Mock requireAuth — auto-imported global in the source
vi.stubGlobal("requireAuth", mockRequireAuth)

vi.mock("../../utils/drizzle", () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args)
  }
}))

vi.mock("@shared/db/schema", () => ({
  project: { organizationId: "organizationId" }
}))

import {
  getOrgBillingContext,
  requirePlan,
  requireFeatureAccess,
  requireProjectQuota,
  requireFileSizeLimit
} from "./billing.guards"

// Mock createError (auto-imported from h3 in the source)
vi.stubGlobal(
  "createError",
  (opts: { statusCode: number; statusMessage: string }) => {
    const err = new Error(opts.statusMessage) as Error & { statusCode: number }
    err.statusCode = opts.statusCode
    return err
  }
)

function mockEvent() {
  return { headers: new Headers(), context: {} } as any
}

function freeBilling(): OrgBillingContext {
  return {
    orgId: "org-123",
    planName: "free",
    limits: FREE_TIER_LIMITS,
    features: FREE_TIER_FEATURES,
    subscriptionStatus: null
  }
}

function setupAuth(billing: Partial<OrgBillingContext> = {}, userId = "user-1", orgId: string | null = "org-123") {
  const ctx = {
    session: { session: { activeOrganizationId: orgId } },
    user: { id: userId, email: "test@test.com" },
    orgId,
    billing: { ...freeBilling(), ...billing }
  }
  mockRequireAuth.mockResolvedValue(ctx)
  return ctx
}

function setupNoSession() {
  mockRequireAuth.mockRejectedValue(
    Object.assign(new Error("Unauthorized"), { statusCode: 401 })
  )
}

describe("getOrgBillingContext", () => {
  beforeEach(() => vi.clearAllMocks())

  it("throws 401 when no session", async () => {
    setupNoSession()
    await expect(getOrgBillingContext(mockEvent())).rejects.toThrow("Unauthorized")
  })

  it("returns free tier when no active org", async () => {
    setupAuth({ orgId: "", planName: "free" }, "user-1", null)
    const ctx = await getOrgBillingContext(mockEvent())
    expect(ctx.planName).toBe("free")
    expect(ctx.limits).toEqual(FREE_TIER_LIMITS)
  })

  it("returns plan data from cached billing context", async () => {
    setupAuth({
      planName: "professional",
      limits: { projects: -1, storageMb: 500, fileSizeMb: 50 },
      features: {
        exportFormats: ["pdf", "png", "svg"],
        measurementTools: "all",
        cloudSync: true,
        collaboration: false,
        customBranding: false,
        measurementPresets: true
      },
      subscriptionStatus: "active"
    })

    const ctx = await getOrgBillingContext(mockEvent())
    expect(ctx.planName).toBe("professional")
    expect(ctx.limits.projects).toBe(-1)
    expect(ctx.features.cloudSync).toBe(true)
  })
})

describe("requirePlan", () => {
  beforeEach(() => vi.clearAllMocks())

  it("allows access when plan meets minimum", async () => {
    setupAuth({ planName: "professional" })
    const ctx = await requirePlan(mockEvent(), "starter")
    expect(ctx.planName).toBe("professional")
  })

  it("allows access when plan equals minimum", async () => {
    setupAuth({ planName: "starter" })
    const ctx = await requirePlan(mockEvent(), "starter")
    expect(ctx.planName).toBe("starter")
  })

  it("throws 403 when plan is below minimum", async () => {
    setupAuth({ planName: "free" })
    await expect(requirePlan(mockEvent(), "starter")).rejects.toThrow(/requires the starter plan/)
  })

  it("throws 403 for free user requiring professional", async () => {
    setupAuth({ planName: "free" })
    await expect(requirePlan(mockEvent(), "professional")).rejects.toThrow(/requires the professional plan/)
  })
})

describe("requireFeatureAccess", () => {
  beforeEach(() => vi.clearAllMocks())

  it("allows access when boolean feature is true", async () => {
    setupAuth({
      features: { ...FREE_TIER_FEATURES, cloudSync: true }
    })
    const ctx = await requireFeatureAccess(mockEvent(), "cloudSync")
    expect(ctx.features.cloudSync).toBe(true)
  })

  it("throws 403 when boolean feature is false", async () => {
    setupAuth() // free tier, cloudSync = false
    await expect(requireFeatureAccess(mockEvent(), "cloudSync")).rejects.toThrow(/does not include cloudSync/)
  })

  it("allows access when measurementTools is 'all'", async () => {
    setupAuth({
      features: { ...FREE_TIER_FEATURES, measurementTools: "all" }
    })
    const ctx = await requireFeatureAccess(mockEvent(), "measurementTools")
    expect(ctx.features.measurementTools).toBe("all")
  })

  it("throws 403 when measurementTools is 'basic'", async () => {
    setupAuth() // free tier, measurementTools = "basic"
    await expect(requireFeatureAccess(mockEvent(), "measurementTools")).rejects.toThrow(/does not include measurementTools/)
  })

  it("allows access when exportFormats has multiple items", async () => {
    setupAuth({
      features: { ...FREE_TIER_FEATURES, exportFormats: ["pdf", "png", "svg"] }
    })
    const ctx = await requireFeatureAccess(mockEvent(), "exportFormats")
    expect(ctx.features.exportFormats).toEqual(["pdf", "png", "svg"])
  })

  it("throws 403 when exportFormats has only one item", async () => {
    setupAuth() // free tier, exportFormats = ["pdf"]
    await expect(requireFeatureAccess(mockEvent(), "exportFormats")).rejects.toThrow(/does not include exportFormats/)
  })
})

describe("requireProjectQuota", () => {
  beforeEach(() => vi.clearAllMocks())

  it("passes when under the limit", async () => {
    setupAuth({ planName: "free", limits: { ...FREE_TIER_LIMITS, projects: 1 } })

    const mockWhere = vi.fn().mockResolvedValue([{ count: 0 }])
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    mockDbSelect.mockReturnValue({ from: mockFrom })

    const ctx = await requireProjectQuota(mockEvent())
    expect(ctx.planName).toBe("free")
  })

  it("throws 403 when at the limit", async () => {
    setupAuth({ planName: "free", limits: { ...FREE_TIER_LIMITS, projects: 1 } })

    const mockWhere = vi.fn().mockResolvedValue([{ count: 1 }])
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    mockDbSelect.mockReturnValue({ from: mockFrom })

    await expect(requireProjectQuota(mockEvent())).rejects.toThrow(/Project limit reached/)
  })

  it("passes when limit is unlimited (-1)", async () => {
    setupAuth({ limits: { projects: -1, storageMb: 500, fileSizeMb: 50 } })

    const ctx = await requireProjectQuota(mockEvent())
    expect(ctx.limits.projects).toBe(-1)
    expect(mockDbSelect).not.toHaveBeenCalled()
  })
})

describe("requireFileSizeLimit", () => {
  it("passes when file is under the limit", () => {
    const ctx = freeBilling()
    ctx.limits = { projects: 5, storageMb: 100, fileSizeMb: 25 }
    expect(() => requireFileSizeLimit(ctx, 10 * 1024 * 1024)).not.toThrow()
  })

  it("throws 413 when file exceeds the limit", () => {
    const ctx = freeBilling()
    expect(() => requireFileSizeLimit(ctx, 15 * 1024 * 1024)).toThrow(
      /File size exceeds your plan limit of 10 MB/
    )
  })

  it("allows exactly at the limit", () => {
    const ctx = freeBilling()
    ctx.limits = { projects: 5, storageMb: 100, fileSizeMb: 25 }
    expect(() => requireFileSizeLimit(ctx, 25 * 1024 * 1024)).not.toThrow()
  })

  it("throws for 1 byte over the limit", () => {
    const ctx = freeBilling()
    expect(() => requireFileSizeLimit(ctx, 10 * 1024 * 1024 + 1)).toThrow()
  })

  it("includes plan limit in error message", () => {
    const ctx = freeBilling()
    ctx.limits = { projects: 5, storageMb: 100, fileSizeMb: 25 }
    expect(() => requireFileSizeLimit(ctx, 30 * 1024 * 1024)).toThrow(/25 MB/)
  })
})

describe("requirePlan - tier boundaries", () => {
  beforeEach(() => vi.clearAllMocks())

  it("starter can access starter-gated features", async () => {
    setupAuth({ planName: "starter" })
    const ctx = await requirePlan(mockEvent(), "starter")
    expect(ctx.planName).toBe("starter")
  })

  it("professional can access starter-gated features", async () => {
    setupAuth({ planName: "professional" })
    const ctx = await requirePlan(mockEvent(), "starter")
    expect(ctx.planName).toBe("professional")
  })

  it("team can access professional-gated features", async () => {
    setupAuth({ planName: "team" })
    const ctx = await requirePlan(mockEvent(), "professional")
    expect(ctx.planName).toBe("team")
  })

  it("starter cannot access professional-gated features", async () => {
    setupAuth({ planName: "starter" })
    await expect(requirePlan(mockEvent(), "professional")).rejects.toThrow(
      /requires the professional plan/
    )
  })

  it("free cannot access any paid-gated features", async () => {
    setupAuth({ planName: "free" })
    await expect(requirePlan(mockEvent(), "starter")).rejects.toThrow(/requires the starter plan/)
  })

  it("enterprise can access all plan gates", async () => {
    setupAuth({ planName: "enterprise" })
    const ctx = await requirePlan(mockEvent(), "team")
    expect(ctx.planName).toBe("enterprise")
  })

  it("handles unknown plan name (defaults to free tier)", async () => {
    setupAuth({ planName: "unknownplan" })
    await expect(requirePlan(mockEvent(), "starter")).rejects.toThrow(/requires the starter plan/)
  })
})
