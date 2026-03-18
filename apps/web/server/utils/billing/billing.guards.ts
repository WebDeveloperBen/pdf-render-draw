import type { H3Event } from "h3"
import { eq, and, inArray, count } from "drizzle-orm"
import { auth } from "@auth"
import { db } from "../drizzle"
import * as schema from "@shared/db/schema"
import type { PlanLimits, PlanFeatures } from "@shared/types/billing"
import { FREE_TIER_LIMITS, FREE_TIER_FEATURES } from "@shared/types/billing"
import { parseFeaturesFromMetadata } from "./billing.helpers"

export interface OrgBillingContext {
  orgId: string
  planName: string
  limits: PlanLimits
  features: PlanFeatures
  subscriptionStatus: string | null
}

/**
 * Resolve the billing context for the current user's active organization.
 * Returns plan name, limits, and features — defaults to free tier if no subscription.
 */
export async function getOrgBillingContext(event: H3Event): Promise<OrgBillingContext> {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" })
  }

  const orgId = session.session.activeOrganizationId
  if (!orgId) {
    return {
      orgId: "",
      planName: "free",
      limits: FREE_TIER_LIMITS,
      features: FREE_TIER_FEATURES,
      subscriptionStatus: null
    }
  }

  const orgSub = await db.query.subscription.findFirst({
    where: and(eq(schema.subscription.referenceId, orgId), inArray(schema.subscription.status, ["active", "trialing"]))
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

  const plan = await db.query.stripePlan.findFirst({
    where: eq(schema.stripePlan.name, orgSub.plan)
  })

  const metadata = (plan?.metadata ?? {}) as Record<string, string>

  return {
    orgId,
    planName: orgSub.plan.toLowerCase(),
    limits: plan?.limits ? (plan.limits as PlanLimits) : FREE_TIER_LIMITS,
    features: parseFeaturesFromMetadata(metadata),
    subscriptionStatus: orgSub.status
  }
}

/**
 * Require a minimum plan tier. Throws 403 if the org's plan is below the required tier.
 */
const PLAN_TIERS: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  team: 3,
  enterprise: 4
}

export async function requirePlan(event: H3Event, minimumPlan: string): Promise<OrgBillingContext> {
  const ctx = await getOrgBillingContext(event)
  const currentTier = PLAN_TIERS[ctx.planName] ?? 0
  const requiredTier = PLAN_TIERS[minimumPlan] ?? 0

  if (currentTier < requiredTier) {
    throw createError({
      statusCode: 403,
      statusMessage: `This feature requires the ${minimumPlan} plan or higher. Current plan: ${ctx.planName}`
    })
  }

  return ctx
}

/**
 * Require a specific feature to be enabled on the current plan.
 */
export async function requireFeatureAccess(event: H3Event, feature: keyof PlanFeatures): Promise<OrgBillingContext> {
  const ctx = await getOrgBillingContext(event)
  const val = ctx.features[feature]

  const hasFeature =
    typeof val === "boolean"
      ? val
      : typeof val === "string"
        ? val !== "basic"
        : Array.isArray(val)
          ? val.length > 1
          : false

  if (!hasFeature) {
    throw createError({
      statusCode: 403,
      statusMessage: `Your plan does not include ${String(feature)}. Please upgrade.`
    })
  }

  return ctx
}

/**
 * Check if the org has reached its project limit.
 * Call this before creating a new project.
 */
export async function requireProjectQuota(event: H3Event): Promise<OrgBillingContext> {
  const ctx = await getOrgBillingContext(event)

  if (ctx.limits.projects === -1) return ctx // unlimited

  const [result] = await db
    .select({ count: count() })
    .from(schema.project)
    .where(eq(schema.project.organizationId, ctx.orgId))

  if ((result?.count ?? 0) >= ctx.limits.projects) {
    throw createError({
      statusCode: 403,
      statusMessage: `Project limit reached (${ctx.limits.projects}). Please upgrade your plan.`
    })
  }

  return ctx
}

/**
 * Check file size against plan limit.
 * Call this before accepting a file upload.
 */
export function requireFileSizeLimit(ctx: OrgBillingContext, fileSizeBytes: number): void {
  const limitBytes = ctx.limits.fileSizeMb * 1024 * 1024

  if (fileSizeBytes > limitBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: `File size exceeds your plan limit of ${ctx.limits.fileSizeMb} MB. Please upgrade.`
    })
  }
}
