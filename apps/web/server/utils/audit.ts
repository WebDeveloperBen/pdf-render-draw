import { nanoid } from "nanoid"
import type { H3Event } from "h3"
import { db } from "./drizzle"
import * as schema from "#shared/db/schema"

/**
 * Shared utility for logging admin actions to the audit log.
 * All platform admin actions should use this helper for consistency.
 */
export async function logAdminAction(params: {
  adminId: string
  actionType: string
  targetUserId?: string | null
  targetOrgId?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}) {
  await db.insert(schema.adminAuditLog).values({
    id: nanoid(),
    adminId: params.adminId,
    actionType: params.actionType,
    targetUserId: params.targetUserId ?? null,
    targetOrgId: params.targetOrgId ?? null,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    createdAt: new Date()
  })
}

/**
 * Convenience wrapper that extracts IP and user-agent from the H3 event.
 */
export async function logAdminActionFromEvent(
  event: H3Event,
  params: {
    adminId: string
    actionType: string
    targetUserId?: string | null
    targetOrgId?: string | null
    metadata?: Record<string, unknown>
  }
) {
  return logAdminAction({
    ...params,
    ipAddress: getRequestIP(event, { xForwardedFor: true }) || null,
    userAgent: getRequestHeader(event, "user-agent") || null
  })
}
