import { $fetch } from "@nuxt/test-utils/e2e"
import { describe, it, expect, beforeEach } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { createAuthenticatedUser } from "../helpers/auth"
import { expectError } from "../helpers/api"
import { getTestDb } from "../helpers/db"
import { projectShare } from "../../../shared/db/schema"
import { eq } from "drizzle-orm"

describe("Share API", () => {
  let seed: SeededData

  beforeEach(async () => {
    seed = await seedStandardScenario(getTestDb())
  })

  describe("GET /api/share/:token", () => {
    it("returns public share data without auth", async () => {
      const data = await $fetch<{
        id: string
        name: string
        share: { shareType: string; allowDownload: boolean; viewCount: number }
      }>(`/api/share/${seed.shares.publicShare.token}`)

      expect(data.id).toBe(seed.projects.floorPlan.id)
      expect(data.name).toBe("Office Floor Plan")
      expect(data.share.shareType).toBe("public")
      expect(data.share.allowDownload).toBe(true)
      expect(data.share.viewCount).toBeGreaterThanOrEqual(1)
    })

    it("increments view count on each access", async () => {
      // First access
      await $fetch(`/api/share/${seed.shares.publicShare.token}`)
      // Second access
      const data = await $fetch<{ share: { viewCount: number } }>(`/api/share/${seed.shares.publicShare.token}`)

      expect(data.share.viewCount).toBeGreaterThanOrEqual(2)
    })

    it("returns 404 for non-existent token", async () => {
      await expectError("/api/share/non-existent-token", 404)
    })

    it("returns 410 for expired share", async () => {
      // Set share to already expired
      const db = getTestDb()
      await db
        .update(projectShare)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(projectShare.id, seed.shares.publicShare.id))

      await expectError(`/api/share/${seed.shares.publicShare.token}`, 410)
    })

    it("returns 403 for private share without auth", async () => {
      await expectError(`/api/share/${seed.shares.privateShare.token}`, 403)
    })

    it("allows authenticated recipient to access private share", async () => {
      // Guest user is a recipient of the private share
      const guestHeaders = await createAuthenticatedUser(
        seed.users.guest.id,
        seed.orgs.acme.id
      )

      const data = await $fetch<{
        id: string
        share: { shareType: string }
      }>(`/api/share/${seed.shares.privateShare.token}`, { headers: guestHeaders })

      expect(data.share.shareType).toBe("private")
    })

    it("requires password for password-protected public share", async () => {
      // Set password on the public share
      const db = getTestDb()
      const crypto = await import("crypto")
      const hashedPassword = crypto.createHash("sha256").update("secret123").digest("hex")
      await db.update(projectShare).set({ password: hashedPassword }).where(eq(projectShare.id, seed.shares.publicShare.id))

      // Without password
      await expectError(`/api/share/${seed.shares.publicShare.token}`, 400)

      // With correct password
      const data = await $fetch<{ id: string }>(`/api/share/${seed.shares.publicShare.token}?password=secret123`)
      expect(data.id).toBe(seed.projects.floorPlan.id)
    })
  })
})
