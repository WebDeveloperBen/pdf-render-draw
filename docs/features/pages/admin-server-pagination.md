# Admin Server-Side Pagination

## Overview

Currently, the admin users table fetches up to 100 users and uses TanStack Table's client-side pagination. If the platform grows beyond 100 users, server-side pagination will be needed.

## Current Implementation

- **Location**: `app/pages/(admin)/admin/users/index.vue`
- **API**: `server/api/admin/users/index.get.ts`
- **Limit**: 100 users max (API validation constraint)
- **Pagination**: Client-side via TanStack Table

## Implementation Plan

### 1. Update API to Support Cursor/Offset Pagination

The API already supports pagination parameters:
```typescript
// server/api/admin/users/index.get.ts
const querySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "name", "email"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
})
```

### 2. Create Server-Side TanStack Table Wrapper

Create a composable that bridges TanStack Table with server-side data:

```typescript
// composables/useServerTable.ts
export function useServerTable<T>(options: {
  fetchFn: (params: { page: number; limit: number; sortBy?: string; sortOrder?: string; search?: string }) => Promise<{ data: T[]; total: number }>
  pageSize?: number
}) {
  const data = ref<T[]>([])
  const totalRows = ref(0)
  const isLoading = ref(false)
  const pagination = ref({ pageIndex: 0, pageSize: options.pageSize || 20 })
  const sorting = ref<SortingState>([])
  const globalFilter = ref("")

  const fetchData = async () => {
    isLoading.value = true
    const result = await options.fetchFn({
      page: pagination.value.pageIndex + 1,
      limit: pagination.value.pageSize,
      sortBy: sorting.value[0]?.id,
      sortOrder: sorting.value[0]?.desc ? "desc" : "asc",
      search: globalFilter.value
    })
    data.value = result.data
    totalRows.value = result.total
    isLoading.value = false
  }

  // Watch for changes and refetch
  watch([pagination, sorting, globalFilter], fetchData, { deep: true })

  return { data, totalRows, isLoading, pagination, sorting, globalFilter, fetchData }
}
```

### 3. Update TanStack Table Component

Add props for server-side mode:

```vue
// components/ui/TanStackTable.vue
const props = defineProps<{
  // ... existing props
  manualPagination?: boolean
  manualSorting?: boolean
  manualFiltering?: boolean
  pageCount?: number
  rowCount?: number
}>()
```

### 4. Update Admin Users Page

```vue
<script setup>
const { data, totalRows, isLoading, pagination, sorting, globalFilter, fetchData } = useServerTable({
  fetchFn: async (params) => {
    const response = await $fetch("/api/admin/users", { query: params })
    return { data: response.users, total: response.pagination.total }
  },
  pageSize: 20
})

onMounted(fetchData)
</script>

<template>
  <UiTanStackTable
    :data="data"
    :columns="columns"
    :manual-pagination="true"
    :manual-sorting="true"
    :page-count="Math.ceil(totalRows / 20)"
    v-model:pagination="pagination"
    v-model:sorting="sorting"
  />
</template>
```

## Files to Modify

| File | Changes |
|------|---------|
| `app/composables/useServerTable.ts` | Create new composable |
| `app/components/ui/TanStackTable.vue` | Add manual mode props |
| `app/pages/(admin)/admin/users/index.vue` | Switch to server-side mode |
| `app/pages/(admin)/admin/organizations/index.vue` | Switch to server-side mode |

## Priority

**Low** - Only needed when user count exceeds 100. Current implementation is sufficient for most use cases.

## References

- [TanStack Table Server-Side Pagination](https://tanstack.com/table/latest/docs/guide/pagination#manual-server-side-pagination)
- [TanStack Table Manual Sorting](https://tanstack.com/table/latest/docs/guide/sorting#manual-server-side-sorting)
