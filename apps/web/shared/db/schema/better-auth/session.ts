import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core"
import { user } from "./user"
import { organization } from "./organisation"
import { team } from "./team"

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
    activeOrganizationId: text("active_organization_id"),
    activeTeamId: text("active_team_id")
  },
  (table) => [index("session_userId_idx").on(table.userId)]
)

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id]
  }),
  activeOrganization: one(organization, {
    fields: [session.activeOrganizationId],
    references: [organization.id]
  }),
  activeTeam: one(team, {
    fields: [session.activeTeamId],
    references: [team.id]
  })
}))
