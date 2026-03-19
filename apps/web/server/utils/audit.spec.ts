import { beforeEach, describe, expect, it, vi } from "vitest"

const mockState = vi.hoisted(() => {
  const values = vi.fn()
  const insert = vi.fn(() => ({
    values
  }))

  return {
    insert,
    values
  }
})

vi.mock("nanoid", () => ({
  nanoid: () => "audit-log-id"
}))

vi.mock("./drizzle", () => ({
  db: {
    insert: mockState.insert
  }
}))

vi.mock("@shared/db/schema", () => ({
  adminAuditLog: Symbol("adminAuditLog")
}))

import { logAdminAction, logAdminActionFromEvent } from "./audit"

describe("audit helpers", () => {
  beforeEach(() => {
    mockState.insert.mockClear()
    mockState.values.mockClear()
  })

  it("writes a normalised admin audit log entry", async () => {
    await logAdminAction({
      adminId: "admin-1",
      actionType: "user.deleted",
      targetUserId: "user-2",
      metadata: { reason: "duplicate" }
    })

    expect(mockState.insert).toHaveBeenCalledTimes(1)
    expect(mockState.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "audit-log-id",
        adminId: "admin-1",
        actionType: "user.deleted",
        targetUserId: "user-2",
        targetOrgId: null,
        metadata: JSON.stringify({ reason: "duplicate" }),
        ipAddress: null,
        userAgent: null,
        createdAt: expect.any(Date)
      })
    )
  })

  it("derives request metadata from the H3 event", async () => {
    vi.stubGlobal("getRequestIP", () => "203.0.113.10")
    vi.stubGlobal("getRequestHeader", (_event: unknown, name: string) =>
      name === "user-agent" ? "Vitest Browser" : null
    )

    await logAdminActionFromEvent({} as never, {
      adminId: "admin-1",
      actionType: "subscription.refreshed",
      targetOrgId: "org-7"
    })

    expect(mockState.values).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin-1",
        actionType: "subscription.refreshed",
        targetOrgId: "org-7",
        ipAddress: "203.0.113.10",
        userAgent: "Vitest Browser"
      })
    )
  })
})
