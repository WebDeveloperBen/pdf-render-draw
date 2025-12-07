export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await authClient.useSession(useFetch)

  // Public routes that don't require authentication
  const publicRoutes = ["/login"]

  // Check if the current route is public
  const isPublicRoute = publicRoutes.some((route) => to.path.startsWith(route))

  // If user is authenticated and trying to access login, redirect to dashboard
  if (session.value && isPublicRoute) {
    return navigateTo("/")
  }

  // If user is not authenticated and trying to access protected routes, redirect to login
  if (!session.value && !isPublicRoute) {
    return navigateTo("/login")
  }
})
