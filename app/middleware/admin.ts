import { authClient } from "~/utils/auth-client"

/**
 * Middleware to protect admin routes
 * Only allows users with platform admin access (MetreMate staff) to access
 */
export default defineNuxtRouteMiddleware(async () => {
  const session = authClient.useSession()

  // Wait for session to load
  if (session.value?.isPending) {
    await new Promise<void>((resolve) => {
      const unwatch = watch(
        () => session.value?.isPending,
        (isPending) => {
          if (!isPending) {
            unwatch()
            resolve()
          }
        },
        { immediate: true }
      )
    })
  }

  const user = session.value?.data?.user

  // Not logged in
  if (!user) {
    return navigateTo("/login")
  }

  // Fetch and check platform admin status
  const { fetchPlatformAdminStatus } = usePermissions()
  const status = await fetchPlatformAdminStatus()

  if (!status.isPlatformAdmin) {
    return navigateTo("/")
  }
})
