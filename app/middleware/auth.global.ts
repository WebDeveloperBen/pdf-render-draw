export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await authClient.useSession(useFetch)

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/share/"]

  // Guest routes - require authentication but accessible to guest users
  const guestRoutes = ["/g"]

  // Check route types
  const isPublicRoute = publicRoutes.some((route) => to.path.startsWith(route))
  const isGuestRoute = guestRoutes.some((route) => to.path.startsWith(route))

  // If user is authenticated and trying to access login, redirect appropriately
  if (session.value && to.path.startsWith("/login")) {
    // Guest users go to guest dashboard, regular users go to main dashboard
    if (session.value.user.isGuest) {
      return navigateTo("/g")
    }
    return navigateTo("/")
  }

  // Guest routes require authentication
  if (isGuestRoute && !session.value) {
    return navigateTo("/login")
  }

  // Guest users can only access guest routes and public routes
  if (session.value?.user.isGuest && !isGuestRoute && !isPublicRoute) {
    return navigateTo("/g")
  }

  // If user is not authenticated and trying to access protected routes, redirect to login
  if (!session.value && !isPublicRoute) {
    return navigateTo("/login")
  }
})
