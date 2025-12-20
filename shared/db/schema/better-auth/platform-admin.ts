import { relations } from "drizzle-orm"
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./user"

/**
 * Platform Admin table - stores MetreMate staff with tiered access
 * Tiers: owner (singular), admin, support, viewer
 */
export const platformAdmin = pgTable("platform_admin", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  tier: text("tier").notNull(), // owner, admin, support, viewer
  grantedBy: text("granted_by").references(() => user.id, { onDelete: "set null" }),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()
})

export const platformAdminRelations = relations(platformAdmin, ({ one }) => ({
  user: one(user, {
    fields: [platformAdmin.userId],
    references: [user.id],
    relationName: "platformAdminUser"
  }),
  grantedByUser: one(user, {
    fields: [platformAdmin.grantedBy],
    references: [user.id],
    relationName: "platformAdminGrantedBy"
  })
}))
