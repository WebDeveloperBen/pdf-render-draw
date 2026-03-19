import { billingSyncService } from "../../../../services/billing/billing.sync"

defineRouteMeta({
  openAPI: {
    tags: ["Admin Billing"],
    summary: "Refresh Subscription",
    description: "Refresh a single subscription from Stripe to update local data",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
        description: "Subscription ID"
      }
    ],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            additionalProperties: false
          }
        }
      }
    },
    responses: {
      200: {
        description: "Subscription refreshed",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" }
              },
              required: ["success"]
            }
          }
        }
      },
      403: { description: "Forbidden - requires support tier" },
      404: { description: "Subscription not found" }
    }
  }
})

export default defineEventHandler(async (event) => {
  await requirePlatformAdminTier(event, "support")

  const admin = await getPlatformAdmin(event)
  if (!admin) throw createError({ statusCode: 403, message: "Admin not found" })

  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: "Subscription ID required" })

  await billingSyncService.refreshSubscription(id, admin.userId)

  // Audit log
  await logAdminActionFromEvent(event, {
    adminId: admin.userId,
    actionType: "billing.sync.refresh",
    metadata: { subscriptionId: id }
  })

  return { success: true }
})
