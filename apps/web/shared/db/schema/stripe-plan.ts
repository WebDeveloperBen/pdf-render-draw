import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core"

/**
 * Local cache of Stripe products/prices + app-managed plan configuration.
 *
 * Synced fields (from Stripe): stripeProductId, stripePriceId, name, description, amount, currency, interval, active.
 * App-managed fields (set by admin): limits, trialDays, annualDiscountPriceId, lookupKey, group.
 *
 * The Better Auth Stripe plugin reads plans via a dynamic async function
 * that queries this table, so changes here take effect on the next subscription action.
 */
export const stripePlan = pgTable("stripe_plan", {
  id: text("id").primaryKey(),

  // ---- Synced from Stripe ----
  stripeProductId: text("stripe_product_id").notNull(),
  stripePriceId: text("stripe_price_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("aud"),
  interval: text("interval").notNull(), // "month" | "year"
  active: boolean("active").notNull().default(true),

  // ---- App-managed plan config (used by Better Auth Stripe plugin) ----
  annualDiscountPriceId: text("annual_discount_price_id"), // Stripe price ID for annual billing variant
  lookupKey: text("lookup_key"), // Stripe price lookup key (alternative to priceId)
  limits: jsonb("limits"), // e.g. { projects: 50, storage: 100 }
  trialDays: integer("trial_days"), // Free trial period in days (null = no trial)
  group: text("group"), // Plan grouping (e.g. "standard", "premium")

  // ---- Metadata ----
  metadata: jsonb("metadata"), // Extra Stripe metadata
  lastSyncedAt: timestamp("last_synced_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
})
