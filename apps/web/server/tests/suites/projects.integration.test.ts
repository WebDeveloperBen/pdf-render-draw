import { $fetch } from "@nuxt/test-utils/e2e"
import { describe, it, expect, beforeEach } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { buildSubscription } from "../fixtures/billing"
import { createAuthenticatedUser, getAuthHeaders, type AuthHeaders } from "../helpers/auth"
import { expectError } from "../helpers/api"
import { getTestDb } from "../helpers/db"
import { project, projectFile, subscription } from "../../../shared/db/schema"
import { eq } from "drizzle-orm"

describe("Projects API", () => {
  let seed: SeededData
  let headers: AuthHeaders

  beforeEach(async () => {
    seed = await seedStandardScenario(getTestDb())
    headers = await createAuthenticatedUser(seed.users.regularUser.id, seed.orgs.acme.id)
  })

  async function enableStarterPlanForAcme() {
    await getTestDb().insert(subscription).values(
      buildSubscription({
        id: "sub-acme-starter",
        referenceId: seed.orgs.acme.id
      })
    )
  }

  // ---- GET /api/projects ----

  describe("GET /api/projects", () => {
    it("returns projects for the active org", async () => {
      const data = await $fetch<Array<{ id: string; name: string }>>("/api/projects", { headers })

      // Acme has floorPlan and sitePlan
      expect(data.length).toBe(2)
      const names = data.map((p) => p.name)
      expect(names).toContain("Office Floor Plan")
      expect(names).toContain("Construction Site Plan")
    })

    it("does not return projects from other orgs", async () => {
      const data = await $fetch<Array<{ id: string; name: string }>>("/api/projects", { headers })

      const names = data.map((p) => p.name)
      // Electrical Layout belongs to Demo Corp
      expect(names).not.toContain("Electrical Layout")
    })

    it("returns 401 without auth", async () => {
      await expectError("/api/projects", 401)
    })

    it("returns 400 without active org", async () => {
      // Sign in without setting active org
      const noOrgHeaders = await getAuthHeaders(seed.users.regularUser.id)

      await expectError("/api/projects", 400, { headers: noOrgHeaders })
    })

    it("supports search filter", async () => {
      const data = await $fetch<Array<{ name: string }>>("/api/projects?search=Floor", { headers })

      expect(data.length).toBe(1)
      expect(data[0].name).toBe("Office Floor Plan")
    })

    it("supports pagination", async () => {
      const data = await $fetch<Array<{ id: string }>>("/api/projects?limit=1&offset=0", { headers })

      expect(data.length).toBe(1)
    })

    it("includes creator, organization, and counts", async () => {
      const data = await $fetch<
        Array<{
          name: string
          creator: { id: string; name: string }
          organization: { id: string; name: string }
          _count: { shares: number; files: number }
        }>
      >("/api/projects", { headers })

      const floorPlan = data.find((p) => p.name === "Office Floor Plan")
      expect(floorPlan).toBeDefined()
      expect(floorPlan!.creator).toBeDefined()
      expect(floorPlan!.organization).toBeDefined()
      expect(floorPlan!._count).toBeDefined()
      expect(floorPlan!._count.files).toBeGreaterThanOrEqual(1)
    })
  })

  // ---- POST /api/projects ----

  describe("POST /api/projects", () => {
    it("creates a project with initial file", async () => {
      await enableStarterPlanForAcme()

      const body = {
        name: "New Test Project",
        description: "A test project",
        pdfUrl: "https://example.com/test.pdf",
        pdfFileName: "test.pdf",
        pdfFileSize: 1000000,
        pageCount: 5
      }

      const data = await $fetch<{ id: string; name: string; files: Array<{ id: string }> }>("/api/projects", {
        method: "POST",
        body,
        headers
      })

      expect(data.name).toBe("New Test Project")
      expect(data.files).toHaveLength(1)
      expect(data.files[0].id).toBeDefined()
    })

    it("returns 401 without auth", async () => {
      await expectError("/api/projects", 401, {
        method: "POST",
        body: { name: "Test", pdfUrl: "https://example.com/test.pdf", pdfFileName: "t.pdf", pdfFileSize: 100 }
      })
    })

    it("returns 400 with invalid body", async () => {
      await expectError("/api/projects", 400, {
        method: "POST",
        body: { name: "AB" }, // name too short, missing required fields
        headers
      })
    })

    it("enforces project quota for free tier", async () => {
      // Switch to Demo Corp which has the electrical project and no subscription
      const demoHeaders = await createAuthenticatedUser(seed.users.regularUser.id, seed.orgs.demo.id)

      // Demo Corp is on free tier (1 project limit) and already has 1 project
      await expectError("/api/projects", 403, {
        method: "POST",
        body: {
          name: "Quota Exceeded Project",
          pdfUrl: "https://example.com/test.pdf",
          pdfFileName: "test.pdf",
          pdfFileSize: 1000000
        },
        headers: demoHeaders
      })
    })
  })

  // ---- GET /api/projects/:id ----

  describe("GET /api/projects/:id", () => {
    it("returns project details", async () => {
      const data = await $fetch<{ id: string; name: string }>(`/api/projects/${seed.projects.floorPlan.id}`, {
        headers
      })

      expect(data.id).toBe(seed.projects.floorPlan.id)
      expect(data.name).toBe("Office Floor Plan")
    })

    it("returns 404 for non-existent project", async () => {
      await expectError("/api/projects/00000000-0000-4000-8000-000000000099", 404, { headers })
    })

    it("returns 401 without auth", async () => {
      await expectError(`/api/projects/${seed.projects.floorPlan.id}`, 401)
    })
  })

  // ---- PATCH /api/projects/:id ----

  describe("PATCH /api/projects/:id", () => {
    it("updates project fields", async () => {
      const data = await $fetch<{ id: string; name: string }>(`/api/projects/${seed.projects.floorPlan.id}`, {
        method: "PATCH",
        body: { name: "Updated Floor Plan" },
        headers
      })

      expect(data.name).toBe("Updated Floor Plan")
    })

    it("returns 401 without auth", async () => {
      await expectError(`/api/projects/${seed.projects.floorPlan.id}`, 401, {
        method: "PATCH",
        body: { name: "Hack" }
      })
    })
  })

  // ---- DELETE /api/projects/:id ----

  describe("DELETE /api/projects/:id", () => {
    it("deletes a project and its files", async () => {
      await $fetch(`/api/projects/${seed.projects.floorPlan.id}`, {
        method: "DELETE",
        headers
      })

      // Verify project is gone
      const db = getTestDb()
      const [p] = await db.select().from(project).where(eq(project.id, seed.projects.floorPlan.id))
      expect(p).toBeUndefined()

      // Verify files are cascaded
      const files = await db
        .select()
        .from(projectFile)
        .where(eq(projectFile.projectId, seed.projects.floorPlan.id))
      expect(files).toHaveLength(0)
    })

    it("returns 401 without auth", async () => {
      await expectError(`/api/projects/${seed.projects.floorPlan.id}`, 401, { method: "DELETE" })
    })
  })

  // ---- Project Shares ----

  describe("GET /api/projects/:id/shares", () => {
    it("lists shares for a project", async () => {
      const data = await $fetch<Array<{ id: string; shareType: string }>>(
        `/api/projects/${seed.projects.floorPlan.id}/shares`,
        { headers }
      )

      expect(data.length).toBeGreaterThanOrEqual(1)
      expect(data[0].shareType).toBe("public")
    })
  })

  describe("POST /api/projects/:id/shares", () => {
    it("creates a new share", async () => {
      await enableStarterPlanForAcme()

      const data = await $fetch<{ id: string; token: string }>(
        `/api/projects/${seed.projects.floorPlan.id}/shares`,
        {
          method: "POST",
          body: {
            name: "New Test Share",
            shareType: "public",
            allowDownload: true,
            allowNotes: false
          },
          headers
        }
      )

      expect(data.id).toBeDefined()
      expect(data.token).toBeDefined()
    })
  })

  // ---- Project Files ----

  describe("GET /api/projects/:id/files", () => {
    it("lists files for a project", async () => {
      const data = await $fetch<Array<{ id: string; pdfFileName: string }>>(
        `/api/projects/${seed.projects.floorPlan.id}/files`,
        { headers }
      )

      expect(data.length).toBe(1)
      expect(data[0].pdfFileName).toBe("floor-plan.pdf")
    })
  })
})
