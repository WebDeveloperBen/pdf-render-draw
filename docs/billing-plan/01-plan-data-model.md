# Stage 1: Plan Data Model

Set up Stripe products, define the metadata convention, enhance the sync, and expose plans via a public API.

## Prerequisites

- Stripe account with test mode enabled
- `.env` has `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Database migrated (migration 0015 applied)

## 1.1 — Create Stripe Products & Prices

In the Stripe Dashboard (or via CLI), create four products with recurring prices:

### Starter
- **Product name:** `Starter`
- **Price:** $29.00 AUD/month
- **Metadata on product:**
  ```
  limit_projects: "5"
  limit_storage_mb: "100"
  limit_file_size_mb: "25"
  feature_export_formats: "pdf"
  feature_measurement_tools: "basic"
  feature_cloud_sync: "false"
  feature_collaboration: "false"
  feature_custom_branding: "false"
  feature_measurement_presets: "false"
  display_order: "1"
  ```

### Professional
- **Product name:** `Professional`
- **Price:** $79.00 AUD/month
- **Metadata on product:**
  ```
  limit_projects: "unlimited"
  limit_storage_mb: "500"
  limit_file_size_mb: "50"
  feature_export_formats: "pdf,png,svg"
  feature_measurement_tools: "all"
  feature_cloud_sync: "true"
  feature_collaboration: "false"
  feature_custom_branding: "false"
  feature_measurement_presets: "true"
  display_order: "2"
  ```

### Team
- **Product name:** `Team`
- **Price:** $79.00 AUD/month (base, 3 seats included)
- **Metadata on product:**
  ```
  limit_projects: "unlimited"
  limit_storage_mb: "1000"
  limit_file_size_mb: "50"
  limit_included_seats: "3"
  limit_additional_seat_price: "2500"
  feature_export_formats: "pdf,png,svg"
  feature_measurement_tools: "all"
  feature_cloud_sync: "true"
  feature_collaboration: "true"
  feature_custom_branding: "true"
  feature_measurement_presets: "true"
  display_order: "3"
  ```

### Enterprise
- **Product name:** `Enterprise`
- **Price:** Custom (create a $0 placeholder price or skip — handled via sales)
- **Metadata on product:**
  ```
  limit_projects: "unlimited"
  limit_storage_mb: "unlimited"
  limit_file_size_mb: "100"
  feature_export_formats: "pdf,png,svg"
  feature_measurement_tools: "all"
  feature_cloud_sync: "true"
  feature_collaboration: "true"
  feature_custom_branding: "true"
  feature_measurement_presets: "true"
  feature_sla: "true"
  feature_dedicated_support: "true"
  display_order: "4"
  ```

## 1.2 — Define Plan Limits Type

Create a shared type for parsed plan limits so backend guards and frontend gating use the same shape.

### File: `shared/types/billing.ts`

```typescript
/**
 * Quantitative limits parsed from stripe_plan.limits (populated from Stripe metadata on sync).
 * "unlimited" is represented as -1 for numeric comparisons.
 */
export interface PlanLimits {
  projects: number         // -1 = unlimited
  storageMb: number        // -1 = unlimited
  fileSizeMb: number
  includedSeats?: number   // only on team/enterprise
}

/**
 * Feature flags parsed from stripe_plan.metadata.
 * Boolean toggles for feature gating.
 */
export interface PlanFeatures {
  exportFormats: string[]           // e.g. ["pdf", "png", "svg"]
  measurementTools: "basic" | "all"
  cloudSync: boolean
  collaboration: boolean
  customBranding: boolean
  measurementPresets: boolean
  sla?: boolean
  dedicatedSupport?: boolean
}

/**
 * Combined plan info for frontend display and backend enforcement.
 */
export interface PlanInfo {
  id: string
  name: string
  description: string | null
  amount: number          // cents
  currency: string
  interval: string
  limits: PlanLimits
  features: PlanFeatures
  displayOrder: number
  trialDays: number | null
  stripePriceId: string
}

/**
 * Free tier defaults — used when org has no active subscription.
 */
export const FREE_TIER_LIMITS: PlanLimits = {
  projects: 1,
  storageMb: 25,
  fileSizeMb: 10
}

export const FREE_TIER_FEATURES: PlanFeatures = {
  exportFormats: ["pdf"],
  measurementTools: "basic",
  cloudSync: false,
  collaboration: false,
  customBranding: false,
  measurementPresets: false
}
```

## 1.3 — Enhance syncPlans() to Parse Limits

Update `server/utils/billing/billing.sync.ts` — after syncing Stripe fields, parse metadata into the `limits` column.

In the `syncPlans()` method, after setting `stripeValues`, add limit parsing:

```typescript
// Parse quantitative limits from Stripe metadata into the limits column
const parsedLimits = parseLimitsFromMetadata(stripeValues.metadata as Record<string, string>)

// For new plans, set limits from metadata. For existing, only update if limits is null
// (admin may have overridden manually)
if (!existing) {
  // New plan — auto-populate limits from metadata
  values.limits = parsedLimits
} else if (existing.limits === null) {
  // Existing plan with no admin-set limits — populate from metadata
  await db.update(schema.stripePlan)
    .set({ limits: parsedLimits })
    .where(eq(schema.stripePlan.id, existing.id))
}
```

### Helper: `parseLimitsFromMetadata()`

```typescript
function parseLimitsFromMetadata(metadata: Record<string, string>): PlanLimits {
  const parseNum = (val: string | undefined): number => {
    if (!val || val === "unlimited") return -1
    const n = parseInt(val, 10)
    return isNaN(n) ? -1 : n
  }

  return {
    projects: parseNum(metadata.limit_projects),
    storageMb: parseNum(metadata.limit_storage_mb),
    fileSizeMb: parseNum(metadata.limit_file_size_mb),
    ...(metadata.limit_included_seats
      ? { includedSeats: parseInt(metadata.limit_included_seats, 10) }
      : {})
  }
}
```

## 1.4 — Create Public Plans Endpoint

The existing `GET /api/admin/plans` requires platform admin auth. Create a public endpoint for the pricing page.

### File: `server/api/plans/index.get.ts`

> **Note:** This is a Nitro API route — use `useDrizzle()` for DB access and auto-imported table names (e.g. `stripePlan`). Schema namespaced imports (`import * as schema`) are only used in utility files under `server/utils/`. OpenAPI metadata here drives Orval type generation — run `pnpm orval` after creating this file.

```typescript
defineRouteMeta({
  openAPI: {
    tags: ["Plans"],
    summary: "List Plans",
    description: "Get all active subscription plans (public)",
    responses: {
      200: {
        description: "Active plans sorted by display order",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                plans: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      description: { type: "string", nullable: true },
                      amount: { type: "number" },
                      currency: { type: "string" },
                      interval: { type: "string" },
                      limits: { type: "object", nullable: true },
                      features: { type: "object", nullable: true },
                      displayOrder: { type: "number" },
                      trialDays: { type: "number", nullable: true },
                      stripePriceId: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
})

export default defineEventHandler(async () => {
  const db = useDrizzle()

  const plans = await db.query.stripePlan.findMany({
    where: eq(stripePlan.active, true)
  })

  // Parse metadata into structured features and sort by display order
  return {
    plans: plans
      .map((plan) => {
        const metadata = (plan.metadata ?? {}) as Record<string, string>
        return {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          amount: plan.amount,
          currency: plan.currency,
          interval: plan.interval,
          limits: plan.limits,
          features: parseFeaturesFromMetadata(metadata),
          displayOrder: parseInt(metadata.display_order ?? "99", 10),
          trialDays: plan.trialDays,
          stripePriceId: plan.stripePriceId
        }
      })
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }
})
```

### Helper: `parseFeaturesFromMetadata()`

Place in `server/utils/billing/billing.helpers.ts` (shared by plans endpoint and sync):

```typescript
export function parseFeaturesFromMetadata(metadata: Record<string, string>): PlanFeatures {
  return {
    exportFormats: (metadata.feature_export_formats ?? "pdf").split(","),
    measurementTools: (metadata.feature_measurement_tools as "basic" | "all") ?? "basic",
    cloudSync: metadata.feature_cloud_sync === "true",
    collaboration: metadata.feature_collaboration === "true",
    customBranding: metadata.feature_custom_branding === "true",
    measurementPresets: metadata.feature_measurement_presets === "true",
    ...(metadata.feature_sla === "true" ? { sla: true } : {}),
    ...(metadata.feature_dedicated_support === "true" ? { dedicatedSupport: true } : {})
  }
}
```

## 1.5 — Run Initial Sync

After creating the Stripe products:

1. Start the dev server: `pnpm dev`
2. Log in as platform admin
3. Navigate to Admin > Subscriptions
4. Click "Sync from Stripe"
5. Verify plans appear in `stripe_plan` table via Drizzle Studio (`pnpm db:studio`)

## 1.6 — Update `planTierFromName()` in billing.service.ts

The existing helper in `server/utils/billing/billing.service.ts` maps plan names to tiers using old names (`"pro"`). Update to match new plan names:

```typescript
function planTierFromName(planName: string): PlanTier {
  const lower = planName.toLowerCase()
  if (lower === "starter") return "starter"
  if (lower === "professional") return "professional"
  if (lower === "team") return "team"
  if (lower === "enterprise") return "enterprise"
  return "free"
}
```

Also update the `PlanTier` type in the same file:
```typescript
export type PlanTier = "free" | "starter" | "professional" | "team" | "enterprise"
```

This affects the admin subscription list/detail views and the org billing endpoint. Update the OpenAPI schemas on those endpoints and regenerate Orval types after.

## 1.7 — Regenerate API Types

After adding the public plans endpoint and updating OpenAPI schemas:

```bash
pnpm orval
```

This generates the TypeScript types and vue-query hooks in `app/models/api.ts`. The new public endpoint will produce `useGetApiPlans()` and related types automatically — no manual typing needed.

## Verification Checklist

- [ ] Four products created in Stripe Dashboard with correct metadata
- [ ] `syncPlans()` pulls metadata and parses limits
- [ ] `GET /api/plans` returns structured plan data without auth
- [ ] `stripe_plan` table has all four plans after sync
- [ ] Orval types regenerated
- [ ] Free tier constants defined in `shared/types/billing.ts`
