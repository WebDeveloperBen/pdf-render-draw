# Stage 6: Frontend Gating

Use `useSubscription()` to conditionally show/hide features, display upgrade prompts, and gate routes. This is cosmetic — backend guards (Stage 5) are authoritative.

## Dependencies

- Stage 2 complete (`useSubscription()` composable)
- Stage 5 complete (backend guards return 403 with plan info)

## 6.1 — Upgrade Prompt Component

A reusable component shown when a user tries to access a gated feature.

### File: `app/components/UpgradePrompt.vue`

```vue
<script setup lang="ts">
import { Sparkles } from "lucide-vue-next"

const props = defineProps<{
  feature: string
  requiredPlan?: string
}>()

const { planName } = useSubscription()
</script>

<template>
  <div class="flex flex-col items-center gap-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
    <div class="flex size-10 items-center justify-center rounded-full bg-primary/10">
      <Sparkles class="size-5 text-primary" />
    </div>
    <div class="space-y-1">
      <p class="font-semibold">{{ feature }} requires an upgrade</p>
      <p class="text-sm text-muted-foreground">
        <template v-if="requiredPlan">
          Available on the {{ requiredPlan }} plan and above.
        </template>
        <template v-else>
          Upgrade your plan to unlock this feature.
        </template>
        You're currently on <span class="font-medium">{{ planName }}</span>.
      </p>
    </div>
    <UiButton to="/pricing" size="sm">
      <Sparkles class="size-4 mr-2" />
      View Plans
    </UiButton>
  </div>
</template>
```

## 6.2 — Feature Gate Component

Wraps content and shows it or replaces it with an upgrade prompt.

### File: `app/components/FeatureGate.vue`

```vue
<script setup lang="ts">
import type { PlanFeatures } from "@shared/types/billing"

const props = defineProps<{
  feature?: keyof PlanFeatures
  minimumPlan?: string
  label: string
}>()

const { canUseFeature, planName } = useSubscription()

const PLAN_TIERS: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  team: 3,
  enterprise: 4
}

const hasAccess = computed(() => {
  if (props.feature) return canUseFeature(props.feature)
  if (props.minimumPlan) {
    const current = PLAN_TIERS[planName.value] ?? 0
    const required = PLAN_TIERS[props.minimumPlan] ?? 0
    return current >= required
  }
  return true
})
</script>

<template>
  <slot v-if="hasAccess" />
  <UpgradePrompt v-else :feature="label" :required-plan="minimumPlan" />
</template>
```

**Usage:**
```vue
<FeatureGate feature="cloudSync" label="Cloud Sync">
  <CloudSyncSettings />
</FeatureGate>

<FeatureGate minimum-plan="professional" label="Advanced Export">
  <ExportOptions />
</FeatureGate>
```

## 6.3 — Handle 403 Responses Globally

When backend guards reject a request, show an upgrade toast instead of a generic error.

### File: update `app/plugins/vue-query.ts` or create an error handler

```typescript
// In the vue-query global error handler, customFetch, or per-composable error handling:
function handleApiError(error: any) {
  if (error?.statusCode === 403 && error?.statusMessage?.includes("upgrade")) {
    toast.error(error.statusMessage)
    // Optionally redirect to pricing
    navigateTo("/pricing")
    return
  }
  // ... existing error handling
}
```

## 6.4 — Gate Specific UI Elements

### Project Creation Modal

In `app/components/projects/CreateProjectModal.vue`:

```vue
<script setup>
const { hasReachedProjectLimit } = useSubscription()
// Fetch current project count from the projects list
const { data: projects } = useGetApiProjects()
const atLimit = computed(() =>
  hasReachedProjectLimit(projects.value?.length ?? 0)
)
</script>

<template>
  <!-- Show limit warning in the modal -->
  <UpgradePrompt
    v-if="atLimit"
    feature="More Projects"
    required-plan="starter"
  />
  <!-- Otherwise show normal creation form -->
</template>
```

### Export Format Selector (Editor)

```vue
<script setup>
const { features } = useSubscription()
</script>

<template>
  <UiSelect v-model="exportFormat">
    <UiSelectItem value="pdf">PDF</UiSelectItem>
    <UiSelectItem
      v-for="format in ['png', 'svg']"
      :key="format"
      :value="format"
      :disabled="!features.exportFormats.includes(format)"
    >
      {{ format.toUpperCase() }}
      <UiBadge v-if="!features.exportFormats.includes(format)" variant="secondary" size="sm">
        Pro
      </UiBadge>
    </UiSelectItem>
  </UiSelect>
</template>
```

### Measurement Presets

```vue
<FeatureGate feature="measurementPresets" label="Measurement Presets">
  <MeasurementPresetsPanel />
</FeatureGate>
```

## 6.5 — Update Sidebar CTA

Replace hardcoded "Free Plan" in `SidebarPricingCta.vue`:

```vue
<script setup lang="ts">
import { Sparkles } from "lucide-vue-next"

const { state } = useSidebar()
const isCollapsed = computed(() => state.value === "collapsed")
const { planName, isFreeTier, limits, isPaid } = useSubscription()

// Only show CTA for users who could benefit from upgrading
const showCta = computed(() => isFreeTier.value || planName.value === "starter")
</script>

<template>
  <div v-if="showCta" class="px-2 pb-2">
    <!-- collapsed: icon only -->
    <NuxtLink v-if="isCollapsed" to="/pricing" ...>
      <Sparkles class="size-4" />
    </NuxtLink>

    <!-- expanded: full CTA -->
    <div v-else ...>
      <span class="text-xs font-semibold">{{ planName === 'free' ? 'Free' : 'Starter' }} Plan</span>
      <span class="text-[10px] text-muted-foreground">
        {{ limits.projects === -1 ? 'Unlimited' : limits.projects }} projects
      </span>
      <UiButton to="/pricing" size="sm" variant="default" class="w-full">Upgrade</UiButton>
    </div>
  </div>
</template>
```

## 6.6 — Organisation Dashboard

Update `app/pages/(dashboard)/organisation/index.vue` to show real plan data:

```vue
<script setup>
const { planName, isActive, isCanceling, subscription } = useSubscription()
</script>

<!-- Replace the hardcoded "Free" stat card -->
<div class="...">
  <CreditCard class="size-4 text-muted-foreground" />
  <span class="text-sm text-muted-foreground">Current subscription</span>
  <span class="text-2xl font-bold capitalize">{{ planName }}</span>
  <UiBadge v-if="isCanceling" variant="destructive" size="sm">Cancelling</UiBadge>
</div>
```

## 6.7 — Subscription-Aware Route Middleware (Optional)

If there are routes that should only be accessible to paid users, add a middleware:

### File: `app/middleware/paid.ts`

```typescript
export default defineNuxtRouteMiddleware(async () => {
  const { isPaid } = useSubscription()

  if (!isPaid.value) {
    return navigateTo("/pricing")
  }
})
```

**Usage in a page:**
```typescript
definePageMeta({
  middleware: ["paid"]
})
```

This is optional — most gating should be at the feature/component level rather than route level.

## Verification Checklist

- [ ] `UpgradePrompt` component renders with correct plan name and feature label
- [ ] `FeatureGate` shows content for authorised plans, prompt for others
- [ ] 403 errors from backend show upgrade toast with "View Plans" action
- [ ] Project creation blocked with upgrade prompt at limit
- [ ] Export format selector shows locked formats with plan badge
- [ ] Sidebar CTA shows real plan name and project limit
- [ ] Organisation dashboard shows real subscription status
- [ ] `FeatureGate` works for both feature flags and minimum plan checks
