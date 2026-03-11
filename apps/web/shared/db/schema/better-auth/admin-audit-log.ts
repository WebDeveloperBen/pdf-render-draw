import { relations } from "drizzle-orm"
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./user"

/**
 * Admin Audit Log table - tracks all platform admin actions
 */
export const admin_audit_log = pgTable("admin_audit_log", {
  id: text("id").primaryKey(),
  adminId: text("admin_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  actionType: text("action_type").notNull(),
  targetUserId: text("target_user_id"),
  targetOrgId: text("target_org_id"),
  metadata: text("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export const admin_audit_logRelations = relations(admin_audit_log, ({ one }) => ({
  admin: one(user, {
    fields: [admin_audit_log.adminId],
    references: [user.id],
    relationName: "auditLogAdmin"
  })
}))

// Alias for backwards compatibility with existing code
export { admin_audit_log as adminAuditLog }
