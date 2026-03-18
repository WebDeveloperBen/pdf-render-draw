# Stage 3: Checkout Flow

Wire up end-to-end purchase: user clicks upgrade → Stripe Checkout → returns to app → subscription active.

## Dependencies

- Stage 1 complete (plans in DB with `stripePriceId`)
- Stage 2 complete (`useSubscription()` composable)

## 3.1 — Understand the Better Auth Stripe Client

The `subscriptionClient$` (exported from `auth-client.ts`) provides these methods via Better Auth:

```typescript
// Create a checkout session and redirect to Stripe
subscriptionClient$.upgrade({
  plan: "professional",           // matches plan name in stripe_plan table
  referenceId: orgId,             // organization ID (org-level billing)
  successUrl: "/checkout/success", // where Stripe redirects after payment
  cancelUrl: "/checkout/cancel",   // where Stripe redirects on cancel
  // Optional:
  annual: false,                  // use annual pricing if configured
  seats: 3,                       // for team plans
  metadata: {}                    // passed to Stripe checkout session
})

// Redirect to Stripe billing portal
subscriptionClient$.billingPortal({
  referenceId: orgId,
  returnUrl: "/settings"
})

// List subscriptions for the org
subscriptionClient$.list({
  referenceId: orgId
})

// Cancel (redirects to portal)
subscriptionClient$.cancel({
  referenceId: orgId,
  returnUrl: "/settings"
})
```

These methods are already available via `authClient.subscription` — no backend work needed. Better Auth handles checkout session creation, webhook processing, and subscription record management internally.

## 3.2 — Create Checkout Success Page

### File: `app/pages/(payment)/checkout/success.vue`

```vue
<script setup lang="ts">
import { CheckCircle } from "lucide-vue-next"

definePageMeta({ layout: "default" })
useSeoMeta({ title: "Payment Successful" })

const { refetch, planName } = useSubscription()

// Refetch profile to pick up the new subscription
// (webhook may take a moment — poll briefly)
const isLoading = ref(true)

onMounted(async () => {
  // Give the webhook a moment to process
  await new Promise((resolve) => setTimeout(resolve, 2000))
  await refetch()
  isLoading.value = false
})
</script>

<template>
  <div class="mx-auto max-w-lg space-y-6 py-16 text-center">
    <div class="flex justify-center">
      <div class="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle class="size-8 text-primary" />
      </div>
    </div>

    <div class="space-y-2">
      <h1 class="text-3xl font-bold">Welcome to {{ planName }}!</h1>
      <p class="text-muted-foreground">
        Your subscription is now active. You have full access to all features included in your plan.
      </p>
    </div>

    <div class="flex justify-center gap-3 pt-4">
      <UiButton to="/projects" variant="default">Go to Projects</UiButton>
      <UiButton to="/settings" variant="outline">View Settings</UiButton>
    </div>
  </div>
</template>
```

## 3.3 — Create Checkout Cancel Page

### File: `app/pages/(payment)/checkout/cancel.vue`

```vue
<script setup lang="ts">
import { XCircle } from "lucide-vue-next"

definePageMeta({ layout: "default" })
useSeoMeta({ title: "Checkout Cancelled" })
</script>

<template>
  <div class="mx-auto max-w-lg space-y-6 py-16 text-center">
    <div class="flex justify-center">
      <div class="flex size-16 items-center justify-center rounded-full bg-muted">
        <XCircle class="size-8 text-muted-foreground" />
      </div>
    </div>

    <div class="space-y-2">
      <h1 class="text-3xl font-bold">Checkout cancelled</h1>
      <p class="text-muted-foreground">
        No worries — you haven't been charged. You can upgrade anytime from the pricing page.
      </p>
    </div>

    <div class="flex justify-center gap-3 pt-4">
      <UiButton to="/pricing" variant="default">View Plans</UiButton>
      <UiButton to="/" variant="outline">Back to Dashboard</UiButton>
    </div>
  </div>
</template>
```

## 3.4 — Create Checkout Composable

Encapsulates the upgrade/checkout flow so pricing pages and CTAs share the same logic.

### File: `app/composables/useCheckout.ts`

```typescript
import { toast } from "vue-sonner"

/**
 * Handles Stripe checkout flow via Better Auth subscription client.
 * Wraps subscriptionClient$.upgrade() with loading state and error handling.
 */
export function useCheckout() {
  const isLoading = ref(false)
  // useActiveOrganization() is an existing composable wrapping authClient.useActiveOrganization()
  const { activeOrg } = useActiveOrganization()

  async function checkout(planName: string, options?: { seats?: number; annual?: boolean }) {
    const orgId = activeOrg.value?.data?.id
    if (!orgId) {
      toast.error("No active organization. Please select an organization first.")
      return
    }

    isLoading.value = true

    try {
      const { error } = await subscriptionClient$.upgrade({
        plan: planName.toLowerCase(),
        referenceId: orgId,
        successUrl: `${window.location.origin}/checkout/success`,
        cancelUrl: `${window.location.origin}/checkout/cancel`,
        ...(options?.seats ? { seats: options.seats } : {}),
        ...(options?.annual ? { annual: true } : {})
      })

      if (error) {
        toast.error(error.message || "Failed to start checkout")
      }
      // If no error, Better Auth redirects to Stripe — no further action needed
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.")
    } finally {
      isLoading.value = false
    }
  }

  async function openBillingPortal(returnPath = "/organisation") {
    const orgId = activeOrg.value?.data?.id
    if (!orgId) {
      toast.error("No active organization")
      return
    }

    try {
      await subscriptionClient$.billingPortal({
        referenceId: orgId,
        returnUrl: `${window.location.origin}${returnPath}`
      })
    } catch (err: any) {
      toast.error(err.message || "Failed to open billing portal")
    }
  }

  return {
    checkout,
    openBillingPortal,
    isLoading: readonly(isLoading)
  }
}
```

## 3.5 — Delete the Stub Payment Page

Remove the placeholder `app/pages/(payment)/payment.vue` — it's replaced by the checkout success/cancel pages.

## 3.6 — Webhook Verification

Better Auth's Stripe plugin already handles the core subscription lifecycle webhooks:
- `checkout.session.completed` → creates subscription record
- `customer.subscription.created` → creates/updates subscription
- `customer.subscription.updated` → updates status, period, cancellation
- `customer.subscription.deleted` → marks as canceled

The custom `onEvent` in `auth/stripe.ts` adds invoice tracking on top.

**Test the full flow with Stripe CLI:**

```bash
# Forward webhooks to your local dev server
stripe listen --forward-to localhost:3000/api/auth/stripe/webhook

# Or if Better Auth uses a different webhook path:
stripe listen --forward-to localhost:3000/api/auth/callback/stripe
```

Check the Better Auth docs or source for the exact webhook endpoint path. It's typically mounted under the auth handler at `/api/auth/[...all]`.

## 3.7 — End-to-End Test Flow

1. Log in as a regular user
2. Navigate to `/pricing`
3. Click upgrade on a plan → should redirect to Stripe Checkout
4. Use test card `4242 4242 4242 4242` with any future expiry
5. Complete checkout → redirected to `/checkout/success`
6. Verify `subscription` table has a new record
7. Verify `useSubscription()` returns the new plan
8. Navigate to admin dashboard → verify subscription appears

## Verification Checklist

- [ ] `useCheckout()` composable calls `subscriptionClient$.upgrade()` correctly
- [ ] Stripe Checkout opens with correct plan/price
- [ ] Success page loads and shows new plan name
- [ ] Cancel page loads with return-to-pricing CTA
- [ ] Webhook creates subscription record in DB
- [ ] `useSubscription()` reflects new plan after checkout
- [ ] Billing portal opens via `openBillingPortal()`
- [ ] Stub `payment.vue` deleted
