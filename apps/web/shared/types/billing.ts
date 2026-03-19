/**
 * Quantitative limits parsed from stripe_plan.limits (populated from Stripe metadata on sync).
 * "unlimited" is represented as -1 for numeric comparisons.
 */
export interface PlanLimits {
  projects: number // -1 = unlimited
  storageMb: number // -1 = unlimited
  fileSizeMb: number
}

/**
 * Feature flags parsed from stripe_plan.metadata.
 * Boolean toggles for feature gating.
 */
export interface PlanFeatures {
  exportFormats: string[] // e.g. ["pdf", "png", "svg"]
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
  amount: number // cents
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
