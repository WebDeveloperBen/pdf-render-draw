import { $fetch } from "@nuxt/test-utils/e2e"
import { describe, it, expect, beforeEach } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { createAuthenticatedUser, type AuthHeaders } from "../helpers/auth"
import { expectError } from "../helpers/api"
import { getTestDb } from "../helpers/db"
import { buildSubscription } from "../fixtures/billing"
import { buildPlatformAdmin } from "../fixtures/admin"
import { patchServerTestState } from "../helpers/test-state"
import {
  account,
  adminAuditLog,
  apikey,
  billingActivity,
  member,
  organization,
  platform_admin,
  project,
  session,
  subscription,
  user
} from "../../../shared/db/schema"
import { eq } from "drizzle-orm"

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

  // ---- GET /api/admin/billing/overview ----

  describe("GET /api/admin/billing/overview", () => {
    it("returns aggregate billing metrics for the admin dashboard", async () => {
      const db = getTestDb()
      await db.insert(subscription).values([
        buildSubscription({
          id: "sub-overview-active",
          referenceId: seed.orgs.acme.id,
          plan: "Starter",
          status: "active",
          stripeCustomerId: "cus_overview_active",
          stripeSubscriptionId: "sub_overview_active"
        }),
        buildSubscription({
          id: "sub-overview-trial",
          referenceId: seed.orgs.demo.id,
          plan: "Starter",
          status: "trialing",
          stripeCustomerId: "cus_overview_trial",
          stripeSubscriptionId: "sub_overview_trial"
        })
      ])

      const data = await $fetch<{
        totalOrganizations: number
        statuses: {
          active: number
          trialing: number
          pastDue: number
          canceled: number
          incomplete: number
        }
        noSubscription: number
        lastSyncedAt: string | null
      }>("/api/admin/billing/overview", {
        headers: adminHeaders
      })

      expect(data).toEqual({
        totalOrganizations: 2,
        statuses: {
          active: 1,
          trialing: 1,
          pastDue: 0,
          canceled: 0,
          incomplete: 0
        },
        noSubscription: 0,
        lastSyncedAt: null
      })
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

  // ---- GET /api/admin/organizations/:id/billing ----

  describe("GET /api/admin/organizations/:id/billing", () => {
    it("returns the free-tier billing summary when the organisation has no subscription", async () => {
      const data = await $fetch<{
        hasSubscription: boolean
        subscription: null
        planTier: string
        billingHealth: string
      }>(`/api/admin/organizations/${seed.orgs.demo.id}/billing`, {
        headers: adminHeaders
      })

      expect(data).toEqual({
        hasSubscription: false,
        subscription: null,
        planTier: "free",
        billingHealth: "inactive"
      })
    })

    it("returns the subscription summary for subscribed organisations", async () => {
      const db = getTestDb()
      await db.insert(subscription).values(
        buildSubscription({
          id: "sub-org-billing-001",
          referenceId: seed.orgs.acme.id,
          plan: "Starter",
          status: "active",
          cancelAtPeriodEnd: true
        })
      )

      const data = await $fetch<{
        hasSubscription: boolean
        subscription: {
          id: string
          plan: string
          status: string
          cancelAtPeriodEnd: boolean | null
        } | null
        planTier: string
        billingHealth: string
      }>(`/api/admin/organizations/${seed.orgs.acme.id}/billing`, {
        headers: adminHeaders
      })

      expect(data.hasSubscription).toBe(true)
      expect(data.subscription).toEqual(
        expect.objectContaining({
          id: "sub-org-billing-001",
          plan: "Starter",
          status: "active",
          cancelAtPeriodEnd: true
        })
      )
      expect(data.planTier).toBe("starter")
      expect(data.billingHealth).toBe("at_risk")
    })
  })

  // ---- POST /api/admin/organizations ----

  describe("POST /api/admin/organizations", () => {
    it("creates an organization for a user", async () => {
      const data = await $fetch<{
        id: string
        name: string
        slug: string
        memberCount: number
        projectCount: number
      }>("/api/admin/organizations", {
        method: "POST",
        headers: adminHeaders,
        body: {
          name: "New Test Org",
          slug: "new-test-org",
          userId: seed.users.regularUser.id
        }
      })

      expect(data.name).toBe("New Test Org")
      expect(data.slug).toBe("new-test-org")
      expect(data.memberCount).toBe(1)
      expect(data.projectCount).toBe(0)
    })

    it("returns 400 for duplicate slugs", async () => {
      await expectError("/api/admin/organizations", 400, {
        method: "POST",
        headers: adminHeaders,
        body: {
          name: "Duplicate Org",
          slug: seed.orgs.acme.slug,
          userId: seed.users.regularUser.id
        }
      })
    })
  })

  // ---- PATCH /api/admin/organizations/:id ----

  describe("PATCH /api/admin/organizations/:id", () => {
    it("updates organization details", async () => {
      const data = await $fetch<{
        id: string
        name: string
        slug: string
        _count: { members: number; projects: number }
      }>(`/api/admin/organizations/${seed.orgs.acme.id}`, {
        method: "PATCH",
        headers: adminHeaders,
        body: {
          name: "Acme Updated",
          slug: "acme-updated"
        }
      })

      expect(data).toEqual(
        expect.objectContaining({
          id: seed.orgs.acme.id,
          name: "Acme Updated",
          slug: "acme-updated",
          _count: {
            members: 4,
            projects: 2
          }
        })
      )
    })
  })

  // ---- DELETE /api/admin/organizations/:id ----

  describe("DELETE /api/admin/organizations/:id", () => {
    it("deletes an organization and disassociates its projects when requested", async () => {
      const data = await $fetch<{
        success: boolean
        message: string
        organizationId: string
        deletedCounts: { members: number; projects: number; invitations: number }
      }>(`/api/admin/organizations/${seed.orgs.demo.id}`, {
        method: "DELETE",
        headers: adminHeaders,
        body: {
          confirmation: true,
          deleteProjects: false
        }
      })

      expect(data).toEqual({
        success: true,
        message: 'Organization "Demo Corp" has been permanently deleted',
        organizationId: seed.orgs.demo.id,
        deletedCounts: {
          members: 2,
          projects: 0,
          invitations: 0
        }
      })

      const db = getTestDb()
      const [deletedOrg] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, seed.orgs.demo.id))
      const demoProjects = await db
        .select({ id: project.id, organizationId: project.organizationId })
        .from(project)
        .where(eq(project.id, seed.projects.electrical.id))
      const auditRows = await db
        .select({ actionType: adminAuditLog.actionType })
        .from(adminAuditLog)
        .where(eq(adminAuditLog.actionType, "organization_delete"))

      expect(deletedOrg).toBeUndefined()
      expect(demoProjects).toEqual([
        {
          id: seed.projects.electrical.id,
          organizationId: null
        }
      ])
      expect(auditRows).toHaveLength(1)
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

  // ---- GET /api/admin/subscriptions/:id/activity ----

  describe("GET /api/admin/subscriptions/:id/activity", () => {
    it("returns the activity timeline with actor details", async () => {
      const db = getTestDb()
      await db.insert(subscription).values(
        buildSubscription({
          id: "sub-activity-001",
          referenceId: seed.orgs.acme.id,
          plan: "Starter"
        })
      )
      await db.insert(billingActivity).values([
        {
          id: "billing-activity-001",
          subscriptionId: "sub-activity-001",
          type: "admin_action",
          description: "Subscription refreshed",
          actorId: seed.users.admin.id,
          metadata: { source: "admin-panel" },
          createdAt: new Date("2025-01-02T00:00:00.000Z")
        },
        {
          id: "billing-activity-002",
          subscriptionId: "sub-activity-001",
          type: "payment",
          description: "Invoice paid",
          actorId: null,
          metadata: null,
          createdAt: new Date("2025-01-01T00:00:00.000Z")
        }
      ])

      const data = await $fetch<{
        activities: Array<{
          id: string
          type: string
          description: string
          actorName: string | null
          actorEmail: string | null
        }>
      }>("/api/admin/subscriptions/sub-activity-001/activity?limit=10&offset=0", {
        headers: adminHeaders
      })

      expect(data.activities).toHaveLength(2)
      expect(data.activities[0]).toEqual(
        expect.objectContaining({
          id: "billing-activity-001",
          type: "admin_action",
          description: "Subscription refreshed",
          actorName: "Platform Owner",
          actorEmail: seed.users.admin.email
        })
      )
      expect(data.activities[1]).toEqual(
        expect.objectContaining({
          id: "billing-activity-002",
          type: "payment",
          description: "Invoice paid",
          actorName: null,
          actorEmail: null
        })
      )
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

  // ---- DELETE /api/admin/users/:id ----

  describe("DELETE /api/admin/users/:id", () => {
    it("soft deletes a user by banning them and revoking active credentials", async () => {
      const data = await $fetch<{
        success: boolean
        message: string
        userId: string
        hardDelete: boolean
      }>(`/api/admin/users/${seed.users.regularUser.id}`, {
        method: "DELETE",
        headers: adminHeaders,
        body: {
          confirmation: true
        }
      })

      const db = getTestDb()
      const [savedUser] = await db
        .select({
          banned: user.banned,
          banReason: user.banReason
        })
        .from(user)
        .where(eq(user.id, seed.users.regularUser.id))
      const revokedSessions = await db
        .select({ id: session.id })
        .from(session)
        .where(eq(session.userId, seed.users.regularUser.id))
      const revokedApiKeys = await db
        .select({ id: apikey.id })
        .from(apikey)
        .where(eq(apikey.userId, seed.users.regularUser.id))
      const auditRows = await db
        .select({ actionType: adminAuditLog.actionType })
        .from(adminAuditLog)
        .where(eq(adminAuditLog.actionType, "user_soft_delete"))

      expect(data).toEqual({
        success: true,
        message: `User ${seed.users.regularUser.email} has been deactivated`,
        userId: seed.users.regularUser.id,
        hardDelete: false
      })
      expect(savedUser).toEqual({
        banned: true,
        banReason: "Account deleted by administrator"
      })
      expect(revokedSessions).toHaveLength(0)
      expect(revokedApiKeys).toHaveLength(0)
      expect(auditRows).toHaveLength(1)
    })

    it("hard deletes a user and their auth records", async () => {
      await createAuthenticatedUser(seed.users.teamMember.id, seed.orgs.acme.id)

      const data = await $fetch<{
        success: boolean
        message: string
        userId: string
        hardDelete: boolean
      }>(`/api/admin/users/${seed.users.teamMember.id}`, {
        method: "DELETE",
        headers: adminHeaders,
        body: {
          confirmation: true,
          hardDelete: true
        }
      })

      const db = getTestDb()
      const [deletedUser] = await db.select({ id: user.id }).from(user).where(eq(user.id, seed.users.teamMember.id))
      const linkedAccounts = await db
        .select({ id: account.id })
        .from(account)
        .where(eq(account.userId, seed.users.teamMember.id))
      const memberships = await db
        .select({ id: member.id })
        .from(member)
        .where(eq(member.userId, seed.users.teamMember.id))
      const deletedSessions = await db
        .select({ id: session.id })
        .from(session)
        .where(eq(session.userId, seed.users.teamMember.id))
      const auditRows = await db
        .select({ actionType: adminAuditLog.actionType })
        .from(adminAuditLog)
        .where(eq(adminAuditLog.actionType, "user_hard_delete"))

      expect(data).toEqual({
        success: true,
        message: `User ${seed.users.teamMember.email} has been permanently deleted`,
        userId: seed.users.teamMember.id,
        hardDelete: true
      })
      expect(deletedUser).toBeUndefined()
      expect(linkedAccounts).toHaveLength(0)
      expect(memberships).toHaveLength(0)
      expect(deletedSessions).toHaveLength(0)
      expect(auditRows).toHaveLength(1)
    })

    it("rejects self-deletion through the admin route", async () => {
      await expectError(`/api/admin/users/${seed.users.admin.id}`, 400, {
        method: "DELETE",
        headers: adminHeaders,
        body: {
          confirmation: true
        }
      })
    })
  })

  // ---- Stripe-calling endpoints: test auth layer only ----

  describe("Admin subscription management (auth layer)", () => {
    it("POST /api/admin/billing/sync - runs and audits successfully", async () => {
      await patchServerTestState({
        billing: {
          fullSyncResult: {
            synced: 3,
            created: 1,
            updated: 2,
            errors: 0,
            duration: 25
          }
        }
      })

      const data = await $fetch<{
        synced: number
        created: number
        updated: number
        errors: number
      }>("/api/admin/billing/sync", {
        method: "POST",
        headers: adminHeaders
      })

      expect(data).toEqual({
        synced: 3,
        created: 1,
        updated: 2,
        errors: 0
      })

      const auditRows = await getTestDb()
        .select({ actionType: adminAuditLog.actionType })
        .from(adminAuditLog)
        .where(eq(adminAuditLog.actionType, "billing.sync.full"))

      expect(auditRows).toHaveLength(1)
    })

    it("POST /api/admin/billing/sync - requires admin", async () => {
      await expectError("/api/admin/billing/sync", 403, {
        method: "POST",
        headers: userHeaders
      })
    })

    it("POST /api/admin/subscriptions/:id/cancel - updates the subscription and writes activity", async () => {
      const db = getTestDb()
      await db.insert(subscription).values(
        buildSubscription({
          id: "sub-cancel-001",
          referenceId: seed.orgs.acme.id,
          plan: "Starter"
        })
      )

      await patchServerTestState({
        billing: {
          cancelStatus: "active"
        }
      })

      const data = await $fetch<{ success: boolean }>("/api/admin/subscriptions/sub-cancel-001/cancel", {
        method: "POST",
        headers: adminHeaders,
        body: {
          mode: "at_period_end",
          reason: "Customer requested cancellation"
        }
      })

      const [savedSubscription] = await db
        .select({
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
        })
        .from(subscription)
        .where(eq(subscription.id, "sub-cancel-001"))
      const activityRows = await db
        .select({ id: billingActivity.id })
        .from(billingActivity)
        .where(eq(billingActivity.subscriptionId, "sub-cancel-001"))
      const auditRows = await db
        .select({ actionType: adminAuditLog.actionType })
        .from(adminAuditLog)
        .where(eq(adminAuditLog.actionType, "billing.subscription.cancel"))

      expect(data).toEqual({ success: true })
      expect(savedSubscription?.cancelAtPeriodEnd).toBe(true)
      expect(activityRows).toHaveLength(1)
      expect(auditRows).toHaveLength(1)
    })

    it("POST /api/admin/subscriptions/:id/cancel - requires admin", async () => {
      await expectError("/api/admin/subscriptions/sub-test/cancel", 403, {
        method: "POST",
        headers: userHeaders
      })
    })

    it("POST /api/admin/subscriptions/:id/cancel - immediate cancellation requires owner tier", async () => {
      const db = getTestDb()
      await db.insert(subscription).values(
        buildSubscription({
          id: "sub-owner-001",
          referenceId: seed.orgs.acme.id,
          plan: "Starter"
        })
      )
      await db.insert(platform_admin).values(
        buildPlatformAdmin({
          id: `${seed.users.teamMember.id}-platform-admin`,
          userId: seed.users.teamMember.id,
          tier: "admin"
        })
      )

      const tieredAdminHeaders = await createAuthenticatedUser(seed.users.teamMember.id, seed.orgs.acme.id)

      await expectError("/api/admin/subscriptions/sub-owner-001/cancel", 403, {
        method: "POST",
        headers: tieredAdminHeaders,
        body: {
          mode: "immediately",
          reason: "Owner-only path"
        }
      })
    })

    it("POST /api/admin/subscriptions/:id/reactivate - updates the subscription and writes activity", async () => {
      const db = getTestDb()
      await db.insert(subscription).values(
        buildSubscription({
          id: "sub-reactivate-001",
          referenceId: seed.orgs.acme.id,
          plan: "Starter",
          cancelAtPeriodEnd: true
        })
      )

      await patchServerTestState({
        billing: {
          reactivateStatus: "active"
        }
      })

      const data = await $fetch<{ success: boolean }>("/api/admin/subscriptions/sub-reactivate-001/reactivate", {
        method: "POST",
        headers: adminHeaders,
        body: {
          reason: "Customer retained"
        }
      })

      const [savedSubscription] = await db
        .select({
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
        })
        .from(subscription)
        .where(eq(subscription.id, "sub-reactivate-001"))
      const auditRows = await db
        .select({ actionType: adminAuditLog.actionType })
        .from(adminAuditLog)
        .where(eq(adminAuditLog.actionType, "billing.subscription.reactivate"))

      expect(data).toEqual({ success: true })
      expect(savedSubscription?.cancelAtPeriodEnd).toBe(false)
      expect(auditRows).toHaveLength(1)
    })

    it("POST /api/admin/subscriptions/:id/reactivate - requires admin", async () => {
      await expectError("/api/admin/subscriptions/sub-test/reactivate", 403, {
        method: "POST",
        headers: userHeaders
      })
    })

    it("POST /api/admin/subscriptions/:id/refresh - refreshes and audits successfully", async () => {
      const db = getTestDb()
      await db.insert(subscription).values(
        buildSubscription({
          id: "sub-refresh-001",
          referenceId: seed.orgs.acme.id,
          plan: "Starter",
          status: "past_due"
        })
      )

      await patchServerTestState({
        billing: {
          refreshStatus: "active"
        }
      })

      const data = await $fetch<{ success: boolean }>("/api/admin/subscriptions/sub-refresh-001/refresh", {
        method: "POST",
        headers: adminHeaders
      })

      const [savedSubscription] = await db
        .select({ status: subscription.status })
        .from(subscription)
        .where(eq(subscription.id, "sub-refresh-001"))
      const auditRows = await db
        .select({ actionType: adminAuditLog.actionType })
        .from(adminAuditLog)
        .where(eq(adminAuditLog.actionType, "billing.sync.refresh"))

      expect(data).toEqual({ success: true })
      expect(savedSubscription?.status).toBe("active")
      expect(auditRows).toHaveLength(1)
    })

    it("POST /api/admin/subscriptions/:id/refresh - requires admin", async () => {
      await expectError("/api/admin/subscriptions/sub-test/refresh", 403, {
        method: "POST",
        headers: userHeaders
      })
    })

    it("POST /api/admin/subscriptions/:id/send-billing-portal-link - returns a link and writes activity", async () => {
      const db = getTestDb()
      await db.insert(subscription).values(
        buildSubscription({
          id: "sub-portal-001",
          referenceId: seed.orgs.acme.id,
          plan: "Starter"
        })
      )

      await patchServerTestState({
        billing: {
          portalUrl: "https://billing.example.com/session/test"
        }
      })

      const data = await $fetch<{ url: string }>("/api/admin/subscriptions/sub-portal-001/send-billing-portal-link", {
        method: "POST",
        headers: adminHeaders,
        body: {
          returnUrl: "https://app.example.com/admin/subscriptions/sub-portal-001"
        }
      })

      const activityRows = await db
        .select({ id: billingActivity.id })
        .from(billingActivity)
        .where(eq(billingActivity.subscriptionId, "sub-portal-001"))
      const auditRows = await db
        .select({ actionType: adminAuditLog.actionType })
        .from(adminAuditLog)
        .where(eq(adminAuditLog.actionType, "billing.portal_link_generated"))

      expect(data).toEqual({
        url: "https://billing.example.com/session/test"
      })
      expect(activityRows).toHaveLength(1)
      expect(auditRows).toHaveLength(1)
    })
  })
})
