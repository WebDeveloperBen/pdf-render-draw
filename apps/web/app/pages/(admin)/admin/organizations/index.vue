<script setup lang="ts">
import { keepPreviousData } from "@tanstack/vue-query"
import type { ColumnDef } from "@tanstack/vue-table"
import type { GetApiAdminOrganizations200, GetApiAdminOrganizations200OrganizationsItem, GetApiAdminOrganizationsParams } from "~/models/api"
import { useGetApiAdminOrganizations } from "~/models/api"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

useSeoMeta({ title: "Organizations - Admin" })

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
  defaultSort: { id: 'createdAt', desc: true }
})

const params = computed<GetApiAdminOrganizationsParams>(() => ({
  page: page.value,
  limit: pageSize.value,
  sortBy: sortBy.value as 'createdAt' | 'name',
  sortOrder: sortOrder.value,
  search: debouncedSearch.value || undefined
}))

const { data, isLoading, isFetching, refetch } = useGetApiAdminOrganizations(params, {
  query: { placeholderData: keepPreviousData }
})

const response = computed(() => data.value?.data as GetApiAdminOrganizations200 | undefined)
const items = computed(() => response.value?.organizations ?? [])
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
const columns: ColumnDef<GetApiAdminOrganizations200OrganizationsItem>[] = [
  {
    accessorKey: "name",
    header: "Organization",
    cell: ({ row }) => {
      const org = row.original
      return h("div", { class: "flex items-center gap-3" }, [
        h(resolveComponent("UiAvatar"), { class: "size-10 rounded-lg" }, () => [
          org.logo
            ? h(resolveComponent("UiAvatarImage"), { src: org.logo, alt: org.name })
            : null,
          h(resolveComponent("UiAvatarFallback"), { class: "rounded-lg" }, () =>
            org.name[0]?.toUpperCase()
          )
        ]),
        h("div", {}, [
          h("p", { class: "font-medium" }, org.name),
          h("p", { class: "text-xs text-muted-foreground" }, `${org.id.slice(0, 8)}...`)
        ])
      ])
    }
  },
  {
    accessorKey: "slug",
    header: "Slug",
    cell: ({ row }) =>
      h("span", { class: "text-muted-foreground" }, `@${row.original.slug}`)
  },
  {
    accessorKey: "memberCount",
    header: "Members",
    cell: ({ row }) =>
      h("div", { class: "flex items-center gap-1" }, [
        h(resolveComponent("Icon"), {
          name: "lucide:users",
          class: "size-4 text-muted-foreground"
        }),
        h("span", {}, String(row.original.memberCount))
      ])
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) =>
      h("span", { class: "text-muted-foreground" }, formatDate(row.original.createdAt))
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
          title: "View organization details",
          onClick: () => navigateTo(`/admin/organizations/${row.original.id}`)
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
        <h1 class="text-3xl font-bold">Organizations</h1>
        <p class="text-muted-foreground mt-1">Manage platform organizations</p>
      </div>
      <UiButton variant="outline" size="sm" @click="refetch()">
        <Icon name="lucide:refresh-cw" class="size-4 mr-2" />
        Refresh
      </UiButton>
    </div>

    <!-- Search -->
    <div class="flex items-center gap-4">
      <div class="relative flex-1 max-w-sm">
        <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <UiInput v-model="search" placeholder="Search organizations by name or slug..." class="pl-9" />
      </div>
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

    <!-- Organizations Table -->
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
        :sorting="[{ id: 'createdAt', desc: true }]"
        @update:sorting="onUpdateSorting"
        @update:page-index="onUpdatePageIndex"
        @update:page-size="onUpdatePageSize"
      >
        <template #empty>
          <div class="flex flex-col items-center py-8 text-muted-foreground">
            <Icon name="lucide:building-2" class="size-12 mb-4 opacity-50" />
            <p>No organizations found</p>
          </div>
        </template>
      </UiTanStackTable>
    </UiCard>
  </div>
</template>
