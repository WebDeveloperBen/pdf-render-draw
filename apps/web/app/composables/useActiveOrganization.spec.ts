import { beforeEach, describe, expect, it, vi } from "vitest"
import { ref } from "vue"

const mockState = {
  activeOrganization: null as any,
  organizations: [] as Array<{ id: string; name: string }>,
  session: null as any,
  setActive: vi.fn(),
  list: vi.fn(),
  getFullOrganization: vi.fn(),
  create: vi.fn()
}

vi.mock("~/utils/auth-client", () => ({
  authClient: {
    useActiveOrganization: () => ref(mockState.activeOrganization),
    useListOrganizations: () => ref({ data: mockState.organizations }),
    useSession: (...args: unknown[]) => (args.length > 0 ? { data: ref(null) } : ref(mockState.session)),
    organization: {
      list: (...args: unknown[]) => mockState.list(...args),
      getFullOrganization: (...args: unknown[]) => mockState.getFullOrganization(...args),
      setActive: (...args: unknown[]) => mockState.setActive(...args),
      create: (...args: unknown[]) => mockState.create(...args)
    }
  }
}))

import { useActiveOrganization } from "./useActiveOrganization"

describe("useActiveOrganization", () => {
  beforeEach(() => {
    mockState.activeOrganization = null
    mockState.organizations = []
    mockState.session = null
    mockState.setActive.mockReset()
    mockState.list.mockReset()
    mockState.getFullOrganization.mockReset()
    mockState.create.mockReset()
    mockState.list.mockResolvedValue({ data: mockState.organizations })
    mockState.getFullOrganization.mockResolvedValue(undefined)
    mockState.setActive.mockResolvedValue(undefined)
    mockState.create.mockResolvedValue({ data: { id: "org-created" } })
  })

  it("selects the first organisation when none is active", async () => {
    mockState.organizations = [
      { id: "org-1", name: "Acme" },
      { id: "org-2", name: "Demo" }
    ]
    mockState.list.mockResolvedValue({ data: mockState.organizations })

    const organization = useActiveOrganization()
    await organization.ensureActiveOrganization()

    expect(mockState.setActive).toHaveBeenCalledWith({ organizationId: "org-1" })
  })

  it("does not switch when the current active organisation is still valid", async () => {
    mockState.activeOrganization = {
      data: {
        id: "org-2",
        name: "Demo",
        members: [{ userId: "user-1", role: "admin" }]
      }
    }
    mockState.organizations = [
      { id: "org-1", name: "Acme" },
      { id: "org-2", name: "Demo" }
    ]
    mockState.session = {
      data: {
        user: {
          id: "user-1"
        }
      }
    }
    mockState.list.mockResolvedValue({ data: mockState.organizations })

    const organization = useActiveOrganization()
    await organization.ensureActiveOrganization()

    expect(mockState.setActive).not.toHaveBeenCalled()
    expect(organization.isOrgAdmin.value).toBe(true)
    expect(organization.workspaceName.value).toBe("Demo")
  })

  it("refreshes both list and active organisation state together", async () => {
    mockState.activeOrganization = {
      data: {
        id: "org-1"
      }
    }

    const organization = useActiveOrganization()
    await organization.refreshAll()

    expect(mockState.list).toHaveBeenCalled()
    expect(mockState.getFullOrganization).toHaveBeenCalledWith({
      query: { organizationId: "org-1" }
    })
  })
})
