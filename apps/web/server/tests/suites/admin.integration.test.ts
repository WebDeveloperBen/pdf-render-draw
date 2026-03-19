import { $fetch } from "@nuxt/test-utils/e2e"
import { describe, it, expect, beforeEach } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { createAuthenticatedUser, type AuthHeaders } from "../helpers/auth"
import { expectError } from "../helpers/api"
import { getTestDb } from "../helpers/db"
import { buildSubscription } from "../fixtures/billing"
import { subscription } from "../../../shared/db/schema"

describe("Admin API", () => {
  let seed: SeededData
  let adminHeaders: AuthHeaders
  let userHeaders: AuthHeaders

  beforeEach(async () => {
    seed = await seedStandardScenario(getTestDb())
    adminHeaders = await createAuthenticatedUser(seed.users.admin.id, seed.orgs.acme.id)
    userHeaders = await createAuthenticatedUser(seed.users.regularUser.id, seed.orgs.acme.id)
  })

  // ---- Middleware enforcement ----

  describe("Admin middleware", () => {
    it("returns 403 for non-admin users on all admin routes", async () => {
      await expectError("/api/admin/stats", 403, { headers: userHeaders })
      await expectError("/api/admin/users", 403, { headers: userHeaders })
      await expectError("/api/admin/organizations", 403, { headers: userHeaders })
      await expectError("/api/admin/plans", 403, { headers: userHeaders })
      await expectError("/api/admin/subscriptions", 403, { headers: userHeaders })
    })

    it("returns 401 for unauthenticated requests", async () => {
      await expectError("/api/admin/stats", 401)
    })
  })

  // ---- GET /api/admin/stats ----

  describe("GET /api/admin/stats", () => {
    it("returns platform-wide statistics", async () => {
      const data = await $fetch<{
        users: { total: number; recentSignups: number; banned: number }
        organizations: { total: number }
        projects: { total: number }
        sessions: { active: number }
      }>("/api/admin/stats", { headers: adminHeaders })

      expect(data.users.total).toBe(4) // 4 seeded users
      expect(data.organizations.total).toBe(2) // 2 seeded orgs
      expect(data.projects.total).toBe(3) // 3 seeded projects
      expect(data.sessions.active).toBeGreaterThanOrEqual(1)
    })
  })

  // ---- GET /api/admin/users ----

  describe("GET /api/admin/users", () => {
    it("lists all platform users", async () => {
      const data = await $fetch<{
        users: Array<{ id: string; email: string }>
        pagination: { total: number }
      }>("/api/admin/users", {
        headers: adminHeaders
      })

      expect(data.users.length).toBeGreaterThanOrEqual(4)
      expect(data.pagination.total).toBeGreaterThanOrEqual(4)
    })
  })

  // ---- GET /api/admin/users/:id ----

  describe("GET /api/admin/users/:id", () => {
    it("returns user details", async () => {
      const data = await $fetch<{ id: string; email: string }>(
        `/api/admin/users/${seed.users.regularUser.id}`,
        { headers: adminHeaders }
      )

      expect(data.id).toBe(seed.users.regularUser.id)
      expect(data.email).toBe(seed.users.regularUser.email)
    })

    it("returns 404 for non-existent user", async () => {
      await expectError("/api/admin/users/00000000-0000-4000-8000-000000000099", 404, { headers: adminHeaders })
    })
  })

  // ---- GET /api/admin/organizations ----

  describe("GET /api/admin/organizations", () => {
    it("lists all organizations", async () => {
      const data = await $fetch<{
        organizations: Array<{ id: string; name: string }>
        pagination: { total: number }
      }>("/api/admin/organizations", {
        headers: adminHeaders
      })

      expect(data.organizations.length).toBeGreaterThanOrEqual(2)
      expect(data.pagination.total).toBeGreaterThanOrEqual(2)
      const names = data.organizations.map((o) => o.name)
      expect(names).toContain("Acme Construction")
      expect(names).toContain("Demo Corp")
    })
  })

  // ---- GET /api/admin/organizations/:id ----

  describe("GET /api/admin/organizations/:id", () => {
    it("returns organization details", async () => {
      const data = await $fetch<{ id: string; name: string }>(
        `/api/admin/organizations/${seed.orgs.acme.id}`,
        { headers: adminHeaders }
      )

      expect(data.id).toBe(seed.orgs.acme.id)
      expect(data.name).toBe("Acme Construction")
    })
  })

  // ---- GET /api/admin/plans ----

  describe("GET /api/admin/plans", () => {
    it("lists all plans (including inactive)", async () => {
      const data = await $fetch<{ plans: Array<{ id: string; name: string }> }>("/api/admin/plans", {
        headers: adminHeaders
      })

      expect(data.plans.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ---- GET /api/admin/subscriptions ----

  describe("GET /api/admin/subscriptions", () => {
    it("lists all subscriptions", async () => {
      // Seed a subscription
      const db = getTestDb()
      await db.insert(subscription).values(
        buildSubscription({
          id: "sub-acme-001",
          referenceId: seed.orgs.acme.id,
          plan: "Starter"
        })
      )

      const data = await $fetch<{
        subscriptions: Array<{ id: string; plan: string }>
        pagination: { total: number }
      }>("/api/admin/subscriptions", {
        headers: adminHeaders
      })

      expect(data.subscriptions.length).toBeGreaterThanOrEqual(1)
      expect(data.pagination.total).toBeGreaterThanOrEqual(1)
    })
  })

  // ---- GET /api/admin/subscriptions/:id ----

  describe("GET /api/admin/subscriptions/:id", () => {
    it("returns subscription details", async () => {
      const db = getTestDb()
      await db.insert(subscription).values(
        buildSubscription({
          id: "sub-detail-001",
          referenceId: seed.orgs.acme.id,
          plan: "Starter"
        })
      )

      const data = await $fetch<{ id: string; plan: string }>(
        "/api/admin/subscriptions/sub-detail-001",
        { headers: adminHeaders }
      )

      expect(data.id).toBe("sub-detail-001")
      expect(data.plan).toBe("Starter")
    })
  })

  // ---- GET /api/admin/audit-log ----

  describe("GET /api/admin/audit-log", () => {
    it("returns audit log entries", async () => {
      const data = await $fetch<{
        entries: Array<unknown>
        pagination: { total: number }
        actionTypes: string[]
      }>("/api/admin/audit-log", {
        headers: adminHeaders
      })

      expect(data.entries).toBeInstanceOf(Array)
      expect(data.pagination.total).toBeGreaterThanOrEqual(0)
      expect(data.actionTypes).toBeInstanceOf(Array)
    })
  })

  // ---- Stripe-calling endpoints: test auth layer only ----

  describe("Admin subscription management (auth layer)", () => {
    it("POST /api/admin/billing/sync - requires admin", async () => {
      await expectError("/api/admin/billing/sync", 403, {
        method: "POST",
        headers: userHeaders
      })
    })

    it("POST /api/admin/subscriptions/:id/cancel - requires admin", async () => {
      await expectError("/api/admin/subscriptions/sub-test/cancel", 403, {
        method: "POST",
        headers: userHeaders
      })
    })

    it("POST /api/admin/subscriptions/:id/reactivate - requires admin", async () => {
      await expectError("/api/admin/subscriptions/sub-test/reactivate", 403, {
        method: "POST",
        headers: userHeaders
      })
    })

    it("POST /api/admin/subscriptions/:id/refresh - requires admin", async () => {
      await expectError("/api/admin/subscriptions/sub-test/refresh", 403, {
        method: "POST",
        headers: userHeaders
      })
    })
  })
})
