# Stage 2: Subscription State Exposure

Enhance the profile endpoint to include the active org's subscription, then build a `useSubscription()` composable so the frontend can cache and react to subscription state.

## Dependencies

- Stage 1 complete (plan data in DB, types defined)

## 2.1 — Enhance `GET /api/user/profile`

Add subscription and plan data for the user's active organization. This avoids a separate API call and gives the frontend everything it needs in one request.

### File: `server/api/user/profile.get.ts`

> **Pattern note:** This is a Nitro API route — use `useDrizzle()` for DB access and auto-imported table names (`subscription`, `stripePlan`), not `import * as schema`. Import drizzle operators (`eq`, `and`, `inArray`) from `"drizzle-orm"`. Import the shared billing helpers from `@shared/types/billing` and `../utils/billing/billing.helpers`.

Add after the existing `userProfile` query, before the return:

```typescript
import { eq, and, inArray } from "drizzle-orm"
import type { PlanLimits } from "@shared/types/billing"
import { FREE_TIER_LIMITS, FREE_TIER_FEATURES } from "@shared/types/billing"
import { parseFeaturesFromMetadata } from "../utils/billing/billing.helpers"

// ... existing userProfile query ...

// Get the user's active org from the session
const activeOrgId = session.session.activeOrganizationId

let subscriptionData = null
let planLimits = FREE_TIER_LIMITS
let planFeatures = FREE_TIER_FEATURES
let planName = "free"

if (activeOrgId) {
  // Find active subscription for this org
  const orgSub = await db.query.subscription.findFirst({
    where: and(
      eq(subscription.referenceId, activeOrgId),
      inArray(subscription.status, ["active", "trialing"])
    )
  })

  if (orgSub) {
    // Look up the plan details from our local cache
    const plan = await db.query.stripePlan.findFirst({
      where: eq(stripePlan.name, orgSub.plan)
    })

    const metadata = (plan?.metadata ?? {}) as Record<string, string>

    planName = orgSub.plan.toLowerCase()
    planLimits = plan?.limits ? (plan.limits as PlanLimits) : FREE_TIER_LIMITS
    planFeatures = parseFeaturesFromMetadata(metadata)

    subscriptionData = {
      id: orgSub.id,
      plan: orgSub.plan,
      status: orgSub.status,
      periodEnd: orgSub.periodEnd,
      cancelAtPeriodEnd: orgSub.cancelAtPeriodEnd,
      trialEnd: orgSub.trialEnd,
      seats: orgSub.seats,
      billingInterval: orgSub.billingInterval
    }
  }
}

return {
  ...userProfile,
  activeOrganizationId: activeOrgId,
  subscription: subscriptionData,
  billing: {
    plan: planName,
    limits: planLimits,
    features: planFeatures
  }
}
```

Update the `defineRouteMeta` OpenAPI response schema to include `subscription` and `billing`. Orval will generate the correct TypeScript types from this — **do not manually type these in `api.ts`**:

```typescript
subscription: {
  type: "object",
  nullable: true,
  properties: {
    id: { type: "string" },
    plan: { type: "string" },
    status: { type: "string" },
    periodEnd: { type: "string", format: "date-time", nullable: true },
    cancelAtPeriodEnd: { type: "boolean", nullable: true },
    trialEnd: { type: "string", format: "date-time", nullable: true },
    seats: { type: "number", nullable: true },
    billingInterval: { type: "string", nullable: true }
  }
},
billing: {
  type: "object",
  properties: {
    plan: { type: "string" },
    limits: { type: "object" },
    features: { type: "object" }
  }
}
```

## 2.2 — Create `useSubscription()` Composable

### File: `app/composables/useSubscription.ts`

```typescript
import type { PlanLimits, PlanFeatures } from "@shared/types/billing"
import { FREE_TIER_LIMITS, FREE_TIER_FEATURES } from "@shared/types/billing"

/**
 * Reactive subscription state for the current user's active organization.
 * Sources data from the profile endpoint via vue-query (Orval-generated hook).
 * Backend is authoritative — this is a read-only cache for UI gating.
 */
export function useSubscription() {
  // Orval-generated vue-query hook — types come from the OpenAPI schema on the profile endpoint
  const { data: profile, suspense, refetch } = useGetApiUserProfile()

  const subscription = computed(() => profile.value?.subscription ?? null)
  const billing = computed(() => profile.value?.billing ?? null)

  // Plan identity
  const planName = computed(() => billing.value?.plan ?? "free")
  const isFreeTier = computed(() => planName.value === "free")
  const isStarter = computed(() => planName.value === "starter")
  const isProfessional = computed(() => planName.value === "professional")
  const isTeam = computed(() => planName.value === "team")
  const isEnterprise = computed(() => planName.value === "enterprise")
  const isPaid = computed(() => !isFreeTier.value)

  // Subscription status
  const isActive = computed(() =>
    subscription.value?.status === "active" || subscription.value?.status === "trialing"
  )
  const isTrialing = computed(() => subscription.value?.status === "trialing")
  const isCanceling = computed(() => subscription.value?.cancelAtPeriodEnd === true)
  const trialEnd = computed(() =>
    subscription.value?.trialEnd ? new Date(subscription.value.trialEnd) : null
  )

  // Limits (for UI display — backend enforces)
  const limits = computed<PlanLimits>(() => billing.value?.limits ?? FREE_TIER_LIMITS)
  const features = computed<PlanFeatures>(() => billing.value?.features ?? FREE_TIER_FEATURES)

  // Convenience checks
  const canUseFeature = (feature: keyof PlanFeatures): boolean => {
    const val = features.value[feature]
    if (typeof val === "boolean") return val
    if (typeof val === "string") return val !== "basic"
    if (Array.isArray(val)) return val.length > 1
    return false
  }

  const hasReachedProjectLimit = (currentCount: number): boolean => {
    const limit = limits.value.projects
    return limit !== -1 && currentCount >= limit
  }

  return {
    // Raw data
    subscription,
    billing,
    refetch,

    // Plan identity
    planName,
    isFreeTier,
    isStarter,
    isProfessional,
    isTeam,
    isEnterprise,
    isPaid,

    // Status
    isActive,
    isTrialing,
    isCanceling,
    trialEnd,

    // Limits & features
    limits,
    features,
    canUseFeature,
    hasReachedProjectLimit
  }
}
```

## 2.3 — Usage Examples

### In a component (checking plan):
```vue
<script setup lang="ts">
const { planName, isPaid, isFreeTier, canUseFeature, limits } = useSubscription()
</script>

<template>
  <div>
    <p>Current plan: {{ planName }}</p>
    <UiBadge v-if="isFreeTier" variant="secondary">Free</UiBadge>
    <div v-if="canUseFeature('cloudSync')">
      <!-- Cloud sync UI -->
    </div>
  </div>
</template>
```

### In the sidebar CTA:
```vue
<script setup lang="ts">
const { planName, isFreeTier, limits } = useSubscription()
</script>

<template>
  <!-- Only show upgrade CTA for free/starter users -->
  <div v-if="isFreeTier || planName === 'starter'">
    <span>{{ planName === 'free' ? 'Free' : 'Starter' }} Plan</span>
    <span>{{ limits.projects === -1 ? 'Unlimited' : limits.projects }} projects</span>
    <UiButton to="/pricing">Upgrade</UiButton>
  </div>
</template>
```

## 2.4 — Regenerate Orval Types

After updating the profile endpoint's OpenAPI schema:

```bash
pnpm orval
```

## 2.5 — Cache Strategy

The profile endpoint is already called on app load. Vue-query defaults handle caching:

- **staleTime:** 5 minutes (matches Better Auth cookie cache `maxAge`)
- **Refetch on window focus:** Yes (catches subscription changes made in another tab or Stripe portal)
- **Invalidation:** Call `refetch()` after checkout success or plan change

No additional cache layer needed — vue-query's in-memory cache is sufficient.

## Verification Checklist

- [ ] `GET /api/user/profile` returns `subscription` and `billing` objects
- [ ] Free users get `subscription: null` and `billing.plan: "free"` with free tier limits
- [ ] Subscribed users get full subscription details and correct plan limits/features
- [ ] `useSubscription()` composable returns reactive computed properties
- [ ] Orval types regenerated with new profile shape
- [ ] Switching active org updates the subscription data on next profile fetch
