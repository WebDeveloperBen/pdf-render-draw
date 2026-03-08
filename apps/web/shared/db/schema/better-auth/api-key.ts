import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, boolean, index, integer, jsonb } from "drizzle-orm/pg-core"
import { user } from "./user"

export const apikey = pgTable(
  "api_key",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at"),
    enabled: boolean("enabled").default(true).notNull(),
    rateLimitEnabled: boolean("rate_limit_enabled").default(false).notNull(),
    rateLimitTimeWindow: integer("rate_limit_time_window"),
    rateLimitMax: integer("rate_limit_max"),
    requestCount: integer("request_count").default(0).notNull(),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    permissions: text("permissions"),
    metadata: jsonb("metadata")
  },
  (table) => [index("apikey_userId_idx").on(table.userId)]
)

export const apikeyRelations = relations(apikey, ({ one }) => ({
  user: one(user, {
    fields: [apikey.userId],
    references: [user.id]
  })
}))
