import type { SortingState } from "@tanstack/vue-table"
import { useDebounceFn } from "@vueuse/core"

interface AdminPaginationOptions {
  /** Default page size */
  defaultPageSize?: number
  /** Default sort state */
  defaultSort?: { id: string; desc: boolean }
}

/**
 * Manages server-side pagination, sorting, and search state for admin tables.
 * Use with Orval-generated query hooks for data fetching.
 */
export function useAdminPagination(options: AdminPaginationOptions = {}) {
  const { defaultPageSize = 20, defaultSort = { id: "createdAt", desc: true } } = options

  // Pagination state
  const page = ref(1)
  const pageSize = ref(defaultPageSize)

  // Search with debounce
  const search = ref("")
  const debouncedSearch = ref("")
  const updateDebouncedSearch = useDebounceFn((val: string) => {
    debouncedSearch.value = val
    page.value = 1
  }, 300)
  watch(search, (val) => updateDebouncedSearch(val))

  // Sorting state (TanStack Table format)
  const sorting = ref<SortingState>([defaultSort])
  const sortBy = computed(() => sorting.value[0]?.id ?? defaultSort.id)
  const sortOrder = computed<"asc" | "desc">(() => (sorting.value[0]?.desc ? "desc" : "asc"))

  // Page index (0-based for TanStack Table)
  const pageIndex = computed(() => page.value - 1)

  // Event handlers for UiTanStackTable
  const onUpdatePageIndex = (index: number) => {
    page.value = index + 1
  }
  const onUpdatePageSize = (size: number) => {
    pageSize.value = size
    page.value = 1
  }
  const onUpdateSorting = (newSorting: SortingState) => {
    sorting.value = newSorting
    page.value = 1
  }

  return {
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
  }
}
