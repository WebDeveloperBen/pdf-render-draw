<script setup lang="ts">
import { toast } from "vue-sonner"
import { getApiAdminBillingOverview, getApiAdminStats } from "~/models/api"
import type { GetApiAdminBillingOverview200, GetApiAdminStats200 } from "~/models/api"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Ban,
  Building2,
  FolderOpen,
  RefreshCw,
  ScrollText,
  Shield,
  Users
} from "lucide-vue-next"
import type { Component } from "vue"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

useSeoMeta({ title: "Admin Dashboard" })

const stats = ref<GetApiAdminStats200 | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const fetchStats = async () => {
  isLoading.value = true
  error.value = null
  try {
    const response = await getApiAdminStats()
    stats.value = response.data
  } catch (e: any) {
    error.value = e.data?.message || "Failed to load stats"
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchStats()
  fetchBillingOverview()
})

// Stat cards configuration
const statCards = computed(() => {
  if (!stats.value) return []
  return [
    {
      title: "Total Users",
      value: stats.value.users.total,
      icon: Users,
      description: `${stats.value.users.recentSignups} new this week`,
      color: "text-blue-500"
    },
    {
      title: "Organizations",
      value: stats.value.organizations.total,
      icon: Building2,
      description: "Active organizations",
      color: "text-green-500"
    },
    {
      title: "Projects",
      value: stats.value.projects.total,
      icon: FolderOpen,
      description: "Total projects created",
      color: "text-purple-500"
    },
    {
      title: "Active Sessions",
      value: stats.value.sessions.active,
      icon: Activity,
      description: "Currently logged in",
      color: "text-orange-500"
    },
    {
      title: "Banned Users",
      value: stats.value.users.banned,
      icon: Ban,
      description: "Accounts suspended",
      color: "text-red-500"
    }
  ]
})

// Quick actions for admins
const quickActions: Array<{ title: string; url: string; icon: Component }> = [
  { title: "View All Users", url: "/admin/users", icon: Users },
  { title: "View Organizations", url: "/admin/organizations", icon: Building2 },
  { title: "View Audit Log", url: "/admin/audit-log", icon: ScrollText }
]

// ---- Billing Overview ----

const billingOverview = ref<GetApiAdminBillingOverview200 | null>(null)
const isBillingLoading = ref(true)

const fetchBillingOverview = async () => {
  isBillingLoading.value = true
  try {
    const response = await getApiAdminBillingOverview()
    billingOverview.value = response.data
  } catch {
    // Non-critical — dashboard still works without billing
  } finally {
    isBillingLoading.value = false
  }
}

const subscriptionCards = computed(() => {
  if (!billingOverview.value) return []
  const b = billingOverview.value
  const total = b.totalOrganizations || 1
  const pct = (n: number) => ((n / total) * 100).toFixed(1) + "%"

  return [
    { label: "Paying", value: b.statuses.active, pct: pct(b.statuses.active), dot: "bg-green-500", status: "active" },
    {
      label: "Trial",
      value: b.statuses.trialing,
      pct: pct(b.statuses.trialing),
      dot: "bg-blue-500",
      status: "trialing"
    },
    {
      label: "Cancelled",
      value: b.statuses.canceled,
      pct: pct(b.statuses.canceled),
      dot: "bg-red-500",
      status: "canceled"
    },
    {
      label: "Past Due",
      value: b.statuses.pastDue,
      pct: pct(b.statuses.pastDue),
      dot: "bg-amber-500",
      status: "past_due"
    },
    {
      label: "Incomplete",
      value: b.statuses.incomplete,
      pct: pct(b.statuses.incomplete),
      dot: "bg-orange-500",
      status: "incomplete"
    },
    { label: "No Subscription", value: b.noSubscription, pct: pct(b.noSubscription), dot: "bg-gray-400", status: "" }
  ]
})

// Sync from Stripe
const isSyncing = ref(false)
const handleSync = async () => {
  isSyncing.value = true
  try {
    const result = await $fetch<{ synced: number; created: number; updated: number; errors: number }>(
      "/api/admin/billing/sync",
      {
        method: "POST",
        body: { mode: "full" }
      }
    )
    toast.success(`Synced ${result.synced} subscriptions (${result.created} new, ${result.updated} updated)`)
    await fetchBillingOverview()
  } catch (e: any) {
    toast.error(e.data?.message || "Sync failed")
  } finally {
    isSyncing.value = false
  }
}

const formatRelativeTime = (date: string | null) => {
  if (!date) return "Never"
  const diff = Date.now() - new Date(date).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return "Less than an hour ago"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold">Platform Admin Dashboard</h1>
      <p class="text-muted-foreground mt-1">Platform overview and quick actions</p>
    </div>

    <!-- Error state -->
    <UiAlert v-if="error" variant="destructive">
      <AlertCircle class="size-4" />
      <UiAlertTitle>Error</UiAlertTitle>
      <UiAlertDescription>{{ error }}</UiAlertDescription>
    </UiAlert>

    <!-- Stats Cards -->
    <div v-if="isLoading" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <UiCard v-for="i in 5" :key="i">
        <UiCardHeader class="flex flex-row items-center justify-between pb-2">
          <div class="h-4 w-24 bg-muted rounded animate-pulse" />
          <div class="h-4 w-4 bg-muted rounded animate-pulse" />
        </UiCardHeader>
        <UiCardContent>
          <div class="h-8 w-16 bg-muted rounded animate-pulse mb-1" />
          <div class="h-3 w-32 bg-muted rounded animate-pulse" />
        </UiCardContent>
      </UiCard>
    </div>

    <div v-else-if="stats" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <UiCard v-for="card in statCards" :key="card.title">
        <UiCardHeader class="flex flex-row items-center justify-between pb-2">
          <UiCardTitle class="text-sm font-medium">{{ card.title }}</UiCardTitle>
          <component :is="card.icon" :class="['size-4', card.color]" />
        </UiCardHeader>
        <UiCardContent>
          <div class="text-2xl font-bold">{{ card.value.toLocaleString() }}</div>
          <p class="text-xs text-muted-foreground mt-1">{{ card.description }}</p>
        </UiCardContent>
      </UiCard>
    </div>

    <!-- Subscription Overview -->
    <UiCard>
      <UiCardHeader class="flex flex-row items-center justify-between">
        <div>
          <UiCardTitle>Subscriptions</UiCardTitle>
          <UiCardDescription>
            <template v-if="billingOverview?.lastSyncedAt">
              Last synced {{ formatRelativeTime(billingOverview.lastSyncedAt) }}
            </template>
            <template v-else>Never synced</template>
          </UiCardDescription>
        </div>
        <div class="flex items-center gap-2">
          <UiButton variant="outline" size="sm" :disabled="isSyncing" @click="handleSync">
            <RefreshCw :class="['size-4 mr-2', { 'animate-spin': isSyncing }]" />
            Sync from Stripe
          </UiButton>
          <UiButton variant="ghost" size="sm" @click="navigateTo('/admin/subscriptions')">
            View All
            <ArrowRight class="size-4 ml-1" />
          </UiButton>
        </div>
      </UiCardHeader>
      <UiCardContent>
        <!-- Loading -->
        <div v-if="isBillingLoading" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="i in 6" :key="i" class="flex items-center gap-3 rounded-lg border p-3">
            <div class="size-3 rounded-full bg-muted animate-pulse" />
            <div class="flex-1">
              <div class="h-4 w-16 bg-muted rounded animate-pulse mb-1" />
              <div class="h-3 w-10 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>

        <!-- Data -->
        <div v-else-if="billingOverview" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink
            v-for="card in subscriptionCards"
            :key="card.label"
            :to="card.status ? `/admin/subscriptions?status=${card.status}` : '/admin/subscriptions'"
            class="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
          >
            <span :class="['size-3 rounded-full', card.dot]" />
            <div class="flex-1">
              <p class="text-sm font-medium">{{ card.label }}</p>
              <p class="text-xs text-muted-foreground">{{ card.pct }} of total</p>
            </div>
            <span class="text-lg font-semibold tabular-nums">{{ card.value }}</span>
          </NuxtLink>
        </div>

        <!-- Error / empty -->
        <p v-else class="text-sm text-muted-foreground">Unable to load billing data. Try syncing from Stripe.</p>
      </UiCardContent>
    </UiCard>

    <!-- Quick Actions -->
    <div class="grid gap-4 md:grid-cols-3">
      <UiCard
        v-for="action in quickActions"
        :key="action.url"
        class="cursor-pointer hover:shadow-md transition-shadow"
        @click="navigateTo(action.url)"
      >
        <UiCardHeader class="flex flex-row items-center gap-4">
          <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <component :is="action.icon" class="size-5 text-primary" />
          </div>
          <div class="flex-1">
            <UiCardTitle class="text-base">{{ action.title }}</UiCardTitle>
          </div>
          <ArrowRight class="size-4 text-muted-foreground" />
        </UiCardHeader>
      </UiCard>
    </div>

    <!-- Platform Info -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Platform Information</UiCardTitle>
        <UiCardDescription>Platform administration panel</UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="space-y-4">
        <div class="flex items-start gap-3">
          <Shield class="size-5 text-primary mt-0.5" />
          <div>
            <h4 class="font-medium">Admin Access Levels</h4>
            <p class="text-sm text-muted-foreground">
              Platform admins have tiered access: Viewer, Support, Admin, and Owner. Each tier has different
              capabilities.
            </p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <ScrollText class="size-5 text-primary mt-0.5" />
          <div>
            <h4 class="font-medium">Audit Logging</h4>
            <p class="text-sm text-muted-foreground">
              All administrative actions are logged for security and compliance purposes.
            </p>
          </div>
        </div>
      </UiCardContent>
    </UiCard>
  </div>
</template>
