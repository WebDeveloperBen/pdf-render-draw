import { relations } from "drizzle-orm"
import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core"
import { user } from "./better-auth/user"
import { subscription } from "./better-auth/subscription"

/**
 * Timeline entries for the subscription detail page.
 * Records lifecycle events, admin actions, sync events, and payment events.
 */
export const billingActivity = pgTable("billing_activity", {
  id: text("id").primaryKey(),
  subscriptionId: text("subscription_id")
    .notNull()
    .references(() => subscription.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "lifecycle" | "admin_action" | "sync" | "payment"
  description: text("description").notNull(),
  actorId: text("actor_id"), // Admin user ID for admin actions
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export const billingActivityRelations = relations(billingActivity, ({ one }) => ({
  subscription: one(subscription, {
    fields: [billingActivity.subscriptionId],
    references: [subscription.id]
  }),
  actor: one(user, {
    fields: [billingActivity.actorId],
    references: [user.id]
  })
}))
