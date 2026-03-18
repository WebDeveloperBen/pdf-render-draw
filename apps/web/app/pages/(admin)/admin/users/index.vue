<script setup lang="ts">
import { keepPreviousData } from "@tanstack/vue-query"
import type { ColumnDef } from "@tanstack/vue-table"
import type { GetApiAdminUsers200, GetApiAdminUsers200UsersItem, GetApiAdminUsersParams } from "~/models/api"
import { useGetApiAdminUsers } from "~/models/api"
import { CheckCircle, Eye, RefreshCw, Search, Users } from "lucide-vue-next"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

useSeoMeta({ title: "Users - Admin" })

// Pagination state
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
  defaultSort: { id: "createdAt", desc: true }
})

// Orval query params
const params = computed<GetApiAdminUsersParams>(() => ({
  page: page.value,
  limit: pageSize.value,
  sortBy: sortBy.value as GetApiAdminUsersParams["sortBy"],
  sortOrder: sortOrder.value,
  search: debouncedSearch.value || undefined
}))

// Use Orval-generated hook
const { data, isLoading, isFetching, refetch } = useGetApiAdminUsers(params, {
  query: { placeholderData: keepPreviousData }
})

// Extract data from response wrapper
const response = computed(() => data.value?.data as GetApiAdminUsers200 | undefined)
const items = computed(() => response.value?.users ?? [])
const pagination = computed(() => response.value?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 })
const pageCount = computed(() => pagination.value.totalPages)
const totalRows = computed(() => pagination.value.total)

// Format date
const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}

// Column definitions
const columns: ColumnDef<GetApiAdminUsers200UsersItem>[] = [
  {
    accessorKey: "name",
    header: "User",
    cell: ({ row }) => {
      const user = row.original
      return h("div", { class: "flex items-center gap-3" }, [
        h(resolveComponent("UiAvatar"), { class: "size-10" }, () => [
          user.image ? h(resolveComponent("UiAvatarImage"), { src: user.image, alt: user.name || "User" }) : null,
          h(resolveComponent("UiAvatarFallback"), {}, () => (user.name || user.email)[0]?.toUpperCase())
        ]),
        h("div", {}, [
          h("p", { class: "font-medium" }, user.name || "No name"),
          h("p", { class: "text-xs text-muted-foreground" }, `${user.id.slice(0, 8)}...`)
        ])
      ])
    }
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => {
      const user = row.original
      return h("div", { class: "flex items-center gap-2" }, [
        h("span", {}, user.email),
        user.emailVerified ? h(CheckCircle, { class: "size-4 text-green-500", title: "Email verified" }) : null
      ])
    }
  },
  {
    accessorKey: "banned",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => {
      const user = row.original
      return user.banned
        ? h(resolveComponent("UiBadge"), { variant: "destructive" }, () => "Banned")
        : h(
            resolveComponent("UiBadge"),
            { variant: "outline", class: "text-green-600 border-green-600" },
            () => "Active"
          )
    }
  },
  {
    accessorKey: "createdAt",
    header: "Joined",
    cell: ({ row }) => h("span", { class: "text-muted-foreground" }, formatDate(row.original.createdAt))
  },
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    cell: ({ row }) => {
      return h(
        resolveComponent("UiButton"),
        {
          variant: "ghost",
          size: "sm",
          title: "View user details",
          onClick: () => navigateTo(`/admin/users/${row.original.id}`)
        },
        () => h(Eye, { class: "size-4" })
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
        <h1 class="text-3xl font-bold">Users</h1>
        <p class="text-muted-foreground mt-1">Manage platform users</p>
      </div>
      <UiButton variant="outline" size="sm" @click="refetch()">
        <RefreshCw class="size-4 mr-2" />
        Refresh
      </UiButton>
    </div>

    <!-- Search -->
    <div class="flex items-center gap-4">
      <div class="relative flex-1 max-w-sm">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <UiInput v-model="search" placeholder="Search users by name or email..." class="pl-9" />
      </div>
    </div>

    <!-- Loading State -->
    <UiCard v-if="isLoading">
      <div class="p-4 space-y-4">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4">
          <div class="size-10 rounded-full bg-muted animate-pulse" />
          <div class="flex-1 space-y-2">
            <div class="h-4 w-32 bg-muted rounded animate-pulse" />
            <div class="h-3 w-48 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    </UiCard>

    <!-- Users Table -->
    <UiCard v-else class="p-4">
      <UiTanStackTable
        :data="items"
        :columns="columns"
        :search="search"
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
            <Users class="size-12 mb-4 opacity-50" />
            <p>No users found</p>
          </div>
        </template>
      </UiTanStackTable>
    </UiCard>
  </div>
</template>
