import { z } from "zod"
import { billingActionsService } from "../../../../services/billing/billing.actions"

const bodySchema = z.object({
  mode: z.enum(["at_period_end", "immediately"]),
  reason: z.string().min(1, "Reason is required").max(500)
})

defineRouteMeta({
  openAPI: {
    tags: ["Admin Billing"],
    summary: "Cancel Subscription",
    description:
      "Cancel a subscription at period end or immediately. Requires admin tier for at_period_end, owner tier for immediately.",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              mode: { type: "string", enum: ["at_period_end", "immediately"] },
              reason: { type: "string" }
            },
            required: ["mode", "reason"]
          }
        }
      }
    },
    responses: {
      200: { description: "Subscription cancelled" },
      403: { description: "Forbidden - requires admin or owner tier" },
      404: { description: "Subscription not found" }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Auth check first — before parsing the body
  await requirePlatformAdminTier(event, "admin")

  const body = await readValidatedBody(event, bodySchema.parse)

  // Immediate cancellation requires owner tier
  if (body.mode === "immediately") {
    await requirePlatformAdminTier(event, "owner")
  }

  const admin = await getPlatformAdmin(event)
  if (!admin) throw createError({ statusCode: 403, message: "Admin not found" })

  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: "Subscription ID required" })

  await billingActionsService.cancelSubscription({
    subscriptionId: id,
    mode: body.mode,
    reason: body.reason,
    adminId: admin.userId,
    ipAddress: getRequestIP(event),
    userAgent: getRequestHeader(event, "user-agent")
  })

  return { success: true }
})
