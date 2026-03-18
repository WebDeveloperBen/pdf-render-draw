import { z } from "zod"
defineRouteMeta({
  openAPI: {
    tags: ["Admin Billing"],
    summary: "Get Subscription Detail",
    description: "Get full subscription details including billing health, freshness, and allowed actions",
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    responses: {
      200: {
        description: "Subscription detail",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "string" },
                stripeSubscriptionId: { type: "string", nullable: true },
                referenceId: { type: "string" },
                organizationName: { type: "string" },
                organizationSlug: { type: "string" },
                organizationLogo: { type: "string", nullable: true },
                stripeCustomerId: { type: "string", nullable: true },
                plan: { type: "string" },
                planTier: { type: "string", enum: ["free", "starter", "professional", "team", "enterprise"] },
                status: { type: "string" },
                periodStart: { type: "string", nullable: true },
                periodEnd: { type: "string", nullable: true },
                cancelAtPeriodEnd: { type: "boolean", nullable: true },
                cancelAt: { type: "string", nullable: true },
                canceledAt: { type: "string", nullable: true },
                endedAt: { type: "string", nullable: true },
                trialStart: { type: "string", nullable: true },
                trialEnd: { type: "string", nullable: true },
                billingInterval: { type: "string", nullable: true },
                seats: { type: "number", nullable: true },
                stripeScheduleId: { type: "string", nullable: true },
                organizationMemberCount: { type: "number" },
                planInfo: {
                  type: "object",
                  nullable: true,
                  properties: {
                    name: { type: "string" },
                    amount: { type: "number" },
                    currency: { type: "string" },
                    interval: { type: "string" }
                  },
                  required: ["name", "amount", "currency", "interval"]
                },
                billingHealth: { type: "string", enum: ["healthy", "at_risk", "action_needed", "inactive"] },
                dataFreshness: { type: "string", enum: ["fresh", "stale", "unknown"] },
                lastSyncedAt: { type: "string", nullable: true },
                lastWebhookAt: { type: "string", nullable: true },
                isEnterpriseManaged: { type: "boolean" },
                allowedActions: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: [
                      "refresh",
                      "cancel_at_period_end",
                      "cancel_immediately",
                      "reactivate",
                      "send_billing_portal_link"
                    ]
                  }
                }
              },
              required: [
                "id",
                "referenceId",
                "organizationName",
                "organizationSlug",
                "plan",
                "planTier",
                "status",
                "organizationMemberCount",
                "billingHealth",
                "dataFreshness",
                "isEnterpriseManaged",
                "allowedActions"
              ]
            }
          }
        }
      },
      403: { description: "Forbidden - requires platform admin access" },
      404: { description: "Subscription not found" }
    }
  }
})

const paramsSchema = z.object({
  id: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const admin = await getPlatformAdmin(event)
  if (!admin) {
    throw createError({ statusCode: 403, statusMessage: "Platform admin access required" })
  }

  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const detail = await billingService.getSubscriptionDetail(id, admin.tier)

  if (!detail) {
    throw createError({ statusCode: 404, statusMessage: "Subscription not found" })
  }

  return detail
})
