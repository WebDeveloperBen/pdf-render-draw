import { $fetch } from "@nuxt/test-utils/e2e"
import { describe, it, expect, beforeEach } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { createAuthenticatedUser, type AuthHeaders } from "../helpers/auth"
import { expectError } from "../helpers/api"
import { getTestDb } from "../helpers/db"

describe("Dashboard API", () => {
  let seed: SeededData
  let headers: AuthHeaders

  beforeEach(async () => {
    seed = await seedStandardScenario(getTestDb())
    headers = await createAuthenticatedUser(seed.users.regularUser.id, seed.orgs.acme.id)
  })

  describe("GET /api/dashboard/stats", () => {
    it("returns org-scoped dashboard statistics", async () => {
      const data = await $fetch<{
        totalProjects: number
        personalProjects: number
        teamProjects: number
        totalOrganizations: number
        totalShares: number
        recentActivity: Array<{ id: string; type: string; projectName: string }>
      }>("/api/dashboard/stats", { headers })

      expect(data.totalProjects).toBe(3)
      expect(data.personalProjects).toBe(0)
      expect(data.teamProjects).toBe(3)
      expect(data.totalOrganizations).toBe(2)
      expect(data.totalShares).toBe(1)
      expect(data.recentActivity).toHaveLength(3)
      expect(data.recentActivity.map((item) => item.projectName)).toEqual(
        expect.arrayContaining(["Office Floor Plan", "Construction Site Plan", "Electrical Layout"])
      )
      expect(data.recentActivity).toBeInstanceOf(Array)
    })

    it("includes share counts for user's projects", async () => {
      const data = await $fetch<{ totalShares: number }>("/api/dashboard/stats", { headers })

      expect(data.totalShares).toBe(1)
    })

    it("returns 401 without auth", async () => {
      await expectError("/api/dashboard/stats", 401)
    })

    it("returns 400 without active org", async () => {
      const { getAuthHeaders } = await import("../helpers/auth")
      const noOrgHeaders = await getAuthHeaders(seed.users.regularUser.id)

      await expectError("/api/dashboard/stats", 400, { headers: noOrgHeaders })
    })
  })
})
