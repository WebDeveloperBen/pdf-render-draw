import { billingService } from "../../../services/billing/billing.service"

defineRouteMeta({
  openAPI: {
    tags: ["Admin Billing"],
    summary: "Get Billing Overview",
    description: "Get platform-wide billing and subscription metrics for admin dashboard",
    responses: {
      200: {
        description: "Billing overview metrics",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                totalOrganizations: { type: "number" },
                statuses: {
                  type: "object",
                  properties: {
                    active: { type: "number" },
                    trialing: { type: "number" },
                    pastDue: { type: "number" },
                    canceled: { type: "number" },
                    incomplete: { type: "number" }
                  },
                  required: ["active", "trialing", "pastDue", "canceled", "incomplete"]
                },
                noSubscription: { type: "number" },
                lastSyncedAt: { type: "string", nullable: true }
              },
              required: ["totalOrganizations", "statuses", "noSubscription", "lastSyncedAt"]
            }
          }
        }
      },
      403: { description: "Forbidden - requires platform admin access" }
    }
  }
})

export default defineEventHandler(async (event) => {
  return billingService.getOverview()
})
