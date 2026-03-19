import { $fetch } from "@nuxt/test-utils/e2e"
import { describe, it, beforeEach, expect } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { createAuthenticatedUser, type AuthHeaders } from "../helpers/auth"
import { expectError } from "../helpers/api"
import { getTestDb } from "../helpers/db"
import { patchServerTestState } from "../helpers/test-state"

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

    it("rejects non-PDF uploads", async () => {
      const form = new FormData()
      form.append("pdf", new Blob(["hello"], { type: "text/plain" }), "notes.txt")

      await expectError("/api/upload/pdf", 400, {
        method: "POST",
        body: form,
        headers
      })
    })

    it("uploads a PDF through the test R2 adapter", async () => {
      const form = new FormData()
      form.append("pdf", new Blob([new Uint8Array([37, 80, 68, 70])], { type: "application/pdf" }), "plan.pdf")

      const data = await $fetch<{
        pdfUrl: string
        fileName: string
        fileSize: number
        pageCount: number
        thumbnailUrl: string
      }>("/api/upload/pdf", {
        method: "POST",
        body: form,
        headers
      })

      expect(data.fileName).toBe("plan.pdf")
      expect(data.fileSize).toBe(4)
      expect(data.pageCount).toBe(0)
      expect(data.thumbnailUrl).toBe("")
      expect(data.pdfUrl).toContain("/storage/pdfs/")
    })

    it("returns 413 when the upload exceeds the plan limit", async () => {
      const form = new FormData()
      form.append(
        "pdf",
        new Blob([new Uint8Array(11 * 1024 * 1024)], { type: "application/pdf" }),
        "too-large.pdf"
      )

      await expectError("/api/upload/pdf", 413, {
        method: "POST",
        body: form,
        headers
      })
    })

    it("returns 500 when the storage adapter fails", async () => {
      await patchServerTestState({
        r2: {
          failPut: true
        }
      })

      const form = new FormData()
      form.append("pdf", new Blob([new Uint8Array([37, 80, 68, 70])], { type: "application/pdf" }), "plan.pdf")

      await expectError("/api/upload/pdf", 500, {
        method: "POST",
        body: form,
        headers
      })
    })
  })
})
