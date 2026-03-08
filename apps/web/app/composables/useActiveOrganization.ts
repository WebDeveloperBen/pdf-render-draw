/**
 * Composable for managing the active organization context
 * Uses better-auth's organization plugin under the hood
 *
 * Every user has at least one organization (their home org created on signup)
 */
export function useActiveOrganization() {
  // Get the active organization from better-auth
  const activeOrg = authClient.useActiveOrganization()

  // List all organizations the user belongs to
  const organizations = authClient.useListOrganizations()

  // Get current session for user ID
  const session = authClient.useSession()

  // Loading state for switching
  const isSwitching = ref(false)

  /**
   * Refresh the organizations list
   * Call this after accepting invitations, creating orgs, or leaving orgs
   */
  const refreshOrganizations = async () => {
    // The useListOrganizations hook is reactive - calling list() updates it
    await authClient.organization.list()
  }

  /**
   * Refresh the active organization data (including members)
   * Call this after member changes, role updates, etc.
   */
  const refreshActiveOrganization = async () => {
    if (activeOrg.value?.data?.id) {
      await authClient.organization.getFullOrganization({
        query: { organizationId: activeOrg.value.data.id }
      })
    }
  }

  /**
   * Refresh all organization-related data
   * Convenience method to invalidate everything
   */
  const refreshAll = async () => {
    await Promise.all([refreshOrganizations(), refreshActiveOrganization()])
  }

  // Switch to a different organization
  const switchOrganization = async (organizationId: string) => {
    isSwitching.value = true
    try {
      await authClient.organization.setActive({
        organizationId
      })
    } finally {
      isSwitching.value = false
    }
  }

  // Auto-select first organization if none is active
  // Uses a flag to prevent concurrent calls from causing loops
  let isEnsuring = false
  const ensureActiveOrganization = async () => {
    // Prevent concurrent/repeated calls
    if (isEnsuring) return
    isEnsuring = true

    try {
      // Fetch organizations list directly to avoid reactivity timing issues
      const orgListResponse = await authClient.organization.list()
      const orgList = orgListResponse.data

      if (!orgList?.length) {
        return // No organizations available
      }

      // Check if we have a valid active organization
      const currentActiveOrg = activeOrg.value?.data
      if (currentActiveOrg?.id) {
        // Verify the active org is still valid (user is still a member)
        const isValidOrg = orgList.some((org) => org.id === currentActiveOrg.id)
        if (isValidOrg) {
          // Already have a valid active org - don't call setActive again
          // This prevents infinite loops from reactive state updates
          return
        }
      }

      // No valid active org - select the first one
      const firstOrg = orgList[0]
      if (firstOrg) {
        await switchOrganization(firstOrg.id)
      }
    } finally {
      isEnsuring = false
    }
  }

  // Create a new organization
  const createOrganization = async (name: string, slug?: string) => {
    const result = await authClient.organization.create({
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, "-")
    })
    return result
  }

  // Get the current user's membership in the active org
  const currentMember = computed(() => {
    const org = activeOrg.value?.data
    const userId = session.value?.data?.user?.id
    if (!org || !userId) return null
    return org.members?.find((m) => m.userId === userId) || null
  })

  // Check if user is owner/admin of active org
  const isOrgAdmin = computed(() => {
    const member = currentMember.value
    if (!member) return false
    return member.role === "owner" || member.role === "admin"
  })

  // Check if user is owner of active org
  const isOrgOwner = computed(() => {
    const member = currentMember.value
    if (!member) return false
    return member.role === "owner"
  })

  // Get a display-friendly name for the current organization
  const workspaceName = computed(() => {
    if (!activeOrg.value?.data) return "Select Organization"
    return activeOrg.value.data.name
  })

  // Check if an organization is currently active
  const hasActiveOrganization = computed(() => {
    return !!activeOrg.value?.data
  })

  // Check if organization data is still loading
  const isLoading = computed(() => {
    return activeOrg.value?.isPending ?? true
  })

  return {
    // State
    activeOrg,
    organizations,
    isSwitching,
    currentMember,

    // Computed
    isOrgAdmin,
    isOrgOwner,
    workspaceName,
    hasActiveOrganization,
    isLoading,

    // Methods
    switchOrganization,
    createOrganization,
    ensureActiveOrganization,

    // Cache invalidation
    refreshOrganizations,
    refreshActiveOrganization,
    refreshAll
  }
}
