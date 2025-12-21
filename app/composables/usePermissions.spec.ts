import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ref } from "vue"

// Store mock state in module scope that can be accessed by hoisted mocks
let mockSessionData: {
  value: {
    data: {
      user: {
        id: string
        email: string
        role: string
      }
    } | null
  }
} = {
  value: {
    data: {
      user: {
        id: "user-123",
        email: "test@example.com",
        role: "member"
      }
    }
  }
}

let mockPlatformAdminData = {
  isPlatformAdmin: true,
  tier: "admin" as const,
  grantedAt: new Date(),
  notes: "Test admin"
}

let mockHasPermissionResult = { data: { success: true } }
let mockCheckRolePermissionResult = true

// Track function calls
const mockCalls = {
  invalidateQueries: [] as Array<unknown>,
  removeQueries: [] as Array<unknown>,
  hasPermission: [] as Array<unknown>,
  checkRolePermission: [] as Array<unknown>
}

// Mock vue-query - must be before imports
vi.mock("@tanstack/vue-query", () => ({
  useQuery: vi.fn((options: { enabled?: { value: boolean } }) => {
    const enabled = options.enabled?.value ?? true
    return {
      data: ref(enabled ? mockPlatformAdminData : null),
      isPending: ref(false),
      error: ref(null)
    }
  }),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: (args: unknown) => {
      mockCalls.invalidateQueries.push(args)
    },
    removeQueries: (args: unknown) => {
      mockCalls.removeQueries.push(args)
    }
  }))
}))

// Mock authClient
vi.mock("~/utils/auth-client", () => ({
  authClient: {
    useSession: () => ref(mockSessionData.value),
    platformAdmin: {
      getStatus: vi.fn().mockImplementation(() =>
        Promise.resolve({
          data: mockPlatformAdminData,
          error: null
        })
      )
    },
    organization: {
      hasPermission: vi.fn().mockImplementation((args: unknown) => {
        mockCalls.hasPermission.push(args)
        return Promise.resolve(mockHasPermissionResult)
      }),
      checkRolePermission: vi.fn().mockImplementation((args: unknown) => {
        mockCalls.checkRolePermission.push(args)
        return mockCheckRolePermissionResult
      })
    }
  }
}))

// Import after mocks
import { usePermissions } from "./usePermissions"

describe("usePermissions", () => {
  beforeEach(() => {
    // Reset mock state
    mockSessionData = {
      value: {
        data: {
          user: {
            id: "user-123",
            email: "test@example.com",
            role: "member"
          }
        }
      }
    }
    mockPlatformAdminData = {
      isPlatformAdmin: true,
      tier: "admin",
      grantedAt: new Date(),
      notes: "Test admin"
    }
    mockHasPermissionResult = { data: { success: true } }
    mockCheckRolePermissionResult = true

    // Clear call tracking
    mockCalls.invalidateQueries = []
    mockCalls.removeQueries = []
    mockCalls.hasPermission = []
    mockCalls.checkRolePermission = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Platform Admin Status", () => {
    it("should return isPlatformAdmin as true when user is a platform admin", () => {
      const { isPlatformAdmin } = usePermissions()
      expect(isPlatformAdmin.value).toBe(true)
    })

    it("should return the correct platform admin tier", () => {
      const { platformAdminTier } = usePermissions()
      expect(platformAdminTier.value).toBe("admin")
    })

    it("should expose loading state", () => {
      const { platformAdminLoading } = usePermissions()
      expect(platformAdminLoading.value).toBe(false)
    })

    it("should expose error state as null when no error", () => {
      const { platformAdminError } = usePermissions()
      expect(platformAdminError.value).toBeNull()
    })
  })

  describe("Tier Checks", () => {
    it("should correctly check if user has at least viewer tier", () => {
      const { hasPlatformAdminTier, isPlatformViewer } = usePermissions()
      expect(hasPlatformAdminTier("viewer")).toBe(true)
      expect(isPlatformViewer.value).toBe(true)
    })

    it("should correctly check if user has at least support tier", () => {
      const { hasPlatformAdminTier, isPlatformSupport } = usePermissions()
      expect(hasPlatformAdminTier("support")).toBe(true)
      expect(isPlatformSupport.value).toBe(true)
    })

    it("should correctly check if user has at least admin tier", () => {
      const { hasPlatformAdminTier, isPlatformAdminTier } = usePermissions()
      expect(hasPlatformAdminTier("admin")).toBe(true)
      expect(isPlatformAdminTier.value).toBe(true)
    })

    it("should return false for owner tier when user is admin", () => {
      const { hasPlatformAdminTier, isPlatformOwner } = usePermissions()
      expect(hasPlatformAdminTier("owner")).toBe(false)
      expect(isPlatformOwner.value).toBe(false)
    })
  })

  describe("Cache Management", () => {
    it("should call invalidateQueries when refreshing platform admin status", () => {
      const { refreshPlatformAdminStatus } = usePermissions()
      refreshPlatformAdminStatus()
      expect(mockCalls.invalidateQueries).toHaveLength(1)
      expect(mockCalls.invalidateQueries[0]).toEqual({
        queryKey: ["platform-admin-status"]
      })
    })

    it("should call removeQueries when clearing platform admin cache", () => {
      const { clearPlatformAdminCache } = usePermissions()
      clearPlatformAdminCache()
      expect(mockCalls.removeQueries).toHaveLength(1)
      expect(mockCalls.removeQueries[0]).toEqual({
        queryKey: ["platform-admin-status"]
      })
    })
  })

  describe("Organization Permissions", () => {
    it("should check permissions asynchronously", async () => {
      const { hasPermission } = usePermissions()
      const result = await hasPermission({ project: ["create"] })
      expect(result).toBe(true)
      expect(mockCalls.hasPermission).toHaveLength(1)
      expect(mockCalls.hasPermission[0]).toEqual({
        permissions: { project: ["create"] }
      })
    })

    it("should return false when hasPermission fails", async () => {
      mockHasPermissionResult = { data: { success: false } }
      const { hasPermission } = usePermissions()
      const result = await hasPermission({ project: ["delete"] })
      expect(result).toBe(false)
    })

    it("should return false when no session exists", async () => {
      mockSessionData = { value: { data: null } }
      const { hasPermission } = usePermissions()
      const result = await hasPermission({ project: ["create"] })
      expect(result).toBe(false)
    })
  })

  describe("Role Permission Checks (sync)", () => {
    it("should check role permissions synchronously", () => {
      const { checkRolePermission } = usePermissions()
      const result = checkRolePermission({ project: ["read"] })
      expect(result).toBe(true)
      expect(mockCalls.checkRolePermission).toHaveLength(1)
      expect(mockCalls.checkRolePermission[0]).toEqual({
        permissions: { project: ["read"] },
        role: "member"
      })
    })

    it("should check permissions with a specific role", () => {
      const { checkRolePermission } = usePermissions()
      checkRolePermission({ project: ["delete"] }, "admin")
      expect(mockCalls.checkRolePermission[0]).toEqual({
        permissions: { project: ["delete"] },
        role: "admin"
      })
    })
  })

  describe("Current Role", () => {
    it("should return current user role from session", () => {
      const { currentRole } = usePermissions()
      expect(currentRole.value).toBe("member")
    })

    it("should return 'member' as default when no role in session", () => {
      mockSessionData = {
        value: {
          data: {
            user: {
              id: "user-123",
              email: "test@example.com",
              role: ""
            }
          }
        }
      }
      const { currentRole } = usePermissions()
      // Empty string is falsy, so it defaults to "member"
      expect(currentRole.value).toBe("member")
    })
  })

  describe("Project Permission Helpers", () => {
    it("should provide project permission helper functions", () => {
      const { projectPermissions } = usePermissions()
      expect(projectPermissions.canCreate()).toBe(true)
      expect(projectPermissions.canRead()).toBe(true)
      expect(projectPermissions.canUpdate()).toBe(true)
      expect(projectPermissions.canDelete()).toBe(true)
      expect(projectPermissions.canShare()).toBe(true)
    })

    it("should provide computed permission values", () => {
      const { can } = usePermissions()
      expect(can.createProject.value).toBe(true)
      expect(can.readProject.value).toBe(true)
      expect(can.updateProject.value).toBe(true)
      expect(can.deleteProject.value).toBe(true)
      expect(can.shareProject.value).toBe(true)
    })
  })
})
