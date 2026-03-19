import { beforeEach, describe, expect, it } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { createAuthenticatedUser, type AuthHeaders } from "../helpers/auth"
import { getTestDb } from "../helpers/db"
import { expectHttpError, testFetch } from "../helpers/http"

/**
 * This suite runs against the built Cloudflare worker via Wrangler preview.
 * It keeps auth setup DRY by reusing Better Auth's test-utils cookies, so the
 * focus here stays on build/runtime parity for the shipped server bundle.
 */
describe("Built app prod smoke", () => {
  let seed: SeededData
  let userHeaders: AuthHeaders

  beforeEach(async () => {
    seed = await seedStandardScenario(getTestDb())
    userHeaders = await createAuthenticatedUser(seed.users.regularUser.id, seed.orgs.acme.id)
  })

  it("serves the health endpoint from the built worker", async () => {
    const data = await testFetch<{ status: string; timestamp: string }>("/api/health")

    expect(data.status).toBe("ok")
    expect(Date.parse(data.timestamp)).not.toBeNaN()
  })

  it("serves public billing plans from the built worker", async () => {
    const data = await testFetch<{ plans: Array<{ id: string; name: string }> }>("/api/plans")

    expect(data.plans).toHaveLength(1)
    expect(data.plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "plan-starter",
          name: "Starter"
        })
      ])
    )
  })

  it.skip("serves file annotations from the built worker", async () => {
    const data = await testFetch<{ annotations: unknown[]; meta: { count: number } }>(
      `/api/files/${seed.files.floorPlanFile.id}/annotations`,
      {
        headers: userHeaders
      }
    )

    expect(data.annotations).toEqual([])
    expect(data.meta.count).toBe(0)
  })

  it("enforces auth on project routes from the built worker", async () => {
    const error = await expectHttpError("/api/projects", 401)

    expect(error.statusCode).toBe(401)
  })
})
