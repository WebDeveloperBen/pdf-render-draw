import { useRuntimeConfig } from "#imports"
import { billingService } from "../../../services/billing/billing.service"

defineRouteMeta({
  openAPI: {
    tags: ["Admin Billing"],
    summary: "List Plans",
    description: "Get cached plan list for filter dropdowns and display",
    responses: {
      200: {
        description: "Active plans",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                plans: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      stripeProductId: { type: "string" },
                      stripePriceId: { type: "string" },
                      name: { type: "string" },
                      description: { type: "string", nullable: true },
                      amount: { type: "number" },
                      currency: { type: "string" },
                      interval: { type: "string" },
                      active: { type: "boolean" },
                      limits: { type: "object", nullable: true },
                      trialDays: { type: "number", nullable: true },
                      group: { type: "string", nullable: true }
                    },
                    required: ["id", "stripePriceId", "name", "amount", "currency", "interval", "active"]
                  }
                }
              },
              required: ["plans"]
            }
          }
        }
      },
      403: { description: "Forbidden - requires platform admin access" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig()
  const freeTrialPeriodInDays = runtimeConfig.public.sales.freeTrialPeriodInDays
  const plans = await billingService.getPlans()

  return {
    plans: plans.map((plan) => ({
      ...plan,
      trialDays: freeTrialPeriodInDays
    }))
  }
})
