import { $fetch } from "@nuxt/test-utils/e2e"
import { describe, it, expect, beforeEach } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { createAuthenticatedUser, type AuthHeaders } from "../helpers/auth"
import { expectError } from "../helpers/api"
import { getTestDb } from "../helpers/db"
import { annotation } from "../../../shared/db/schema"
import { randomUUID } from "crypto"

describe("Files API", () => {
  let seed: SeededData
  let headers: AuthHeaders

  beforeEach(async () => {
    seed = await seedStandardScenario(getTestDb())
    headers = await createAuthenticatedUser(seed.users.regularUser.id, seed.orgs.acme.id)
  })

  // ---- GET /api/projects/:id/files ----

  describe("GET /api/projects/:id/files", () => {
    it("lists all files for a project", async () => {
      const data = await $fetch<Array<{ id: string; pdfFileName: string }>>(
        `/api/projects/${seed.projects.sitePlan.id}/files`,
        { headers }
      )

      // sitePlan has 2 files (site-plan.pdf and site-plan-v2.pdf)
      expect(data.length).toBe(2)
      const fileNames = data.map((f) => f.pdfFileName)
      expect(fileNames).toContain("site-plan.pdf")
      expect(fileNames).toContain("site-plan-v2.pdf")
    })

    it("returns 401 without auth", async () => {
      await expectError(`/api/projects/${seed.projects.floorPlan.id}/files`, 401)
    })
  })

  // ---- GET /api/projects/:id/files/:fileId ----

  describe("GET /api/projects/:id/files/:fileId", () => {
    it("returns file details", async () => {
      const data = await $fetch<{ id: string; pdfFileName: string; pageCount: number }>(
        `/api/projects/${seed.projects.floorPlan.id}/files/${seed.files.floorPlanFile.id}`,
        { headers }
      )

      expect(data.id).toBe(seed.files.floorPlanFile.id)
      expect(data.pdfFileName).toBe("floor-plan.pdf")
      expect(data.pageCount).toBe(3)
    })
  })

  // ---- POST /api/projects/:id/files ----

  describe("POST /api/projects/:id/files", () => {
    it("adds a new file to a project", async () => {
      const data = await $fetch<{ id: string; pdfFileName: string }>(
        `/api/projects/${seed.projects.floorPlan.id}/files`,
        {
          method: "POST",
          body: {
            pdfUrl: "https://example.com/new-file.pdf",
            pdfFileName: "new-file.pdf",
            pdfFileSize: 3000000,
            pageCount: 5
          },
          headers
        }
      )

      expect(data.pdfFileName).toBe("new-file.pdf")
    })
  })

  // ---- DELETE /api/projects/:id/files/:fileId ----

  describe("DELETE /api/projects/:id/files/:fileId", () => {
    it("deletes a file from a project", async () => {
      await $fetch(`/api/projects/${seed.projects.floorPlan.id}/files/${seed.files.floorPlanFile.id}`, {
        method: "DELETE",
        headers
      })

      // Verify the file is gone
      await expectError(
        `/api/projects/${seed.projects.floorPlan.id}/files/${seed.files.floorPlanFile.id}`,
        404,
        { headers }
      )
    })
  })

  // ---- GET /api/files/:fileId/annotations ----

  describe("GET /api/files/:fileId/annotations", () => {
    it("returns annotations for a file", async () => {
      // Seed an annotation
      const db = getTestDb()
      await db.insert(annotation).values({
        id: randomUUID(),
        fileId: seed.files.floorPlanFile.id,
        projectId: seed.projects.floorPlan.id,
        type: "measure",
        pageNum: 1,
        data: { points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
        createdBy: seed.users.regularUser.id,
        version: 1
      })

      const data = await $fetch<{
        annotations: Array<{ id: string; type: string }>
        meta: { count: number }
        viewportState: unknown
      }>(
        `/api/files/${seed.files.floorPlanFile.id}/annotations`,
        { headers }
      )

      expect(data.annotations.length).toBe(1)
      expect(data.meta.count).toBe(1)
      expect(data.annotations[0].type).toBe("measure")
    })

    it("returns empty array for file with no annotations", async () => {
      const data = await $fetch<{
        annotations: Array<unknown>
        meta: { count: number }
        viewportState: unknown
      }>(`/api/files/${seed.files.floorPlanFile.id}/annotations`, { headers })

      expect(data.annotations).toEqual([])
      expect(data.meta.count).toBe(0)
    })
  })

  // ---- POST /api/files/:fileId/annotations/sync ----

  describe("POST /api/files/:fileId/annotations/sync", () => {
    it("returns 401 without auth", async () => {
      await expectError(`/api/files/${seed.files.floorPlanFile.id}/annotations/sync`, 401, {
        method: "POST",
        body: { annotations: [] }
      })
    })
  })
})
