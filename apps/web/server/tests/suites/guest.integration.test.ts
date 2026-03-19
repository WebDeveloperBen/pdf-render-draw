import { $fetch } from "@nuxt/test-utils/e2e"
import { describe, it, expect, beforeEach } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { createAuthenticatedUser, type AuthHeaders } from "../helpers/auth"
import { expectError } from "../helpers/api"
import { getTestDb } from "../helpers/db"
import { organization, projectShareRecipient, projectShare, user } from "../../../shared/db/schema"
import { eq } from "drizzle-orm"

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
      const data = await $fetch<
        Array<{
          id: string
          shareId: string
          email: string
          project: { id: string; name: string }
          share: { id: string }
        }>
      >("/api/guest/shares", { headers: guestHeaders })

      expect(data).toEqual([
        expect.objectContaining({
          id: "00000000-0000-4000-8000-000000000040",
          shareId: seed.shares.privateShare.id,
          email: seed.users.guest.email,
          project: expect.objectContaining({
            id: seed.projects.sitePlan.id,
            name: "Construction Site Plan"
          }),
          share: expect.objectContaining({
            id: seed.shares.privateShare.id
          })
        })
      ])
    })

    it("returns 401 without auth", async () => {
      await expectError("/api/guest/shares", 401)
    })
  })

  describe("GET /api/guest/shares/:shareId", () => {
    it("returns share details for a guest recipient", async () => {
      const data = await $fetch<{
        id: string
        recipient: { status: string; viewCount: number }
        project: { id: string }
      }>(`/api/guest/shares/${seed.shares.privateShare.id}`, {
        headers: guestHeaders
      })

      expect(data.id).toBe(seed.shares.privateShare.id)
      expect(data.project.id).toBe(seed.projects.sitePlan.id)
      expect(data.recipient.status).toBe("pending")
      expect(data.recipient.viewCount).toBe(1)

      const db = getTestDb()
      const [recipient] = await db
        .select({
          status: projectShareRecipient.status,
          viewCount: projectShareRecipient.viewCount
        })
        .from(projectShareRecipient)
        .where(eq(projectShareRecipient.id, "00000000-0000-4000-8000-000000000040"))

      expect(recipient?.status).toBe("viewed")
      expect(recipient?.viewCount).toBe(1)
    })

    it("returns 403 for a user who is not the invited recipient", async () => {
      const regularUserHeaders = await createAuthenticatedUser(seed.users.regularUser.id, seed.orgs.acme.id)

      await expectError(`/api/guest/shares/${seed.shares.privateShare.id}`, 403, {
        headers: regularUserHeaders
      })
    })

    it("returns 410 for an expired share", async () => {
      const db = getTestDb()
      await db
        .update(projectShare)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(eq(projectShare.id, seed.shares.privateShare.id))

      await expectError(`/api/guest/shares/${seed.shares.privateShare.id}`, 410, {
        headers: guestHeaders
      })
    })
  })

  describe("POST /api/guest/upgrade", () => {
    it("returns 401 without auth", async () => {
      await expectError("/api/guest/upgrade", 401, { method: "POST" })
    })

    it("upgrades a guest user to a full user", async () => {
      const data = await $fetch<{ success: boolean; message: string }>("/api/guest/upgrade", {
        method: "POST",
        body: { firstName: "Real", lastName: "User" },
        headers: guestHeaders
      })

      expect(data).toEqual({
        success: true,
        message: "Account upgraded successfully"
      })

      const db = getTestDb()
      const [upgradedUser] = await db
        .select({
          firstName: user.firstName,
          lastName: user.lastName,
          isGuest: user.isGuest,
          guestOrganizationId: user.guestOrganizationId
        })
        .from(user)
        .where(eq(user.id, seed.users.guest.id))

      const [homeOrg] = await db
        .select({
          name: organization.name,
          slug: organization.slug
        })
        .from(organization)
        .where(eq(organization.slug, `${seed.users.guest.email.split("@")[0]}-${seed.users.guest.id.slice(0, 8)}`))

      expect(upgradedUser).toEqual({
        firstName: "Real",
        lastName: "User",
        isGuest: false,
        guestOrganizationId: null
      })
      expect(homeOrg?.name).toBe("Real's Organization")
    })

    it("keeps the guest user unchanged when organization creation fails", async () => {
      const db = getTestDb()
      const conflictSlug = `${seed.users.guest.email.split("@")[0]}-${seed.users.guest.id.slice(0, 8)}`

      await db.insert(organization).values({
        id: "org-guest-upgrade-conflict",
        name: "Conflicting Org",
        slug: conflictSlug,
        createdAt: new Date(),
        metadata: null,
        logo: null,
        stripeCustomerId: null
      })

      await expectError("/api/guest/upgrade", 409, {
        method: "POST",
        body: { firstName: "Real", lastName: "User" },
        headers: guestHeaders
      })

      const [guestUser] = await db
        .select({
          firstName: user.firstName,
          lastName: user.lastName,
          isGuest: user.isGuest,
          guestOrganizationId: user.guestOrganizationId
        })
        .from(user)
        .where(eq(user.id, seed.users.guest.id))

      expect(guestUser).toEqual({
        firstName: "Guest",
        lastName: "User",
        isGuest: true,
        guestOrganizationId: null
      })
    })
  })
})
