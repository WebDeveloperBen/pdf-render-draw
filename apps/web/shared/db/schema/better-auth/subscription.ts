import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core"
import { organization } from "./organisation"

/**
 * Subscription table — managed by the Better Auth Stripe plugin.
 * Defined here so Drizzle is aware of it for queries in admin API routes.
 */
export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(),
  plan: text("plan").notNull(),
  referenceId: text("reference_id").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end"),
  cancelAt: timestamp("cancel_at"),
  canceledAt: timestamp("canceled_at"),
  endedAt: timestamp("ended_at"),
  seats: integer("seats"),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  billingInterval: text("billing_interval"),
  stripeScheduleId: text("stripe_schedule_id")
})

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  organization: one(organization, {
    fields: [subscription.referenceId],
    references: [organization.id]
  })
}))
