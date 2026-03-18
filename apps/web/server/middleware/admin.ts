/**
 * Server middleware: enforce platform admin access for all /api/admin/* routes.
 * Runs on every request but exits immediately for non-admin paths.
 * Individual routes that need a higher tier (admin, owner) still call
 * requirePlatformAdminTier() per-route — the session is already cached.
 */
export default defineEventHandler(async (event) => {
  if (!event.path.startsWith("/api/admin")) return

  await requirePlatformAdmin(event)
})
