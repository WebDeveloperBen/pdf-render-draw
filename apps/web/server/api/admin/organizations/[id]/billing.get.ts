import { z } from "zod"
defineRouteMeta({
  openAPI: {
    tags: ["Admin Billing"],
    summary: "Get Organisation Billing",
    description: "Get billing summary for an organisation, used on the organisation detail page",
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    responses: {
      200: {
        description: "Organisation billing summary",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                hasSubscription: { type: "boolean" },
                subscription: {
                  type: "object",
                  nullable: true,
                  properties: {
                    id: { type: "string" },
                    plan: { type: "string" },
                    status: { type: "string" },
                    periodEnd: { type: "string", nullable: true },
                    cancelAtPeriodEnd: { type: "boolean", nullable: true },
                    billingInterval: { type: "string", nullable: true }
                  },
                  required: ["id", "plan", "status"]
                },
                planTier: { type: "string", enum: ["freemium", "pro", "team", "enterprise"] },
                billingHealth: { type: "string", enum: ["healthy", "at_risk", "action_needed", "inactive"] }
              },
              required: ["hasSubscription", "planTier", "billingHealth"]
            }
          }
        }
      },
      403: { description: "Forbidden - requires platform admin access" }
    }
  }
})

const paramsSchema = z.object({
  id: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)

  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  return billingService.getOrganizationBilling(id)
})
