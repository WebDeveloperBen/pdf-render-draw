import { $fetch } from "@nuxt/test-utils/e2e"
import { describe, it, expect, beforeEach } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { createAuthenticatedUser, type AuthHeaders } from "../helpers/auth"
import { expectError } from "../helpers/api"
import { getTestDb } from "../helpers/db"

describe("Guest API", () => {
  let seed: SeededData
  let guestHeaders: AuthHeaders

  beforeEach(async () => {
    seed = await seedStandardScenario(getTestDb())
    // Guest user needs to be a member of an org to sign in with active org
    // The seed already has the guest user set up
    guestHeaders = await createAuthenticatedUser(seed.users.guest.id, seed.orgs.acme.id)
  })

  describe("GET /api/guest/shares", () => {
    it("lists shares accessible to the guest user", async () => {
      const data = await $fetch<Array<{ id: string }>>("/api/guest/shares", { headers: guestHeaders })

      expect(data).toBeInstanceOf(Array)
    })

    it("returns 401 without auth", async () => {
      await expectError("/api/guest/shares", 401)
    })
  })

  describe("GET /api/guest/shares/:shareId", () => {
    it("returns share details for a guest recipient", async () => {
      const data = await $fetch<{ id: string }>(`/api/guest/shares/${seed.shares.privateShare.id}`, {
        headers: guestHeaders
      })

      expect(data).toBeDefined()
    })
  })

  describe("POST /api/guest/upgrade", () => {
    it("returns 401 without auth", async () => {
      await expectError("/api/guest/upgrade", 401, { method: "POST" })
    })

    it("upgrades a guest user to a full user", async () => {
      const data = await $fetch<{ success: boolean }>("/api/guest/upgrade", {
        method: "POST",
        body: { firstName: "Real", lastName: "User" },
        headers: guestHeaders
      })

      expect(data).toBeDefined()
    })
  })
})
