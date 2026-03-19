import type { InferInsertModel } from "drizzle-orm"
import type { stripePlan, subscription } from "../../../shared/db/schema"

type StripePlanInsert = InferInsertModel<typeof stripePlan>
type SubscriptionInsert = InferInsertModel<typeof subscription>

export function buildStripePlan(overrides: Partial<StripePlanInsert> = {}): StripePlanInsert {
  return {
    id: "plan-starter",
    stripeProductId: "prod_test_starter",
    stripePriceId: "price_test_starter_monthly",
    name: "Starter",
    description: "For individual tradespeople",
    amount: 1900,
    currency: "aud",
    interval: "month",
    active: true,
    annualDiscountPriceId: null,
    lookupKey: null,
    limits: { projects: 10, storageMb: 500, fileSizeMb: 50 },
    trialDays: null,
    group: "standard",
    metadata: {
      display_order: "1",
      feature_export_formats: "pdf,png",
      feature_measurement_tools: "all",
      feature_cloud_sync: "true",
      feature_collaboration: "false",
      feature_custom_branding: "false",
      feature_measurement_presets: "true",
      limit_projects: "10",
      limit_storage_mb: "500",
      limit_file_size_mb: "50"
    },
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    ...overrides
  }
}

export function buildSubscription(overrides: Partial<SubscriptionInsert> = {}): SubscriptionInsert {
  return {
    id: "sub-test-001",
    plan: "Starter",
    referenceId: overrides.referenceId ?? "org-id",
    stripeCustomerId: "cus_test_001",
    stripeSubscriptionId: "sub_stripe_test_001",
    status: "active",
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    seats: null,
    trialStart: null,
    trialEnd: null,
    billingInterval: "month",
    ...overrides
  }
}
