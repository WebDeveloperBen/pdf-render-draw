import { z } from "zod"
import { and, eq, gt } from "drizzle-orm"
import { useRuntimeConfig } from "#imports"
import { parseFeaturesFromMetadata } from "../../services/billing/billing.helpers"

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
              type: "object"
            }
          }
        }
      }
    }
  }
})

export default defineEventHandler(async () => {
  const db = useDrizzle()
  const runtimeConfig = useRuntimeConfig()
  const freeTrialPeriodInDays = runtimeConfig.public.sales.freeTrialPeriodInDays

  const plans = await db.query.stripePlan.findMany({
    where: and(eq(stripePlan.active, true), gt(stripePlan.amount, 0))
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
          trialDays: freeTrialPeriodInDays,
          stripePriceId: plan.stripePriceId
        }
      })
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }
})
