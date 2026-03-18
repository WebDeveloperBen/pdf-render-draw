import type { H3Event } from "h3"
import { eq, count } from "drizzle-orm"
import { db } from "../../utils/drizzle"
import * as schema from "@shared/db/schema"
import type { PlanFeatures } from "@shared/types/billing"
import type { OrgBillingContext } from "./billing.types"

// Re-export for consumers
export type { OrgBillingContext } from "./billing.types"

// ---- Plan tier hierarchy ----

const PLAN_TIERS: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  team: 3,
  enterprise: 4
}

// ---- Guards (read from cached auth context) ----

/**
 * Get the billing context from the cached auth context.
 * Requires requireAuth() to have been called first (which it always is via auto-caching).
 */
export async function getOrgBillingContext(event: H3Event): Promise<OrgBillingContext> {
  const { billing } = await requireAuth(event)
  return billing
}

/**
 * Require a minimum plan tier. Throws 403 if the org's plan is below the required tier.
 */
export async function requirePlan(event: H3Event, minimumPlan: string): Promise<OrgBillingContext> {
  const { billing } = await requireAuth(event)
  const currentTier = PLAN_TIERS[billing.planName] ?? 0
  const requiredTier = PLAN_TIERS[minimumPlan] ?? 0

  if (currentTier < requiredTier) {
    throw createError({
      statusCode: 403,
      statusMessage: `This feature requires the ${minimumPlan} plan or higher. Current plan: ${billing.planName}`
    })
  }

  return billing
}

/**
 * Require a specific feature to be enabled on the current plan.
 */
export async function requireFeatureAccess(event: H3Event, feature: keyof PlanFeatures): Promise<OrgBillingContext> {
  const { billing } = await requireAuth(event)
  const val = billing.features[feature]

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

  return billing
}

/**
 * Check if the org has reached its project limit.
 * Call this before creating a new project.
 */
export async function requireProjectQuota(event: H3Event): Promise<OrgBillingContext> {
  const { billing } = await requireAuth(event)

  if (billing.limits.projects === -1) return billing // unlimited

  const [result] = await db
    .select({ count: count() })
    .from(schema.project)
    .where(eq(schema.project.organizationId, billing.orgId))

  if ((result?.count ?? 0) >= billing.limits.projects) {
    throw createError({
      statusCode: 403,
      statusMessage: `Project limit reached (${billing.limits.projects}). Please upgrade your plan.`
    })
  }

  return billing
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
