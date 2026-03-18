import { eq } from "drizzle-orm"
import { parseFeaturesFromMetadata } from "../../utils/billing/billing.helpers"

defineRouteMeta({
  openAPI: {
    tags: ["Plans"],
    summary: "List Plans",
    description: "Get all active subscription plans (public)",
    responses: {
      200: {
        description: "Active plans sorted by display order",
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
                      name: { type: "string" },
                      description: { type: "string", nullable: true },
                      amount: { type: "number" },
                      currency: { type: "string" },
                      interval: { type: "string" },
                      limits: { type: "object", nullable: true },
                      features: { type: "object", nullable: true },
                      displayOrder: { type: "number" },
                      trialDays: { type: "number", nullable: true },
                      stripePriceId: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
})

export default defineEventHandler(async () => {
  const db = useDrizzle()

  const plans = await db.query.stripePlan.findMany({
    where: eq(stripePlan.active, true)
  })

  return {
    plans: plans
      .map((plan) => {
        const metadata = (plan.metadata ?? {}) as Record<string, string>
        return {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          amount: plan.amount,
          currency: plan.currency,
          interval: plan.interval,
          limits: plan.limits,
          features: parseFeaturesFromMetadata(metadata),
          displayOrder: parseInt(metadata.display_order ?? "99", 10),
          trialDays: plan.trialDays,
          stripePriceId: plan.stripePriceId
        }
      })
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }
})
