'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  exportRowsAsPdf,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from '@/lib/table-export';
import {
  fetchPalReport,
  parsePalStartTime,
  type PalReportRow,
} from '@/app/pal/data/pal';

type SortKey = 'studentName' | 'stdDiv' | 'startTime' | 'grade';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [50, 100, 500, 1000] as const;
const ALL_PAGE_SIZE = -1;

// Export columns mirror the Laravel DataTable export (4 visible columns).
const EXPORT_COLUMNS: TableExportColumn[] = [
  { key: 'studentName', label: 'Student Name', width: '240px' },
  { key: 'stdDiv', label: 'Std/Div' },
  { key: 'startTime', label: 'Started' },
  { key: 'grade', label: 'Grade' },
];

export default function PalReportPage() {
  const [rows, setRows] = useState<PalReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiMessage, setApiMessage] = useState('');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<number>(100);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'startTime',
    dir: 'desc',
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPalReport(controller.signal);
        setRows(result.rows);
        setApiMessage(result.message);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'Unable to load the PAL report.'
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.studentName, row.stdDiv, row.startTime, row.grade].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    const factor = sort.dir === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      if (sort.key === 'startTime') {
        return (parsePalStartTime(a.startTime) - parsePalStartTime(b.startTime)) * factor;
      }
      return a[sort.key].localeCompare(b[sort.key], undefined, { numeric: true }) * factor;
    });
    return sorted;
  }, [filteredRows, sort]);

  const effectivePageSize = pageSize === ALL_PAGE_SIZE ? sortedRows.length || 1 : pageSize;
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / effectivePageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * effectivePageSize;
  const paginatedRows = sortedRows.slice(startIndex, startIndex + effectivePageSize);

  const exportRows = useMemo<TableExportRow[]>(
    () =>
      sortedRows.map((row) => ({
        studentName: row.studentName || '-',
        stdDiv: row.stdDiv || '-',
        startTime: row.startTime || '-',
        grade: row.grade || '-',
      })),
    [sortedRows]
  );

  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
    setPage(1);
  };

  const hasExportableRows = exportRows.length > 0;
  const exportSubtitle = `${sortedRows.length} attempt${sortedRows.length === 1 ? '' : 's'}`;

  const emptyLabel =
    apiMessage && rows.length === 0
      ? apiMessage
      : search.trim()
        ? 'No PAL attempts match your search.'
        : 'No PAL attempts found for the current academic year.';

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">PAL Report</h1>
              <p className="text-sm text-slate-500">
                Personalized Adaptive Learning exam attempts for the current academic year.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasExportableRows}
              onClick={() =>
                exportRowsAsCsv({
                  filename: 'pal-report.csv',
                  columns: EXPORT_COLUMNS,
                  rows: exportRows,
                })
              }
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasExportableRows}
              onClick={() =>
                exportRowsAsExcel({
                  filename: 'pal-report.xls',
                  title: 'PAL Report',
                  columns: EXPORT_COLUMNS,
                  rows: exportRows,
                })
              }
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasExportableRows}
              onClick={() =>
                exportRowsAsPdf({
                  filename: 'pal-report.pdf',
                  title: 'PAL Report',
                  subtitle: exportSubtitle,
                  columns: EXPORT_COLUMNS,
                  rows: exportRows,
                })
              }
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasExportableRows}
              onClick={() =>
                openPrintPreview({
                  title: 'PAL Report',
                  subtitle: exportSubtitle,
                  columns: EXPORT_COLUMNS,
                  rows: exportRows,
                })
              }
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="border-b border-slate-200 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-[260px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by student, std/div, date, or grade"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-full pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500">Show</label>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value={ALL_PAGE_SIZE}>All</option>
                </select>
                <label className="text-xs font-medium text-slate-500">entries</label>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-semibold">Sr No.</th>
                  <SortableHeader label="Student Name" sortKey="studentName" sort={sort} onSort={handleSort} />
                  <SortableHeader label="Std/Div" sortKey="stdDiv" sort={sort} onSort={handleSort} />
                  <SortableHeader label="Started" sortKey="startTime" sort={sort} onSort={handleSort} />
                  <SortableHeader label="Grade" sortKey="grade" sort={sort} onSort={handleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading PAL report...
                      </span>
                    </td>
                  </tr>
                ) : paginatedRows.length > 0 ? (
                  paginatedRows.map((row, index) => (
                    <tr key={`${row.studentName}-${row.startTime}-${startIndex + index}`} className="hover:bg-slate-50/60">
                      <td className="px-5 py-4 text-slate-600">{startIndex + index + 1}</td>
                      <td className="px-5 py-4 font-medium text-slate-900">{row.studentName || '-'}</td>
                      <td className="px-5 py-4 text-slate-600">{row.stdDiv || '-'}</td>
                      <td className="px-5 py-4 text-slate-600 tabular-nums">{row.startTime || '-'}</td>
                      <td className="px-5 py-4 text-slate-600 tabular-nums">{row.grade || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                      {emptyLabel}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              {sortedRows.length === 0 ? 0 : startIndex + 1}-
              {Math.min(startIndex + effectivePageSize, sortedRows.length)} of {sortedRows.length} records
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                ‹
              </Button>
              <span className="px-2 text-sm font-medium text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                ›
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="px-5 py-3 font-semibold">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 font-semibold text-slate-700 hover:text-blue-600"
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />
        )}
      </button>
    </th>
  );
}
