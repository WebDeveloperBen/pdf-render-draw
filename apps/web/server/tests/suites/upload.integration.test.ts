import { describe, it, beforeEach } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { createAuthenticatedUser, type AuthHeaders } from "../helpers/auth"
import { expectError } from "../helpers/api"
import { getTestDb } from "../helpers/db"

describe("Upload API", () => {
  let seed: SeededData
  let headers: AuthHeaders

  beforeEach(async () => {
    seed = await seedStandardScenario(getTestDb())
    headers = await createAuthenticatedUser(seed.users.regularUser.id, seed.orgs.acme.id)
  })

  describe("POST /api/upload/pdf", () => {
    it("returns 401 without auth", async () => {
      await expectError("/api/upload/pdf", 401, { method: "POST" })
    })

    // Note: Actual R2 upload is not testable without the real service.
    // The upload endpoint validates file type and size before uploading,
    // so auth and validation layers are what we test here.

    it("returns 400 without a file", async () => {
      await expectError("/api/upload/pdf", 400, {
        method: "POST",
        headers
      })
    })
  })
})
