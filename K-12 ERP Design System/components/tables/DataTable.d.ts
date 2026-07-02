import * as React from "react";

export interface DataTableColumn<T = any> {
  key: string;
  header: React.ReactNode;
  /** `end` right-aligns and tabular-nums the column (numbers/currency). */
  align?: "start" | "end";
  sortable?: boolean;
  /** CSS width (e.g. "120px", "20%"). */
  width?: string;
  /** Custom cell renderer; defaults to row[key]. */
  render?: (row: T) => React.ReactNode;
}

/**
 * The workhorse table for every data-heavy module: sortable columns, row
 * selection with a header select-all, sticky header, zebra/hover, and built-in
 * empty + loading states. Canonical table — `data-grid` is a variant of this.
 *
 * @dsCard group="Components"
 */
export interface DataTableProps<T = any> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Row key field name, or a function returning a stable key. */
  rowKey?: string | ((row: T) => string | number);
  selectable?: boolean;
  selectedKeys?: (string | number)[];
  onSelectionChange?: (keys: (string | number)[]) => void;
  /** Controlled sort column key. */
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string, dir: "asc" | "desc") => void;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyText?: string;
  stickyHeader?: boolean;
  className?: string;
}
export function DataTable<T = any>(props: DataTableProps<T>): JSX.Element;
