import { createAuthMiddleware } from "better-auth/api"
import { nanoid } from "nanoid"
import { db } from "../server/utils/drizzle"
import * as schema from "../shared/db/schema"

/**
 * Admin actions worth auditing. Maps Better Auth admin paths to action types.
 * Platform-admin actions (grant/revoke/update-tier) are excluded —
 * they're already logged by the platform-admin plugin directly.
 */
const AUDITED_ACTIONS: Record<string, string> = {
  "/admin/ban-user": "user_banned",
  "/admin/unban-user": "user_unbanned",
  "/admin/impersonate-user": "impersonation_started",
  "/admin/stop-impersonating": "impersonation_stopped",
  "/admin/set-role": "role_changed",
  "/admin/remove-user": "user_removed",
  "/admin/revoke-user-session": "session_revoked",
  "/admin/revoke-user-sessions": "sessions_revoked",
  "/admin/set-user-password": "password_set_by_admin"
}

function logAdminAction(params: {
  adminId: string
  actionType: string
  targetUserId?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}) {
  // Fire-and-forget — don't block the response
  db.insert(schema.adminAuditLog)
    .values({
      id: nanoid(),
      adminId: params.adminId,
      actionType: params.actionType,
      targetUserId: params.targetUserId ?? null,
      targetOrgId: null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      createdAt: new Date()
    })
    .catch((error) => {
      console.error("[Audit Log] Failed to log admin action:", error)
    })
}

export function createAuditHook() {
  return createAuthMiddleware(async (ctx) => {
    const actionType = AUDITED_ACTIONS[ctx.path]
    if (!actionType) return

    const session = ctx.context.session
    if (!session?.user?.id) return

    // Check the response succeeded — don't log failed attempts
    const response = ctx.context.returned
    if (response instanceof Response && !response.ok) return

    const ipAddress = ctx.request?.headers.get("x-forwarded-for") || null
    const userAgent = ctx.request?.headers.get("user-agent") || null
    const body = (ctx.body ?? {}) as Record<string, unknown>

    // For stop-impersonating, the session belongs to the impersonated user.
    // The actual admin is stored in `impersonatedBy`.
    let adminId = session.user.id
    let targetUserId = (body.userId as string) ?? null

    if (ctx.path === "/admin/stop-impersonating") {
      const impersonatedBy = (session as { impersonatedBy?: string }).impersonatedBy
      if (impersonatedBy) {
        adminId = impersonatedBy
        targetUserId = session.user.id
      }
    }

    // Build metadata from the request body (exclude sensitive fields)
    const { password, newPassword, ...safeMeta } = body
    const metadata = Object.keys(safeMeta).length > 0 ? safeMeta : undefined

    logAdminAction({
      adminId,
      actionType,
      targetUserId,
      metadata,
      ipAddress,
      userAgent
    })
  })
}
