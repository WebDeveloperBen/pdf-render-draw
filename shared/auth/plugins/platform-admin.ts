import type { BetterAuthPlugin } from "better-auth"
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api"
import { z } from "zod"

/**
 * Platform Admin Tiers
 * - owner: Singular, full control, only one who can manage platform admins
 * - admin: Full platform access, can delete users/orgs
 * - support: Help users - impersonate, ban/unban, view data
 * - viewer: Read-only dashboards and reports
 */
export type PlatformAdminTier = "owner" | "admin" | "support" | "viewer"

// Tier hierarchy for comparison
export const TIER_LEVELS: Record<PlatformAdminTier, number> = {
  viewer: 1,
  support: 2,
  admin: 3,
  owner: 4
}

/**
 * Check if a tier meets the minimum required tier
 */
export function hasTier(userTier: PlatformAdminTier | undefined, minimumTier: PlatformAdminTier): boolean {
  if (!userTier) return false
  return TIER_LEVELS[userTier] >= TIER_LEVELS[minimumTier]
}

// Type definitions for database records
interface PlatformAdminRecord {
  id: string
  userId: string
  tier: string
  grantedBy: string | null
  grantedAt: Date
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

interface UserRecord {
  id: string
  name: string
  email: string
  image?: string | null
}

interface AuditLogRecord {
  id: string
  adminId: string
  actionType: string
  targetUserId: string | null
  targetOrgId: string | null
  metadata: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

/**
 * Platform Admin Plugin for better-auth
 * Provides tiered platform admin management separate from organization roles
 */
export const platformAdminPlugin = () => {
  return {
    id: "platform-admin",

    // Database schema
    // Use snake_case model names to match Drizzle's casing convention
    schema: {
      platform_admin: {
        fields: {
          userId: {
            type: "string",
            required: true,
            unique: true,
            references: { model: "user", field: "id", onDelete: "cascade" }
          },
          tier: {
            type: "string",
            required: true
          },
          grantedBy: {
            type: "string",
            references: { model: "user", field: "id", onDelete: "set null" }
          },
          grantedAt: {
            type: "date",
            required: true
          },
          notes: {
            type: "string"
          }
        }
      },
      admin_audit_log: {
        fields: {
          adminId: {
            type: "string",
            required: true,
            references: { model: "user", field: "id", onDelete: "set null" }
          },
          actionType: {
            type: "string",
            required: true
          },
          targetUserId: {
            type: "string"
          },
          targetOrgId: {
            type: "string"
          },
          metadata: {
            type: "string" // JSON stringified
          },
          ipAddress: {
            type: "string"
          },
          userAgent: {
            type: "string"
          }
        }
      }
    },

    // Custom endpoints
    endpoints: {
      // GET /platform-admin/me - Get current user's platform admin status
      getPlatformAdminStatus: createAuthEndpoint(
        "/platform-admin/me",
        {
          method: "GET",
          use: [sessionMiddleware]
        },
        async (ctx) => {
          const session = ctx.context.session

          if (!session) {
            return ctx.json({ isPlatformAdmin: false, tier: null })
          }

          try {
            const admin = (await ctx.context.adapter.findOne({
              model: "platform_admin",
              where: [{ field: "userId", value: session.user.id }]
            })) as PlatformAdminRecord | null

            if (!admin) {
              return ctx.json({ isPlatformAdmin: false, tier: null })
            }

            return ctx.json({
              isPlatformAdmin: true,
              tier: admin.tier as PlatformAdminTier,
              grantedAt: admin.grantedAt,
              notes: admin.notes
            })
          } catch {
            return ctx.json({ isPlatformAdmin: false, tier: null })
          }
        }
      ),

      // GET /platform-admin/list - List all platform admins (viewer+ only)
      listPlatformAdmins: createAuthEndpoint(
        "/platform-admin/list",
        {
          method: "GET",
          use: [sessionMiddleware]
        },
        async (ctx) => {
          const session = ctx.context.session
          if (!session) {
            throw ctx.error("UNAUTHORIZED", { message: "Not authenticated" })
          }

          // Check if requester is a platform admin
          const requester = (await ctx.context.adapter.findOne({
            model: "platform_admin",
            where: [{ field: "userId", value: session.user.id }]
          })) as PlatformAdminRecord | null

          if (!requester || !hasTier(requester.tier as PlatformAdminTier, "viewer")) {
            throw ctx.error("FORBIDDEN", { message: "Platform admin access required" })
          }

          // Get all platform admins with user info
          const admins = (await ctx.context.adapter.findMany({
            model: "platform_admin"
          })) as PlatformAdminRecord[]

          // Fetch user details for each admin
          const adminsWithUsers = await Promise.all(
            admins.map(async (admin) => {
              const user = (await ctx.context.adapter.findOne({
                model: "user",
                where: [{ field: "id", value: admin.userId }]
              })) as UserRecord | null

              let grantedByUser: UserRecord | null = null
              if (admin.grantedBy) {
                grantedByUser = (await ctx.context.adapter.findOne({
                  model: "user",
                  where: [{ field: "id", value: admin.grantedBy }]
                })) as UserRecord | null
              }

              return {
                id: admin.id,
                tier: admin.tier,
                grantedAt: admin.grantedAt,
                notes: admin.notes,
                user: user
                  ? {
                      id: user.id,
                      name: user.name,
                      email: user.email,
                      image: user.image
                    }
                  : null,
                grantedBy: grantedByUser
                  ? {
                      id: grantedByUser.id,
                      name: grantedByUser.name,
                      email: grantedByUser.email
                    }
                  : null
              }
            })
          )

          return ctx.json({ admins: adminsWithUsers })
        }
      ),

      // POST /platform-admin/grant - Grant platform admin (owner only)
      grantPlatformAdmin: createAuthEndpoint(
        "/platform-admin/grant",
        {
          method: "POST",
          use: [sessionMiddleware],
          body: z.object({
            userId: z.string(),
            tier: z.enum(["admin", "support", "viewer"]), // Cannot grant owner
            notes: z.string().optional()
          })
        },
        async (ctx) => {
          const session = ctx.context.session
          if (!session) {
            throw ctx.error("UNAUTHORIZED", { message: "Not authenticated" })
          }

          // Check if requester is the owner
          const requester = (await ctx.context.adapter.findOne({
            model: "platform_admin",
            where: [{ field: "userId", value: session.user.id }]
          })) as PlatformAdminRecord | null

          if (!requester || requester.tier !== "owner") {
            throw ctx.error("FORBIDDEN", { message: "Only the platform owner can manage platform admins" })
          }

          const { userId, tier, notes } = ctx.body

          // Check if user exists
          const targetUser = (await ctx.context.adapter.findOne({
            model: "user",
            where: [{ field: "id", value: userId }]
          })) as UserRecord | null

          if (!targetUser) {
            throw ctx.error("NOT_FOUND", { message: "User not found" })
          }

          // Check if already a platform admin
          const existing = (await ctx.context.adapter.findOne({
            model: "platform_admin",
            where: [{ field: "userId", value: userId }]
          })) as PlatformAdminRecord | null

          if (existing) {
            throw ctx.error("BAD_REQUEST", { message: "User is already a platform admin" })
          }

          // Create platform admin
          const admin = (await ctx.context.adapter.create({
            model: "platform_admin",
            data: {
              id: crypto.randomUUID(),
              userId,
              tier,
              grantedBy: session.user.id,
              grantedAt: new Date(),
              notes: notes || null
            }
          })) as PlatformAdminRecord

          // Log the action
          await ctx.context.adapter.create({
            model: "admin_audit_log",
            data: {
              id: crypto.randomUUID(),
              adminId: session.user.id,
              actionType: "platform_admin_granted",
              targetUserId: userId,
              metadata: JSON.stringify({ tier, notes }),
              ipAddress: ctx.request?.headers.get("x-forwarded-for") || null,
              userAgent: ctx.request?.headers.get("user-agent") || null
            }
          })

          return ctx.json({
            success: true,
            admin: {
              id: admin.id,
              userId: admin.userId,
              tier: admin.tier,
              grantedAt: admin.grantedAt
            }
          })
        }
      ),

      // POST /platform-admin/update-tier - Change tier (owner only)
      updatePlatformAdminTier: createAuthEndpoint(
        "/platform-admin/update-tier",
        {
          method: "POST",
          use: [sessionMiddleware],
          body: z.object({
            userId: z.string(),
            tier: z.enum(["admin", "support", "viewer"]) // Cannot change to owner
          })
        },
        async (ctx) => {
          const session = ctx.context.session
          if (!session) {
            throw ctx.error("UNAUTHORIZED", { message: "Not authenticated" })
          }

          // Check if requester is the owner
          const requester = (await ctx.context.adapter.findOne({
            model: "platform_admin",
            where: [{ field: "userId", value: session.user.id }]
          })) as PlatformAdminRecord | null

          if (!requester || requester.tier !== "owner") {
            throw ctx.error("FORBIDDEN", { message: "Only the platform owner can manage platform admins" })
          }

          const { userId, tier } = ctx.body

          // Find the target admin
          const targetAdmin = (await ctx.context.adapter.findOne({
            model: "platform_admin",
            where: [{ field: "userId", value: userId }]
          })) as PlatformAdminRecord | null

          if (!targetAdmin) {
            throw ctx.error("NOT_FOUND", { message: "Platform admin not found" })
          }

          // Cannot change owner tier
          if (targetAdmin.tier === "owner") {
            throw ctx.error("FORBIDDEN", { message: "Cannot change owner tier" })
          }

          const oldTier = targetAdmin.tier

          // Update tier
          await ctx.context.adapter.update({
            model: "platform_admin",
            where: [{ field: "userId", value: userId }],
            update: { tier }
          })

          // Log the action
          await ctx.context.adapter.create({
            model: "admin_audit_log",
            data: {
              id: crypto.randomUUID(),
              adminId: session.user.id,
              actionType: "platform_admin_tier_changed",
              targetUserId: userId,
              metadata: JSON.stringify({ oldTier, newTier: tier }),
              ipAddress: ctx.request?.headers.get("x-forwarded-for") || null,
              userAgent: ctx.request?.headers.get("user-agent") || null
            }
          })

          return ctx.json({ success: true, tier })
        }
      ),

      // POST /platform-admin/revoke - Revoke platform admin (owner only)
      revokePlatformAdmin: createAuthEndpoint(
        "/platform-admin/revoke",
        {
          method: "POST",
          use: [sessionMiddleware],
          body: z.object({
            userId: z.string()
          })
        },
        async (ctx) => {
          const session = ctx.context.session
          if (!session) {
            throw ctx.error("UNAUTHORIZED", { message: "Not authenticated" })
          }

          // Check if requester is the owner
          const requester = (await ctx.context.adapter.findOne({
            model: "platform_admin",
            where: [{ field: "userId", value: session.user.id }]
          })) as PlatformAdminRecord | null

          if (!requester || requester.tier !== "owner") {
            throw ctx.error("FORBIDDEN", { message: "Only the platform owner can manage platform admins" })
          }

          const { userId } = ctx.body

          // Find the target admin
          const targetAdmin = (await ctx.context.adapter.findOne({
            model: "platform_admin",
            where: [{ field: "userId", value: userId }]
          })) as PlatformAdminRecord | null

          if (!targetAdmin) {
            throw ctx.error("NOT_FOUND", { message: "Platform admin not found" })
          }

          // Cannot revoke owner
          if (targetAdmin.tier === "owner") {
            throw ctx.error("FORBIDDEN", { message: "Cannot revoke owner access" })
          }

          // Delete platform admin
          await ctx.context.adapter.delete({
            model: "platform_admin",
            where: [{ field: "userId", value: userId }]
          })

          // Log the action
          await ctx.context.adapter.create({
            model: "admin_audit_log",
            data: {
              id: crypto.randomUUID(),
              adminId: session.user.id,
              actionType: "platform_admin_revoked",
              targetUserId: userId,
              metadata: JSON.stringify({ revokedTier: targetAdmin.tier }),
              ipAddress: ctx.request?.headers.get("x-forwarded-for") || null,
              userAgent: ctx.request?.headers.get("user-agent") || null
            }
          })

          return ctx.json({ success: true })
        }
      ),

      // GET /platform-admin/audit-log - Get audit log (viewer+ only)
      getAuditLog: createAuthEndpoint(
        "/platform-admin/audit-log",
        {
          method: "GET",
          use: [sessionMiddleware],
          query: z.object({
            limit: z.coerce.number().optional().default(50),
            offset: z.coerce.number().optional().default(0)
          })
        },
        async (ctx) => {
          const session = ctx.context.session
          if (!session) {
            throw ctx.error("UNAUTHORIZED", { message: "Not authenticated" })
          }

          // Check if requester is a platform admin
          const requester = (await ctx.context.adapter.findOne({
            model: "platform_admin",
            where: [{ field: "userId", value: session.user.id }]
          })) as PlatformAdminRecord | null

          if (!requester || !hasTier(requester.tier as PlatformAdminTier, "viewer")) {
            throw ctx.error("FORBIDDEN", { message: "Platform admin access required" })
          }

          const { limit, offset } = ctx.query

          // Get audit logs
          const logs = (await ctx.context.adapter.findMany({
            model: "admin_audit_log",
            limit,
            offset,
            sortBy: { field: "createdAt", direction: "desc" }
          })) as AuditLogRecord[]

          // Enrich with user info
          const enrichedLogs = await Promise.all(
            logs.map(async (log) => {
              const admin = (await ctx.context.adapter.findOne({
                model: "user",
                where: [{ field: "id", value: log.adminId }]
              })) as UserRecord | null

              let targetUser: UserRecord | null = null
              if (log.targetUserId) {
                targetUser = (await ctx.context.adapter.findOne({
                  model: "user",
                  where: [{ field: "id", value: log.targetUserId }]
                })) as UserRecord | null
              }

              return {
                id: log.id,
                actionType: log.actionType,
                createdAt: log.createdAt,
                ipAddress: log.ipAddress,
                metadata: log.metadata ? JSON.parse(log.metadata) : null,
                admin: admin
                  ? {
                      id: admin.id,
                      name: admin.name,
                      email: admin.email
                    }
                  : null,
                targetUser: targetUser
                  ? {
                      id: targetUser.id,
                      name: targetUser.name,
                      email: targetUser.email
                    }
                  : null
              }
            })
          )

          return ctx.json({ logs: enrichedLogs })
        }
      )
    }
  } satisfies BetterAuthPlugin
}
