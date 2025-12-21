/**
 * Middleware to protect admin routes
 * Only allows users with platform admin access to access
 */
export default defineNuxtRouteMiddleware(async () => {
  // Use useFetch for proper SSR support (same pattern as auth.global.ts)
  const { data: session } = await authClient.useSession(useFetch)

  // Not logged in
  if (!session.value?.user) {
    return navigateTo("/login")
  }

  try {
    const { data: result, error } = await authClient.platformAdmin.getStatus(useFetch)

    if (error.value || !result.value?.isPlatformAdmin) {
      return navigateTo("/")
    }

    // Cache the result in useState for the layout/pages to use
    const platformAdminStatus = useState("platformAdminStatus", () => result.value)
    platformAdminStatus.value = result.value
  } catch {
    return navigateTo("/")
  }
})
