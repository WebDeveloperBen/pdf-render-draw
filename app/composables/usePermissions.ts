import { authClient } from "~/utils/auth-client"
import type { statements } from "../../shared/auth/access-control"

type Statements = typeof statements
type Resource = keyof Statements
type Action<R extends Resource> = Statements[R][number]

type PermissionCheck = {
  [K in Resource]?: Action<K>[]
}

/**
 * Composable for checking user permissions in the frontend
 * Uses better-auth's organization access control system
 */
export function usePermissions() {
  const sessionRef = authClient.useSession()
  const session = computed(() => sessionRef.value?.data)

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

  return {
    hasPermission,
    checkRolePermission,
    currentRole,
    projectPermissions,
    can
  }
}
