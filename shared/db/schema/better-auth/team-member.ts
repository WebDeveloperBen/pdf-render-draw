import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core"
import { team } from "./team"
import { user } from "./user"

export const teamMember = pgTable(
  "team_member",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => [index("teamMember_teamId_idx").on(table.teamId), index("teamMember_userId_idx").on(table.userId)]
)
