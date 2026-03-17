/**
 * Composable for authentication flows.
 *
 * Provides helpers for sign-in, sign-out, and session management
 * that handle SSR/hydration concerns properly.
 */
export function useAuth() {
  /**
   * Redirect after successful authentication.
   * Fetches fresh session to determine the correct destination.
   * Respects a `redirect` query param if present (set by auth middleware).
   */
  const redirectAfterAuth = async (defaultPath = "/") => {
    const { data: session } = await authClient.getSession()
    const route = useRoute()
    const redirectTo = (route.query.redirect as string) || defaultPath

    if (session?.user?.isGuest) {
      await navigateTo("/g")
    } else {
      // Only allow relative redirects to prevent open redirect attacks
      const safePath = redirectTo.startsWith("/") ? redirectTo : defaultPath
      await navigateTo(safePath)
    }
  }

  /**
   * Sign out and redirect to login.
   * Uses external navigation to force a full page reload,
   * preventing hydration mismatches from stale session state.
   */
  const signOut = async () => {
    await authClient.signOut()
    await navigateTo("/login", { external: true })
  }

  return {
    redirectAfterAuth,
    signOut
  }
}
