import { relations } from "drizzle-orm"
import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core"
import { user } from "./better-auth/user"

/**
 * History of billing sync operations.
 * Records each full sync or targeted refresh with result metadata.
 */
export const billingSyncLog = pgTable("billing_sync_log", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // "full" | "targeted"
  status: text("status").notNull(), // "in_progress" | "success" | "partial" | "failed"
  subscriptionsSynced: integer("subscriptions_synced"),
  subscriptionsCreated: integer("subscriptions_created"),
  subscriptionsUpdated: integer("subscriptions_updated"),
  errors: integer("errors"),
  errorDetails: text("error_details"), // JSON stringified error info
  duration: integer("duration"), // milliseconds
  triggeredBy: text("triggered_by").notNull(), // Admin user ID
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at")
})

export const billingSyncLogRelations = relations(billingSyncLog, ({ one }) => ({
  triggeredByUser: one(user, {
    fields: [billingSyncLog.triggeredBy],
    references: [user.id]
  })
}))
