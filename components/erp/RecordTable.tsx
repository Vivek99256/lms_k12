"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, FileSpreadsheet, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from "@/lib/table-export";
import { ErpEmpty } from "./erp-ui";

/**
 * Searchable, sortable, paginated and exportable table used across the
 * Blade-era list and report screens. It replaces the legacy jQuery DataTable
 * (search box, column sort, page length, CSV/Excel/print buttons) with the
 * frontend's own primitives — no new dependency.
 */

export type RecordColumn<TRow> = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  width?: string;
  /** Plain text used for search, sort and export. */
  value: (row: TRow) => string;
  /** Optional rich cell. Falls back to `value`. */
  render?: (row: TRow) => ReactNode;
  sortable?: boolean;
  exportable?: boolean;
};

type SortState = {
  key: string;
  direction: "asc" | "desc";
} | null;

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function compare(left: string, right: string) {
  const leftNumber = Number(left.replace(/[^0-9.-]/g, ""));
  const rightNumber = Number(right.replace(/[^0-9.-]/g, ""));
  const bothNumeric =
    left.trim() !== "" &&
    right.trim() !== "" &&
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber) &&
    /\d/.test(left) &&
    /\d/.test(right) &&
    !/[a-z]/i.test(left) &&
    !/[a-z]/i.test(right);

  if (bothNumeric) return leftNumber - rightNumber;
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

export function RecordTable<TRow>({
  rows,
  columns,
  getRowKey,
  actions,
  actionsLabel = "Action",
  rowClassName,
  searchPlaceholder = "Search…",
  showSearch = true,
  showExport = true,
  exportFilename = "report",
  exportTitle = "Report",
  exportSubtitle = "",
  emptyTitle = "No records found.",
  emptyHint,
  initialPageSize = 10,
  serialColumn = true,
}: {
  rows: TRow[];
  columns: Array<RecordColumn<TRow>>;
  getRowKey: (row: TRow, index: number) => string | number;
  actions?: (row: TRow) => ReactNode;
  actionsLabel?: string;
  rowClassName?: (row: TRow) => string | undefined;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showExport?: boolean;
  exportFilename?: string;
  exportTitle?: string;
  exportSubtitle?: string;
  emptyTitle?: string;
  emptyHint?: string;
  initialPageSize?: number;
  serialColumn?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      columns.some((column) => column.value(row).toLowerCase().includes(needle))
    );
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((entry) => entry.key === sort.key);
    if (!column) return filtered;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) => factor * compare(column.value(left), column.value(right)));
  }, [filtered, columns, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportColumns: TableExportColumn[] = useMemo(
    () =>
      columns
        .filter((column) => column.exportable !== false)
        .map((column) => ({ key: column.key, label: column.label, align: column.align })),
    [columns]
  );

  const exportRows: TableExportRow[] = useMemo(
    () =>
      sorted.map((row) => {
        const entry: TableExportRow = {};
        for (const column of columns) {
          if (column.exportable === false) continue;
          entry[column.key] = column.value(row);
        }
        return entry;
      }),
    [sorted, columns]
  );

  function toggleSort(column: RecordColumn<TRow>) {
    if (column.sortable === false) return;
    setPage(1);
    setSort((current) => {
      if (!current || current.key !== column.key) return { key: column.key, direction: "asc" };
      if (current.direction === "asc") return { key: column.key, direction: "desc" };
      return null;
    });
  }

  const alignClass = (align?: "left" | "center" | "right") =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "";

  return (
    <div className="space-y-3">
      {showSearch || showExport ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {showSearch ? (
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder={searchPlaceholder}
                value={query}
                aria-label={searchPlaceholder}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          ) : (
            <span />
          )}

          {showExport ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={exportRows.length === 0}
                onClick={() =>
                  exportRowsAsCsv({
                    filename: `${exportFilename}.csv`,
                    columns: exportColumns,
                    rows: exportRows,
                  })
                }
              >
                <Download className="size-3.5" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={exportRows.length === 0}
                onClick={() =>
                  exportRowsAsExcel({
                    filename: `${exportFilename}.xls`,
                    title: exportTitle,
                    columns: exportColumns,
                    rows: exportRows,
                  })
                }
              >
                <FileSpreadsheet className="size-3.5" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={exportRows.length === 0}
                onClick={() =>
                  openPrintPreview({
                    filename: exportFilename,
                    title: exportTitle,
                    subtitle: exportSubtitle,
                    columns: exportColumns,
                    rows: exportRows,
                  })
                }
              >
                <Printer className="size-3.5" />
                Print
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <ErpEmpty
          title={query.trim() ? "No records match this search." : emptyTitle}
          hint={query.trim() ? "Clear the search box to see every record." : emptyHint}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  {serialColumn ? <TableHead className="w-14">Sr. no.</TableHead> : null}
                  {columns.map((column) => {
                    const active = sort?.key === column.key;
                    const sortable = column.sortable !== false;
                    return (
                      <TableHead
                        key={column.key}
                        style={column.width ? { width: column.width } : undefined}
                        className={alignClass(column.align)}
                        aria-sort={
                          active ? (sort?.direction === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        {sortable ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 hover:text-slate-900"
                            onClick={() => toggleSort(column)}
                          >
                            {column.label}
                            {active ? (
                              sort?.direction === "asc" ? (
                                <ArrowUp className="size-3" />
                              ) : (
                                <ArrowDown className="size-3" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3 text-slate-300" />
                            )}
                          </button>
                        ) : (
                          column.label
                        )}
                      </TableHead>
                    );
                  })}
                  {actions ? <TableHead className="w-32">{actionsLabel}</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row, index) => (
                  <TableRow key={getRowKey(row, index)} className={rowClassName?.(row)}>
                    {serialColumn ? (
                      <TableCell className="text-slate-500">
                        {(currentPage - 1) * pageSize + index + 1}
                      </TableCell>
                    ) : null}
                    {columns.map((column) => (
                      <TableCell key={column.key} className={alignClass(column.align)}>
                        {column.render ? column.render(row) : column.value(row) || "—"}
                      </TableCell>
                    ))}
                    {actions ? <TableCell>{actions(row)}</TableCell> : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span>
                Showing {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}
              </span>
              <select
                aria-label="Rows per page"
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} / page
                  </option>
                ))}
              </select>
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
