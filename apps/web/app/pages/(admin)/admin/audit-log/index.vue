<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core"
import type { TableColumn } from "~/components/Blocks/datatable.types"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

useSeoMeta({ title: "Audit Log - Admin" })

// Types
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

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

// State
const entries = ref<AuditEntry[]>([])
const pagination = ref<PaginationInfo>({ page: 1, limit: 50, total: 0, totalPages: 0 })
const actionTypes = ref<string[]>([])
const isLoading = ref(true)

// Filters
const search = ref("")
const actionTypeFilter = ref("")

// Shared date range
const { dateRange, hasDateRange, resetToAllTime, formatForQuery } = useDateRange()

// Fetch
const fetchAuditLog = async () => {
  isLoading.value = true
  try {
    const response = await $fetch<{
      entries: AuditEntry[]
      pagination: PaginationInfo
      actionTypes: string[]
    }>("/api/admin/audit-log", {
      query: {
        page: pagination.value.page,
        limit: pagination.value.limit,
        search: search.value || undefined,
        actionType: actionTypeFilter.value || undefined,
        dateFrom: formatForQuery("start"),
        dateTo: formatForQuery("end")
      }
    })
    entries.value = response.entries
    pagination.value = response.pagination
    // Only update action types on first load or if empty
    if (response.actionTypes.length > 0) {
      actionTypes.value = response.actionTypes
    }
  } catch {
    // Handled by error state
  } finally {
    isLoading.value = false
  }
}

// Debounced search
const debouncedFetch = useDebounceFn(() => {
  pagination.value.page = 1
  fetchAuditLog()
}, 300)

watch(search, () => debouncedFetch())
watch(actionTypeFilter, () => {
  pagination.value.page = 1
  fetchAuditLog()
})

// Re-fetch when date range changes
watch(dateRange, () => {
  pagination.value.page = 1
  fetchAuditLog()
})

// Pagination
const handlePageChange = (page: number) => {
  pagination.value.page = page
  fetchAuditLog()
}

// Clear all filters
const clearFilters = () => {
  search.value = ""
  actionTypeFilter.value = ""
  resetToAllTime()
  pagination.value.page = 1
  fetchAuditLog()
}

const hasFilters = computed(() => search.value || actionTypeFilter.value || hasDateRange.value)

// Action display config
const getActionDisplay = (actionType: string) => {
  const actions: Record<string, { icon: string; color: string; label: string }> = {
    // Platform admin management
    platform_admin_granted: { icon: "lucide:user-plus", color: "text-green-500", label: "Granted Admin" },
    platform_admin_revoked: { icon: "lucide:user-minus", color: "text-red-500", label: "Revoked Admin" },
    platform_admin_tier_changed: { icon: "lucide:edit", color: "text-blue-500", label: "Changed Admin Tier" },
    // User management
    user_hard_delete: { icon: "lucide:trash-2", color: "text-red-500", label: "Hard Deleted User" },
    user_soft_delete: { icon: "lucide:trash-2", color: "text-red-500", label: "Soft Deleted User" },
    ban_user: { icon: "lucide:ban", color: "text-red-500", label: "Banned User" },
    unban_user: { icon: "lucide:user-check", color: "text-green-500", label: "Unbanned User" },
    impersonate_user: { icon: "lucide:eye", color: "text-orange-500", label: "Impersonated User" },
    // Organisation management
    organization_delete: { icon: "lucide:trash-2", color: "text-red-500", label: "Deleted Organisation" },
    // Billing
    "billing.subscription.cancel": {
      icon: "lucide:credit-card",
      color: "text-red-500",
      label: "Cancelled Subscription"
    },
    "billing.subscription.reactivate": {
      icon: "lucide:undo-2",
      color: "text-green-500",
      label: "Reactivated Subscription"
    },
    "billing.portal_link_generated": {
      icon: "lucide:external-link",
      color: "text-blue-500",
      label: "Portal Link Generated"
    },
    "billing.sync.full": { icon: "lucide:refresh-cw", color: "text-purple-500", label: "Full Stripe Sync" },
    "billing.sync.refresh": { icon: "lucide:refresh-cw", color: "text-purple-500", label: "Subscription Refreshed" }
  }

  return (
    actions[actionType] || {
      icon: "lucide:activity",
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

// Table columns
const columns: TableColumn<AuditEntry>[] = [
  {
    accessorKey: "actionType",
    header: "Action",
    cell: ({ row }) => row.original.actionType
  },
  {
    accessorKey: "admin",
    header: "Admin",
    cell: ({ row }) => row.original.admin?.name || row.original.admin?.email || "System"
  },
  {
    accessorKey: "target",
    header: "Target",
    cell: ({ row }) => {
      if (row.original.targetUser) return row.original.targetUser.name || row.original.targetUser.email
      if (row.original.targetOrg) return row.original.targetOrg.name
      return "-"
    }
  },
  {
    accessorKey: "createdAt",
    header: "Timestamp",
    cell: ({ row }) => row.original.createdAt
  },
  {
    accessorKey: "details",
    header: "Details",
    cell: ({ row }) => row.original.id
  }
]

onMounted(() => {
  fetchAuditLog()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Audit Log</h1>
        <p class="text-muted-foreground mt-1">Track all platform actions across admins, support, and billing</p>
      </div>
      <UiButton variant="outline" :disabled="isLoading" @click="fetchAuditLog">
        <Icon name="lucide:refresh-cw" class="size-4 mr-2" />
        Refresh
      </UiButton>
    </div>

    <!-- Filters -->
    <div class="flex items-end gap-4 flex-wrap">
      <div class="relative flex-1 min-w-[240px] max-w-sm">
        <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
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
        <Icon name="lucide:x" class="size-4 mr-1" />
        Clear
      </UiButton>
    </div>

    <!-- Table -->
    <BlocksDatatable :data="entries" :columns="columns" :loading="isLoading" sticky="header">
      <template #actionType-cell="{ row }">
        <div class="flex items-center gap-2">
          <Icon
            :name="getActionDisplay(row.original.actionType).icon"
            :class="['size-4', getActionDisplay(row.original.actionType).color]"
          />
          <span class="font-medium">{{ getActionDisplay(row.original.actionType).label }}</span>
        </div>
      </template>

      <template #admin-cell="{ row }">
        <div v-if="row.original.admin" class="flex items-center gap-2">
          <UiAvatar class="size-6">
            <UiAvatarFallback class="text-xs">{{
              (row.original.admin.name?.[0] || row.original.admin.email?.[0] || "?").toUpperCase()
            }}</UiAvatarFallback>
          </UiAvatar>
          <span class="text-sm">{{ row.original.admin.name || row.original.admin.email }}</span>
        </div>
        <span v-else class="text-muted-foreground text-sm">System</span>
      </template>

      <template #target-cell="{ row }">
        <div v-if="row.original.targetUser" class="text-sm">
          <NuxtLink :to="`/admin/users/${row.original.targetUser.id}`" class="text-primary hover:underline">
            {{ row.original.targetUser.name || row.original.targetUser.email }}
          </NuxtLink>
        </div>
        <div v-else-if="row.original.targetOrg" class="text-sm">
          <NuxtLink :to="`/admin/organizations/${row.original.targetOrg.id}`" class="text-primary hover:underline">
            {{ row.original.targetOrg.name }}
          </NuxtLink>
          <span class="text-muted-foreground ml-1">@{{ row.original.targetOrg.slug }}</span>
        </div>
        <span v-else class="text-muted-foreground text-sm">—</span>
      </template>

      <template #createdAt-cell="{ row }">
        <span class="text-sm text-muted-foreground">{{ formatDate(row.original.createdAt) }}</span>
      </template>

      <template #details-cell="{ row }">
        <UiPopover v-if="row.original.metadata || row.original.ipAddress">
          <UiPopoverTrigger>
            <UiButton variant="ghost" size="sm">
              <Icon name="lucide:info" class="size-4" />
            </UiButton>
          </UiPopoverTrigger>
          <UiPopoverContent class="w-96" side="left">
            <div class="space-y-3">
              <h4 class="font-medium text-sm">Details</h4>
              <div v-if="row.original.ipAddress" class="text-sm">
                <span class="text-muted-foreground">IP:</span>
                <span class="ml-1 font-mono text-xs">{{ row.original.ipAddress }}</span>
              </div>
              <div v-if="row.original.userAgent" class="text-sm">
                <span class="text-muted-foreground">User Agent:</span>
                <p class="font-mono text-xs mt-0.5 break-all">{{ row.original.userAgent }}</p>
              </div>
              <div v-if="row.original.metadata" class="text-sm">
                <span class="text-muted-foreground">Metadata:</span>
                <pre class="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-48 whitespace-pre-wrap">{{
                  formatMetadata(row.original.metadata)
                }}</pre>
              </div>
            </div>
          </UiPopoverContent>
        </UiPopover>
        <span v-else class="text-muted-foreground">—</span>
      </template>

      <template #empty>
        <div class="py-8 text-center text-muted-foreground">
          <Icon name="lucide:scroll-text" class="size-12 mx-auto mb-4 opacity-50" />
          <p>No audit log entries found</p>
          <p v-if="hasFilters" class="text-sm mt-1">Try adjusting your filters</p>
        </div>
      </template>
    </BlocksDatatable>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">
        Showing {{ (pagination.page - 1) * pagination.limit + 1 }} to
        {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }} entries
      </p>
      <div class="flex items-center gap-2">
        <UiButton
          variant="outline"
          size="sm"
          :disabled="pagination.page === 1"
          @click="handlePageChange(pagination.page - 1)"
        >
          <Icon name="lucide:chevron-left" class="size-4" />
          Previous
        </UiButton>
        <span class="text-sm text-muted-foreground">Page {{ pagination.page }} of {{ pagination.totalPages }}</span>
        <UiButton
          variant="outline"
          size="sm"
          :disabled="pagination.page === pagination.totalPages"
          @click="handlePageChange(pagination.page + 1)"
        >
          Next
          <Icon name="lucide:chevron-right" class="size-4" />
        </UiButton>
      </div>
    </div>
  </div>
</template>
