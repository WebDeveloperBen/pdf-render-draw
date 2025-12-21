import { relations } from "drizzle-orm"
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./user"

/**
 * Platform Admin table - stores platform staff with tiered access
 * Tiers: owner (singular), admin, support, viewer
 */
export const platform_admin = pgTable("platform_admin", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  tier: text("tier").notNull(),
  grantedBy: text("granted_by").references(() => user.id, { onDelete: "set null" }),
  grantedAt: timestamp("granted_at").notNull(),
  notes: text("notes")
})

export const platform_adminRelations = relations(platform_admin, ({ one }) => ({
  user: one(user, {
    fields: [platform_admin.userId],
    references: [user.id],
    relationName: "platformAdminUser"
  }),
  grantedByUser: one(user, {
    fields: [platform_admin.grantedBy],
    references: [user.id],
    relationName: "platformAdminGrantedBy"
  })
}))

// Alias for backwards compatibility with existing code
export { platform_admin as platformAdmin }
