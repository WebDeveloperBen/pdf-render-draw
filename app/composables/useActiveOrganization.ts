/**
 * Composable for managing the active organization context
 * Uses better-auth's organization plugin under the hood
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

  // Switch to a different organization
  const switchOrganization = async (organizationId: string | null) => {
    isSwitching.value = true
    try {
      if (organizationId) {
        await authClient.organization.setActive({
          organizationId
        })
      } else {
        // Clear active organization (switch to personal workspace)
        await authClient.organization.setActive({})
      }
    } finally {
      isSwitching.value = false
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

  // Get a display-friendly name for the current workspace
  const workspaceName = computed(() => {
    if (!activeOrg.value?.data) return "Personal Workspace"
    return activeOrg.value.data.name
  })

  // Check if currently in personal workspace (no active org)
  const isPersonalWorkspace = computed(() => {
    return !activeOrg.value?.data
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
    isPersonalWorkspace,

    // Methods
    switchOrganization,
    createOrganization
  }
}
