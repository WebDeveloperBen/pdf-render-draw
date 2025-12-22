import type { H3Event } from "h3"
import { eq } from "drizzle-orm"
import { auth } from "@auth"
import type { statements } from "@shared/auth/access-control"
import { type PlatformAdminTier, TIER_LEVELS, hasTier } from "@shared/auth/plugins/platform-admin"

type Statements = typeof statements
type Resource = keyof Statements
type Action<R extends Resource> = Statements[R][number]

type PermissionCheck = {
  [K in Resource]?: Action<K>[]
}

/**
 * Check if the current user has the specified permissions
 * Uses better-auth's built-in hasPermission API
 */
export async function hasPermission(event: H3Event, permissions: PermissionCheck): Promise<boolean> {
  const result = await auth.api.hasPermission({
    headers: event.headers,
    body: {
      permissions
    }
  })

  return result?.success ?? false
}

/**
 * Require permission or throw a 403 error
 */
export async function requirePermission(event: H3Event, permissions: PermissionCheck, message?: string): Promise<void> {
  const allowed = await hasPermission(event, permissions)

  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: message || "You don't have permission to perform this action"
    })
  }
}

/**
 * Check if user can perform project actions
 */
export const projectPermissions = {
  canCreate: (event: H3Event) => hasPermission(event, { project: ["create"] }),
  canRead: (event: H3Event) => hasPermission(event, { project: ["read"] }),
  canUpdate: (event: H3Event) => hasPermission(event, { project: ["update"] }),
  canDelete: (event: H3Event) => hasPermission(event, { project: ["delete"] }),
  canShare: (event: H3Event) => hasPermission(event, { project: ["share"] })
}

// ----- Platform Admin Tier System -----

export interface PlatformAdminInfo {
  id: string
  userId: string
  tier: PlatformAdminTier
  grantedAt: Date
  notes: string | null
}

/**
 * Get the current user's platform admin record if they are a platform admin
 * Returns null if not authenticated or not a platform admin
 */
export async function getPlatformAdmin(event: H3Event): Promise<PlatformAdminInfo | null> {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user?.id) return null

  const db = useDrizzle()

  const [adminRecord] = await db
    .select({
      id: platformAdmin.id,
      userId: platformAdmin.userId,
      tier: platformAdmin.tier,
      grantedAt: platformAdmin.grantedAt,
      notes: platformAdmin.notes
    })
    .from(platformAdmin)
    .where(eq(platformAdmin.userId, session.user.id))
    .limit(1)

  if (!adminRecord) return null

  return {
    id: adminRecord.id,
    userId: adminRecord.userId,
    tier: adminRecord.tier as PlatformAdminTier,
    grantedAt: adminRecord.grantedAt,
    notes: adminRecord.notes
  }
}

/**
 * Check if the current user is a platform admin (any tier)
 * This checks the platform_admin table
 */
export async function isPlatformAdmin(event: H3Event): Promise<boolean> {
  const admin = await getPlatformAdmin(event)
  return admin !== null
}

/**
 * Check if the current user has the specified minimum platform admin tier
 * @param minimumTier - The minimum tier required (viewer < support < admin < owner)
 */
export async function hasPlatformAdminTier(event: H3Event, minimumTier: PlatformAdminTier): Promise<boolean> {
  const admin = await getPlatformAdmin(event)
  if (!admin) return false
  return hasTier(admin.tier, minimumTier)
}

/**
 * Require platform admin or throw a 403 error
 */
export async function requirePlatformAdmin(event: H3Event, message?: string): Promise<void> {
  const isAdmin = await isPlatformAdmin(event)

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: message || "Platform admin access required"
    })
  }
}

/**
 * Require a minimum platform admin tier or throw a 403 error
 * @param minimumTier - The minimum tier required (viewer < support < admin < owner)
 */
export async function requirePlatformAdminTier(
  event: H3Event,
  minimumTier: PlatformAdminTier,
  message?: string
): Promise<void> {
  const admin = await getPlatformAdmin(event)

  if (!admin) {
    throw createError({
      statusCode: 403,
      statusMessage: message || "Platform admin access required"
    })
  }

  if (!hasTier(admin.tier, minimumTier)) {
    throw createError({
      statusCode: 403,
      statusMessage: message || `${minimumTier} tier or higher required`
    })
  }
}

/**
 * Check if the current user is the platform owner
 */
export async function isPlatformOwner(event: H3Event): Promise<boolean> {
  return hasPlatformAdminTier(event, "owner")
}

/**
 * Require platform owner or throw a 403 error
 */
export async function requirePlatformOwner(event: H3Event, message?: string): Promise<void> {
  return requirePlatformAdminTier(event, "owner", message || "Platform owner access required")
}

// Re-export tier utilities for convenience
export { type PlatformAdminTier, TIER_LEVELS, hasTier }
