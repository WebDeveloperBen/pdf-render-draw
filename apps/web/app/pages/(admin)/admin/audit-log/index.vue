<script setup lang="ts">
import { useQuery, keepPreviousData } from "@tanstack/vue-query"
import type { ColumnDef } from "@tanstack/vue-table"
import { getGetApiAdminAuditLogQueryKey } from "~/models/api"
import {
  Activity,
  Ban,
  CreditCard,
  Edit,
  ExternalLink,
  Eye,
  Info,
  RefreshCw,
  ScrollText,
  Search,
  Trash2,
  Undo2,
  UserCheck,
  UserMinus,
  UserPlus,
  X
} from "lucide-vue-next"
import type { Component } from "vue"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

useSeoMeta({ title: "Audit Log - Admin" })

// Keep custom interface since Orval's entry type is { [key: string]: unknown }
interface AuditEntry {
  id: string
  actionType: string
  createdAt: string
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, unknown> | null
  admin: { id: string; name: string | null; email: string | null }
  targetUser: { id: string; name?: string | null; email?: string } | null
  targetOrg: { id: string; name?: string; slug?: string } | null
}

// Pagination & search state
const { page, pageSize, search, debouncedSearch, pageIndex, onUpdatePageIndex, onUpdatePageSize } = useAdminPagination({
  defaultPageSize: 50,
  defaultSort: { id: "createdAt", desc: true }
})

// Filters
const actionTypeFilter = ref("")
const { dateRange, hasDateRange, resetToAllTime, formatForQuery } = useDateRange()

// Reset page when filters change
watch([actionTypeFilter, dateRange], () => {
  page.value = 1
})

// Query params - audit-log API doesn't support sortBy/sortOrder
const params = computed(() => ({
  page: page.value,
  limit: pageSize.value,
  search: debouncedSearch.value || undefined,
  actionType: actionTypeFilter.value || undefined,
  dateFrom: formatForQuery("start"),
  dateTo: formatForQuery("end")
}))

// Use Orval query key for cache consistency, but $fetch since params aren't in OpenAPI spec
const { data, isLoading, isFetching, refetch } = useQuery({
  queryKey: [...getGetApiAdminAuditLogQueryKey(), params],
  queryFn: () =>
    $fetch<{
      entries: AuditEntry[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
      actionTypes: string[]
    }>("/api/admin/audit-log", { query: params.value }),
  placeholderData: keepPreviousData
})

// Derived state
const items = computed(() => data.value?.entries ?? [])
const pagination = computed(() => data.value?.pagination ?? { page: 1, limit: 50, total: 0, totalPages: 0 })
const actionTypes = computed(() => data.value?.actionTypes ?? [])
const pageCount = computed(() => pagination.value.totalPages)
const totalRows = computed(() => pagination.value.total)

// Detail dialog state
const selectedEntry = ref<AuditEntry | null>(null)
const showDetails = ref(false)

// Clear all filters
const clearFilters = () => {
  search.value = ""
  actionTypeFilter.value = ""
  resetToAllTime()
  page.value = 1
}

const hasFilters = computed(() => search.value || actionTypeFilter.value || hasDateRange.value)

// Action display config
const getActionDisplay = (actionType: string) => {
  const actions: Record<string, { icon: Component; color: string; label: string }> = {
    // Platform admin management
    platform_admin_granted: { icon: UserPlus, color: "text-green-500", label: "Granted Admin" },
    platform_admin_revoked: { icon: UserMinus, color: "text-red-500", label: "Revoked Admin" },
    platform_admin_tier_changed: { icon: Edit, color: "text-blue-500", label: "Changed Admin Tier" },
    // User management
    user_hard_delete: { icon: Trash2, color: "text-red-500", label: "Hard Deleted User" },
    user_soft_delete: { icon: Trash2, color: "text-red-500", label: "Soft Deleted User" },
    ban_user: { icon: Ban, color: "text-red-500", label: "Banned User" },
    unban_user: { icon: UserCheck, color: "text-green-500", label: "Unbanned User" },
    impersonate_user: { icon: Eye, color: "text-orange-500", label: "Impersonated User" },
    // Organisation management
    organization_delete: { icon: Trash2, color: "text-red-500", label: "Deleted Organisation" },
    // Billing
    "billing.subscription.cancel": {
      icon: CreditCard,
      color: "text-red-500",
      label: "Cancelled Subscription"
    },
    "billing.subscription.reactivate": {
      icon: Undo2,
      color: "text-green-500",
      label: "Reactivated Subscription"
    },
    "billing.portal_link_generated": {
      icon: ExternalLink,
      color: "text-blue-500",
      label: "Portal Link Generated"
    },
    "billing.sync.full": { icon: RefreshCw, color: "text-purple-500", label: "Full Stripe Sync" },
    "billing.sync.refresh": { icon: RefreshCw, color: "text-purple-500", label: "Subscription Refreshed" }
  }

  return (
    actions[actionType] || {
      icon: Activity,
      color: "text-muted-foreground",
      label: actionType
        .replace(/\./g, " ")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase())
    }
  )
}

// Format date
const formatDate = (date: string) => {
  return new Date(date).toLocaleString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

// Format metadata for display
const formatMetadata = (metadata: Record<string, unknown> | null) => {
  if (!metadata) return null
  return JSON.stringify(metadata, null, 2)
}

// Open details dialog
const openDetails = (entry: AuditEntry) => {
  selectedEntry.value = entry
  showDetails.value = true
}

// Column definitions
const columns: ColumnDef<AuditEntry>[] = [
  {
    accessorKey: "actionType",
    header: "Action",
    cell: ({ row }) => {
      const display = getActionDisplay(row.original.actionType)
      return h("div", { class: "flex items-center gap-2" }, [
        h(display.icon, { class: `size-4 ${display.color}` }),
        h("span", { class: "font-medium" }, display.label)
      ])
    }
  },
  {
    accessorKey: "admin",
    header: "Admin",
    cell: ({ row }) => {
      const admin = row.original.admin
      if (!admin) return h("span", { class: "text-muted-foreground text-sm" }, "System")
      const initial = (admin.name?.[0] || admin.email?.[0] || "?").toUpperCase()
      return h("div", { class: "flex items-center gap-2" }, [
        h(resolveComponent("UiAvatar"), { class: "size-6" }, () => [
          h(resolveComponent("UiAvatarFallback"), { class: "text-xs" }, () => initial)
        ]),
        h("span", { class: "text-sm" }, admin.name || admin.email || "Unknown")
      ])
    }
  },
  {
    id: "target",
    header: "Target",
    cell: ({ row }) => {
      const { targetUser, targetOrg } = row.original
      if (targetUser) {
        return h(
          resolveComponent("NuxtLink"),
          { to: `/admin/users/${targetUser.id}`, class: "text-sm text-primary hover:underline" },
          () => targetUser.name || targetUser.email
        )
      }
      if (targetOrg) {
        return h("div", { class: "text-sm" }, [
          h(
            resolveComponent("NuxtLink"),
            { to: `/admin/organizations/${targetOrg.id}`, class: "text-primary hover:underline" },
            () => targetOrg.name
          ),
          targetOrg.slug ? h("span", { class: "text-muted-foreground ml-1" }, `@${targetOrg.slug}`) : null
        ])
      }
      return h("span", { class: "text-muted-foreground text-sm" }, "\u2014")
    }
  },
  {
    accessorKey: "createdAt",
    header: "Timestamp",
    cell: ({ row }) => h("span", { class: "text-sm text-muted-foreground" }, formatDate(row.original.createdAt))
  },
  {
    id: "details",
    header: "Details",
    enableSorting: false,
    cell: ({ row }) => {
      const entry = row.original
      if (!entry.metadata && !entry.ipAddress) {
        return h("span", { class: "text-muted-foreground" }, "\u2014")
      }
      return h(
        resolveComponent("UiButton"),
        {
          variant: "ghost",
          size: "sm",
          title: "View details",
          onClick: () => openDetails(entry)
        },
        () => h(Info, { class: "size-4" })
      )
    }
  }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Audit Log</h1>
        <p class="text-muted-foreground mt-1">Track all platform actions across admins, support, and billing</p>
      </div>
      <UiButton variant="outline" :disabled="isLoading || isFetching" @click="refetch()">
        <RefreshCw class="size-4 mr-2" :class="{ 'animate-spin': isFetching }" />
        Refresh
      </UiButton>
    </div>

    <!-- Filters -->
    <div class="flex items-end gap-4 flex-wrap">
      <div class="relative flex-1 min-w-[240px] max-w-sm">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <UiInput v-model="search" placeholder="Search actions, metadata..." class="pl-9" />
      </div>

      <select
        v-model="actionTypeFilter"
        class="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All actions</option>
        <option v-for="at in actionTypes" :key="at" :value="at">
          {{ getActionDisplay(at).label }}
        </option>
      </select>

      <BlocksHeaderDatePicker />

      <UiButton v-if="hasFilters" variant="ghost" size="sm" @click="clearFilters">
        <X class="size-4 mr-1" />
        Clear
      </UiButton>
    </div>

    <!-- Loading State (initial only) -->
    <UiCard v-if="isLoading">
      <div class="p-4 space-y-4">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4">
          <div class="size-4 rounded bg-muted animate-pulse" />
          <div class="flex-1 space-y-2">
            <div class="h-4 w-32 bg-muted rounded animate-pulse" />
            <div class="h-3 w-48 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    </UiCard>

    <!-- Audit Log Table -->
    <UiCard v-else class="p-4">
      <UiTanStackTable
        :data="items"
        :columns="columns"
        :search="search"
        :sorting="[{ id: 'createdAt', desc: true }]"
        :manual-pagination="true"
        :page-count="pageCount"
        :row-count="totalRows"
        :page-index="pageIndex"
        :page-size="pageSize"
        @update:page-index="onUpdatePageIndex"
        @update:page-size="onUpdatePageSize"
      >
        <template #empty>
          <div class="py-8 text-center text-muted-foreground">
            <ScrollText class="size-12 mx-auto mb-4 opacity-50" />
            <p>No audit log entries found</p>
            <p v-if="hasFilters" class="text-sm mt-1">Try adjusting your filters</p>
          </div>
        </template>
      </UiTanStackTable>
    </UiCard>

    <!-- Details Dialog -->
    <UiDialog v-model:open="showDetails">
      <UiDialogContent class="max-w-lg">
        <UiDialogHeader>
          <UiDialogTitle>Entry Details</UiDialogTitle>
          <UiDialogDescription v-if="selectedEntry">
            {{ getActionDisplay(selectedEntry.actionType).label }} &mdash;
            {{ formatDate(selectedEntry.createdAt) }}
          </UiDialogDescription>
        </UiDialogHeader>
        <div v-if="selectedEntry" class="space-y-4 pt-2">
          <div v-if="selectedEntry.ipAddress">
            <p class="text-sm text-muted-foreground mb-1">IP Address</p>
            <p class="font-mono text-sm">{{ selectedEntry.ipAddress }}</p>
          </div>
          <div v-if="selectedEntry.userAgent">
            <p class="text-sm text-muted-foreground mb-1">User Agent</p>
            <p class="font-mono text-xs break-all">{{ selectedEntry.userAgent }}</p>
          </div>
          <div v-if="selectedEntry.metadata">
            <p class="text-sm text-muted-foreground mb-1">Metadata</p>
            <pre class="text-xs bg-muted p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap">{{
              formatMetadata(selectedEntry.metadata)
            }}</pre>
          </div>
          <div v-if="!selectedEntry.ipAddress && !selectedEntry.userAgent && !selectedEntry.metadata">
            <p class="text-sm text-muted-foreground">No additional details available.</p>
          </div>
        </div>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
