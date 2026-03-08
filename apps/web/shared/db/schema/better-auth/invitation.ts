import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core"
import { user } from "./user"
import { organization } from "./organisation"
import { team } from "./team"

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    teamId: text("team_id")
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email)
  ]
)

export const invitationRelations = relations(invitation, ({ one }) => ({
  inviter: one(user, {
    fields: [invitation.inviterId],
    references: [user.id]
  }),
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id]
  }),
  team: one(team, {
    fields: [invitation.teamId],
    references: [team.id]
  })
}))
