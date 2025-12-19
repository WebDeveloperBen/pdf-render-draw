import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core"
import { session } from "./session"
import { account } from "./account"
import { member } from "./member"
import { teamMember } from "./team-member"
import { apiKey } from "./api-key"
import { invitation } from "./invitation"

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull()
})

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  teamMembers: many(teamMember),
  apiKeys: many(apiKey),
  invitations: many(invitation)
}))
