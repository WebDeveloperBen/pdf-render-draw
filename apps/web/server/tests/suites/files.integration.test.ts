import { $fetch } from "@nuxt/test-utils/e2e"
import { describe, it, expect, beforeEach } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { createAuthenticatedUser, type AuthHeaders } from "../helpers/auth"
import { expectError } from "../helpers/api"
import { getTestDb } from "../helpers/db"
import { annotation, subscription } from "../../../shared/db/schema"
import { randomUUID } from "crypto"
import { buildSubscription } from "../fixtures/billing"
import { eq } from "drizzle-orm"

describe("Files API", () => {
  let seed: SeededData
  let headers: AuthHeaders

  beforeEach(async () => {
    seed = await seedStandardScenario(getTestDb())
    await getTestDb()
      .insert(subscription)
      .values(
        buildSubscription({
          id: "sub-sync-001",
          referenceId: seed.orgs.acme.id,
          plan: "Starter"
        })
      )
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
      await expectError(`/api/projects/${seed.projects.floorPlan.id}/files/${seed.files.floorPlanFile.id}`, 404, {
        headers
      })
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
        data: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 100 }
          ]
        },
        createdBy: seed.users.regularUser.id,
        version: 1
      })

      const data = await $fetch<{
        annotations: Array<{ id: string; type: string }>
        meta: { count: number }
        viewportState: unknown
      }>(`/api/files/${seed.files.floorPlanFile.id}/annotations`, { headers })

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
    it("creates annotations and persists viewport state", async () => {
      const annotationId = randomUUID()
      const clientTime = new Date().toISOString()

      const data = await $fetch<{
        success: boolean
        applied: string[]
        conflicts: Array<unknown>
        viewportState: {
          scale: number
          rotation: number
          scrollLeft: number
          scrollTop: number
          currentPage: number
        } | null
      }>(`/api/files/${seed.files.floorPlanFile.id}/annotations/sync`, {
        method: "POST",
        headers,
        body: {
          clientTime,
          operations: [
            {
              type: "create",
              annotation: {
                id: annotationId,
                type: "measure",
                pageNum: 1,
                rotation: 0,
                points: [
                  { x: 0, y: 0 },
                  { x: 100, y: 100 }
                ]
              },
              localVersion: 0,
              timestamp: clientTime
            }
          ],
          viewportState: {
            scale: 1.5,
            rotation: 90,
            scrollLeft: 24,
            scrollTop: 48,
            currentPage: 2
          }
        }
      })

      expect(data.success).toBe(true)
      expect(data.applied).toEqual([annotationId])
      expect(data.conflicts).toEqual([])
      expect(data.viewportState).toEqual({
        scale: 1.5,
        rotation: 90,
        scrollLeft: 24,
        scrollTop: 48,
        currentPage: 2
      })

      const persisted = await $fetch<{
        annotations: Array<{ id: string; type: string }>
        viewportState: {
          scale: number
          rotation: number
          scrollLeft: number
          scrollTop: number
          currentPage: number
        } | null
      }>(`/api/files/${seed.files.floorPlanFile.id}/annotations`, { headers })

      expect(persisted.annotations).toEqual([
        expect.objectContaining({
          id: annotationId,
          type: "measure"
        })
      ])
      expect(persisted.viewportState).toEqual({
        scale: 1.5,
        rotation: 90,
        scrollLeft: 24,
        scrollTop: 48,
        currentPage: 2
      })
    })

    it("treats duplicate create retries as idempotent", async () => {
      const annotationId = randomUUID()
      const timestamp = new Date().toISOString()
      const body = {
        clientTime: timestamp,
        operations: [
          {
            type: "create" as const,
            annotation: {
              id: annotationId,
              type: "count" as const,
              pageNum: 1,
              rotation: 0,
              x: 10,
              y: 20,
              width: 30,
              height: 40
            },
            localVersion: 0,
            timestamp
          }
        ]
      }

      await $fetch(`/api/files/${seed.files.floorPlanFile.id}/annotations/sync`, {
        method: "POST",
        headers,
        body
      })

      const retry = await $fetch<{
        applied: string[]
        conflicts: Array<unknown>
      }>(`/api/files/${seed.files.floorPlanFile.id}/annotations/sync`, {
        method: "POST",
        headers,
        body
      })

      expect(retry.applied).toEqual([annotationId])
      expect(retry.conflicts).toEqual([])

      const records = await getTestDb()
        .select({ id: annotation.id })
        .from(annotation)
        .where(eq(annotation.id, annotationId))

      expect(records).toHaveLength(1)
    })

    it("returns version conflicts for stale updates", async () => {
      const annotationId = randomUUID()
      await getTestDb()
        .insert(annotation)
        .values({
          id: annotationId,
          fileId: seed.files.floorPlanFile.id,
          projectId: seed.projects.floorPlan.id,
          type: "measure",
          pageNum: 1,
          data: {
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 }
            ]
          },
          createdBy: seed.users.regularUser.id,
          modifiedBy: seed.users.regularUser.id,
          version: 2
        })

      const response = await $fetch<{
        applied: string[]
        conflicts: Array<{
          annotationId: string
          reason: string
          serverVersion: { id: string; version: number } | null
        }>
      }>(`/api/files/${seed.files.floorPlanFile.id}/annotations/sync`, {
        method: "POST",
        headers,
        body: {
          clientTime: new Date().toISOString(),
          operations: [
            {
              type: "update",
              annotation: {
                id: annotationId,
                type: "measure",
                pageNum: 1,
                rotation: 0,
                points: [
                  { x: 10, y: 10 },
                  { x: 20, y: 20 }
                ]
              },
              localVersion: 1,
              timestamp: new Date().toISOString()
            }
          ]
        }
      })

      expect(response.applied).toEqual([])
      expect(response.conflicts).toEqual([
        expect.objectContaining({
          annotationId,
          reason: "version_mismatch",
          serverVersion: expect.objectContaining({
            id: annotationId,
            version: 2
          })
        })
      ])
    })

    it("returns server updates since the previous sync time", async () => {
      const earlier = new Date(Date.now() - 60_000)
      const updatedAnnotationId = randomUUID()

      await getTestDb()
        .insert(annotation)
        .values({
          id: updatedAnnotationId,
          fileId: seed.files.floorPlanFile.id,
          projectId: seed.projects.floorPlan.id,
          type: "line",
          pageNum: 1,
          data: {
            points: [
              { x: 1, y: 1 },
              { x: 2, y: 2 }
            ]
          },
          createdBy: seed.users.regularUser.id,
          modifiedBy: seed.users.regularUser.id,
          version: 3,
          createdAt: earlier,
          updatedAt: new Date()
        })

      const response = await $fetch<{
        serverUpdates: Array<{ id: string; version: number }>
      }>(`/api/files/${seed.files.floorPlanFile.id}/annotations/sync`, {
        method: "POST",
        headers,
        body: {
          clientTime: new Date().toISOString(),
          lastSyncTime: earlier.toISOString(),
          operations: []
        }
      })

      expect(response.serverUpdates).toEqual([
        expect.objectContaining({
          id: updatedAnnotationId,
          version: 3
        })
      ])
    })

    it("returns 401 without auth", async () => {
      await expectError(`/api/files/${seed.files.floorPlanFile.id}/annotations/sync`, 401, {
        method: "POST",
        body: { annotations: [] }
      })
    })
  })

  describe("POST /api/files/:fileId/annotations/sync-beacon", () => {
    it("accepts invalid beacon payloads with 204", async () => {
      const response = await $fetch<null>(`/api/files/${seed.files.floorPlanFile.id}/annotations/sync-beacon`, {
        method: "POST",
        headers,
        body: {
          clientTime: "not-a-date",
          operations: []
        }
      })

      expect(response).toBeUndefined()
    })
  })
})
