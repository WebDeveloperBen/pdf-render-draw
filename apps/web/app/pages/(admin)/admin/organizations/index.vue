<script setup lang="ts">
import { toast } from "vue-sonner"
import { useDebounceFn } from "@vueuse/core"
import type { AdminOrganization, AdminOrganizationsResponse } from "@shared/types/admin.types"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

useSeoMeta({ title: "Organizations - Admin" })

// State
const organizations = ref<AdminOrganization[]>([])
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
const isLoading = ref(true)
const search = ref("")
const sortBy = ref<"createdAt" | "name">("createdAt")
const sortOrder = ref<"asc" | "desc">("desc")

// Fetch organizations
const fetchOrganizations = async () => {
  isLoading.value = true
  try {
    const response = await $fetch<AdminOrganizationsResponse>("/api/admin/organizations", {
      query: {
        search: search.value || undefined,
        page: pagination.value.page,
        limit: pagination.value.limit,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value
      }
    })
    organizations.value = response.organizations
    pagination.value = response.pagination
  } catch (e: any) {
    toast.error(e.data?.message || "Failed to load organizations")
  } finally {
    isLoading.value = false
  }
}

// Debounced search
const debouncedFetch = useDebounceFn(() => {
  pagination.value.page = 1
  fetchOrganizations()
}, 300)

// Watch search changes
watch(search, () => {
  debouncedFetch()
})

// Handle sort change
const handleSort = (column: "createdAt" | "name") => {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc"
  } else {
    sortBy.value = column
    sortOrder.value = "desc"
  }
  fetchOrganizations()
}

// Handle page change
const handlePageChange = (page: number) => {
  pagination.value.page = page
  fetchOrganizations()
}

// Format date
const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}

onMounted(() => {
  fetchOrganizations()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Organizations</h1>
        <p class="text-muted-foreground mt-1">Manage platform organizations</p>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="flex items-center gap-4">
      <div class="relative flex-1 max-w-sm">
        <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <UiInput v-model="search" placeholder="Search organizations by name or slug..." class="pl-9" />
      </div>
      <UiButton variant="outline" size="sm" @click="fetchOrganizations">
        <Icon name="lucide:refresh-cw" class="size-4 mr-2" />
        Refresh
      </UiButton>
    </div>

    <!-- Organizations Table -->
    <UiCard>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b">
              <th class="text-left p-4 font-medium">
                <button class="flex items-center gap-1 hover:text-primary" @click="handleSort('name')">
                  Organization
                  <Icon
                    v-if="sortBy === 'name'"
                    :name="sortOrder === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                    class="size-3"
                  />
                </button>
              </th>
              <th class="text-left p-4 font-medium">Slug</th>
              <th class="text-left p-4 font-medium">Members</th>
              <th class="text-left p-4 font-medium">
                <button class="flex items-center gap-1 hover:text-primary" @click="handleSort('createdAt')">
                  Created
                  <Icon
                    v-if="sortBy === 'createdAt'"
                    :name="sortOrder === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                    class="size-3"
                  />
                </button>
              </th>
              <th class="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading state -->
            <template v-if="isLoading">
              <tr v-for="i in 5" :key="i" class="border-b">
                <td class="p-4">
                  <div class="flex items-center gap-3">
                    <div class="size-10 rounded-lg bg-muted animate-pulse" />
                    <div class="h-4 w-32 bg-muted rounded animate-pulse" />
                  </div>
                </td>
                <td class="p-4"><div class="h-4 w-24 bg-muted rounded animate-pulse" /></td>
                <td class="p-4"><div class="h-4 w-16 bg-muted rounded animate-pulse" /></td>
                <td class="p-4"><div class="h-4 w-24 bg-muted rounded animate-pulse" /></td>
                <td class="p-4 text-right"><div class="h-8 w-8 bg-muted rounded animate-pulse ml-auto" /></td>
              </tr>
            </template>

            <!-- Empty state -->
            <tr v-else-if="organizations.length === 0">
              <td colspan="5" class="p-8 text-center text-muted-foreground">
                <Icon name="lucide:building-2" class="size-12 mx-auto mb-4 opacity-50" />
                <p>No organizations found</p>
              </td>
            </tr>

            <!-- Organization rows -->
            <tr v-for="org in organizations" v-else :key="org.id" class="border-b hover:bg-muted/50 transition-colors">
              <td class="p-4">
                <div class="flex items-center gap-3">
                  <UiAvatar class="size-10 rounded-lg">
                    <UiAvatarImage v-if="org.logo" :src="org.logo" :alt="org.name" />
                    <UiAvatarFallback class="rounded-lg">{{ org.name[0]?.toUpperCase() }}</UiAvatarFallback>
                  </UiAvatar>
                  <div>
                    <p class="font-medium">{{ org.name }}</p>
                    <p class="text-xs text-muted-foreground">{{ org.id.slice(0, 8) }}...</p>
                  </div>
                </div>
              </td>
              <td class="p-4 text-muted-foreground">@{{ org.slug }}</td>
              <td class="p-4">
                <div class="flex items-center gap-1">
                  <Icon name="lucide:users" class="size-4 text-muted-foreground" />
                  {{ org.memberCount }}
                </div>
              </td>
              <td class="p-4 text-muted-foreground">
                {{ formatDate(org.createdAt) }}
              </td>
              <td class="p-4 text-right">
                <UiButton variant="ghost" size="sm" @click="navigateTo(`/admin/organizations/${org.id}`)">
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
          {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }} organizations
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
