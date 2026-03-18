# Stage 4: Pricing Pages

Unify the pricing page and onboarding plan page to use real plan data from the API, connect purchase CTAs to the checkout flow.

## Dependencies

- Stage 1 complete (public `GET /api/plans` endpoint)
- Stage 3 complete (`useCheckout()` composable)

## 4.1 — Rewrite `pricing.vue`

Replace hardcoded plan arrays with data from `GET /api/plans`. Connect CTAs to `useCheckout()`.

### Key Changes

**Remove:**
- Hardcoded `tiers` array (lines 25-83)
- Static "Coming soon" tooltips on CTAs
- Static "Current Plan" button

**Replace with:**
```vue
<script setup lang="ts">
const { data: plansData } = useGetApiPlans() // Orval-generated hook
const { planName, isFreeTier } = useSubscription()
const { checkout, isLoading } = useCheckout()

// Free tier is defined locally (no Stripe product)
const freeTier = {
  name: "Free",
  description: "Perfect for trying out PDF annotations",
  amount: 0,
  features: FREE_TIER_FEATURES,
  limits: FREE_TIER_LIMITS
}

// Combine free tier + API plans
const allPlans = computed(() => {
  const apiPlans = plansData.value?.plans ?? []
  return [freeTier, ...apiPlans]
})

function handleUpgrade(plan: PlanInfo) {
  if (plan.name.toLowerCase() === "enterprise") {
    navigateTo("/support") // contact sales
    return
  }
  checkout(plan.name)
}

function ctaLabel(plan: { name: string }) {
  const name = plan.name.toLowerCase()
  if (name === "free") return "Current Plan"
  if (name === planName.value) return "Current Plan"
  return `Upgrade to ${plan.name}`
}

function isCurrentPlan(plan: { name: string }) {
  const name = plan.name.toLowerCase()
  return name === planName.value || (name === "free" && isFreeTier.value)
}
</script>
```

**CTA buttons — replace disabled tooltips with working buttons:**
```vue
<UiButton
  :variant="isCurrentPlan(plan) ? 'outline' : 'default'"
  :disabled="isCurrentPlan(plan) || isLoading"
  class="w-full"
  @click="handleUpgrade(plan)"
>
  <UiSpinner v-if="isLoading" class="size-4 mr-2" />
  {{ ctaLabel(plan) }}
</UiButton>
```

**Feature list — render from plan features/limits instead of hardcoded arrays:**
```vue
<ul class="space-y-3">
  <li class="flex items-start gap-3">
    <Check class="size-4 mt-0.5 shrink-0 text-primary" />
    <span class="text-sm">
      {{ plan.limits.projects === -1 ? 'Unlimited' : plan.limits.projects }} projects
    </span>
  </li>
  <li class="flex items-start gap-3">
    <component :is="plan.features.cloudSync ? Check : X" ... />
    <span class="text-sm">Cloud sync & backup</span>
  </li>
  <!-- etc. -->
</ul>
```

### Feature Comparison Table

The comparison table can stay mostly as-is but should use computed data from the plans API rather than hardcoded values. Create a helper that maps plan features to table rows.

## 4.2 — Rewrite `onboarding/plan.vue`

### Key Changes

- Replace the hardcoded `plans` array with data from `GET /api/plans`
- Use the same plan names (Starter, Professional, Team, Enterprise)
- Replace the dead `navigateTo("/checkout?plan=...")` with `checkout(planName)`
- Remove the `// In production, you'd create a Stripe checkout session here` comment

```typescript
const { data: plansData } = useGetApiPlans()
const { checkout, isLoading } = useCheckout()

const handleComplete = async () => {
  isSubmitting.value = true
  try {
    wizardData.value.selectedPlan = selectedPlan.value
    await $fetch("/api/user/onboarding", { method: "POST", body: wizardData.value })
    toast.success("Profile completed!")

    if (selectedPlan.value === "enterprise") {
      navigateTo("/support")
    } else {
      // Actually trigger Stripe checkout
      await checkout(selectedPlan.value)
    }
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to complete onboarding")
  } finally {
    isSubmitting.value = false
  }
}
```

## 4.3 — Update Plan Name Constants

Ensure all references use the canonical plan names:

| Display Name | Internal Key (lowercase) | Stripe Product Name |
|-------------|-------------------------|-------------------|
| Free | `free` | (no product) |
| Starter | `starter` | Starter |
| Professional | `professional` | Professional |
| Team | `team` | Team |
| Enterprise | `enterprise` | Enterprise |

Search for and replace any references to "Pro" (from the old pricing.vue) or mismatched names.

## 4.4 — Enterprise CTA

Enterprise doesn't go through Stripe Checkout — it goes to a contact form. The existing "Contact Sales" button in the Enterprise CTA section already links to `/support`. Keep this as-is.

If a dedicated contact-sales page is needed later, create it. For now, the support page is fine.

## 4.5 — FAQ Updates

Update the FAQ data in `pricing.vue` to reflect the actual plan names:
- "Free" → "Free"
- "Pro" → references should be "Starter" or "Professional" as appropriate
- "Team" → "Team"
- Seat pricing: "$10/month" → "$25/month" per the actual pricing

## 4.6 — Annual Toggle (Optional — can defer)

The `stripe_plan` schema supports `annualDiscountPriceId`. If annual pricing is set up in Stripe:

```vue
<script setup>
const billingInterval = ref<"month" | "year">("month")
</script>

<template>
  <div class="flex items-center gap-3">
    <span>Monthly</span>
    <UiSwitch v-model="billingInterval" />
    <span>Annual <UiBadge variant="secondary">Save 20%</UiBadge></span>
  </div>
</template>
```

Pass `annual: true` to `checkout()` when the toggle is on. Defer this if annual prices aren't set up yet.

## Verification Checklist

- [ ] `pricing.vue` loads plans from `GET /api/plans` API
- [ ] Free tier displayed without an API call (hardcoded constants)
- [ ] Current plan shows "Current Plan" button (disabled)
- [ ] Upgrade buttons trigger Stripe Checkout for paid plans
- [ ] Enterprise CTA goes to support/contact page
- [ ] `onboarding/plan.vue` uses real checkout flow
- [ ] No hardcoded plan arrays remain in either page
- [ ] FAQ text matches actual plan names and pricing
- [ ] Feature comparison table driven by plan data
