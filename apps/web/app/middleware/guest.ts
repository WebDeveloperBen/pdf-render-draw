/**
 * Guest middleware - verifies the user has access to guest content
 * Can be used on individual pages that need guest-specific checks
 */
export default defineNuxtRouteMiddleware(async () => {
  const { data: session } = await authClient.useSession(useFetch)

  // Must be authenticated
  if (!session.value) {
    return navigateTo("/login")
  }

  // Guest users are always allowed on guest routes
  // Regular users can also access guest routes (to view shares they received)
  // No additional restrictions needed here - the API handles access control
})
