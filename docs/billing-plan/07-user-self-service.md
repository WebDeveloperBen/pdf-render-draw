# Stage 7: User Self-Service

Give users visibility and control over their subscription without needing to contact support or use the Stripe dashboard directly.

## Dependencies

- Stage 2 complete (`useSubscription()` composable)
- Stage 3 complete (`useCheckout()` with `openBillingPortal()`)

## 7.1 — Billing Settings Section

Add a billing section to the existing settings or organisation page. This gives org owners/admins visibility into their subscription and a way to manage it.

### File: `app/pages/(dashboard)/organisation/billing.vue` (new page)

Or add as a section within the existing organisation page — depends on how settings are structured. A dedicated page keeps it clean.

```vue
<script setup lang="ts">
import { CreditCard, ExternalLink, Calendar, Users } from "lucide-vue-next"

definePageMeta({ layout: "default" })
useSeoMeta({ title: "Billing" })

const { subscription, planName, isFreeTier, isPaid, isTrialing, isCanceling, trialEnd, limits } =
  useSubscription()
const { openBillingPortal, isLoading } = useCheckout()
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <div>
      <h1 class="text-2xl font-bold">Billing</h1>
      <p class="text-muted-foreground">Manage your subscription and billing details</p>
    </div>

    <!-- Current Plan Card -->
    <UiCard>
      <UiCardHeader>
        <div class="flex items-center justify-between">
          <div>
            <UiCardTitle>Current Plan</UiCardTitle>
            <UiCardDescription>
              <span class="capitalize">{{ planName }}</span>
              <UiBadge v-if="isTrialing" variant="secondary" class="ml-2">Trial</UiBadge>
              <UiBadge v-if="isCanceling" variant="destructive" class="ml-2">Cancelling</UiBadge>
            </UiCardDescription>
          </div>
          <UiButton v-if="isFreeTier" to="/pricing" variant="default">
            Upgrade
          </UiButton>
        </div>
      </UiCardHeader>

      <UiCardContent v-if="isPaid" class="space-y-4">
        <!-- Subscription details -->
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="space-y-1">
            <p class="text-sm text-muted-foreground flex items-center gap-1.5">
              <CreditCard class="size-3.5" /> Billing
            </p>
            <p class="text-sm font-medium capitalize">
              {{ subscription?.billingInterval ?? "monthly" }}
            </p>
          </div>

          <div class="space-y-1">
            <p class="text-sm text-muted-foreground flex items-center gap-1.5">
              <Calendar class="size-3.5" /> Next billing date
            </p>
            <p class="text-sm font-medium">
              {{ subscription?.periodEnd
                ? new Date(subscription.periodEnd).toLocaleDateString()
                : "—"
              }}
            </p>
          </div>

          <div v-if="subscription?.seats" class="space-y-1">
            <p class="text-sm text-muted-foreground flex items-center gap-1.5">
              <Users class="size-3.5" /> Seats
            </p>
            <p class="text-sm font-medium">{{ subscription.seats }}</p>
          </div>
        </div>

        <!-- Trial info -->
        <div
          v-if="isTrialing && trialEnd"
          class="rounded-md bg-primary/5 border border-primary/20 p-3"
        >
          <p class="text-sm">
            Your trial ends on
            <span class="font-medium">{{ trialEnd.toLocaleDateString() }}</span>.
            Add a payment method to continue after your trial.
          </p>
        </div>

        <!-- Cancellation info -->
        <div
          v-if="isCanceling"
          class="rounded-md bg-destructive/5 border border-destructive/20 p-3"
        >
          <p class="text-sm">
            Your subscription will end on
            <span class="font-medium">
              {{ subscription?.periodEnd
                ? new Date(subscription.periodEnd).toLocaleDateString()
                : "the end of your billing period"
              }}
            </span>.
            You can reactivate from the billing portal.
          </p>
        </div>
      </UiCardContent>

      <!-- Free tier content -->
      <UiCardContent v-else class="space-y-3">
        <p class="text-sm text-muted-foreground">
          You're on the free plan. Upgrade to unlock more projects, advanced tools, and cloud sync.
        </p>
        <div class="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{{ limits.projects }} project</span>
          <span>{{ limits.fileSizeMb }} MB uploads</span>
          <span>PDF export only</span>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Manage Subscription (paid users) -->
    <UiCard v-if="isPaid">
      <UiCardHeader>
        <UiCardTitle>Manage Subscription</UiCardTitle>
        <UiCardDescription>
          Update payment method, change plan, view invoices, or cancel
        </UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <div class="flex flex-wrap gap-3">
          <UiButton
            variant="outline"
            :disabled="isLoading"
            @click="openBillingPortal('/organisation/billing')"
          >
            <ExternalLink class="size-4 mr-2" />
            Open Billing Portal
          </UiButton>
          <UiButton variant="outline" to="/pricing">
            Compare Plans
          </UiButton>
        </div>
        <p class="mt-3 text-xs text-muted-foreground">
          The billing portal is powered by Stripe and lets you update your card,
          download invoices, and manage your subscription.
        </p>
      </UiCardContent>
    </UiCard>

    <!-- Usage Summary -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Usage</UiCardTitle>
        <UiCardDescription>Current usage against your plan limits</UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <!-- Populate with actual project count, storage used, etc. -->
        <div class="space-y-4">
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span>Projects</span>
              <span class="text-muted-foreground">
                <!-- projectCount / limit -->
              </span>
            </div>
            <!-- Progress bar -->
          </div>
        </div>
      </UiCardContent>
    </UiCard>
  </div>
</template>
```

## 7.2 — Add Billing Link to Navigation

Add a "Billing" item to the organisation section of the sidebar or settings navigation.

In the sidebar data or navigation config, add:

```typescript
{
  title: "Billing",
  url: "/organisation/billing",
  icon: CreditCard
}
```

## 7.3 — Billing-Related Notifications

Show in-app banners for billing states that need user attention:

### Past Due
When subscription status is `past_due`, show a warning banner at the top of the dashboard:

```vue
<div
  v-if="subscription?.status === 'past_due'"
  class="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm"
>
  <p>
    <strong>Payment failed.</strong> Please update your payment method to keep your subscription active.
    <UiButton variant="link" class="h-auto p-0 ml-1" @click="openBillingPortal()">
      Update payment method
    </UiButton>
  </p>
</div>
```

### Trial Ending Soon
When trial ends within 3 days:

```vue
<div
  v-if="isTrialing && trialEnd && trialEnd.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000"
  class="rounded-md bg-primary/10 border border-primary/20 p-3 text-sm"
>
  <p>
    Your trial ends in {{ Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) }} days.
    <NuxtLink to="/organisation/billing" class="font-medium text-primary hover:underline">
      Add a payment method
    </NuxtLink>
    to continue using all features.
  </p>
</div>
```

Place these in the default layout or a dedicated `BillingBanner.vue` component rendered in the layout.

## 7.4 — Update FAQ Data

Update `app/data/faq.json` "Account & Billing" section to reference the billing page:

- "How do I manage my subscription?" → "Go to Organisation > Billing, or click 'Open Billing Portal' to manage your subscription directly with Stripe."
- "How do I update my payment method?" → "Open the Billing Portal from your billing page."
- "Where can I find my invoices?" → "In the Stripe Billing Portal, accessible from Organisation > Billing."

## Verification Checklist

- [ ] Billing page shows current plan name, status, and period
- [ ] Free users see upgrade prompt on billing page
- [ ] Paid users can open Stripe billing portal
- [ ] Trial users see trial end date and "add payment" prompt
- [ ] Cancelling users see cancellation date and reactivation option
- [ ] Billing link appears in sidebar/navigation
- [ ] Past due banner shown for failed payments
- [ ] Trial ending soon banner shown within 3 days of expiry
- [ ] FAQ references updated to point to billing page
