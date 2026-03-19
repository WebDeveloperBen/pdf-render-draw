import { z } from "zod"
import { billingActionsService } from "../../../../services/billing/billing.actions"

const bodySchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500)
})

defineRouteMeta({
  openAPI: {
    tags: ["Admin Billing"],
    summary: "Reactivate Subscription",
    description: "Reverse a scheduled cancellation (cancel_at_period_end). Requires admin tier.",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              reason: { type: "string" }
            },
            required: ["reason"]
          }
        }
      }
    },
    responses: {
      200: { description: "Subscription reactivated" },
      400: { description: "Subscription is not scheduled for cancellation" },
      403: { description: "Forbidden - requires admin tier" },
      404: { description: "Subscription not found" }
    }
  }
})

export default defineEventHandler(async (event) => {
  await requirePlatformAdminTier(event, "admin")

  const admin = await getPlatformAdmin(event)
  if (!admin) throw createError({ statusCode: 403, message: "Admin not found" })

  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: "Subscription ID required" })

  const body = await readValidatedBody(event, bodySchema.parse)

  await billingActionsService.reactivateSubscription({
    subscriptionId: id,
    reason: body.reason,
    adminId: admin.userId,
    ipAddress: getRequestIP(event),
    userAgent: getRequestHeader(event, "user-agent")
  })

  return { success: true }
})
