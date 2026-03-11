import type { Ref, WatchOptions } from "vue"
import type { Cell, Header, RowData, TableMeta } from "@tanstack/table-core"
import type {
  CellContext,
  ColumnDef,
  ColumnFiltersOptions,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnPinningOptions,
  ColumnPinningState,
  ColumnSizingInfoState,
  ColumnSizingOptions,
  ColumnSizingState,
  CoreOptions,
  ExpandedOptions,
  ExpandedState,
  FacetedOptions,
  GlobalFilterOptions,
  GroupingOptions,
  GroupingState,
  HeaderContext,
  PaginationOptions,
  PaginationState,
  Row,
  RowPinningOptions,
  RowPinningState,
  RowSelectionOptions,
  RowSelectionState,
  SortingOptions,
  SortingState,
  Updater,
  VisibilityOptions,
  VisibilityState
} from "@tanstack/vue-table"

// Module augmentation for TanStack Table meta types
declare module "@tanstack/table-core" {
  interface ColumnMeta<TData extends RowData, TValue> {
    class?: {
      th?: string | ((cell: Header<TData, TValue>) => string)
      td?: string | ((cell: Cell<TData, TValue>) => string)
    }
    style?: {
      th?: string | Record<string, string> | ((cell: Header<TData, TValue>) => string | Record<string, string>)
      td?: string | Record<string, string> | ((cell: Cell<TData, TValue>) => string | Record<string, string>)
    }
    colspan?: {
      td?: string | ((cell: Cell<TData, TValue>) => string)
    }
    rowspan?: {
      td?: string | ((cell: Cell<TData, TValue>) => string)
    }
  }

  interface TableMeta<TData> {
    class?: {
      tr?: string | ((row: Row<TData>) => string)
    }
    style?: {
      tr?: string | Record<string, string> | ((row: Row<TData>) => string | Record<string, string>)
    }
  }
}

export type TableRow<T> = Row<T>
export type TableData = RowData
export type TableColumn<T extends TableData, D = unknown> = ColumnDef<T, D>

export interface TableOptions<T extends TableData = TableData> extends Omit<
  CoreOptions<T>,
  "data" | "columns" | "getCoreRowModel" | "state" | "onStateChange" | "renderFallbackValue"
> {
  state?: CoreOptions<T>["state"]
  onStateChange?: CoreOptions<T>["onStateChange"]
  renderFallbackValue?: CoreOptions<T>["renderFallbackValue"]
}

export interface TableProps<T extends TableData = TableData> extends /* @vue-ignore */ TableOptions<T> {
  as?: any
  data?: T[]
  columns?: TableColumn<T>[]
  caption?: string
  meta?: TableMeta<T>
  empty?: string
  sticky?: boolean | "header" | "footer"
  loading?: boolean
  loadingColor?: string
  loadingAnimation?: string
  watchOptions?: WatchOptions
  /** Column reordering */
  enableColumnReordering?: boolean
  /** Typical TanStack options passthroughs */
  globalFilterOptions?: Omit<GlobalFilterOptions<T>, "onGlobalFilterChange">
  columnFiltersOptions?: Omit<ColumnFiltersOptions<T>, "getFilteredRowModel" | "onColumnFiltersChange">
  columnPinningOptions?: Omit<ColumnPinningOptions, "onColumnPinningChange">
  columnSizingOptions?: Omit<ColumnSizingOptions, "onColumnSizingChange" | "onColumnSizingInfoChange">
  visibilityOptions?: Omit<VisibilityOptions, "onColumnVisibilityChange">
  sortingOptions?: Omit<SortingOptions<T>, "getSortedRowModel" | "onSortingChange">
  groupingOptions?: Omit<GroupingOptions, "onGroupingChange">
  expandedOptions?: Omit<ExpandedOptions<T>, "getExpandedRowModel" | "onExpandedChange">
  rowSelectionOptions?: Omit<RowSelectionOptions<T>, "onRowSelectionChange">
  rowPinningOptions?: Omit<RowPinningOptions<T>, "onRowPinningChange">
  paginationOptions?: Omit<PaginationOptions, "onPaginationChange">
  facetedOptions?: FacetedOptions<T>
  enablePagination?: boolean
  onSelect?: (row: TableRow<T>, e?: Event) => void
  onHover?: (e: Event, row: TableRow<T> | null) => void
  onContextmenu?: ((e: Event, row: TableRow<T>) => void) | Array<(e: Event, row: TableRow<T>) => void>
  class?: any
  ui?: {
    root?: any
    base?: any
    caption?: any
    thead?: any
    tr?: any
    th?: any
    separator?: any
    tbody?: any
    td?: any
    loading?: any
    empty?: any
    tfoot?: any
  }
}

type DynamicHeaderSlots<T, K = keyof T> = Record<string, (props: HeaderContext<T, unknown>) => any> &
  Record<`${K extends string ? K : never}-header`, (props: HeaderContext<T, unknown>) => any>
type DynamicFooterSlots<T, K = keyof T> = Record<string, (props: HeaderContext<T, unknown>) => any> &
  Record<`${K extends string ? K : never}-footer`, (props: HeaderContext<T, unknown>) => any>
type DynamicCellSlots<T, K = keyof T> = Record<string, (props: CellContext<T, unknown>) => any> &
  Record<`${K extends string ? K : never}-cell`, (props: CellContext<T, unknown>) => any>

export type TableSlots<T extends TableData = TableData> = {
  expanded: (props: { row: Row<T> }) => any
  empty: (props?: Record<string, never>) => any
  loading: (props?: Record<string, never>) => any
  caption: (props?: Record<string, never>) => any
  "body-top": (props?: Record<string, never>) => any
  "body-bottom": (props?: Record<string, never>) => any
} & DynamicHeaderSlots<T> &
  DynamicFooterSlots<T> &
  DynamicCellSlots<T>

// Re-export types used in the component's internal implementation
export type {
  Ref,
  WatchOptions,
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
}
