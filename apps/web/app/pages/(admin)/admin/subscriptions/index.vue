<script setup lang="ts">
import { toast } from "vue-sonner"
import { useDebounceFn } from "@vueuse/core"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

useSeoMeta({ title: "Subscriptions - Admin" })

// State
interface SubscriptionListItem {
  id: string
  stripeSubscriptionId: string | null
  referenceId: string
  organizationName: string
  organizationSlug: string
  organizationLogo: string | null
  stripeCustomerId: string | null
  plan: string
  planTier: string
  status: string
  periodStart: string | null
  periodEnd: string | null
  cancelAtPeriodEnd: boolean | null
  billingInterval: string | null
  trialEnd: string | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

const subscriptions = ref<SubscriptionListItem[]>([])
const pagination = ref<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 0 })
const isLoading = ref(true)
const search = ref("")
const statusFilter = ref("")
const planFilter = ref("")
const sortBy = ref<"periodEnd" | "organizationName" | "status" | "plan">("periodEnd")
const sortOrder = ref<"asc" | "desc">("desc")

// Fetch subscriptions
const fetchSubscriptions = async () => {
  isLoading.value = true
  try {
    const response = await $fetch<{ subscriptions: SubscriptionListItem[]; pagination: PaginationInfo }>(
      "/api/admin/subscriptions",
      {
        query: {
          search: search.value || undefined,
          status: statusFilter.value || undefined,
          plan: planFilter.value || undefined,
          page: pagination.value.page,
          limit: pagination.value.limit,
          sortBy: sortBy.value,
          sortOrder: sortOrder.value
        }
      }
    )
    subscriptions.value = response.subscriptions
    pagination.value = response.pagination
  } catch (e: any) {
    toast.error(e.data?.message || "Failed to load subscriptions")
  } finally {
    isLoading.value = false
  }
}

// Debounced search
const debouncedFetch = useDebounceFn(() => {
  pagination.value.page = 1
  fetchSubscriptions()
}, 300)

watch(search, () => debouncedFetch())
watch([statusFilter, planFilter], () => {
  pagination.value.page = 1
  fetchSubscriptions()
})

// Sort
const handleSort = (column: typeof sortBy.value) => {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc"
  } else {
    sortBy.value = column
    sortOrder.value = "desc"
  }
  fetchSubscriptions()
}

// Pagination
const handlePageChange = (page: number) => {
  pagination.value.page = page
  fetchSubscriptions()
}

// Format date
const formatDate = (date: string | null) => {
  if (!date) return "—"
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
    await fetchSubscriptions()
  } catch (e: any) {
    toast.error(e.data?.message || "Sync failed")
  } finally {
    isSyncing.value = false
  }
}

// Init: check for status query param (from dashboard card click)
const route = useRoute()
onMounted(() => {
  if (route.query.status) {
    statusFilter.value = String(route.query.status)
  }
  fetchSubscriptions()
})
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
        <UiButton variant="outline" size="sm" @click="fetchSubscriptions">
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

    <!-- Table -->
    <UiCard>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b">
              <th class="text-left p-4 font-medium">
                <button class="flex items-center gap-1 hover:text-primary" @click="handleSort('organizationName')">
                  Organisation
                  <Icon
                    v-if="sortBy === 'organizationName'"
                    :name="sortOrder === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                    class="size-3"
                  />
                </button>
              </th>
              <th class="text-left p-4 font-medium">
                <button class="flex items-center gap-1 hover:text-primary" @click="handleSort('plan')">
                  Plan
                  <Icon
                    v-if="sortBy === 'plan'"
                    :name="sortOrder === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                    class="size-3"
                  />
                </button>
              </th>
              <th class="text-left p-4 font-medium">
                <button class="flex items-center gap-1 hover:text-primary" @click="handleSort('status')">
                  Status
                  <Icon
                    v-if="sortBy === 'status'"
                    :name="sortOrder === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                    class="size-3"
                  />
                </button>
              </th>
              <th class="text-left p-4 font-medium hidden lg:table-cell">Interval</th>
              <th class="text-left p-4 font-medium hidden md:table-cell">
                <button class="flex items-center gap-1 hover:text-primary" @click="handleSort('periodEnd')">
                  Current Period
                  <Icon
                    v-if="sortBy === 'periodEnd'"
                    :name="sortOrder === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                    class="size-3"
                  />
                </button>
              </th>
              <th class="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading -->
            <template v-if="isLoading">
              <tr v-for="i in 5" :key="i" class="border-b">
                <td class="p-4">
                  <div class="flex items-center gap-3">
                    <div class="size-10 rounded-lg bg-muted animate-pulse" />
                    <div class="h-4 w-32 bg-muted rounded animate-pulse" />
                  </div>
                </td>
                <td class="p-4"><div class="h-4 w-16 bg-muted rounded animate-pulse" /></td>
                <td class="p-4"><div class="h-6 w-16 bg-muted rounded-full animate-pulse" /></td>
                <td class="p-4 hidden lg:table-cell"><div class="h-4 w-16 bg-muted rounded animate-pulse" /></td>
                <td class="p-4 hidden md:table-cell"><div class="h-4 w-28 bg-muted rounded animate-pulse" /></td>
                <td class="p-4 text-right"><div class="h-8 w-8 bg-muted rounded animate-pulse ml-auto" /></td>
              </tr>
            </template>

            <!-- Empty -->
            <tr v-else-if="subscriptions.length === 0">
              <td colspan="6" class="p-8 text-center text-muted-foreground">
                <Icon name="lucide:credit-card" class="size-12 mx-auto mb-4 opacity-50" />
                <p>No subscriptions found</p>
                <p v-if="search || statusFilter || planFilter" class="text-sm mt-1">Try adjusting your filters</p>
              </td>
            </tr>

            <!-- Rows -->
            <tr
              v-for="sub in subscriptions"
              v-else
              :key="sub.id"
              class="border-b hover:bg-muted/50 transition-colors cursor-pointer"
              @click="navigateTo(`/admin/subscriptions/${sub.id}`)"
            >
              <td class="p-4">
                <div class="flex items-center gap-3">
                  <UiAvatar class="size-10 rounded-lg">
                    <UiAvatarImage
                      v-if="sub.organizationLogo"
                      :src="sub.organizationLogo"
                      :alt="sub.organizationName"
                    />
                    <UiAvatarFallback class="rounded-lg">{{ sub.organizationName[0]?.toUpperCase() }}</UiAvatarFallback>
                  </UiAvatar>
                  <div>
                    <p class="font-medium">{{ sub.organizationName }}</p>
                    <p class="text-xs text-muted-foreground">@{{ sub.organizationSlug }}</p>
                  </div>
                </div>
              </td>
              <td class="p-4">
                <UiBadge variant="outline" class="capitalize">{{ sub.plan }}</UiBadge>
              </td>
              <td class="p-4">
                <UiBadge variant="outline" :class="getStatusConfig(sub.status).class">
                  {{ getStatusConfig(sub.status).label }}
                </UiBadge>
                <span v-if="sub.cancelAtPeriodEnd" class="block text-xs text-muted-foreground mt-1"> Cancelling </span>
              </td>
              <td class="p-4 text-muted-foreground capitalize hidden lg:table-cell">
                {{ sub.billingInterval || "—" }}
              </td>
              <td class="p-4 text-muted-foreground hidden md:table-cell">
                {{ formatDate(sub.periodStart) }} – {{ formatDate(sub.periodEnd) }}
              </td>
              <td class="p-4 text-right">
                <UiButton variant="ghost" size="sm" @click.stop="navigateTo(`/admin/subscriptions/${sub.id}`)">
                  <Icon name="lucide:eye" class="size-4" />
                </UiButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="flex items-center justify-between p-4 border-t">
        <p class="text-sm text-muted-foreground">
          Showing {{ (pagination.page - 1) * pagination.limit + 1 }} to
          {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }} subscriptions
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
    </UiCard>
  </div>
</template>
