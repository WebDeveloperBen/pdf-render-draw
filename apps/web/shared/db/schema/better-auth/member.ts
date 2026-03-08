import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core"
import { user } from "./user"
import { organization } from "./organisation"

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => [index("member_userId_idx").on(table.userId), index("member_organizationId_idx").on(table.organizationId)]
)

export const memberRelations = relations(member, ({ one }) => ({
  user: one(user, {
    fields: [member.userId],
    references: [user.id]
  }),
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id]
  })
}))
