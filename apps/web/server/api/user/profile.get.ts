import { eq, and, inArray } from "drizzle-orm"
import { auth } from "@auth"
import type { PlanLimits } from "@shared/types/billing"
import { FREE_TIER_LIMITS, FREE_TIER_FEATURES } from "@shared/types/billing"
import { parseFeaturesFromMetadata } from "../../utils/billing/billing.helpers"

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["User"],
    summary: "Get Profile",
    description: "Get current user's profile information",
    responses: {
      200: {
        description: "User profile information",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string", nullable: true },
                firstName: { type: "string", nullable: true },
                lastName: { type: "string", nullable: true },
                email: { type: "string" },
                emailVerified: { type: "boolean", nullable: true },
                image: { type: "string", nullable: true },
                role: { type: "string", nullable: true },
                banned: { type: "boolean" },
                banReason: { type: "string", nullable: true },
                banExpires: { type: "string", format: "date-time", nullable: true },
                isGuest: { type: "boolean" },
                guestOrganizationId: { type: "string", nullable: true },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                activeOrganizationId: { type: "string", nullable: true },
                subscription: {
                  type: "object",
                  nullable: true,
                  properties: {
                    id: { type: "string" },
                    plan: { type: "string" },
                    status: { type: "string" },
                    periodEnd: { type: "string", format: "date-time", nullable: true },
                    cancelAtPeriodEnd: { type: "boolean", nullable: true },
                    trialEnd: { type: "string", format: "date-time", nullable: true },
                    seats: { type: "number", nullable: true },
                    billingInterval: { type: "string", nullable: true }
                  }
                },
                billing: {
                  type: "object",
                  properties: {
                    plan: { type: "string" },
                    limits: { type: "object" },
                    features: { type: "object" }
                  }
                }
              },
              required: ["id", "email", "banned", "isGuest", "createdAt", "updatedAt"]
            }
          }
        }
      },
      401: { description: "Unauthorized - authentication required" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  const db = useDrizzle()

  const [userProfile] = await db
    .select({
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      isGuest: user.isGuest,
      guestOrganizationId: user.guestOrganizationId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (!userProfile) {
    throw createError({
      statusCode: 404,
      statusMessage: "User profile not found"
    })
  }

  // Get the user's active org from the session
  const activeOrgId = session.session.activeOrganizationId

  let subscriptionData = null
  let planLimits = FREE_TIER_LIMITS
  let planFeatures = FREE_TIER_FEATURES
  let planName = "free"

  if (activeOrgId) {
    // Find active subscription for this org
    const orgSub = await db.query.subscription.findFirst({
      where: and(eq(subscription.referenceId, activeOrgId), inArray(subscription.status, ["active", "trialing"]))
    })

    if (orgSub) {
      // Look up the plan details from our local cache
      const plan = await db.query.stripePlan.findFirst({
        where: eq(stripePlan.name, orgSub.plan)
      })

      const metadata = (plan?.metadata ?? {}) as Record<string, string>

      planName = orgSub.plan.toLowerCase()
      planLimits = plan?.limits ? (plan.limits as PlanLimits) : FREE_TIER_LIMITS
      planFeatures = parseFeaturesFromMetadata(metadata)

      subscriptionData = {
        id: orgSub.id,
        plan: orgSub.plan,
        status: orgSub.status,
        periodEnd: orgSub.periodEnd,
        cancelAtPeriodEnd: orgSub.cancelAtPeriodEnd,
        trialEnd: orgSub.trialEnd,
        seats: orgSub.seats,
        billingInterval: orgSub.billingInterval
      }
    }
  }

  return {
    ...userProfile,
    activeOrganizationId: activeOrgId,
    subscription: subscriptionData,
    billing: {
      plan: planName,
      limits: planLimits,
      features: planFeatures
    }
  }
})
