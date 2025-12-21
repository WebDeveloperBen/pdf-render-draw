<script setup lang="ts">
import { toast } from "vue-sonner"
import { useDebounceFn } from "@vueuse/core"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

useSeoMeta({ title: "Users - Admin" })

interface AdminUser {
  id: string
  name: string | null
  email: string
  emailVerified: boolean
  image: string | null
  role: string | null
  banned: boolean | null
  banReason: string | null
  banExpires: Date | null
  createdAt: Date
  updatedAt: Date
}

interface UsersResponse {
  users: AdminUser[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// State
const users = ref<AdminUser[]>([])
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
const isLoading = ref(true)
const search = ref("")
const sortBy = ref<"createdAt" | "name" | "email">("createdAt")
const sortOrder = ref<"asc" | "desc">("desc")

// Fetch users
const fetchUsers = async () => {
  isLoading.value = true
  try {
    const response = await $fetch<UsersResponse>("/api/admin/users", {
      query: {
        search: search.value || undefined,
        page: pagination.value.page,
        limit: pagination.value.limit,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value
      }
    })
    users.value = response.users
    pagination.value = response.pagination
  } catch (e: any) {
    toast.error(e.data?.message || "Failed to load users")
  } finally {
    isLoading.value = false
  }
}

// Debounced search
const debouncedFetch = useDebounceFn(() => {
  pagination.value.page = 1
  fetchUsers()
}, 300)

// Watch search changes
watch(search, () => {
  debouncedFetch()
})

// Handle sort change
const handleSort = (column: "createdAt" | "name" | "email") => {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc"
  } else {
    sortBy.value = column
    sortOrder.value = "desc"
  }
  fetchUsers()
}

// Handle page change
const handlePageChange = (page: number) => {
  pagination.value.page = page
  fetchUsers()
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
  fetchUsers()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Users</h1>
        <p class="text-muted-foreground mt-1">Manage platform users</p>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="flex items-center gap-4">
      <div class="relative flex-1 max-w-sm">
        <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <UiInput v-model="search" placeholder="Search users by name or email..." class="pl-9" />
      </div>
      <UiButton variant="outline" size="sm" @click="fetchUsers">
        <Icon name="lucide:refresh-cw" class="size-4 mr-2" />
        Refresh
      </UiButton>
    </div>

    <!-- Users Table -->
    <UiCard>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b">
              <th class="text-left p-4 font-medium">
                <button class="flex items-center gap-1 hover:text-primary" @click="handleSort('name')">
                  User
                  <Icon
                    v-if="sortBy === 'name'"
                    :name="sortOrder === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                    class="size-3"
                  />
                </button>
              </th>
              <th class="text-left p-4 font-medium">
                <button class="flex items-center gap-1 hover:text-primary" @click="handleSort('email')">
                  Email
                  <Icon
                    v-if="sortBy === 'email'"
                    :name="sortOrder === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                    class="size-3"
                  />
                </button>
              </th>
              <th class="text-left p-4 font-medium">Status</th>
              <th class="text-left p-4 font-medium">
                <button class="flex items-center gap-1 hover:text-primary" @click="handleSort('createdAt')">
                  Joined
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
                    <div class="size-10 rounded-full bg-muted animate-pulse" />
                    <div class="h-4 w-32 bg-muted rounded animate-pulse" />
                  </div>
                </td>
                <td class="p-4"><div class="h-4 w-48 bg-muted rounded animate-pulse" /></td>
                <td class="p-4"><div class="h-6 w-20 bg-muted rounded animate-pulse" /></td>
                <td class="p-4"><div class="h-4 w-24 bg-muted rounded animate-pulse" /></td>
                <td class="p-4 text-right"><div class="h-8 w-8 bg-muted rounded animate-pulse ml-auto" /></td>
              </tr>
            </template>

            <!-- Empty state -->
            <tr v-else-if="users.length === 0">
              <td colspan="5" class="p-8 text-center text-muted-foreground">
                <Icon name="lucide:users" class="size-12 mx-auto mb-4 opacity-50" />
                <p>No users found</p>
              </td>
            </tr>

            <!-- User rows -->
            <tr v-for="user in users" v-else :key="user.id" class="border-b hover:bg-muted/50 transition-colors">
              <td class="p-4">
                <div class="flex items-center gap-3">
                  <UiAvatar class="size-10">
                    <UiAvatarImage v-if="user.image" :src="user.image" :alt="user.name || 'User'" />
                    <UiAvatarFallback>{{ (user.name || user.email)[0]?.toUpperCase() }}</UiAvatarFallback>
                  </UiAvatar>
                  <div>
                    <p class="font-medium">{{ user.name || "No name" }}</p>
                    <p class="text-xs text-muted-foreground">{{ user.id.slice(0, 8) }}...</p>
                  </div>
                </div>
              </td>
              <td class="p-4">
                <div class="flex items-center gap-2">
                  <span>{{ user.email }}</span>
                  <Icon
                    v-if="user.emailVerified"
                    name="lucide:check-circle"
                    class="size-4 text-green-500"
                    title="Email verified"
                  />
                </div>
              </td>
              <td class="p-4">
                <UiBadge v-if="user.banned" variant="destructive">Banned</UiBadge>
                <UiBadge v-else variant="outline" class="text-green-600 border-green-600">Active</UiBadge>
              </td>
              <td class="p-4 text-muted-foreground">
                {{ formatDate(user.createdAt) }}
              </td>
              <td class="p-4 text-right">
                <UiButton variant="ghost" size="sm" @click="navigateTo(`/admin/users/${user.id}`)">
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
          {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }} users
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
