import { toWebRequest, type H3Event } from "h3"
import { eq, and, inArray, or } from "drizzle-orm"
import { auth } from "@auth"
import type { statements } from "@shared/auth/access-control"
import { type PlatformAdminTier, TIER_LEVELS, hasTier } from "@shared/auth/plugins/platform-admin"
import type { PlanLimits } from "@shared/types/billing"
import { FREE_TIER_LIMITS, FREE_TIER_FEATURES } from "@shared/types/billing"
import { parseFeaturesFromMetadata } from "../services/billing/billing.helpers"
import type { OrgBillingContext } from "../services/billing/billing.types"

// ---- Types ----

type Statements = typeof statements
type Resource = keyof Statements
type Action<R extends Resource> = Statements[R][number]

type PermissionCheck = {
  [K in Resource]?: Action<K>[]
}

/** Cached auth + billing context attached to every authenticated request. */
export interface AuthContext {
  session: Awaited<ReturnType<typeof auth.api.getSession>>
  user: { id: string; email: string; [key: string]: unknown }
  orgId: string | null
  billing: OrgBillingContext
}

function getAuthHeaders(event: H3Event): Headers {
  try {
    return toWebRequest(event).headers
  } catch {
    if (event.headers instanceof Headers) {
      return event.headers
    }

    return new Headers(event.headers as HeadersInit | undefined)
  }
}

// ---- Core: requireAuth ----

/**
 * Resolve session + billing context once per request, cache on event.context.
 * Every authenticated route should call this instead of auth.api.getSession directly.
 */
export async function requireAuth(event: H3Event): Promise<AuthContext> {
  // Return cached context if already resolved this request
  if (event.context.auth) return event.context.auth as AuthContext

  const session = await auth.api.getSession({ headers: getAuthHeaders(event) })

  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  const orgId = session.session.activeOrganizationId ?? null
  const billing = await resolveBillingContext(orgId)

  const ctx: AuthContext = {
    session,
    user: session.user,
    orgId,
    billing
  }

  event.context.auth = ctx
  return ctx
}

/**
 * Require an active organization. Call after requireAuth when the route needs an org.
 */
export async function requireActiveOrg(event: H3Event): Promise<AuthContext & { orgId: string }> {
  const ctx = await requireAuth(event)

  if (!ctx.orgId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No active organization. Please select an organization."
    })
  }

  return ctx as AuthContext & { orgId: string }
}

// ---- Billing context resolution (DB only, no session) ----

async function resolveBillingContext(orgId: string | null): Promise<OrgBillingContext> {
  if (!orgId) {
    return {
      orgId: "",
      planName: "free",
      limits: FREE_TIER_LIMITS,
      features: FREE_TIER_FEATURES,
      subscriptionStatus: null
    }
  }

  const db = useDrizzle()

  const orgSub = await db.query.subscription.findFirst({
    where: and(eq(subscription.referenceId, orgId), inArray(subscription.status, ["active", "trialing"]))
  })

  if (!orgSub) {
    return {
      orgId,
      planName: "free",
      limits: FREE_TIER_LIMITS,
      features: FREE_TIER_FEATURES,
      subscriptionStatus: null
    }
  }

  const plan =
    (orgSub.stripePriceId
      ? await db.query.stripePlan.findFirst({
          where: or(
            eq(stripePlan.stripePriceId, orgSub.stripePriceId),
            eq(stripePlan.annualDiscountPriceId, orgSub.stripePriceId)
          )
        })
      : null) ??
    (await db.query.stripePlan.findFirst({
      where: eq(stripePlan.name, orgSub.plan)
    }))

  const metadata = (plan?.metadata ?? {}) as Record<string, string>

  return {
    orgId,
    planName: (plan?.name ?? orgSub.plan).toLowerCase(),
    limits: plan?.limits ? (plan.limits as PlanLimits) : FREE_TIER_LIMITS,
    features: parseFeaturesFromMetadata(metadata),
    subscriptionStatus: orgSub.status
  }
}

// ---- RBAC Permissions ----

/**
 * Check if the current user has the specified permissions.
 * Uses better-auth's built-in hasPermission API.
 */
export async function hasPermission(event: H3Event, permissions: PermissionCheck): Promise<boolean> {
  const result = await auth.api.hasPermission({
    headers: getAuthHeaders(event),
    body: { permissions }
  })

  return result?.success ?? false
}

/**
 * Require permission or throw a 403 error.
 */
export async function requirePermission(event: H3Event, permissions: PermissionCheck, message?: string): Promise<void> {
  // Ensure auth context is resolved (cached)
  await requireAuth(event)

  const allowed = await hasPermission(event, permissions)

  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: message || "You don't have permission to perform this action"
    })
  }
}

/**
 * Check if user can perform project actions.
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
 * Get the current user's platform admin record.
 * Uses cached session from requireAuth.
 */
export async function getPlatformAdmin(event: H3Event): Promise<PlatformAdminInfo | null> {
  const { user } = await requireAuth(event)

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
    .where(eq(platformAdmin.userId, user.id))
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
 * Check if the current user is a platform admin (any tier).
 */
export async function isPlatformAdmin(event: H3Event): Promise<boolean> {
  const admin = await getPlatformAdmin(event)
  return admin !== null
}

/**
 * Check if the current user has the specified minimum platform admin tier.
 */
export async function hasPlatformAdminTier(event: H3Event, minimumTier: PlatformAdminTier): Promise<boolean> {
  const admin = await getPlatformAdmin(event)
  if (!admin) return false
  return hasTier(admin.tier, minimumTier)
}

/**
 * Require platform admin or throw a 403 error.
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
 * Require a minimum platform admin tier or throw a 403 error.
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
 * Check if the current user is the platform owner.
 */
export async function isPlatformOwner(event: H3Event): Promise<boolean> {
  return hasPlatformAdminTier(event, "owner")
}

/**
 * Require platform owner or throw a 403 error.
 */
export async function requirePlatformOwner(event: H3Event, message?: string): Promise<void> {
  return requirePlatformAdminTier(event, "owner", message || "Platform owner access required")
}

// Re-export tier utilities for convenience
export { type PlatformAdminTier, TIER_LEVELS, hasTier }
