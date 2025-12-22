export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await authClient.useSession(useFetch)

  // Auth routes - public but redirect authenticated users away
  const authRoutes = ["/login", "/register"]

  // Public routes that don't require authentication
  const publicRoutes = [...authRoutes, "/share/"]

  // Guest routes - require authentication but accessible to guest users
  const guestRoutes = ["/g"]

  // Check route types
  const isAuthRoute = authRoutes.some((route) => to.path.startsWith(route))
  const isPublicRoute = publicRoutes.some((route) => to.path.startsWith(route))
  const isGuestRoute = guestRoutes.some((route) => to.path.startsWith(route))

  // If user is authenticated and trying to access auth routes, redirect appropriately
  if (session.value && isAuthRoute) {
    // Guest users go to guest dashboard, regular users go to main dashboard
    if (session.value.user.isGuest) {
      return await navigateTo("/g")
    }
    return await navigateTo("/")
  }

  // Guest routes require authentication
  if (isGuestRoute && !session.value) {
    return await navigateTo("/login")
  }

  // Guest users can only access guest routes and public routes
  if (session.value?.user.isGuest && !isGuestRoute && !isPublicRoute) {
    return await navigateTo("/g")
  }

  // If user is not authenticated and trying to access protected routes, redirect to login
  if (!session.value && !isPublicRoute) {
    return await navigateTo("/login")
  }
})
