<script setup lang="ts" generic="T extends TableData">
import { computed, ref, watch } from "vue"
import { Primitive } from "reka-ui"
import { upperFirst } from "scule"
import {
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  useVueTable
} from "@tanstack/vue-table"
import { reactiveOmit } from "@vueuse/core"
import type {
  TableData,
  TableColumn,
  TableRow,
  TableProps,
  Ref,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnSizingInfoState,
  ExpandedState,
  GroupingState,
  PaginationState,
  RowPinningState,
  RowSelectionState,
  SortingState,
  VisibilityState,
  Updater
} from "./datatable.types"

// Re-export types for consumers
export type { TableRow, TableData, TableColumn, TableProps, TableSlots } from "./datatable.types"
export type { TableOptions } from "./datatable.types"

const props = withDefaults(defineProps<TableProps<T>>(), {
  watchOptions: () => ({ deep: true }),
  enableColumnReordering: false,
  enablePagination: false
})

const data = ref(props.data ?? []) as Ref<T[]>
const columns = computed<TableColumn<T>[]>(
  () =>
    props.columns ??
    Object.keys(data.value[0] ?? {}).map((accessorKey: string) => ({ accessorKey, header: upperFirst(accessorKey) }))
)
const meta = computed(() => props.meta ?? {})

/** tiny class combiner */
function cn(...inputs: any[]) {
  return inputs.flat(Infinity).filter(Boolean).join(" ")
}

/** Tailwind/shadcn UI */
const ui = computed(() => {
  const isStickyHeader = props.sticky === true || props.sticky === "header"
  const isStickyFooter = props.sticky === true || props.sticky === "footer"
  return {
    root: ({ class: extra }: any = {}) =>
      cn("relative w-full overflow-auto rounded-2xl border bg-card text-card-foreground shadow-sm", extra),
    base: ({ class: extra }: any = {}) => cn("w-full caption-bottom text-sm", extra),
    caption: ({ class: extra }: any = {}) => cn("mt-4 text-xs text-muted-foreground", extra),
    thead: ({ class: extra }: any = {}) =>
      cn(
        "text-sm",
        isStickyHeader && "sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40",
        extra
      ),
    tfoot: ({ class: extra }: any = {}) =>
      cn(
        "text-sm",
        isStickyFooter && "sticky bottom-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40",
        extra
      ),
    tr: ({ class: extra }: any = {}) =>
      cn(
        "border-b last:border-0 data-[selectable=true]:cursor-pointer",
        "hover:bg-muted/30 data-[selected=true]:bg-muted data-[expanded=true]:bg-muted/20",
        extra
      ),
    th: ({ pinned, class: extra }: any = {}) =>
      cn(
        "h-10 px-3 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        "relative", // for drop-indicator positioning
        pinned && "sticky left-0 bg-background shadow-[inset_-1px_0_0_theme(colors.border)]",
        extra
      ),
    td: ({ pinned, class: extra }: any = {}) =>
      cn(
        "p-3 align-middle [&:has([role=checkbox])]:pr-0 whitespace-nowrap",
        pinned && "sticky left-0 bg-background shadow-[inset_-1px_0_0_theme(colors.border)]",
        extra
      ),
    separator: ({ class: extra }: any = {}) => cn("h-px bg-border", extra),
    tbody: ({ class: extra }: any = {}) => cn("", extra),
    loading: ({ class: extra }: any = {}) => cn("py-10 text-center text-muted-foreground", extra),
    empty: ({ class: extra }: any = {}) => cn("py-10 text-center text-muted-foreground", extra)
  }
})

const hasFooter = computed(() => {
  function hasFooterRecursive(cols: TableColumn<T>[]): boolean {
    for (const c of cols) {
      if ("footer" in c) return true
      if ("columns" in c && hasFooterRecursive(c.columns as TableColumn<T>[])) return true
    }
    return false
  }
  return hasFooterRecursive(columns.value)
})

/** TanStack controlled states */
const globalFilterState = defineModel<string>("globalFilter", { default: undefined })
const columnFiltersState = defineModel<ColumnFiltersState>("columnFilters", { default: [] })
const columnOrderState = defineModel<ColumnOrderState>("columnOrder", { default: [] })
const columnVisibilityState = defineModel<VisibilityState>("columnVisibility", { default: {} })
const columnPinningState = defineModel<ColumnPinningState>("columnPinning", { default: {} })
const columnSizingState = defineModel<ColumnSizingState>("columnSizing", { default: {} })
const columnSizingInfoState = defineModel<ColumnSizingInfoState>("columnSizingInfo", { default: {} })
const rowSelectionState = defineModel<RowSelectionState>("rowSelection", { default: {} })
const rowPinningState = defineModel<RowPinningState>("rowPinning", { default: {} })
const sortingState = defineModel<SortingState>("sorting", { default: [] })
const groupingState = defineModel<GroupingState>("grouping", { default: [] })
const expandedState = defineModel<ExpandedState>("expanded", { default: {} })
const paginationState = defineModel<PaginationState>("pagination", { default: {} })

const tableRef = ref<HTMLTableElement | null>(null)

/** Column reordering drag state + hysteresis */
const draggedColumn = ref<string | null>(null)
const dragOverColumn = ref<string | null>(null)
const dropPosition = ref<"before" | "after" | null>(null)
const HYSTERESIS = 0.15 // 15% dead-zone around mid; adjust 0.1–0.2 as desired
const stableDropPos = ref<Record<string, "before" | "after">>({})

/** Column reordering fns */
const handleColumnDragStart = (e: DragEvent, columnId: string) => {
  if (!props.enableColumnReordering) return
  draggedColumn.value = columnId
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", columnId)
  }
}

const handleColumnDragOver = (e: DragEvent, columnId: string) => {
  if (!props.enableColumnReordering || !draggedColumn.value) return
  e.preventDefault()
  e.dataTransfer!.dropEffect = "move"

  // Compute relative X and apply hysteresis against center
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const rel = (e.clientX - rect.left) / rect.width

  let nextPos: "before" | "after" = stableDropPos.value[columnId] ?? "after"
  if (rel < 0.5 - HYSTERESIS) nextPos = "before"
  else if (rel > 0.5 + HYSTERESIS) nextPos = "after"

  // Only show indicator if the drop would actually change the order
  const currentOrder =
    columnOrderState.value.length > 0 ? [...columnOrderState.value] : tableApi.getAllLeafColumns().map((c) => c.id)

  const draggedIndex = currentOrder.indexOf(draggedColumn.value)
  const targetIndex = currentOrder.indexOf(columnId)

  let wouldChangeOrder = false
  if (draggedIndex !== -1 && targetIndex !== -1) {
    if (nextPos === "before") {
      wouldChangeOrder = targetIndex !== draggedIndex + 1
    } else {
      wouldChangeOrder = targetIndex !== draggedIndex - 1
    }
  }

  dragOverColumn.value = columnId
  stableDropPos.value[columnId] = nextPos
  dropPosition.value = wouldChangeOrder ? nextPos : null
}

const handleColumnDragLeave = () => {
  if (!props.enableColumnReordering) return
  dragOverColumn.value = null
  dropPosition.value = null
}

const handleColumnDrop = (e: DragEvent, targetColumnId: string) => {
  if (!props.enableColumnReordering || !draggedColumn.value) return
  e.preventDefault()

  const draggedId = draggedColumn.value
  if (draggedId === targetColumnId) {
    draggedColumn.value = null
    dragOverColumn.value = null
    dropPosition.value = null
    return
  }

  const currentOrder =
    columnOrderState.value.length > 0 ? [...columnOrderState.value] : tableApi.getAllLeafColumns().map((c) => c.id)

  const draggedIndex = currentOrder.indexOf(draggedId)
  const targetIndex = currentOrder.indexOf(targetColumnId)

  if (draggedIndex !== -1 && targetIndex !== -1) {
    currentOrder.splice(draggedIndex, 1)
    let newTargetIndex = targetIndex
    if (draggedIndex < targetIndex) newTargetIndex = targetIndex - 1
    if (dropPosition.value === "after") newTargetIndex = newTargetIndex + 1
    currentOrder.splice(newTargetIndex, 0, draggedId)
    columnOrderState.value = currentOrder
  }

  draggedColumn.value = null
  dragOverColumn.value = null
  dropPosition.value = null
  stableDropPos.value = {}
}

const handleColumnDragEnd = () => {
  draggedColumn.value = null
  dragOverColumn.value = null
  dropPosition.value = null
  stableDropPos.value = {}
}

/** Visibility helpers (optional) */
const toggleColumnVisibility = (columnId: string) => {
  const column = tableApi.getColumn(columnId)
  if (column) {
    columnVisibilityState.value = {
      ...columnVisibilityState.value,
      [columnId]: !column.getIsVisible()
    }
  }
}
const resetColumnOrder = () => (columnOrderState.value = [])

/** TanStack table */
const tableApi = useVueTable({
  ...reactiveOmit(
    props,
    "as",
    "data",
    "columns",
    "caption",
    "sticky",
    "loading",
    "loadingColor",
    "loadingAnimation",
    "class",
    "ui"
  ),
  data,
  get columns() {
    return columns.value
  },
  meta: meta.value,
  getCoreRowModel: getCoreRowModel(),
  ...(props.globalFilterOptions || {}),
  onGlobalFilterChange: (u) => valueUpdater(u, globalFilterState),
  ...(props.columnFiltersOptions || {}),
  getFilteredRowModel: getFilteredRowModel(),
  onColumnFiltersChange: (u) => valueUpdater(u, columnFiltersState),
  onColumnOrderChange: (u) => valueUpdater(u, columnOrderState),
  ...(props.visibilityOptions || {}),
  onColumnVisibilityChange: (u) => valueUpdater(u, columnVisibilityState),
  ...(props.columnPinningOptions || {}),
  onColumnPinningChange: (u) => valueUpdater(u, columnPinningState),
  ...(props.columnSizingOptions || {}),
  onColumnSizingChange: (u) => valueUpdater(u, columnSizingState),
  onColumnSizingInfoChange: (u) => valueUpdater(u, columnSizingInfoState),
  ...(props.rowSelectionOptions || {}),
  onRowSelectionChange: (u) => valueUpdater(u, rowSelectionState),
  ...(props.rowPinningOptions || {}),
  onRowPinningChange: (u) => valueUpdater(u, rowPinningState),
  ...(props.sortingOptions || {}),
  getSortedRowModel: getSortedRowModel(),
  onSortingChange: (u) => valueUpdater(u, sortingState),
  ...(props.groupingOptions || {}),
  onGroupingChange: (u) => valueUpdater(u, groupingState),
  ...(props.expandedOptions || {}),
  getExpandedRowModel: getExpandedRowModel(),
  onExpandedChange: (u) => valueUpdater(u, expandedState),
  ...(props.enablePagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  ...(props.paginationOptions || {}),
  onPaginationChange: (u) => valueUpdater(u, paginationState),
  ...(props.facetedOptions || {}),
  state: {
    get globalFilter() {
      return globalFilterState.value
    },
    get columnFilters() {
      return columnFiltersState.value
    },
    get columnOrder() {
      return columnOrderState.value
    },
    get columnVisibility() {
      return columnVisibilityState.value
    },
    get columnPinning() {
      return columnPinningState.value
    },
    get expanded() {
      return expandedState.value
    },
    get rowSelection() {
      return rowSelectionState.value
    },
    get sorting() {
      return sortingState.value
    },
    get grouping() {
      return groupingState.value
    },
    get rowPinning() {
      return rowPinningState.value
    },
    get columnSizing() {
      return columnSizingState.value
    },
    get columnSizingInfo() {
      return columnSizingInfoState.value
    },
    get pagination() {
      return paginationState.value
    }
  }
})

function valueUpdater<T extends Updater<any>>(updaterOrValue: T, ref: Ref) {
  ref.value = typeof updaterOrValue === "function" ? updaterOrValue(ref.value) : updaterOrValue
}

/** Row events */
function onRowSelect(e: Event, row: TableRow<T>) {
  if (!props.onSelect) return
  const target = e.target as HTMLElement
  const isInteractive = target.closest("button") || target.closest("a")
  if (isInteractive) return
  e.preventDefault()
  e.stopPropagation()
  props.onSelect(row, e)
}
function onRowHover(e: Event, row: TableRow<T> | null) {
  if (!props.onHover) return
  props.onHover(e, row)
}
function onRowContextmenu(e: Event, row: TableRow<T>) {
  if (!props.onContextmenu) return
  if (Array.isArray(props.onContextmenu)) props.onContextmenu.forEach((fn) => fn(e, row))
  else props.onContextmenu(e, row)
}

/** helpers */
function resolveValue<T, A = undefined>(prop: T | ((arg: A) => T), arg?: A): T | undefined {
  if (typeof prop === "function") {
    // @ts-expect-error - prop is narrowed to function but TS can't infer callable signature
    return prop(arg)
  }
  return prop
}

watch(
  () => props.data,
  () => {
    data.value = props.data ? [...props.data] : []
  },
  props.watchOptions
)

defineExpose({
  tableRef,
  tableApi,
  resetColumnOrder,
  toggleColumnVisibility
})
</script>

<template>
  <Primitive :as="as" :class="ui.root({ class: [props.ui?.root, props.class] })">
    <table ref="tableRef" :class="ui.base({ class: [props.ui?.base] })">
      <caption v-if="caption || !!$slots.caption" :class="ui.caption({ class: [props.ui?.caption] })">
        <slot name="caption">
          {{ caption }}
        </slot>
      </caption>

      <thead :class="ui.thead({ class: [props.ui?.thead] })">
        <tr
          v-for="headerGroup in tableApi.getHeaderGroups()"
          :key="headerGroup.id"
          :class="ui.tr({ class: [props.ui?.tr] })"
        >
          <th
            v-for="header in headerGroup.headers"
            :key="header.id"
            :data-pinned="header.column.getIsPinned()"
            :scope="header.colSpan > 1 ? 'colgroup' : 'col'"
            :colspan="header.colSpan > 1 ? header.colSpan : undefined"
            :rowspan="header.rowSpan > 1 ? header.rowSpan : undefined"
            :draggable="props.enableColumnReordering && !header.isPlaceholder"
            :class="
              cn(
                ui.th({
                  class: [props.ui?.th, resolveValue(header.column.columnDef.meta?.class?.th, header)],
                  pinned: !!header.column.getIsPinned()
                }),
                props.enableColumnReordering &&
                  !header.isPlaceholder &&
                  'cursor-move select-none transition-all duration-200',
                draggedColumn === header.id && 'opacity-50 scale-95',
                dragOverColumn === header.id && draggedColumn !== header.id && 'bg-muted/30'
              )
            "
            @dragstart="handleColumnDragStart($event, header.id)"
            @dragover="handleColumnDragOver($event, header.id)"
            @dragleave="handleColumnDragLeave"
            @drop="handleColumnDrop($event, header.id)"
            @dragend="handleColumnDragEnd"
          >
            <!-- Stable drop indicator using hysteresis + gutter centering -->
            <div
              v-if="
                dragOverColumn === header.id &&
                draggedColumn !== header.id &&
                props.enableColumnReordering &&
                dropPosition
              "
              :class="
                cn(
                  'absolute inset-y-0 w-1 bg-primary pointer-events-none',
                  (stableDropPos[header.id] ?? 'after') === 'before'
                    ? 'left-0 -translate-x-1/2'
                    : 'right-0 translate-x-1/2'
                )
              "
            />

            <div class="relative group">
              <slot :name="`${header.id}-header`" v-bind="header.getContext()">
                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
              </slot>
            </div>
          </th>
        </tr>

        <tr :class="ui.separator({ class: [props.ui?.separator] })" />
      </thead>

      <tbody :class="ui.tbody({ class: [props.ui?.tbody] })">
        <slot name="body-top" />

        <template v-if="tableApi.getRowModel().rows?.length">
          <template v-for="row in tableApi.getRowModel().rows" :key="row.id">
            <tr
              :data-selected="row.getIsSelected()"
              :data-selectable="!!props.onSelect || !!props.onHover || !!props.onContextmenu"
              :data-expanded="row.getIsExpanded()"
              :role="props.onSelect ? 'button' : undefined"
              :tabindex="props.onSelect ? 0 : undefined"
              :class="
                ui.tr({
                  class: [props.ui?.tr, resolveValue(tableApi.options.meta?.class?.tr, row)]
                })
              "
              :style="resolveValue(tableApi.options.meta?.style?.tr, row)"
              @click="onRowSelect($event, row)"
              @pointerenter="onRowHover($event, row)"
              @pointerleave="onRowHover($event, null)"
              @contextmenu="onRowContextmenu($event, row)"
            >
              <td
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                :data-pinned="cell.column.getIsPinned()"
                :colspan="resolveValue(cell.column.columnDef.meta?.colspan?.td, cell)"
                :rowspan="resolveValue(cell.column.columnDef.meta?.rowspan?.td, cell)"
                :class="
                  ui.td({
                    class: [props.ui?.td, resolveValue(cell.column.columnDef.meta?.class?.td, cell)],
                    pinned: !!cell.column.getIsPinned()
                  })
                "
                :style="resolveValue(cell.column.columnDef.meta?.style?.td, cell)"
              >
                <slot :name="`${cell.column.id}-cell`" v-bind="cell.getContext()">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </slot>
              </td>
            </tr>

            <!-- Expanded row -->
            <tr v-if="row.getIsExpanded()" :class="ui.tr({ class: [props.ui?.tr] })">
              <td :colspan="row.getAllCells().length" :class="ui.td({ class: [props.ui?.td] })">
                <slot name="expanded" :row="row" />
              </td>
            </tr>
          </template>
        </template>

        <tr v-else-if="loading && !!$slots['loading']">
          <td :colspan="tableApi.getAllLeafColumns().length" :class="ui.loading({ class: props.ui?.loading })">
            <slot name="loading" />
          </td>
        </tr>

        <tr v-else>
          <td :colspan="tableApi.getAllLeafColumns().length" :class="ui.empty({ class: [props.ui?.empty] })">
            <slot name="empty">
              {{ empty || "No Results" }}
            </slot>
          </td>
        </tr>

        <slot name="body-bottom" />
      </tbody>

      <tfoot v-if="hasFooter" :class="ui.tfoot({ class: [props.ui?.tfoot] })">
        <tr :class="ui.separator({ class: [props.ui?.separator] })" />
        <tr
          v-for="footerGroup in tableApi.getFooterGroups()"
          :key="footerGroup.id"
          :class="ui.tr({ class: [props.ui?.tr] })"
        >
          <th
            v-for="header in footerGroup.headers"
            :key="header.id"
            :data-pinned="header.column.getIsPinned()"
            :colspan="header.colSpan > 1 ? header.colSpan : undefined"
            :rowspan="header.rowSpan > 1 ? header.rowSpan : undefined"
            :class="
              ui.th({
                class: [props.ui?.th, resolveValue(header.column.columnDef.meta?.class?.th, header)],
                pinned: !!header.column.getIsPinned()
              })
            "
            :style="resolveValue(header.column.columnDef.meta?.style?.th, header)"
          >
            <slot :name="`${header.id}-footer`" v-bind="header.getContext()">
              <FlexRender
                v-if="!header.isPlaceholder"
                :render="header.column.columnDef.footer"
                :props="header.getContext()"
              />
            </slot>
          </th>
        </tr>
      </tfoot>
    </table>
  </Primitive>
</template>
