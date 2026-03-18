import type { PlanLimits, PlanFeatures } from "@shared/types/billing"

// ---- Subscription & Plan Types ----

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused"

export type PlanTier = "free" | "starter" | "professional" | "team" | "enterprise"

export type BillingHealth = "healthy" | "at_risk" | "action_needed" | "inactive"

export type DataFreshness = "fresh" | "stale" | "unknown"

export type AllowedAction =
  | "refresh"
  | "cancel_at_period_end"
  | "cancel_immediately"
  | "reactivate"
  | "send_billing_portal_link"

// ---- API Response Interfaces ----

export interface BillingOverview {
  totalOrganizations: number
  statuses: {
    active: number
    trialing: number
    pastDue: number
    canceled: number
    incomplete: number
  }
  noSubscription: number
  lastSyncedAt: string | null
}

export interface SubscriptionListItem {
  id: string
  stripeSubscriptionId: string | null
  referenceId: string
  organizationName: string
  organizationSlug: string
  organizationLogo: string | null
  stripeCustomerId: string | null
  plan: string
  planTier: PlanTier
  status: string
  periodStart: string | null
  periodEnd: string | null
  cancelAtPeriodEnd: boolean | null
  billingInterval: string | null
  trialEnd: string | null
}

export interface SubscriptionDetail extends SubscriptionListItem {
  cancelAt: string | null
  canceledAt: string | null
  endedAt: string | null
  trialStart: string | null
  seats: number | null
  stripeScheduleId: string | null
  organizationMemberCount: number
  planInfo: {
    name: string
    amount: number
    currency: string
    interval: string
  } | null
  billingHealth: BillingHealth
  dataFreshness: DataFreshness
  lastSyncedAt: string | null
  lastWebhookAt: string | null
  isEnterpriseManaged: boolean
  allowedActions: AllowedAction[]
}

export interface SubscriptionListParams {
  page?: number
  limit?: number
  search?: string
  status?: string
  plan?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export interface BillingPaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ---- Guard Types ----

export interface OrgBillingContext {
  orgId: string
  planName: string
  limits: PlanLimits
  features: PlanFeatures
  subscriptionStatus: string | null
}
