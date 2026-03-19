<script setup lang="ts">
import { toast } from "vue-sonner"
import {
  getApiAdminSubscriptionsId,
  getApiAdminSubscriptionsIdActivity,
  postApiAdminSubscriptionsIdCancel,
  postApiAdminSubscriptionsIdReactivate,
  postApiAdminSubscriptionsIdRefresh,
  postApiAdminSubscriptionsIdSendBillingPortalLink
} from "~/models/api"
import type { GetApiAdminSubscriptionsId200, GetApiAdminSubscriptionsIdActivity200ActivitiesItem } from "~/models/api"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarX,
  CheckCircle,
  Clock,
  CreditCard,
  Dot,
  ExternalLink,
  GitCommitHorizontal,
  HelpCircle,
  MinusCircle,
  RefreshCw,
  Shield,
  Undo2,
  XCircle
} from "lucide-vue-next"
import type { Component } from "vue"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

const route = useRoute("admin-subscriptions-id")
const subscriptionId = computed(() => route.params.id)

// State
const isLoading = ref(true)
const error = ref<string | null>(null)
const detail = ref<GetApiAdminSubscriptionsId200 | null>(null)
const activities = ref<GetApiAdminSubscriptionsIdActivity200ActivitiesItem[]>([])

// Fetch subscription detail
const fetchDetail = async () => {
  isLoading.value = true
  error.value = null
  try {
    const response = await getApiAdminSubscriptionsId(subscriptionId.value)
    detail.value = response.data as GetApiAdminSubscriptionsId200
  } catch (e: any) {
    error.value = e.data?.message || "Failed to load subscription"
  } finally {
    isLoading.value = false
  }
}

// Fetch activity timeline
const fetchActivity = async () => {
  try {
    const response = await getApiAdminSubscriptionsIdActivity(subscriptionId.value)
    activities.value =
      (response.data as { activities?: GetApiAdminSubscriptionsIdActivity200ActivitiesItem[] } | undefined)
        ?.activities ?? []
  } catch {
    // Non-critical — don't block the page
  }
}

// Refresh from Stripe
const isRefreshing = ref(false)
const handleRefresh = async () => {
  isRefreshing.value = true
  try {
    await postApiAdminSubscriptionsIdRefresh(subscriptionId.value, {})
    toast.success("Subscription refreshed from Stripe")
    await fetchDetail()
    await fetchActivity()
  } catch (e: any) {
    toast.error(e.data?.message || "Refresh failed")
  } finally {
    isRefreshing.value = false
  }
}

// Cancel subscription
const showCancelDialog = ref(false)
const cancelMode = ref<"at_period_end" | "immediately">("at_period_end")
const cancelReason = ref("")
const isCancelling = ref(false)

const openCancelDialog = (mode: "at_period_end" | "immediately") => {
  cancelMode.value = mode
  showCancelDialog.value = true
}

const handleCancel = async () => {
  if (!cancelReason.value.trim()) {
    toast.error("Please provide a reason for cancellation")
    return
  }
  isCancelling.value = true
  try {
    await postApiAdminSubscriptionsIdCancel(subscriptionId.value, {
      mode: cancelMode.value,
      reason: cancelReason.value
    })
    toast.success(
      cancelMode.value === "at_period_end"
        ? "Subscription scheduled for cancellation"
        : "Subscription cancelled immediately"
    )
    showCancelDialog.value = false
    cancelReason.value = ""
    await fetchDetail()
    await fetchActivity()
  } catch (e: any) {
    toast.error(e.data?.message || "Cancellation failed")
  } finally {
    isCancelling.value = false
  }
}

// Reactivate subscription
const isReactivating = ref(false)
const handleReactivate = async () => {
  isReactivating.value = true
  try {
    await postApiAdminSubscriptionsIdReactivate(subscriptionId.value, {
      reason: "Admin reactivated scheduled cancellation"
    })
    toast.success("Scheduled cancellation reversed")
    await fetchDetail()
    await fetchActivity()
  } catch (e: any) {
    toast.error(e.data?.message || "Reactivation failed")
  } finally {
    isReactivating.value = false
  }
}

// Billing portal link
const isGeneratingPortal = ref(false)
const handleBillingPortal = async () => {
  isGeneratingPortal.value = true
  try {
    const result = await postApiAdminSubscriptionsIdSendBillingPortalLink(subscriptionId.value, {
      returnUrl: window.location.href
    })
    await navigator.clipboard.writeText((result.data as { url: string }).url)
    toast.success("Billing portal link copied to clipboard")
  } catch (e: any) {
    toast.error(e.data?.message || "Failed to generate portal link")
  } finally {
    isGeneratingPortal.value = false
  }
}

// Helpers
const formatDate = (date: string | null | undefined) => {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
}

const formatRelativeTime = (date: string | null | undefined) => {
  if (!date) return "Never"
  const diff = Date.now() - new Date(date).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return "Less than an hour ago"
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? "s" : ""} ago`
}

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100)
}

const statusConfig: Record<string, { label: string; class: string }> = {
  active: { label: "Active", class: "text-green-600 border-green-600" },
  trialing: { label: "Trial", class: "text-blue-600 border-blue-600" },
  past_due: { label: "Past Due", class: "text-amber-600 border-amber-600" },
  canceled: { label: "Cancelled", class: "text-red-600 border-red-600" },
  incomplete: { label: "Incomplete", class: "text-orange-600 border-orange-600" },
  incomplete_expired: { label: "Expired", class: "text-gray-600 border-gray-600" },
  unpaid: { label: "Unpaid", class: "text-red-600 border-red-600" },
  paused: { label: "Paused", class: "text-gray-600 border-gray-600" }
}

const getStatusConfig = (status: string) =>
  statusConfig[status] || { label: status, class: "text-gray-600 border-gray-600" }

const healthConfig: Record<string, { label: string; icon: Component; class: string }> = {
  healthy: { label: "Healthy", icon: CheckCircle, class: "text-green-500" },
  at_risk: { label: "At Risk", icon: AlertTriangle, class: "text-amber-500" },
  action_needed: { label: "Action Needed", icon: AlertCircle, class: "text-red-500" },
  inactive: { label: "Inactive", icon: MinusCircle, class: "text-gray-400" }
}

const activityTypeConfig: Record<string, { icon: Component; class: string }> = {
  lifecycle: { icon: GitCommitHorizontal, class: "text-blue-500" },
  admin_action: { icon: Shield, class: "text-amber-500" },
  sync: { icon: RefreshCw, class: "text-purple-500" },
  payment: { icon: CreditCard, class: "text-green-500" }
}

useSeoMeta({
  title: computed(() => (detail.value ? `${detail.value.organizationName} — Subscription` : "Subscription Detail"))
})

onMounted(() => {
  fetchDetail()
  fetchActivity()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Back link -->
    <NuxtLink
      to="/admin/subscriptions"
      class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft class="size-4" />
      Back to Subscriptions
    </NuxtLink>

    <!-- Error -->
    <UiAlert v-if="error" variant="destructive">
      <AlertCircle class="size-4" />
      <UiAlertTitle>Error</UiAlertTitle>
      <UiAlertDescription>{{ error }}</UiAlertDescription>
    </UiAlert>

    <!-- Loading -->
    <template v-if="isLoading">
      <div class="space-y-4">
        <div class="h-10 w-64 bg-muted rounded animate-pulse" />
        <div class="grid gap-4 md:grid-cols-2">
          <UiCard v-for="i in 4" :key="i">
            <UiCardHeader><div class="h-4 w-32 bg-muted rounded animate-pulse" /></UiCardHeader>
            <UiCardContent><div class="h-20 bg-muted rounded animate-pulse" /></UiCardContent>
          </UiCard>
        </div>
      </div>
    </template>

    <!-- Detail -->
    <template v-else-if="detail">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-3xl font-bold">{{ detail.organizationName }}</h1>
          <p class="text-muted-foreground mt-1 font-mono text-sm">{{ detail.stripeSubscriptionId || detail.id }}</p>
        </div>
        <div class="flex items-center gap-2">
          <UiBadge variant="outline" :class="getStatusConfig(detail.status).class" class="text-base px-3 py-1">
            {{ getStatusConfig(detail.status).label }}
          </UiBadge>
        </div>
      </div>

      <!-- Stale data warning -->
      <UiAlert
        v-if="detail.dataFreshness === 'stale'"
        variant="warning"
        class="border-amber-300 bg-amber-50 dark:bg-amber-950/20"
      >
        <AlertTriangle class="size-4 text-amber-500" />
        <UiAlertTitle>Data may be outdated</UiAlertTitle>
        <UiAlertDescription class="flex items-center gap-2">
          Last synced {{ formatRelativeTime(detail.lastSyncedAt) }}.
          <UiButton variant="link" size="sm" class="h-auto p-0" :disabled="isRefreshing" @click="handleRefresh">
            Refresh from Stripe
          </UiButton>
        </UiAlertDescription>
      </UiAlert>

      <!-- Cards grid -->
      <div class="grid gap-4 md:grid-cols-2">
        <!-- Subscription Details -->
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Subscription Details</UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Plan</dt>
                <dd class="font-medium capitalize">
                  {{ detail.plan }}
                  <span v-if="detail.planInfo">
                    ({{ formatCurrency(detail.planInfo.amount, detail.planInfo.currency) }}/{{
                      detail.planInfo.interval
                    }})
                  </span>
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Status</dt>
                <dd>
                  <UiBadge variant="outline" :class="getStatusConfig(detail.status).class">
                    {{ getStatusConfig(detail.status).label }}
                  </UiBadge>
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Billing Cycle</dt>
                <dd class="capitalize">{{ detail.billingInterval || "—" }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Current Period</dt>
                <dd>{{ formatDate(detail.periodStart) }} – {{ formatDate(detail.periodEnd) }}</dd>
              </div>
              <div v-if="detail.cancelAtPeriodEnd" class="flex justify-between">
                <dt class="text-muted-foreground">Cancelling At</dt>
                <dd class="text-red-600">{{ formatDate(detail.periodEnd) }}</dd>
              </div>
              <div v-if="detail.trialEnd" class="flex justify-between">
                <dt class="text-muted-foreground">Trial End</dt>
                <dd>{{ formatDate(detail.trialEnd) }}</dd>
              </div>
              <div v-if="detail.seats" class="flex justify-between">
                <dt class="text-muted-foreground">Seats</dt>
                <dd>{{ detail.seats }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Stripe Sub ID</dt>
                <dd class="font-mono text-xs">{{ detail.stripeSubscriptionId || "—" }}</dd>
              </div>
            </dl>
          </UiCardContent>
        </UiCard>

        <!-- Organisation + Health -->
        <div class="space-y-4">
          <!-- Organisation -->
          <UiCard>
            <UiCardHeader>
              <UiCardTitle>Organisation</UiCardTitle>
            </UiCardHeader>
            <UiCardContent>
              <div class="flex items-center gap-3 mb-3">
                <UiAvatar class="size-10 rounded-lg">
                  <UiAvatarImage
                    v-if="detail.organizationLogo"
                    :src="detail.organizationLogo"
                    :alt="detail.organizationName"
                  />
                  <UiAvatarFallback class="rounded-lg">{{
                    detail.organizationName[0]?.toUpperCase()
                  }}</UiAvatarFallback>
                </UiAvatar>
                <div>
                  <p class="font-medium">{{ detail.organizationName }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ detail.organizationMemberCount }} member{{ detail.organizationMemberCount !== 1 ? "s" : "" }}
                  </p>
                </div>
              </div>
              <div class="flex flex-col gap-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Stripe Customer</span>
                  <span class="font-mono text-xs">{{ detail.stripeCustomerId || "—" }}</span>
                </div>
                <NuxtLink
                  :to="`/admin/organizations/${detail.referenceId}`"
                  class="text-primary hover:underline text-sm"
                >
                  View Organisation →
                </NuxtLink>
                <a
                  v-if="detail.stripeSubscriptionId"
                  :href="`https://dashboard.stripe.com/subscriptions/${detail.stripeSubscriptionId}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline text-sm"
                >
                  View in Stripe →
                </a>
              </div>
            </UiCardContent>
          </UiCard>

          <!-- Billing Health + Sync -->
          <UiCard>
            <UiCardHeader>
              <UiCardTitle>Health & Sync</UiCardTitle>
            </UiCardHeader>
            <UiCardContent>
              <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Billing Health</span>
                  <span class="flex items-center gap-1" :class="healthConfig[detail.billingHealth]?.class">
                    <component :is="healthConfig[detail.billingHealth]?.icon || HelpCircle" class="size-4" />
                    {{ healthConfig[detail.billingHealth]?.label || detail.billingHealth }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Data Freshness</span>
                  <UiBadge
                    variant="outline"
                    :class="{
                      'text-green-600 border-green-600': detail.dataFreshness === 'fresh',
                      'text-amber-600 border-amber-600': detail.dataFreshness === 'stale',
                      'text-gray-600 border-gray-600': detail.dataFreshness === 'unknown'
                    }"
                  >
                    {{ detail.dataFreshness }}
                  </UiBadge>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Last Synced</span>
                  <span>{{ formatRelativeTime(detail.lastSyncedAt) }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Last Webhook</span>
                  <span>{{ formatRelativeTime(detail.lastWebhookAt) }}</span>
                </div>
                <UiButton
                  v-if="detail.allowedActions.includes('refresh')"
                  variant="outline"
                  size="sm"
                  class="w-full mt-2"
                  :disabled="isRefreshing"
                  @click="handleRefresh"
                >
                  <RefreshCw :class="['size-4 mr-2', { 'animate-spin': isRefreshing }]" />
                  Refresh from Stripe
                </UiButton>
              </div>
            </UiCardContent>
          </UiCard>
        </div>
      </div>

      <!-- Admin Actions -->
      <UiCard v-if="detail.allowedActions.length > 0">
        <UiCardHeader>
          <UiCardTitle>Admin Actions</UiCardTitle>
          <UiCardDescription>Support and management actions for this subscription</UiCardDescription>
        </UiCardHeader>
        <UiCardContent>
          <div class="flex flex-wrap gap-2">
            <UiButton
              v-if="detail.allowedActions.includes('cancel_at_period_end')"
              variant="outline"
              size="sm"
              @click="openCancelDialog('at_period_end')"
            >
              <CalendarX class="size-4 mr-2" />
              Cancel at Period End
            </UiButton>
            <UiButton
              v-if="detail.allowedActions.includes('cancel_immediately')"
              variant="destructive"
              size="sm"
              @click="openCancelDialog('immediately')"
            >
              <XCircle class="size-4 mr-2" />
              Cancel Immediately
            </UiButton>
            <UiButton
              v-if="detail.allowedActions.includes('reactivate')"
              variant="outline"
              size="sm"
              :disabled="isReactivating"
              @click="handleReactivate"
            >
              <Undo2 class="size-4 mr-2" />
              Reactivate
            </UiButton>
            <UiButton
              v-if="detail.allowedActions.includes('send_billing_portal_link')"
              variant="outline"
              size="sm"
              :disabled="isGeneratingPortal"
              @click="handleBillingPortal"
            >
              <ExternalLink class="size-4 mr-2" />
              Copy Billing Portal Link
            </UiButton>
          </div>
          <p v-if="detail.allowedActions.includes('cancel_immediately')" class="text-xs text-muted-foreground mt-3">
            Cancellation actions are permanent and will affect the customer's access.
          </p>
        </UiCardContent>
      </UiCard>

      <!-- Activity Timeline -->
      <UiCard>
        <UiCardHeader>
          <UiCardTitle>Activity</UiCardTitle>
          <UiCardDescription>Billing events and admin actions</UiCardDescription>
        </UiCardHeader>
        <UiCardContent>
          <div v-if="activities.length === 0" class="text-center py-6 text-muted-foreground">
            <Clock class="size-8 mx-auto mb-2 opacity-50" />
            <p class="text-sm">No activity recorded yet</p>
          </div>
          <div v-else class="space-y-4">
            <div v-for="entry in activities" :key="entry.id" class="flex items-start gap-3">
              <component
                :is="activityTypeConfig[entry.type]?.icon || Dot"
                :class="['size-4 mt-0.5', activityTypeConfig[entry.type]?.class || 'text-gray-400']"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm">{{ entry.description }}</p>
                <div class="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{{ formatDate(entry.createdAt) }}</span>
                  <span v-if="entry.actorName">· {{ entry.actorName }}</span>
                </div>
              </div>
            </div>
          </div>
        </UiCardContent>
      </UiCard>
    </template>

    <!-- Cancel Dialog -->
    <UiAlertDialog :open="showCancelDialog" @update:open="showCancelDialog = $event">
      <UiAlertDialogContent>
        <UiAlertDialogHeader>
          <UiAlertDialogTitle>
            {{ cancelMode === "immediately" ? "Cancel Subscription Immediately?" : "Cancel at Period End?" }}
          </UiAlertDialogTitle>
          <UiAlertDialogDescription>
            <template v-if="cancelMode === 'immediately'">
              This will cancel the subscription immediately. The customer will lose access right away. This cannot be
              undone.
            </template>
            <template v-else>
              The subscription will remain active until the end of the current billing period, then cancel
              automatically.
            </template>
          </UiAlertDialogDescription>
        </UiAlertDialogHeader>
        <div class="py-2">
          <label class="text-sm font-medium">Reason</label>
          <UiInput v-model="cancelReason" placeholder="Why is this subscription being cancelled?" class="mt-1" />
        </div>
        <UiAlertDialogFooter>
          <UiAlertDialogCancel @click="showCancelDialog = false">Cancel</UiAlertDialogCancel>
          <UiButton
            :variant="cancelMode === 'immediately' ? 'destructive' : 'default'"
            :disabled="isCancelling || !cancelReason.trim()"
            @click="handleCancel"
          >
            {{ isCancelling ? "Cancelling..." : "Confirm" }}
          </UiButton>
        </UiAlertDialogFooter>
      </UiAlertDialogContent>
    </UiAlertDialog>
  </div>
</template>
