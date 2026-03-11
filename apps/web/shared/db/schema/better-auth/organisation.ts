import { relations } from "drizzle-orm"
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { team } from "./team"
import { invitation } from "./invitation"
import { member } from "./member"
import { subscription } from "./subscription"

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Added by Better Auth Stripe plugin (org billing)
  stripeCustomerId: text("stripe_customer_id")
})

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  teams: many(team),
  subscriptions: many(subscription)
}))
