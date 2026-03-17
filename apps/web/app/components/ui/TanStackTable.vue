<template>
  <div>
    <div :class="styles({ class: props.class })">
      <UiTable :class="tableClass">
        <UiTableHeader>
          <UiTableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <UiTableHead
              v-for="header in headerGroup.headers"
              :key="header.id"
              :colspan="header.colSpan"
              :class="[header.column.getCanSort() && 'cursor-pointer select-none']"
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              <template v-if="!header.isPlaceholder">
                <div class="flex items-center gap-3">
                  <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                  <Icon
                    v-if="header.column.getCanSort() && header.column.getIsSorted() === 'asc'"
                    :name="ascIcon"
                    class="size-4"
                  />
                  <Icon
                    v-else-if="header.column.getCanSort() && header.column.getIsSorted() === 'desc'"
                    :name="descIcon"
                    class="size-4"
                  />
                  <Icon
                    v-else-if="header.column.getCanSort() && !header.column.getIsSorted()"
                    :name="unsortedIcon"
                    class="h-5 w-5"
                  />
                </div>
              </template>
            </UiTableHead>
          </UiTableRow>
        </UiTableHeader>

        <UiTableBody>
          <UiTableRow
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            :data-state="row.getIsSelected() ? 'selected' : ''"
          >
            <UiTableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </UiTableCell>
          </UiTableRow>

          <UiTableEmpty v-if="table.getRowModel().rows.length === 0" :colspan="table.getAllLeafColumns().length">
            <slot :table="table" name="empty"> No data available. </slot>
          </UiTableEmpty>
        </UiTableBody>
      </UiTable>
    </div>

    <div v-if="showPagination" class="@container">
      <div class="my-6 flex flex-col justify-between gap-4 px-2 @[700px]:flex-row @[700px]:items-center">
        <div class="flex items-center justify-between gap-3">
          <slot name="rowsSelected" :table="table">
            <div v-if="showSelect" class="text-sm whitespace-nowrap text-muted-foreground">
              <span>
                {{ table.getFilteredSelectedRowModel().rows.length }} of {{ " " }}
                {{ table.getFilteredRowModel().rows.length }} row(s) selected
              </span>
            </div>
          </slot>
          <slot name="rowsPerPage" :table="table">
            <div class="flex items-center space-x-2 whitespace-nowrap">
              <p class="hidden text-sm font-medium text-foreground md:inline-block">
                {{ rowsPerPageText }}
              </p>
              <UiSelect v-model="pageSize">
                <UiSelectTrigger class="h-9 w-fit">
                  {{ table.getState().pagination.pageSize }}
                </UiSelectTrigger>
                <UiSelectContent class="min-w-fit" side="top" align="start">
                  <UiSelectGroup>
                    <!-- eslint-disable vue/no-template-shadow -->
                    <UiSelectItem v-for="pageSize in pageSizes" :key="pageSize" :value="`${pageSize}`">
                      {{ pageSize }}
                    </UiSelectItem>
                  </UiSelectGroup>
                </UiSelectContent>
              </UiSelect>
            </div>
          </slot>
        </div>

        <div class="flex items-center justify-between gap-3">
          <slot :table="table" name="page">
            <div class="flex items-center justify-center text-sm font-medium whitespace-nowrap text-foreground">
              Page {{ table.getState().pagination.pageIndex + 1 }} of
              {{ table.getPageCount() }}
            </div>
          </slot>

          <slot :table="table" name="pageButtons">
            <div class="flex items-center space-x-2">
              <UiButton
                variant="outline"
                title="First page"
                class="h-9 w-9 p-0"
                :disabled="!table.getCanPreviousPage()"
                @click="table.setPageIndex(0)"
              >
                <Icon name="lucide:chevrons-left" class="size-4" />
              </UiButton>
              <UiButton
                variant="outline"
                title="Previous page"
                class="h-9 w-9 p-0"
                :disabled="!table.getCanPreviousPage()"
                @click="table.previousPage()"
              >
                <Icon name="lucide:chevron-left" class="size-4" />
              </UiButton>
              <UiButton
                variant="outline"
                title="Next page"
                class="h-9 w-9 p-0"
                :disabled="!table.getCanNextPage()"
                @click="table.nextPage()"
              >
                <Icon name="lucide:chevron-right" class="size-4" />
              </UiButton>
              <UiButton
                variant="outline"
                title="Last page"
                class="h-9 w-9 p-0"
                :disabled="!table.getCanNextPage()"
                @click="table.setPageIndex(table.getPageCount() - 1)"
              >
                <Icon name="lucide:chevrons-right" class="size-4" />
              </UiButton>
            </div>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup generic="T extends object">
import CheckBox from "@/components/ui/Checkbox/Checkbox.vue"
import {
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable
} from "@tanstack/vue-table"
import type { ColumnDef, PaginationState, SortingState, Table } from "@tanstack/vue-table"
import type { HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<{
    /**
     * The data to display in the table.
     */
    data?: T[]
    /**
     * The columns to display in the table.
     */
    columns?: ColumnDef<T>[]
    /**
     * The search term to filter the table data.
     */
    search?: string
    /**
     * Whether to show the select checkbox column.
     */
    showSelect?: boolean
    /**
     * The page sizes to display in the pagination dropdown.
     */
    pageSizes?: number[]
    /**
     * The initial page size for the table.
     */
    pageSize?: number
    /**
     * The initial sorting state of the table.
     */
    sorting?: SortingState
    /**
     * The class(es) to apply to the table.
     */
    tableClass?: HTMLAttributes["class"]
    /**
     * The icon to display for ascending sorting.
     */
    ascIcon?: string
    /**
     * The icon to display for descending sorting.
     */
    descIcon?: string
    /**
     * The icon to display for unsorted columns.
     */
    unsortedIcon?: string
    /**
     * Custom class(es) to add to the parent element.
     */
    class?: HTMLAttributes["class"]
    /**
     * Whether to show pagination controls.
     *
     * @default true
     */
    showPagination?: boolean
    /**
     * The text to display for the rows per page label.
     *
     * @default "Rows per page:"
     */
    rowsPerPageText?: string
    /**
     * Enable server-side pagination (disables client-side pagination/filtering).
     */
    manualPagination?: boolean
    /**
     * Enable server-side sorting (disables client-side sorting).
     */
    manualSorting?: boolean
    /**
     * Total page count from server (required when manualPagination is true).
     */
    pageCount?: number
    /**
     * Total row count from server (required when manualPagination is true).
     */
    rowCount?: number
    /**
     * Current page index (0-based) for controlled pagination.
     */
    pageIndex?: number
  }>(),
  {
    pageSizes: () => [10, 20, 30, 40, 50, 100],
    pageSize: () => 10,
    columns: () => [],
    data: () => [],
    sorting: () => [],
    ascIcon: "lucide:chevron-up",
    descIcon: "lucide:chevron-down",
    unsortedIcon: "lucide:chevrons-up-down",
    showPagination: true,
    rowsPerPageText: "Rows per page:",
    manualPagination: false,
    manualSorting: false,
    pageCount: undefined,
    rowCount: undefined,
    pageIndex: undefined
  }
)

defineOptions({ inheritAttrs: false })

const styles = tv({
  base: "w-full overflow-x-auto"
})

const checkBoxHeader: ColumnDef<any> = {
  id: "checkbox",
  header: ({ table }) => {
    return h(
      "div",
      { class: "flex items-center justify-center" },
      h(CheckBox, {
        modelValue: table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false,
        "onUpdate:modelValue": (value: boolean | "indeterminate") => table.toggleAllPageRowsSelected(!!value),
        ariaLabel: "Select all"
      })
    )
  },
  cell: ({ row }) => {
    return h(
      "div",
      { class: "flex items-center justify-center " },
      h(CheckBox, {
        modelValue: row.getIsSelected(),
        "onUpdate:modelValue": (value: boolean | "indeterminate") => row.toggleSelected(!!value),
        ariaLabel: "Select row"
      })
    )
  },
  enableSorting: false,
  enableHiding: false
}

const localColumns: ColumnDef<T>[] = [...props.columns]

if (props.showSelect) {
  localColumns.unshift(checkBoxHeader)
}

const emit = defineEmits<{
  ready: [table: Table<T>]
  "update:sorting": [sorting: SortingState]
  "update:pageIndex": [pageIndex: number]
  "update:pageSize": [pageSize: number]
}>()

const localSorting = ref(props.sorting)
const globalFilter = ref(props.search)
const columnVisibility = ref({})
const rowSelection = ref({})

const updateFn = (updaterOrValue: any, v: MaybeRefOrGetter) => {
  if (typeof updaterOrValue === "function") {
    return updaterOrValue(toValue(v))
  }
  return updaterOrValue
}

const table = useVueTable({
  get data() {
    return props.data
  },
  get columns() {
    return localColumns
  },
  initialState: {
    pagination: {
      pageSize: props.pageSize,
      pageIndex: props.pageIndex ?? 0
    },
    rowSelection: rowSelection.value,
    globalFilter: props.search
  },
  state: {
    get sorting() {
      return localSorting.value
    },
    get globalFilter() {
      return props.search
    },
    get columnVisibility() {
      return columnVisibility.value
    },
    get rowSelection() {
      return rowSelection.value
    },
    ...(props.manualPagination
      ? {
          get pagination(): PaginationState {
            return {
              pageIndex: props.pageIndex ?? 0,
              pageSize: props.pageSize
            }
          }
        }
      : {})
  },
  manualPagination: props.manualPagination,
  manualSorting: props.manualSorting,
  ...(props.manualPagination && props.pageCount != null ? { pageCount: props.pageCount } : {}),
  ...(props.manualPagination && props.rowCount != null ? { rowCount: props.rowCount } : {}),
  onSortingChange: (updaterOrValue) => {
    localSorting.value = updateFn(updaterOrValue, localSorting)
    if (props.manualSorting) {
      emit("update:sorting", localSorting.value)
    }
  },
  onGlobalFilterChange: (updaterOrValue) => {
    globalFilter.value = updateFn(updaterOrValue, globalFilter)
  },
  onPaginationChange: (updaterOrValue) => {
    if (props.manualPagination) {
      const current = { pageIndex: props.pageIndex ?? 0, pageSize: props.pageSize }
      const next = typeof updaterOrValue === "function" ? updaterOrValue(current) : updaterOrValue
      if (next.pageIndex !== current.pageIndex) emit("update:pageIndex", next.pageIndex)
      if (next.pageSize !== current.pageSize) emit("update:pageSize", next.pageSize)
    }
  },
  onRowSelectionChange: (updaterOrValue) => {
    rowSelection.value = updateFn(updaterOrValue, rowSelection)
  },
  getCoreRowModel: getCoreRowModel(),
  ...(!props.manualSorting ? { getSortedRowModel: getSortedRowModel() } : {}),
  ...(!props.manualPagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  ...(!props.manualPagination ? { getFilteredRowModel: getFilteredRowModel() } : {}),
  enableRowSelection: () => !!props.showSelect
})

function toggleColumnVisibility(column: any) {
  columnVisibility.value = {
    ...columnVisibility.value,
    [column.id]: !column.getIsVisible()
  }
}

 
const pageSize = computed({
  get() {
    if (props.manualPagination) return props.pageSize.toString()
    return table.getState().pagination.pageSize.toString()
  },
  set(value) {
    if (props.manualPagination) {
      emit("update:pageSize", Number(value))
      emit("update:pageIndex", 0)
    } else {
      table.setPageSize(Number(value))
    }
  }
})

onMounted(() => {
  emit("ready", table)
})

defineExpose({ toggleColumnVisibility })
</script>
