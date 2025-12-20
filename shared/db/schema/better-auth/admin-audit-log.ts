import { relations } from "drizzle-orm"
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./user"

/**
 * Admin Audit Log table - tracks all platform admin actions
 */
export const adminAuditLog = pgTable("admin_audit_log", {
  id: text("id").primaryKey(),
  adminId: text("admin_id")
    .notNull()
    .references(() => user.id, { onDelete: "set null" }),
  actionType: text("action_type").notNull(),
  targetUserId: text("target_user_id"),
  targetOrgId: text("target_org_id"),
  metadata: text("metadata"), // JSON stringified
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
  admin: one(user, {
    fields: [adminAuditLog.adminId],
    references: [user.id],
    relationName: "adminAuditLogs"
  }),
  targetUser: one(user, {
    fields: [adminAuditLog.targetUserId],
    references: [user.id],
    relationName: "targetedAuditLogs"
  })
}))
