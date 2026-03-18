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
