import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core"
import { user } from "./better-auth"
import { projectShare } from "./project-share"

export const projectShareRecipient = pgTable(
  "project_share_recipient",
  {
    id: text("id").primaryKey(),
    shareId: text("share_id")
      .notNull()
      .references(() => projectShare.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    status: text("status").notNull().default("pending"), // 'pending' | 'viewed' | 'expired'

    // Tracking
    invitedAt: timestamp("invited_at").defaultNow().notNull(),
    firstViewedAt: timestamp("first_viewed_at"),
    lastViewedAt: timestamp("last_viewed_at"),
    viewCount: integer("view_count").default(0).notNull(),

    // Link to guest user once they authenticate via magic link
    userId: text("user_id").references(() => user.id, { onDelete: "set null" })
  },
  (table) => [
    index("projectShareRecipient_shareId_idx").on(table.shareId),
    index("projectShareRecipient_email_idx").on(table.email),
    uniqueIndex("projectShareRecipient_share_email_idx").on(table.shareId, table.email)
  ]
)

export const projectShareRecipientRelations = relations(projectShareRecipient, ({ one }) => ({
  share: one(projectShare, {
    fields: [projectShareRecipient.shareId],
    references: [projectShare.id]
  }),
  user: one(user, {
    fields: [projectShareRecipient.userId],
    references: [user.id]
  })
}))
