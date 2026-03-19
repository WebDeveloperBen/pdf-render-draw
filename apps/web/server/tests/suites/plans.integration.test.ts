import { $fetch } from "@nuxt/test-utils/e2e"
import { describe, it, expect, beforeEach } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { getTestDb } from "../helpers/db"
import { stripePlan } from "../../../shared/db/schema"

describe("Plans API", () => {
  let seed: SeededData

  beforeEach(async () => {
    seed = await seedStandardScenario(getTestDb())
  })

  describe("GET /api/plans", () => {
    it("returns active plans without auth (public endpoint)", async () => {
      const data = await $fetch<{ plans: Array<{ id: string; name: string; amount: number }> }>("/api/plans")

      expect(data.plans).toBeInstanceOf(Array)
      expect(data.plans.length).toBeGreaterThanOrEqual(1)

      const starter = data.plans.find((p) => p.name === "Starter")
      expect(starter).toBeDefined()
      expect(starter!.amount).toBe(1900)
    })

    it("returns empty plans array when no active plans exist", async () => {
      // Deactivate all plans
      const db = getTestDb()
      await db.update(stripePlan).set({ active: false })

      const data = await $fetch<{ plans: unknown[] }>("/api/plans")

      expect(data.plans).toEqual([])
    })

    it("sorts plans by display_order from metadata", async () => {
      // Insert a second plan with lower display_order
      const db = getTestDb()
      await db.insert(stripePlan).values({
        id: "plan-professional",
        stripeProductId: "prod_test_pro",
        stripePriceId: "price_test_pro_monthly",
        name: "Professional",
        description: "For teams",
        amount: 4900,
        currency: "aud",
        interval: "month",
        active: true,
        metadata: { display_order: "2" },
        lastSyncedAt: new Date()
      })

      const data = await $fetch<{ plans: Array<{ name: string }> }>("/api/plans")

      expect(data.plans.length).toBe(2)
      expect(data.plans[0].name).toBe("Starter")
      expect(data.plans[1].name).toBe("Professional")
    })
  })
})
