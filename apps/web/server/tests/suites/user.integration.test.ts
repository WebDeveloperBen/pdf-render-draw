import { $fetch } from "@nuxt/test-utils/e2e"
import { describe, it, expect, beforeEach } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { createAuthenticatedUser, getAuthHeaders, type AuthHeaders } from "../helpers/auth"
import { expectError } from "../helpers/api"
import { getTestDb } from "../helpers/db"

describe("User API", () => {
  let seed: SeededData
  let headers: AuthHeaders

  beforeEach(async () => {
    seed = await seedStandardScenario(getTestDb())
    headers = await createAuthenticatedUser(seed.users.regularUser.id, seed.orgs.acme.id)
  })

  // ---- GET /api/user/profile ----

  describe("GET /api/user/profile", () => {
    it("returns the current user profile", async () => {
      const data = await $fetch<{
        id: string
        email: string
        firstName: string
        lastName: string
        isGuest: boolean
        activeOrganizationId: string | null
        billing: { plan: string; limits: object; features: object }
      }>("/api/user/profile", { headers })

      expect(data.id).toBe(seed.users.regularUser.id)
      expect(data.email).toBe(seed.users.regularUser.email)
      expect(data.firstName).toBe("Demo")
      expect(data.lastName).toBe("User")
      expect(data.isGuest).toBe(false)
      expect(data.activeOrganizationId).toBe(seed.orgs.acme.id)
    })

    it("includes billing context for free tier", async () => {
      const data = await $fetch<{
        billing: { plan: string; limits: { projects: number } }
      }>("/api/user/profile", { headers })

      expect(data.billing.plan).toBe("free")
      expect(data.billing.limits.projects).toBe(1)
    })

    it("returns 401 without auth", async () => {
      await expectError("/api/user/profile", 401)
    })

    it("works without active org (returns null orgId)", async () => {
      const noOrgHeaders = await getAuthHeaders(seed.users.regularUser.id)

      const data = await $fetch<{
        id: string
        activeOrganizationId: string | null
      }>("/api/user/profile", { headers: noOrgHeaders })

      expect(data.id).toBe(seed.users.regularUser.id)
      expect(data.activeOrganizationId).toBeNull()
    })
  })

  // ---- PATCH /api/user/profile ----

  describe("PATCH /api/user/profile", () => {
    it("updates user profile fields", async () => {
      const data = await $fetch<{ firstName: string; lastName: string }>("/api/user/profile", {
        method: "PATCH",
        body: { firstName: "Updated", lastName: "Name" },
        headers
      })

      expect(data.firstName).toBe("Updated")
      expect(data.lastName).toBe("Name")
    })

    it("returns 401 without auth", async () => {
      await expectError("/api/user/profile", 401, {
        method: "PATCH",
        body: { firstName: "Hack" }
      })
    })
  })

  // ---- GET /api/user/invitations ----

  describe("GET /api/user/invitations", () => {
    it("returns invitations for the current user", async () => {
      const data = await $fetch<Array<unknown>>("/api/user/invitations", { headers })

      expect(data).toBeInstanceOf(Array)
    })

    it("returns 401 without auth", async () => {
      await expectError("/api/user/invitations", 401)
    })
  })
})
