<script setup lang="ts">
import { toast } from "vue-sonner"
import type { ColumnDef } from "@tanstack/vue-table"
import type { AdminUser, AdminUsersResponse } from "@shared/types/admin.types"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

useSeoMeta({ title: "Users - Admin" })

// State
const users = ref<AdminUser[]>([])
const isLoading = ref(true)
const search = ref("")

// Fetch all users (TanStack handles pagination/sorting client-side)
const fetchUsers = async () => {
  isLoading.value = true
  try {
    const response = await $fetch<AdminUsersResponse>("/api/admin/users", {
      query: {
        limit: 100 // API max limit
      }
    })
    users.value = response.users
  } catch (e: any) {
    toast.error(e.data?.message || "Failed to load users")
  } finally {
    isLoading.value = false
  }
}

// Format date
const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}

// Column definitions
const columns: ColumnDef<AdminUser>[] = [
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
        user.emailVerified
          ? h(resolveComponent("Icon"), {
              name: "lucide:check-circle",
              class: "size-4 text-green-500",
              title: "Email verified"
            })
          : null
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
        () => h(resolveComponent("Icon"), { name: "lucide:eye", class: "size-4" })
      )
    }
  }
]

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
      <UiButton variant="outline" size="sm" @click="fetchUsers">
        <Icon name="lucide:refresh-cw" class="size-4 mr-2" />
        Refresh
      </UiButton>
    </div>

    <!-- Search -->
    <div class="flex items-center gap-4">
      <div class="relative flex-1 max-w-sm">
        <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
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
        :data="users"
        :columns="columns"
        :search="search"
        :page-size="20"
        :sorting="[{ id: 'createdAt', desc: true }]"
      >
        <template #empty>
          <div class="flex flex-col items-center py-8 text-muted-foreground">
            <Icon name="lucide:users" class="size-12 mb-4 opacity-50" />
            <p>No users found</p>
          </div>
        </template>
      </UiTanStackTable>
    </UiCard>
  </div>
</template>
