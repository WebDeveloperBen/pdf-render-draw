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
              type: "object"
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
