# Billing Implementation Plan

End-to-end Stripe subscription billing — from plan metadata through to purchase flow, enforcement, and self-service.

## Plan Names

| Tier | Stripe Product Name | Internal Key | Price (indicative — set in Stripe) |
|------|-------------------|--------------|-------------------------------------|
| Starter | Starter | `starter` | $29/month |
| Professional | Professional | `professional` | $79/month |
| Team | Team | `team` | $79/month + per-seat add-on |
| Enterprise | Enterprise | `enterprise` | Custom (contact sales) |

Free users have no subscription record — absence of an active subscription = free tier.

## Architecture Summary

```
Stripe Dashboard (source of truth for plans)
  ↓ sync (admin action or webhook)
stripe_plan table (local cache + app-managed limits)
  ↓ read
GET /api/plans (public) → frontend plan display
GET /api/user/profile (enhanced) → current subscription state

Backend guards: session → org → subscription → plan limits → allow/deny
Frontend cache: useSubscription() composable → vue-query → profile data
```

## Stages

Each stage is self-contained with its own doc. Execute in order — each builds on the previous.

| # | Stage | Doc | Revenue Impact |
|---|-------|-----|----------------|
| 1 | [Plan Data Model](./01-plan-data-model.md) | Stripe metadata convention, sync enhancement, public API | Foundation |
| 2 | [Subscription State](./02-subscription-state.md) | Enhance profile endpoint, create `useSubscription()` composable | Foundation |
| 3 | [Checkout Flow](./03-checkout-flow.md) | Wire up `subscriptionClient$`, success/cancel pages | **Revenue-critical** |
| 4 | [Pricing Pages](./04-pricing-pages.md) | Unify and connect to real plan data, enable purchase CTAs | **Revenue-critical** |
| 5 | [Backend Guards](./05-backend-guards.md) | Plan-aware middleware, quota enforcement on API routes | Integrity |
| 6 | [Frontend Gating](./06-frontend-gating.md) | Feature toggles, route guards, upgrade prompts | UX |
| 7 | [User Self-Service](./07-user-self-service.md) | Billing settings page, portal access, dynamic sidebar CTA | Retention |

## Key Decisions

### Plan metadata lives in Stripe, synced to local DB
- Stripe product `metadata` holds feature flags and limits (e.g. `limit_projects: "50"`, `feature_cloud_sync: "true"`)
- `syncPlans()` already pulls `product.metadata` + `price.metadata` into `stripe_plan.metadata`
- The existing `limits` jsonb column stores parsed quantitative limits for fast server-side checks
- Marketing copy (feature lists, descriptions) stored in Stripe product description + metadata
- Admin "Sync from Stripe" button refreshes everything; app-managed fields preserved

### Free tier = no subscription
- No Stripe product for free tier
- Absence of active subscription on the org = free tier with hardcoded defaults
- Simplifies Stripe setup and reduces webhook noise

### Backend always owns enforcement
- Every API route that touches a gated resource checks the org's subscription
- Frontend caches subscription state from the profile endpoint for UI toggling only
- Frontend never makes access decisions — it just hides/shows UI affordances

### Session includes subscription summary
- `GET /api/user/profile` enhanced to return `subscription` object on the active org
- Cached client-side via vue-query with 5-minute stale time
- No JWT changes needed — Better Auth session cookie + profile fetch pattern
