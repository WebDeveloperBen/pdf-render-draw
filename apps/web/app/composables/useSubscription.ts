import type { PlanLimits, PlanFeatures } from "#shared/types/billing"
import { FREE_TIER_LIMITS, FREE_TIER_FEATURES } from "#shared/types/billing"
import { withResponseData } from "~/utils/customFetch"

/**
 * Reactive subscription state for the current user's active organization.
 * Sources data from the profile endpoint via vue-query (Orval-generated hook).
 * Backend is authoritative — this is a read-only cache for UI gating.
 */
export function useSubscription() {
  const { data: profileData, suspense, refetch } = useGetApiUserProfile(withResponseData())

  const subscription = computed(() => profileData.value?.subscription ?? null)
  const billing = computed(() => profileData.value?.billing ?? null)

  // Plan identity
  const planName = computed(() => (billing.value?.plan as string) ?? "free")
  const isFreeTier = computed(() => planName.value === "free")
  const isStarter = computed(() => planName.value === "starter")
  const isProfessional = computed(() => planName.value === "professional")
  const isTeam = computed(() => planName.value === "team")
  const isEnterprise = computed(() => planName.value === "enterprise")
  const isPaid = computed(() => !isFreeTier.value)

  // Subscription status
  const isActive = computed(() => subscription.value?.status === "active" || subscription.value?.status === "trialing")
  const isTrialing = computed(() => subscription.value?.status === "trialing")
  const isCanceling = computed(() => subscription.value?.cancelAtPeriodEnd === true)
  const trialEnd = computed(() => (subscription.value?.trialEnd ? new Date(subscription.value.trialEnd) : null))

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
    suspense,

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
