import { eq, and, inArray } from "drizzle-orm"

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
                    stripeSubscriptionId: { type: "string", nullable: true },
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
  const { user: authUser, orgId, billing } = await requireAuth(event)

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
    .where(eq(user.id, authUser.id))

  if (!userProfile) {
    throw createError({
      statusCode: 404,
      statusMessage: "User profile not found"
    })
  }

  // Look up subscription details for the response (billing context already resolved plan/limits)
  let subscriptionData = null

  if (orgId) {
    const orgSub = await db.query.subscription.findFirst({
      where: and(eq(subscription.referenceId, orgId), inArray(subscription.status, ["active", "trialing"]))
    })

    if (orgSub) {
      subscriptionData = {
        id: orgSub.id,
        stripeSubscriptionId: orgSub.stripeSubscriptionId,
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
    activeOrganizationId: orgId,
    subscription: subscriptionData,
    billing: {
      plan: billing.planName,
      limits: billing.limits,
      features: billing.features
    }
  }
})
