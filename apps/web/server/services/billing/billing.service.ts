import { eq, and, count, sql, like, or, inArray, desc } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "../../utils/drizzle"
import * as schema from "@shared/db/schema"
import type {
  PlanTier,
  BillingHealth,
  DataFreshness,
  AllowedAction,
  BillingOverview,
  SubscriptionListItem,
  SubscriptionDetail,
  SubscriptionListParams,
  BillingPaginationInfo
} from "./billing.types"

// Re-export types for consumers that import from billing.service
export type {
  SubscriptionStatus,
  PlanTier,
  BillingHealth,
  DataFreshness,
  AllowedAction,
  BillingOverview,
  SubscriptionListItem,
  SubscriptionDetail,
  SubscriptionListParams,
  BillingPaginationInfo
} from "./billing.types"

// ---- Helpers ----

function planTierFromName(planName: string): PlanTier {
  const lower = planName.toLowerCase()
  if (lower === "starter") return "starter"
  if (lower === "professional") return "professional"
  if (lower === "team") return "team"
  if (lower === "enterprise") return "enterprise"
  return "free"
}

function computeBillingHealth(status: string, cancelAtPeriodEnd: boolean | null): BillingHealth {
  if (status === "active" && !cancelAtPeriodEnd) return "healthy"
  if (status === "trialing") return "healthy"
  if (status === "active" && cancelAtPeriodEnd) return "at_risk"
  if (status === "past_due") return "at_risk"
  if (status === "incomplete" || status === "unpaid") return "action_needed"
  return "inactive" // canceled, ended, incomplete_expired, paused
}

function computeDataFreshness(lastActivityAt: Date | null): DataFreshness {
  if (!lastActivityAt) return "unknown"
  const hoursSince = (Date.now() - lastActivityAt.getTime()) / (1000 * 60 * 60)
  if (hoursSince < 1) return "fresh"
  if (hoursSince < 24) return "fresh" // Still reasonable
  return "stale"
}

function computeAllowedActions(status: string, cancelAtPeriodEnd: boolean | null, adminTier: string): AllowedAction[] {
  const actions: AllowedAction[] = []

  // Support+ can refresh
  if (["support", "admin", "owner"].includes(adminTier)) {
    actions.push("refresh")
  }

  // Support+ can send billing portal link for active subs
  if (["support", "admin", "owner"].includes(adminTier) && ["active", "trialing", "past_due"].includes(status)) {
    actions.push("send_billing_portal_link")
  }

  // Admin+ can cancel at period end
  if (["admin", "owner"].includes(adminTier) && ["active", "trialing"].includes(status) && !cancelAtPeriodEnd) {
    actions.push("cancel_at_period_end")
  }

  // Admin+ can reactivate a scheduled cancellation
  if (["admin", "owner"].includes(adminTier) && cancelAtPeriodEnd) {
    actions.push("reactivate")
  }

  // Owner only can cancel immediately
  if (adminTier === "owner" && ["active", "trialing", "past_due"].includes(status)) {
    actions.push("cancel_immediately")
  }

  return actions
}

async function findPlanForSubscription(sub: Pick<typeof schema.subscription.$inferSelect, "plan" | "stripePriceId">) {
  return (
    (sub.stripePriceId
      ? await db.query.stripePlan.findFirst({
          where: or(
            eq(schema.stripePlan.stripePriceId, sub.stripePriceId),
            eq(schema.stripePlan.annualDiscountPriceId, sub.stripePriceId)
          )
        })
      : null) ??
    (await db.query.stripePlan.findFirst({
      where: eq(schema.stripePlan.name, sub.plan)
    }))
  )
}

// ---- Service ----

export const billingService = {
  /**
   * Get billing overview metrics for the admin dashboard.
   */
  async getOverview(): Promise<BillingOverview> {
    // Count subscriptions by status
    const statusCounts = await db
      .select({
        status: schema.subscription.status,
        count: count()
      })
      .from(schema.subscription)
      .groupBy(schema.subscription.status)

    const statuses = {
      active: 0,
      trialing: 0,
      pastDue: 0,
      canceled: 0,
      incomplete: 0
    }

    for (const row of statusCounts) {
      if (row.status === "active") statuses.active = row.count
      else if (row.status === "trialing") statuses.trialing = row.count
      else if (row.status === "past_due") statuses.pastDue = row.count
      else if (row.status === "canceled") statuses.canceled = row.count
      else if (row.status === "incomplete" || row.status === "incomplete_expired") statuses.incomplete += row.count
    }

    // Count total organisations
    const [orgCount] = await db.select({ count: count() }).from(schema.organization)

    // Count orgs with at least one subscription
    const [orgsWithSub] = await db
      .select({ count: sql<number>`count(distinct ${schema.subscription.referenceId})` })
      .from(schema.subscription)

    const totalOrganizations = orgCount?.count ?? 0
    const orgsWithSubscriptions = Number(orgsWithSub?.count ?? 0)
    const noSubscription = totalOrganizations - orgsWithSubscriptions

    // Get last sync timestamp
    const lastSync = await db.query.billingSyncLog.findFirst({
      where: eq(schema.billingSyncLog.status, "success"),
      orderBy: desc(schema.billingSyncLog.completedAt)
    })

    return {
      totalOrganizations,
      statuses,
      noSubscription: Math.max(0, noSubscription),
      lastSyncedAt: lastSync?.completedAt?.toISOString() ?? null
    }
  },

  /**
   * List subscriptions with pagination, search, and filters.
   */
  async listSubscriptions(params: SubscriptionListParams): Promise<{
    subscriptions: SubscriptionListItem[]
    pagination: BillingPaginationInfo
  }> {
    const page = params.page ?? 1
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = (page - 1) * limit

    // Build where conditions
    const conditions = []

    if (params.status) {
      const statuses = params.status.split(",").map((s) => s.trim())
      conditions.push(inArray(schema.subscription.status, statuses))
    }

    if (params.plan) {
      conditions.push(eq(schema.subscription.plan, params.plan))
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`
      conditions.push(
        or(
          like(schema.organization.name, searchPattern),
          like(schema.organization.slug, searchPattern),
          like(schema.subscription.stripeSubscriptionId, searchPattern),
          like(schema.subscription.stripeCustomerId, searchPattern)
        )
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Count total
    const [totalResult] = await db
      .select({ count: count() })
      .from(schema.subscription)
      .leftJoin(schema.organization, eq(schema.subscription.referenceId, schema.organization.id))
      .where(whereClause)

    const total = totalResult?.count ?? 0

    // Fetch subscriptions with org data
    const rows = await db
      .select({
        subscription: schema.subscription,
        org: {
          name: schema.organization.name,
          slug: schema.organization.slug,
          logo: schema.organization.logo
        }
      })
      .from(schema.subscription)
      .leftJoin(schema.organization, eq(schema.subscription.referenceId, schema.organization.id))
      .where(whereClause)
      .orderBy(() => {
        const columnMap = {
          periodEnd: schema.subscription.periodEnd,
          organizationName: schema.organization.name,
          status: schema.subscription.status,
          plan: schema.subscription.plan
        } as const
        const col = columnMap[params.sortBy as keyof typeof columnMap] ?? schema.subscription.periodEnd
        return params.sortOrder === "asc" ? sql`${col} asc nulls last` : sql`${col} desc nulls last`
      })
      .limit(limit)
      .offset(offset)

    const subscriptions: SubscriptionListItem[] = rows.map((row) => ({
      id: row.subscription.id,
      stripeSubscriptionId: row.subscription.stripeSubscriptionId,
      referenceId: row.subscription.referenceId,
      organizationName: row.org?.name ?? "Unknown",
      organizationSlug: row.org?.slug ?? "",
      organizationLogo: row.org?.logo ?? null,
      stripeCustomerId: row.subscription.stripeCustomerId,
      plan: row.subscription.plan,
      planTier: planTierFromName(row.subscription.plan),
      status: row.subscription.status,
      periodStart: row.subscription.periodStart?.toISOString() ?? null,
      periodEnd: row.subscription.periodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: row.subscription.cancelAtPeriodEnd,
      billingInterval: row.subscription.billingInterval,
      trialEnd: row.subscription.trialEnd?.toISOString() ?? null
    }))

    return {
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  },

  /**
   * Get full subscription detail for the admin detail page.
   */
  async getSubscriptionDetail(subscriptionId: string, adminTier: string): Promise<SubscriptionDetail | null> {
    const sub = await db.query.subscription.findFirst({
      where: eq(schema.subscription.id, subscriptionId),
      with: {
        organization: true
      }
    })

    if (!sub) return null

    // Get member count
    const [memberCount] = await db
      .select({ count: count() })
      .from(schema.member)
      .where(eq(schema.member.organizationId, sub.referenceId))

    // Get plan info from cache
    const planInfo = await findPlanForSubscription(sub)

    // Get last billing activity for freshness
    const lastActivity = await db.query.billingActivity.findFirst({
      where: eq(schema.billingActivity.subscriptionId, sub.id),
      orderBy: desc(schema.billingActivity.createdAt)
    })

    // Get last webhook activity specifically
    const lastWebhook = await db.query.billingActivity.findFirst({
      where: and(eq(schema.billingActivity.subscriptionId, sub.id), eq(schema.billingActivity.type, "payment")),
      orderBy: desc(schema.billingActivity.createdAt)
    })

    const org = sub.organization as typeof schema.organization.$inferSelect | null

    const resolvedPlanName = planInfo?.name ?? sub.plan

    return {
      id: sub.id,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      referenceId: sub.referenceId,
      organizationName: org?.name ?? "Unknown",
      organizationSlug: org?.slug ?? "",
      organizationLogo: org?.logo ?? null,
      stripeCustomerId: sub.stripeCustomerId,
      plan: resolvedPlanName,
      planTier: planTierFromName(resolvedPlanName),
      status: sub.status,
      periodStart: sub.periodStart?.toISOString() ?? null,
      periodEnd: sub.periodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      cancelAt: sub.cancelAt?.toISOString() ?? null,
      canceledAt: sub.canceledAt?.toISOString() ?? null,
      endedAt: sub.endedAt?.toISOString() ?? null,
      trialStart: sub.trialStart?.toISOString() ?? null,
      trialEnd: sub.trialEnd?.toISOString() ?? null,
      billingInterval: sub.billingInterval,
      seats: sub.seats,
      stripeScheduleId: sub.stripeScheduleId,
      organizationMemberCount: memberCount?.count ?? 0,
      planInfo: planInfo
        ? {
            name: planInfo.name,
            amount: planInfo.amount,
            currency: planInfo.currency,
            interval: planInfo.interval
          }
        : null,
      billingHealth: computeBillingHealth(sub.status, sub.cancelAtPeriodEnd),
      dataFreshness: computeDataFreshness(lastActivity?.createdAt ?? null),
      lastSyncedAt: lastActivity?.createdAt?.toISOString() ?? null,
      lastWebhookAt: lastWebhook?.createdAt?.toISOString() ?? null,
      isEnterpriseManaged: planTierFromName(resolvedPlanName) === "enterprise",
      allowedActions: computeAllowedActions(sub.status, sub.cancelAtPeriodEnd, adminTier)
    }
  },

  /**
   * Get billing activity timeline for a subscription.
   */
  async getActivity(subscriptionId: string, limit = 20, offset = 0) {
    const activities = await db
      .select({
        activity: schema.billingActivity,
        actorName: schema.user.name,
        actorEmail: schema.user.email
      })
      .from(schema.billingActivity)
      .leftJoin(schema.user, eq(schema.billingActivity.actorId, schema.user.id))
      .where(eq(schema.billingActivity.subscriptionId, subscriptionId))
      .orderBy(desc(schema.billingActivity.createdAt))
      .limit(limit)
      .offset(offset)

    return activities.map((row) => ({
      id: row.activity.id,
      type: row.activity.type,
      description: row.activity.description,
      actorName: row.actorName ?? null,
      actorEmail: row.actorEmail ?? null,
      metadata: row.activity.metadata,
      createdAt: row.activity.createdAt.toISOString()
    }))
  },

  /**
   * Get billing summary for an organisation (used on org detail page).
   */
  async getOrganizationBilling(organizationId: string) {
    const sub = await db.query.subscription.findFirst({
      where: eq(schema.subscription.referenceId, organizationId)
    })

    if (!sub) {
      return {
        hasSubscription: false,
        subscription: null,
        planTier: "free" as PlanTier,
        billingHealth: "inactive" as BillingHealth
      }
    }

    const planInfo = await findPlanForSubscription(sub)
    const resolvedPlanName = planInfo?.name ?? sub.plan

    return {
      hasSubscription: true,
      subscription: {
        id: sub.id,
        plan: resolvedPlanName,
        status: sub.status,
        periodEnd: sub.periodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        billingInterval: sub.billingInterval
      },
      planTier: planTierFromName(resolvedPlanName),
      billingHealth: computeBillingHealth(sub.status, sub.cancelAtPeriodEnd)
    }
  },

  /**
   * Get cached plan list for filter dropdowns and display.
   */
  async getPlans() {
    return db.query.stripePlan.findMany({
      where: eq(schema.stripePlan.active, true),
      orderBy: schema.stripePlan.amount
    })
  },

  /**
   * Record a billing activity entry.
   */
  async recordActivity(params: {
    subscriptionId: string
    type: string
    description: string
    actorId?: string
    metadata?: Record<string, unknown>
  }) {
    await db.insert(schema.billingActivity).values({
      id: nanoid(),
      subscriptionId: params.subscriptionId,
      type: params.type,
      description: params.description,
      actorId: params.actorId ?? null,
      metadata: params.metadata ?? null,
      createdAt: new Date()
    })
  }
}
