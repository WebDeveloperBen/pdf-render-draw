import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetSession = vi.fn()
const mockHasPermission = vi.fn()

vi.mock("@auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      hasPermission: (...args: unknown[]) => mockHasPermission(...args)
    }
  }
}))

import { requireActiveOrg, requireAuth, requirePermission } from "./permissions"

describe("permission helpers", () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    mockHasPermission.mockReset()
  })

  it("caches the resolved auth context on the request event", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com"
      },
      session: {
        activeOrganizationId: null
      }
    })

    const event = {
      context: {},
      headers: new Headers()
    } as never

    const first = await requireAuth(event)
    const second = await requireAuth(event)

    expect(first).toBe(second)
    expect(mockGetSession).toHaveBeenCalledTimes(1)
    expect(first.billing.planName).toBe("free")
  })

  it("rejects routes that require an active organisation", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com"
      },
      session: {
        activeOrganizationId: null
      }
    })

    await expect(
      requireActiveOrg({
        context: {},
        headers: new Headers()
      } as never)
    ).rejects.toMatchObject({
      statusCode: 400
    })
  })

  it("throws a 403 when the permission check fails", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com"
      },
      session: {
        activeOrganizationId: null
      }
    })
    mockHasPermission.mockResolvedValue({ success: false })

    await expect(
      requirePermission(
        {
          context: {},
          headers: new Headers()
        } as never,
        { project: ["delete"] },
        "Delete denied"
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: "Delete denied"
    })
  })
})
