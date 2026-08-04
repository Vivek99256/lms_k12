'use client';

/**
 * Generic ERP data table for the Result module.
 *
 * Features: sticky header, global search, per-column filters, sorting,
 * pagination, row selection + bulk actions, column visibility, export
 * (CSV / Excel / PDF / Print via lib/table-export), loading skeleton,
 * empty and error states, responsive horizontal scroll.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, ArrowUpDown, Columns3, Download, FileSpreadsheet, FileText,
  Printer, RefreshCw, Search, SlidersHorizontal, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { readString } from '@/lib/result/api';
import type { ColumnDef } from '@/lib/result/types';
import {
  exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf, openPrintPreview,
  type TableExportColumn,
} from '@/lib/table-export';
import { Banner, Checkbox, EmptyState, StatusChip, TableSkeleton } from './primitives';

export type TableRow = Record<string, unknown>;

const PAGE_SIZES = [10, 25, 50, 100];

function cellText(row: TableRow, key: string): string {
  return readString(row[key]);
}

export default function DataTable({
  columns,
  rows,
  loading = false,
  error = null,
  onRetry,
  rowKey = 'id',
  selectable = false,
  onBulkDelete,
  renderActions,
  renderCell,
  exportName,
  exportTitle,
  toolbar,
  emptyTitle = 'No records found',
  emptyMessage = 'Try adjusting your search or filters.',
  defaultPageSize = 25,
}: {
  columns: ColumnDef[];
  rows: TableRow[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  rowKey?: string;
  selectable?: boolean;
  onBulkDelete?: (keys: string[]) => void;
  renderActions?: (row: TableRow) => React.ReactNode;
  renderCell?: (row: TableRow, column: ColumnDef) => React.ReactNode | undefined;
  exportName?: string;
  exportTitle?: string;
  toolbar?: React.ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  defaultPageSize?: number;
}) {
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(
    () => new Set(columns.filter((column) => column.hidden).map((column) => column.key)),
  );
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!columnsMenuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!columnsMenuRef.current?.contains(event.target as Node)) setColumnsMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [columnsMenuOpen]);

  useEffect(() => {
    setSelected(new Set());
    setPage(1);
  }, [rows]);

  const visibleColumns = columns.filter((column) => !hiddenColumns.has(column.key));

  const filteredRows = useMemo(() => {
    let next = rows;
    const query = globalSearch.trim().toLowerCase();
    if (query) {
      next = next.filter((row) =>
        visibleColumns.some((column) => cellText(row, column.key).toLowerCase().includes(query)),
      );
    }
    for (const [key, filterValue] of Object.entries(columnFilters)) {
      const trimmed = filterValue.trim().toLowerCase();
      if (!trimmed) continue;
      next = next.filter((row) => cellText(row, key).toLowerCase().includes(trimmed));
    }
    if (sort) {
      const { key, direction } = sort;
      next = [...next].sort((a, b) => {
        const aText = cellText(a, key);
        const bText = cellText(b, key);
        const aNumber = Number(aText);
        const bNumber = Number(bText);
        const comparison =
          Number.isFinite(aNumber) && Number.isFinite(bNumber) && aText !== '' && bText !== ''
            ? aNumber - bNumber
            : aText.localeCompare(bText, undefined, { sensitivity: 'base' });
        return direction === 'asc' ? comparison : -comparison;
      });
    }
    return next;
  }, [rows, visibleColumns, globalSearch, columnFilters, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const keyOf = (row: TableRow, index: number) => readString(row[rowKey]) || String(index);

  const pageKeys = pageRows.map((row, index) => keyOf(row, index));
  const allPageSelected = pageKeys.length > 0 && pageKeys.every((key) => selected.has(key));
  const somePageSelected = pageKeys.some((key) => selected.has(key));

  const toggleAllOnPage = (checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const key of pageKeys) {
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  };

  const toggleSort = (column: ColumnDef) => {
    if (column.sortable === false) return;
    setSort((current) => {
      if (current?.key !== column.key) return { key: column.key, direction: 'asc' };
      if (current.direction === 'asc') return { key: column.key, direction: 'desc' };
      return null;
    });
  };

  const exportColumns: TableExportColumn[] = visibleColumns.map((column) => ({
    key: column.key,
    label: column.header,
    align: column.align,
    width: column.width,
  }));
  const exportRows = filteredRows.map((row) => {
    const flat: Record<string, string> = {};
    for (const column of visibleColumns) flat[column.key] = cellText(row, column.key);
    return flat;
  });
  const doExport = (format: 'csv' | 'excel' | 'pdf' | 'print') => {
    const filenameBase = exportName || 'export';
    const title = exportTitle || filenameBase;
    if (format === 'csv') exportRowsAsCsv({ filename: `${filenameBase}.csv`, columns: exportColumns, rows: exportRows });
    if (format === 'excel') exportRowsAsExcel({ filename: `${filenameBase}.xls`, title, columns: exportColumns, rows: exportRows });
    if (format === 'pdf') exportRowsAsPdf({ filename: `${filenameBase}.pdf`, title, subtitle: `${exportRows.length} records`, columns: exportColumns, rows: exportRows });
    if (format === 'print') openPrintPreview({ title, subtitle: `${exportRows.length} records`, columns: exportColumns, rows: exportRows });
  };

  const hasSearchableColumns = columns.some((column) => column.searchable);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              value={globalSearch}
              onChange={(event) => { setGlobalSearch(event.target.value); setPage(1); }}
              placeholder="Search all columns…"
              aria-label="Search table"
              className="h-9 pl-9"
            />
          </div>
          {hasSearchableColumns && (
            <Button
              variant={showColumnFilters ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowColumnFilters((current) => !current)}
              aria-pressed={showColumnFilters}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </Button>
          )}
          {selectable && selected.size > 0 && onBulkDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onBulkDelete(Array.from(selected))}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected ({selected.size})
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {toolbar}
          {exportName && (
            <>
              <Button variant="outline" size="sm" onClick={() => doExport('csv')} title="Export CSV">
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => doExport('excel')} title="Export Excel">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => doExport('pdf')} title="Export PDF">
                <FileText className="h-3.5 w-3.5" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => doExport('print')} title="Print">
                <Printer className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <div className="relative" ref={columnsMenuRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColumnsMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={columnsMenuOpen}
              title="Toggle columns"
            >
              <Columns3 className="h-3.5 w-3.5" />
            </Button>
            {columnsMenuOpen && (
              <div role="menu" className="absolute right-0 z-40 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Columns</p>
                {columns.map((column) => (
                  <div key={column.key} className="rounded-md px-2 py-1.5 hover:bg-slate-50">
                    <Checkbox
                      checked={!hiddenColumns.has(column.key)}
                      onChange={(checked) =>
                        setHiddenColumns((current) => {
                          const next = new Set(current);
                          if (checked) next.delete(column.key);
                          else next.add(column.key);
                          return next;
                        })
                      }
                      label={column.header}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 pt-3">
          <Banner tone="error">
            <span className="flex items-center gap-3">
              {error}
              {onRetry && (
                <Button variant="outline" size="xs" onClick={onRetry}>
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
              )}
            </span>
          </Banner>
        </div>
      )}

      {loading ? (
        <TableSkeleton columns={Math.min(visibleColumns.length + (selectable ? 1 : 0) + (renderActions ? 1 : 0), 8)} />
      ) : (
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                {selectable && (
                  <th className="w-10 bg-slate-50 px-4 py-3">
                    <Checkbox
                      checked={allPageSelected}
                      indeterminate={!allPageSelected && somePageSelected}
                      onChange={toggleAllOnPage}
                    />
                  </th>
                )}
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    style={column.width ? { width: column.width } : undefined}
                    className={cn('bg-slate-50 px-4 py-3 font-semibold', column.align === 'center' && 'text-center', column.align === 'right' && 'text-right')}
                  >
                    {column.sortable === false ? (
                      column.header
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className="inline-flex items-center gap-1 rounded transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                      >
                        {column.header}
                        {sort?.key === column.key ? (
                          sort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    )}
                  </th>
                ))}
                {renderActions && <th className="bg-slate-50 px-4 py-3 text-right font-semibold">Actions</th>}
              </tr>
              {showColumnFilters && (
                <tr className="border-b border-slate-100 bg-white">
                  {selectable && <th className="bg-white px-4 py-2" />}
                  {visibleColumns.map((column) => (
                    <th key={column.key} className="bg-white px-4 py-2">
                      {column.searchable !== false ? (
                        <Input
                          value={columnFilters[column.key] ?? ''}
                          onChange={(event) => {
                            setColumnFilters((current) => ({ ...current, [column.key]: event.target.value }));
                            setPage(1);
                          }}
                          placeholder={`Filter ${column.header.toLowerCase()}`}
                          aria-label={`Filter by ${column.header}`}
                          className="h-8 text-xs font-normal normal-case tracking-normal"
                        />
                      ) : null}
                    </th>
                  ))}
                  {renderActions && <th className="bg-white px-4 py-2" />}
                </tr>
              )}
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + (selectable ? 1 : 0) + (renderActions ? 1 : 0)}>
                    <EmptyState title={emptyTitle} message={emptyMessage} />
                  </td>
                </tr>
              ) : (
                pageRows.map((row, index) => {
                  const key = keyOf(row, index);
                  return (
                    <tr key={key} className={cn('border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60', selected.has(key) && 'bg-blue-50/40')}>
                      {selectable && (
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selected.has(key)}
                            onChange={(checked) =>
                              setSelected((current) => {
                                const next = new Set(current);
                                if (checked) next.add(key);
                                else next.delete(key);
                                return next;
                              })
                            }
                          />
                        </td>
                      )}
                      {visibleColumns.map((column) => {
                        const custom = renderCell?.(row, column);
                        const raw = cellText(row, column.key);
                        const badgeTone = column.badge?.[raw] ?? column.badge?.[raw.toUpperCase()];
                        return (
                          <td
                            key={column.key}
                            className={cn(
                              'px-4 py-3 text-slate-600',
                              column.align === 'center' && 'text-center',
                              column.align === 'right' && 'text-right',
                              column.mono && 'font-mono text-xs',
                            )}
                          >
                            {custom !== undefined ? custom : badgeTone ? <StatusChip tone={badgeTone}>{raw || '—'}</StatusChip> : raw || '—'}
                          </td>
                        );
                      })}
                      {renderActions && <td className="px-4 py-3 text-right">{renderActions(row)}</td>}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* pagination */}
      {!loading && filteredRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Showing {(clampedPage - 1) * pageSize + 1}–{Math.min(clampedPage * pageSize, filteredRows.length)} of {filteredRows.length}
            </span>
            <select
              value={pageSize}
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
              aria-label="Rows per page"
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={clampedPage <= 1} onClick={() => setPage(1)}>«</Button>
            <Button variant="outline" size="sm" disabled={clampedPage <= 1} onClick={() => setPage(clampedPage - 1)}>Prev</Button>
            <span className="px-2 text-sm font-medium text-slate-700">{clampedPage} / {pageCount}</span>
            <Button variant="outline" size="sm" disabled={clampedPage >= pageCount} onClick={() => setPage(clampedPage + 1)}>Next</Button>
            <Button variant="outline" size="sm" disabled={clampedPage >= pageCount} onClick={() => setPage(pageCount)}>»</Button>
          </div>
        </div>
      )}
    </div>
  );
}
