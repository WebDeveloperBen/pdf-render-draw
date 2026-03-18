# Stage 5: Backend Guards

Server-side enforcement of plan limits and feature access. This is the authoritative layer — frontend gating is cosmetic, backend guards are mandatory.

## Dependencies

- Stage 1 complete (plan limits type, free tier constants)
- Stage 2 complete (subscription state available via DB queries)

## 5.1 — Create Subscription Guard Utility

### File: `server/utils/billing/billing.guards.ts`

> **Pattern note:** This is a utility file under `server/utils/` — use `import { db } from "../drizzle"` and `import * as schema from "@shared/db/schema"` (namespaced). This matches the pattern in `billing.service.ts` and `billing.sync.ts`. Use `import { auth } from "@auth"` for session access. `createError` is auto-imported from h3.

```typescript
import type { H3Event } from "h3"
import { eq, and, inArray, count } from "drizzle-orm"
import { auth } from "@auth"
import { db } from "../drizzle"
import * as schema from "@shared/db/schema"
import type { PlanLimits, PlanFeatures } from "@shared/types/billing"
import { FREE_TIER_LIMITS, FREE_TIER_FEATURES } from "@shared/types/billing"
import { parseFeaturesFromMetadata } from "./billing.helpers"

export interface OrgBillingContext {
  orgId: string
  planName: string
  limits: PlanLimits
  features: PlanFeatures
  subscriptionStatus: string | null
}

/**
 * Resolve the billing context for the current user's active organization.
 * Returns plan name, limits, and features — defaults to free tier if no subscription.
 */
export async function getOrgBillingContext(event: H3Event): Promise<OrgBillingContext> {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" })
  }

  const orgId = session.session.activeOrganizationId
  if (!orgId) {
    return {
      orgId: "",
      planName: "free",
      limits: FREE_TIER_LIMITS,
      features: FREE_TIER_FEATURES,
      subscriptionStatus: null
    }
  }

  const orgSub = await db.query.subscription.findFirst({
    where: and(
      eq(schema.subscription.referenceId, orgId),
      inArray(schema.subscription.status, ["active", "trialing"])
    )
  })

  if (!orgSub) {
    return {
      orgId,
      planName: "free",
      limits: FREE_TIER_LIMITS,
      features: FREE_TIER_FEATURES,
      subscriptionStatus: null
    }
  }

  const plan = await db.query.stripePlan.findFirst({
    where: eq(schema.stripePlan.name, orgSub.plan)
  })

  const metadata = (plan?.metadata ?? {}) as Record<string, string>

  return {
    orgId,
    planName: orgSub.plan.toLowerCase(),
    limits: plan?.limits ? (plan.limits as PlanLimits) : FREE_TIER_LIMITS,
    features: parseFeaturesFromMetadata(metadata),
    subscriptionStatus: orgSub.status
  }
}

/**
 * Require a minimum plan tier. Throws 403 if the org's plan is below the required tier.
 */
const PLAN_TIERS: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  team: 3,
  enterprise: 4
}

export async function requirePlan(event: H3Event, minimumPlan: string): Promise<OrgBillingContext> {
  const ctx = await getOrgBillingContext(event)
  const currentTier = PLAN_TIERS[ctx.planName] ?? 0
  const requiredTier = PLAN_TIERS[minimumPlan] ?? 0

  if (currentTier < requiredTier) {
    throw createError({
      statusCode: 403,
      statusMessage: `This feature requires the ${minimumPlan} plan or higher. Current plan: ${ctx.planName}`
    })
  }

  return ctx
}

/**
 * Require a specific feature to be enabled on the current plan.
 */
export async function requireFeatureAccess(
  event: H3Event,
  feature: keyof PlanFeatures
): Promise<OrgBillingContext> {
  const ctx = await getOrgBillingContext(event)
  const val = ctx.features[feature]

  const hasFeature =
    typeof val === "boolean" ? val :
    typeof val === "string" ? val !== "basic" :
    Array.isArray(val) ? val.length > 1 :
    false

  if (!hasFeature) {
    throw createError({
      statusCode: 403,
      statusMessage: `Your plan does not include ${String(feature)}. Please upgrade.`
    })
  }

  return ctx
}

/**
 * Check if the org has reached its project limit.
 * Call this before creating a new project.
 */
export async function requireProjectQuota(event: H3Event): Promise<OrgBillingContext> {
  const ctx = await getOrgBillingContext(event)

  if (ctx.limits.projects === -1) return ctx // unlimited

  const [result] = await db
    .select({ count: count() })
    .from(schema.project)
    .where(eq(schema.project.organizationId, ctx.orgId))

  if ((result?.count ?? 0) >= ctx.limits.projects) {
    throw createError({
      statusCode: 403,
      statusMessage: `Project limit reached (${ctx.limits.projects}). Please upgrade your plan.`
    })
  }

  return ctx
}

/**
 * Check file size against plan limit.
 * Call this before accepting a file upload.
 */
export function requireFileSizeLimit(ctx: OrgBillingContext, fileSizeBytes: number): void {
  const limitBytes = ctx.limits.fileSizeMb * 1024 * 1024

  if (fileSizeBytes > limitBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: `File size exceeds your plan limit of ${ctx.limits.fileSizeMb} MB. Please upgrade.`
    })
  }
}
```

## 5.2 — Apply Guards to Existing Endpoints

### Project Creation: `server/api/projects/index.post.ts`

Add at the start of the handler:

```typescript
// Check project quota before creating
await requireProjectQuota(event)
```

### File Upload: `server/api/upload/pdf.post.ts` (or `server/api/projects/[id]/files.post.ts`)

```typescript
const ctx = await getOrgBillingContext(event)

// Check file size against plan limit
const body = await readMultipartFormData(event)
const file = body?.find((f) => f.name === "file")
if (file?.data) {
  requireFileSizeLimit(ctx, file.data.byteLength)
}
```

### Export (if server-side): gate PNG/SVG exports

```typescript
const ctx = await getOrgBillingContext(event)
if (format !== "pdf" && !ctx.features.exportFormats.includes(format)) {
  throw createError({
    statusCode: 403,
    statusMessage: `${format.toUpperCase()} export requires a paid plan.`
  })
}
```

## 5.3 — Feature-Gated Endpoints

For any future endpoints that serve plan-gated features:

```typescript
// Require at least Professional plan
await requirePlan(event, "professional")

// Or require a specific feature
await requireFeatureAccess(event, "collaboration")
await requireFeatureAccess(event, "cloudSync")
```

## 5.4 — Endpoints to Guard (Full List)

| Endpoint | Guard | Reason |
|----------|-------|--------|
| `POST /api/projects` | `requireProjectQuota()` | Free: 1, Starter: 5, Pro+: unlimited |
| `POST /api/projects/[id]/files` | `requireFileSizeLimit()` | Free: 10MB, Starter: 25MB, Pro+: 50MB |
| `POST /api/upload/pdf` | `requireFileSizeLimit()` | Same as above |
| `POST /api/projects/[id]/shares` | `requirePlan("starter")` | Sharing requires paid plan |
| `POST /api/files/[id]/annotations/sync` | `requireFeatureAccess("cloudSync")` | Cloud sync is paid |
| Collaboration endpoints (future) | `requireFeatureAccess("collaboration")` | Team+ only |

## 5.5 — Error Response Format

All guards throw standard H3 errors with:
- `statusCode: 403` for plan/feature restrictions
- `statusCode: 413` for file size limits
- `statusMessage` includes the restriction reason and an upgrade prompt

Frontend should catch these and show upgrade prompts (Stage 6).

## 5.6 — Performance Consideration

`getOrgBillingContext()` does 1-2 DB queries (subscription + plan). For hot paths:

- The subscription query is lightweight (indexed by `referenceId` + `status`)
- Plan data is a small table (4 rows) — could be cached in-memory with a 5-minute TTL if needed
- Don't over-optimize until profiling shows it's needed

## Verification Checklist

- [ ] `getOrgBillingContext()` returns correct limits for each plan tier
- [ ] Free users get free tier limits when no subscription exists
- [ ] `requireProjectQuota()` blocks project creation at the limit
- [ ] `requireFileSizeLimit()` rejects oversized uploads with 413
- [ ] `requirePlan()` blocks access below the minimum tier with 403
- [ ] `requireFeatureAccess()` blocks disabled features with 403
- [ ] Error messages include plan name and upgrade prompt
- [ ] Guards applied to all endpoints listed in 5.4
