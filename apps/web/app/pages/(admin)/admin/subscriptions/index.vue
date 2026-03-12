<script setup lang="ts">
import { keepPreviousData } from "@tanstack/vue-query"
import { toast } from "vue-sonner"
import type { ColumnDef } from "@tanstack/vue-table"
import type { GetApiAdminSubscriptions200, GetApiAdminSubscriptions200SubscriptionsItem, GetApiAdminSubscriptionsParams } from "~/models/api"
import { useGetApiAdminSubscriptions } from "~/models/api"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

useSeoMeta({ title: "Subscriptions - Admin" })

// Filters
const statusFilter = ref("")
const planFilter = ref("")

// Init: check for status query param (from dashboard card click)
const route = useRoute()
if (route.query.status) {
  statusFilter.value = String(route.query.status)
}

// Server-side pagination, sorting, search
const {
  page,
  pageSize,
  search,
  debouncedSearch,
  sorting,
  sortBy,
  sortOrder,
  pageIndex,
  onUpdatePageIndex,
  onUpdatePageSize,
  onUpdateSorting
} = useAdminPagination({
  defaultPageSize: 20,
  defaultSort: { id: "periodEnd", desc: true }
})

// Reset page on filter change
watch([statusFilter, planFilter], () => {
  page.value = 1
})

const params = computed<GetApiAdminSubscriptionsParams>(() => ({
  page: page.value,
  limit: pageSize.value,
  sortBy: sortBy.value as "organizationName" | "status" | "periodEnd" | "plan",
  sortOrder: sortOrder.value,
  search: debouncedSearch.value || undefined,
  status: statusFilter.value || undefined,
  plan: planFilter.value || undefined
}))

const { data, isLoading, isFetching, refetch } = useGetApiAdminSubscriptions(params, {
  query: { placeholderData: keepPreviousData }
})

const response = computed(() => data.value?.data as GetApiAdminSubscriptions200 | undefined)
const items = computed(() => response.value?.subscriptions ?? [])
const pagination = computed(() => response.value?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 })
const pageCount = computed(() => pagination.value.totalPages)
const totalRows = computed(() => pagination.value.total)

// Format date
const formatDate = (date: string | null | undefined) => {
  if (!date) return "\u2014"
  return new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
}

// Status badge styling
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
    toast.success(
      `Synced ${result.synced} subscriptions (${result.created} created, ${result.updated} updated${result.errors > 0 ? `, ${result.errors} errors` : ""})`
    )
    await refetch()
  } catch (e: any) {
    toast.error(e.data?.message || "Sync failed")
  } finally {
    isSyncing.value = false
  }
}

// Column definitions
const columns: ColumnDef<GetApiAdminSubscriptions200SubscriptionsItem>[] = [
  {
    accessorKey: "organizationName",
    header: "Organisation",
    cell: ({ row }) => {
      const sub = row.original
      return h("div", { class: "flex items-center gap-3" }, [
        h(resolveComponent("UiAvatar"), { class: "size-10 rounded-lg" }, () => [
          sub.organizationLogo
            ? h(resolveComponent("UiAvatarImage"), { src: sub.organizationLogo, alt: sub.organizationName })
            : null,
          h(resolveComponent("UiAvatarFallback"), { class: "rounded-lg" }, () =>
            sub.organizationName[0]?.toUpperCase()
          )
        ]),
        h("div", {}, [
          h("p", { class: "font-medium" }, sub.organizationName),
          h("p", { class: "text-xs text-muted-foreground" }, `@${sub.organizationSlug}`)
        ])
      ])
    }
  },
  {
    accessorKey: "plan",
    header: "Plan",
    cell: ({ row }) => {
      return h(resolveComponent("UiBadge"), { variant: "outline", class: "capitalize" }, () => row.original.plan)
    }
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const sub = row.original
      const config = getStatusConfig(sub.status)
      const children = [
        h(resolveComponent("UiBadge"), { variant: "outline", class: config.class }, () => config.label)
      ]
      if (sub.cancelAtPeriodEnd) {
        children.push(h("span", { class: "block text-xs text-muted-foreground mt-1" }, "Cancelling"))
      }
      return h("div", {}, children)
    }
  },
  {
    accessorKey: "billingInterval",
    header: "Interval",
    cell: ({ row }) => {
      return h(
        "span",
        { class: "text-muted-foreground capitalize" },
        row.original.billingInterval || "\u2014"
      )
    }
  },
  {
    accessorKey: "periodEnd",
    header: "Current Period",
    cell: ({ row }) => {
      const sub = row.original
      return h(
        "span",
        { class: "text-muted-foreground" },
        `${formatDate(sub.periodStart)} \u2013 ${formatDate(sub.periodEnd)}`
      )
    }
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => {
      return h(
        resolveComponent("UiButton"),
        {
          variant: "ghost",
          size: "sm",
          title: "View subscription details",
          onClick: () => navigateTo(`/admin/subscriptions/${row.original.id}`)
        },
        () => h(resolveComponent("Icon"), { name: "lucide:eye", class: "size-4" })
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
        <h1 class="text-3xl font-bold">Subscriptions</h1>
        <p class="text-muted-foreground mt-1">Manage platform subscriptions</p>
      </div>
      <div class="flex items-center gap-2">
        <UiButton variant="default" size="sm" :disabled="isSyncing" @click="handleSync">
          <Icon name="lucide:refresh-cw" :class="['size-4 mr-2', { 'animate-spin': isSyncing }]" />
          Sync from Stripe
        </UiButton>
        <UiButton variant="outline" size="sm" @click="refetch()">
          <Icon name="lucide:refresh-cw" class="size-4 mr-2" />
          Refresh
        </UiButton>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="flex items-center gap-4 flex-wrap">
      <div class="relative flex-1 min-w-[240px] max-w-sm">
        <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <UiInput v-model="search" placeholder="Search orgs, emails, Stripe IDs..." class="pl-9" />
      </div>
      <select
        v-model="statusFilter"
        class="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="trialing">Trial</option>
        <option value="past_due">Past Due</option>
        <option value="canceled">Cancelled</option>
        <option value="incomplete">Incomplete</option>
      </select>
      <select
        v-model="planFilter"
        class="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All plans</option>
        <option value="pro">Pro</option>
        <option value="team">Team</option>
        <option value="enterprise">Enterprise</option>
      </select>
    </div>

    <!-- Loading State -->
    <UiCard v-if="isLoading">
      <div class="p-4 space-y-4">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4">
          <div class="size-10 rounded-lg bg-muted animate-pulse" />
          <div class="flex-1 space-y-2">
            <div class="h-4 w-32 bg-muted rounded animate-pulse" />
            <div class="h-3 w-48 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    </UiCard>

    <!-- Subscriptions Table -->
    <UiCard v-else class="p-4">
      <UiTanStackTable
        :data="items"
        :columns="columns"
        :search="search"
        :sorting="sorting"
        :manual-pagination="true"
        :manual-sorting="true"
        :page-count="pageCount"
        :row-count="totalRows"
        :page-index="pageIndex"
        :page-size="pageSize"
        @update:sorting="onUpdateSorting"
        @update:page-index="onUpdatePageIndex"
        @update:page-size="onUpdatePageSize"
      >
        <template #empty>
          <div class="flex flex-col items-center py-8 text-muted-foreground">
            <Icon name="lucide:credit-card" class="size-12 mb-4 opacity-50" />
            <p>No subscriptions found</p>
            <p v-if="search || statusFilter || planFilter" class="text-sm mt-1">Try adjusting your filters</p>
          </div>
        </template>
      </UiTanStackTable>
    </UiCard>
  </div>
</template>
