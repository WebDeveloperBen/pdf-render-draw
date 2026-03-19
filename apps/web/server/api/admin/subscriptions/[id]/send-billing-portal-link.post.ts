import { billingActionsService } from "../../../../services/billing/billing.actions"

defineRouteMeta({
  openAPI: {
    tags: ["Admin Billing"],
    summary: "Generate Billing Portal Link",
    description: "Generate a Stripe billing portal session URL for the subscription's customer. Requires support tier.",
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
            properties: {
              returnUrl: {
                type: "string",
                format: "uri",
                nullable: true,
                description: "Optional return URL for the Stripe billing portal"
              }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: "Portal link generated",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                url: { type: "string" }
              },
              required: ["url"]
            }
          }
        }
      },
      403: { description: "Forbidden - requires support tier" },
      404: { description: "Subscription not found or no Stripe customer" }
    }
  }
})

export default defineEventHandler(async (event) => {
  await requirePlatformAdminTier(event, "support")

  const admin = await getPlatformAdmin(event)
  if (!admin) throw createError({ statusCode: 403, message: "Admin not found" })

  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: "Subscription ID required" })

  const body = await readBody(event)
  const returnUrl = body?.returnUrl || getRequestHeader(event, "referer") || getRequestHeader(event, "origin") || "/"

  const url = await billingActionsService.generateBillingPortalLink({
    subscriptionId: id,
    returnUrl,
    adminId: admin.userId,
    ipAddress: getRequestIP(event),
    userAgent: getRequestHeader(event, "user-agent")
  })

  return { url }
})
