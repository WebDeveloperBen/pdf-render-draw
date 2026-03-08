import { useQuery, useQueryClient } from "@tanstack/vue-query"
import { authClient } from "~/utils/auth-client"
import type { statements } from "@shared/auth/access-control"
import type { PlatformAdminTier } from "@shared/auth/plugins/platform-admin"

type Statements = typeof statements
type Resource = keyof Statements
type Action<R extends Resource> = Statements[R][number]

type PermissionCheck = {
  [K in Resource]?: Action<K>[]
}

// Tier hierarchy for client-side comparison
const TIER_LEVELS: Record<PlatformAdminTier, number> = {
  viewer: 1,
  support: 2,
  admin: 3,
  owner: 4
}

interface PlatformAdminStatus {
  isPlatformAdmin: boolean
  tier: PlatformAdminTier | null
  grantedAt?: Date
  notes?: string
}

const PLATFORM_ADMIN_QUERY_KEY = ["platform-admin-status"] as const

/**
 * Composable for checking user permissions in the frontend
 * Uses better-auth's organization access control system
 */
export function usePermissions() {
  const sessionRef = authClient.useSession()
  const session = computed(() => sessionRef.value?.data)
  const queryClient = useQueryClient()

  // Platform admin status using vue-query
  const {
    data: platformAdminData,
    isPending: platformAdminLoading,
    error: platformAdminQueryError
  } = useQuery({
    queryKey: PLATFORM_ADMIN_QUERY_KEY,
    queryFn: async (): Promise<PlatformAdminStatus> => {
      const result = await authClient.platformAdmin.getStatus()
      if (result.error) {
        throw new Error(result.error.message || "Failed to fetch platform admin status")
      }
      return result.data as PlatformAdminStatus
    },
    // Only fetch when user is authenticated
    enabled: computed(() => !!session.value?.user),
    // Cache for 5 minutes
    staleTime: 5 * 60 * 1000
  })

  // Computed status with default fallback
  const platformAdminStatus = computed<PlatformAdminStatus>(
    () => platformAdminData.value ?? { isPlatformAdmin: false, tier: null }
  )

  const platformAdminError = computed(() =>
    platformAdminQueryError.value ? platformAdminQueryError.value.message : null
  )

  /**
   * Refresh platform admin status (invalidate cache)
   */
  const refreshPlatformAdminStatus = () => {
    queryClient.invalidateQueries({ queryKey: PLATFORM_ADMIN_QUERY_KEY })
  }

  /**
   * Clear the platform admin cache (e.g., on logout)
   */
  const clearPlatformAdminCache = () => {
    queryClient.removeQueries({ queryKey: PLATFORM_ADMIN_QUERY_KEY })
  }

  /**
   * Check if the current user has the specified permissions (async)
   * Makes a server call to verify permissions
   */
  const hasPermission = async (permissions: PermissionCheck): Promise<boolean> => {
    if (!session.value) return false

    try {
      const result = await authClient.organization.hasPermission({
        permissions
      })
      return result?.data?.success ?? false
    } catch {
      return false
    }
  }

  type RoleType = "owner" | "admin" | "member"

  /**
   * Check if a role has the specified permissions (sync)
   * Uses client-side role definitions - no server call
   * Note: Does not work with dynamic roles
   */
  const checkRolePermission = (permissions: PermissionCheck, role?: RoleType): boolean => {
    const userRole: RoleType = role || (session.value?.user?.role as RoleType) || "member"

    return authClient.organization.checkRolePermission({
      permissions,
      role: userRole
    })
  }

  /**
   * Get the current user's role in the active organization
   */
  const currentRole = computed(() => {
    // The role is stored on the member record, not user
    // For now, return the user's global role or default to member
    return session.value?.user?.role || "member"
  })

  // Convenience methods for common permission checks
  const projectPermissions = {
    canCreate: () => checkRolePermission({ project: ["create"] }),
    canRead: () => checkRolePermission({ project: ["read"] }),
    canUpdate: () => checkRolePermission({ project: ["update"] }),
    canDelete: () => checkRolePermission({ project: ["delete"] }),
    canShare: () => checkRolePermission({ project: ["share"] })
  }

  // Computed permissions for reactive UI
  const can = {
    createProject: computed(() => projectPermissions.canCreate()),
    readProject: computed(() => projectPermissions.canRead()),
    updateProject: computed(() => projectPermissions.canUpdate()),
    deleteProject: computed(() => projectPermissions.canDelete()),
    shareProject: computed(() => projectPermissions.canShare())
  }

  // ----- Platform Admin Tier System -----

  /**
   * Check if the current user is a platform admin (any tier)
   */
  const isPlatformAdmin = computed(() => {
    return platformAdminStatus.value.isPlatformAdmin
  })

  /**
   * Get the current user's platform admin tier
   */
  const platformAdminTier = computed(() => {
    return platformAdminStatus.value.tier
  })

  /**
   * Check if user has at least the specified tier
   * @param minimumTier - The minimum tier required (viewer < support < admin < owner)
   */
  const hasPlatformAdminTier = (minimumTier: PlatformAdminTier): boolean => {
    const currentTier = platformAdminStatus.value.tier
    if (!currentTier) return false
    return TIER_LEVELS[currentTier] >= TIER_LEVELS[minimumTier]
  }

  // Convenience computed properties for tier checks
  const isPlatformViewer = computed(() => hasPlatformAdminTier("viewer"))
  const isPlatformSupport = computed(() => hasPlatformAdminTier("support"))
  const isPlatformAdminTierCheck = computed(() => hasPlatformAdminTier("admin"))
  const isPlatformOwner = computed(() => hasPlatformAdminTier("owner"))

  return {
    // Organization permissions
    hasPermission,
    checkRolePermission,
    currentRole,
    projectPermissions,
    can,

    // Platform admin system
    isPlatformAdmin,
    platformAdminTier,
    platformAdminStatus,
    platformAdminLoading,
    platformAdminError,
    refreshPlatformAdminStatus,
    clearPlatformAdminCache,
    hasPlatformAdminTier,

    // Tier convenience computed
    isPlatformViewer,
    isPlatformSupport,
    isPlatformAdminTier: isPlatformAdminTierCheck,
    isPlatformOwner
  }
}
