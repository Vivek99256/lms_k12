'use client';

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Printer,
  Search,
  Table2,
} from 'lucide-react';
import PageHeader from '@/components/result/PageHeader';
import { toast } from '@/components/result/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  exportRowsAsPdf,
  openPrintPreview,
  type TableExportColumn,
} from '@/lib/table-export';
import {
  fetchAdmissionReportContext,
  formatReportHeaderLabel,
  runAdmissionReport,
  type AdmissionReportFieldOption,
  type AdmissionReportResult,
  type AdmissionReportRow,
  type AdmissionReportUser,
} from '../api';
import { getReportConfig, initialFilters, type ReportConfig } from '../config';

type SortDirection = 'asc' | 'desc' | null;

function toTableColumns(headers: string[]): TableExportColumn[] {
  return headers.map((header) => ({
    key: header,
    label: formatReportHeaderLabel(header),
  }));
}

function buildSearchText(row: AdmissionReportRow, headers: string[]) {
  return headers.map((header) => row[header] ?? '').join(' ').toLowerCase();
}

function getSortValue(row: AdmissionReportRow, key: string) {
  return (row[key] ?? '').toString().toLowerCase();
}

function getPaginationItems(currentPage: number, totalPages: number) {
  const items: Array<number | 'ellipsis'> = [];
  if (totalPages <= 5) {
    for (let page = 1; page <= totalPages; page += 1) items.push(page);
    return items;
  }

  items.push(1);
  if (currentPage > 3) items.push('ellipsis');

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let page = start; page <= end; page += 1) items.push(page);

  if (currentPage < totalPages - 2) items.push('ellipsis');
  items.push(totalPages);
  return items;
}

function getSortIcon(activeKey: string | null, activeDirection: SortDirection, key: string) {
  if (activeKey !== key) return <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-slate-400" />;
  if (activeDirection === 'asc') return <ArrowUp className="ml-2 h-3.5 w-3.5 text-blue-600" />;
  if (activeDirection === 'desc') return <ArrowDown className="ml-2 h-3.5 w-3.5 text-blue-600" />;
  return <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-slate-400" />;
}

export default function AdmissionReportWorkspace({ reportId }: { reportId: ReportConfig['id'] }) {
  const config = useMemo(() => getReportConfig(reportId), [reportId]);
  const [filters, setFilters] = useState(initialFilters);
  const [result, setResult] = useState<AdmissionReportResult>({
    message: '',
    rows: [],
    headers: [],
    users: [],
    fields: [],
  });
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [isMetaLoading, setIsMetaLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState('10');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [showFieldSelector, setShowFieldSelector] = useState(false);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    let ignore = false;

    const loadContext = async () => {
      setIsMetaLoading(true);
      setError(null);
      setResult({ message: '', rows: [], headers: [], users: [], fields: [] });
      setSelectedFields([]);
      setCurrentPage(1);
      setSortKey(null);
      setSortDirection(null);

      try {
        const context = await fetchAdmissionReportContext(reportId);
        if (ignore) return;

        setResult(context);
        if (config.supportsFieldSelection) {
          const nextSelectedFields = context.fields
            .filter((field) => config.defaultFieldKeys.includes(field.key))
            .map((field) => field.key);
          setSelectedFields(nextSelectedFields);
        } else if (config.defaultFieldKeys.length > 0) {
          setSelectedFields(config.defaultFieldKeys);
        }
      } catch (loadError) {
        if (ignore) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load report metadata.');
      } finally {
        if (!ignore) setIsMetaLoading(false);
      }
    };

    void loadContext();
    return () => {
      ignore = true;
    };
  }, [config.defaultFieldKeys, config.supportsFieldSelection, reportId]);

  const visibleRows = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
    let rows = result.rows;

    if (normalizedQuery) {
      rows = rows.filter((row) => buildSearchText(row, result.headers).includes(normalizedQuery));
    }

    if (sortKey && sortDirection) {
      rows = [...rows].sort((left, right) => {
        const a = getSortValue(left, sortKey);
        const b = getSortValue(right, sortKey);
        if (a < b) return sortDirection === 'asc' ? -1 : 1;
        if (a > b) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }, [deferredSearchQuery, result.headers, result.rows, sortDirection, sortKey]);

  const totalEntries = visibleRows.length;
  const pageSize = Number(entriesPerPage) || 10;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = totalEntries === 0 ? 0 : (safeCurrentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, totalEntries);
  const paginatedRows = visibleRows.slice(pageStartIndex, pageEndIndex);
  const exportColumns = useMemo(() => toTableColumns(result.headers), [result.headers]);
  const exportSubtitle = `${config.title} | Showing ${pageStartIndex + (totalEntries ? 1 : 0)} to ${pageEndIndex} of ${totalEntries} records`;

  const handleFieldToggle = (fieldKey: string) => {
    setSelectedFields((current) =>
      current.includes(fieldKey)
        ? current.filter((item) => item !== fieldKey)
        : [...current, fieldKey]
    );
  };

  const handleSort = (header: string) => {
    if (sortKey !== header) {
      setSortKey(header);
      setSortDirection('asc');
      return;
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc');
      return;
    }

    if (sortDirection === 'desc') {
      setSortDirection(null);
      setSortKey(null);
      return;
    }

    setSortDirection('asc');
  };

  const handleRunReport = async () => {
    setIsRunning(true);
    setError(null);
    setCurrentPage(1);

    try {
      const response = await runAdmissionReport(reportId, filters, selectedFields);
      setResult((current) => ({
        ...current,
        ...response,
      }));
      toast.success(`${config.title} loaded`, response.message || 'Report data loaded successfully.');
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : 'Failed to run the report.';
      setResult((current) => ({ ...current, rows: [], headers: current.headers }));
      setError(message);
      toast.error(config.title, message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleExport = (kind: 'pdf' | 'csv' | 'excel' | 'print') => {
    const rowsForExport = visibleRows.map((row) =>
      Object.fromEntries(result.headers.map((header) => [header, row[header] ?? '']))
    );

    if (kind === 'pdf') {
      exportRowsAsPdf({
        filename: `${config.id}.pdf`,
        title: config.title,
        subtitle: exportSubtitle,
        columns: exportColumns,
        rows: rowsForExport,
      });
      return;
    }

    if (kind === 'csv') {
      exportRowsAsCsv({
        filename: `${config.id}.csv`,
        columns: exportColumns,
        rows: rowsForExport,
      });
      return;
    }

    if (kind === 'excel') {
      exportRowsAsExcel({
        filename: `${config.id}.xls`,
        title: config.title,
        columns: exportColumns,
        rows: rowsForExport,
      });
      return;
    }

    openPrintPreview({
      title: config.title,
      subtitle: exportSubtitle,
      columns: exportColumns,
      rows: rowsForExport,
    });
  };

  const metrics = useMemo(
    () => [
      { label: 'Loaded rows', value: String(result.rows.length) },
      { label: 'Current view', value: String(visibleRows.length) },
      { label: 'Columns', value: String(result.headers.length) },
      { label: 'Selected fields', value: String(selectedFields.length || result.headers.length) },
    ],
    [result.headers.length, result.rows.length, selectedFields.length, visibleRows.length]
  );

  return (
    <div className="min-h-screen bg-slate-50/40">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader
          icon={config.icon}
          title={config.title}
          subtitle={config.subtitle}
          breadcrumbs={[
            { label: 'Admissions', href: '/admissions/admission_enquiry' },
            { label: 'Admission Reports', href: '/admissions/admission_reports' },
            { label: config.title },
          ]}
          actions={
            result.headers.length > 0 && visibleRows.length > 0 ? (
              <>
                <Button variant="outline" onClick={() => handleExport('pdf')}>
                  <FileText className="mr-2 h-4 w-4 text-rose-500" />
                  PDF
                </Button>
                <Button variant="outline" onClick={() => handleExport('csv')}>
                  <Table2 className="mr-2 h-4 w-4 text-emerald-500" />
                  CSV
                </Button>
                <Button variant="outline" onClick={() => handleExport('excel')}>
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-blue-500" />
                  Excel
                </Button>
                <Button variant="outline" onClick={() => handleExport('print')}>
                  <Printer className="mr-2 h-4 w-4 text-slate-500" />
                  Print
                </Button>
              </>
            ) : undefined
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label} className="border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">{config.title}</CardTitle>
                <p className="mt-1 text-sm text-slate-500">{config.subtitle}</p>
              </div>
              {config.supportsFieldSelection ? (
                <Button variant="outline" onClick={() => setShowFieldSelector((current) => !current)}>
                  <Filter className="mr-2 h-4 w-4" />
                  {showFieldSelector ? 'Hide Field Selection' : 'Choose Fields'}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  From Date
                </label>
                <Input
                  type="date"
                  value={filters.fromDate}
                  onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  To Date
                </label>
                <Input
                  type="date"
                  value={filters.toDate}
                  onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
                />
              </div>

              {config.filterMode === 'user' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    User
                  </label>
                  <Select
                    value={filters.user || '__all__'}
                    onValueChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        user: (value ?? '__all__') === '__all__' ? '' : value ?? '',
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All users</SelectItem>
                      {result.users.map((user: AdmissionReportUser) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {config.filterMode === 'status' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Status
                  </label>
                  <Select
                    value={filters.status || '__all__'}
                    onValueChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        status: (value ?? '__all__') === '__all__' ? '' : value ?? '',
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All statuses</SelectItem>
                      {(config.statusOptions ?? []).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {config.filterMode === 'followup' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Follow-up Status
                  </label>
                  <Select
                    value={filters.followUpStatus || '__all__'}
                    onValueChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        followUpStatus: (value ?? '__all__') === '__all__' ? '' : value ?? '',
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select follow-up status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All follow-up states</SelectItem>
                      <SelectItem value="Followed">Followed</SelectItem>
                      <SelectItem value="Unfollowed">Unfollowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void handleRunReport()} disabled={isRunning || isMetaLoading}>
                {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Search
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFilters(initialFilters);
                  setSearchQuery('');
                  setCurrentPage(1);
                  setError(null);
                }}
              >
                Reset Filters
              </Button>
              {/* <p className="text-sm text-slate-500">
                API: <span className="font-mono text-slate-700">{config.endpoint}</span>
              </p> */}
            </div>

            {config.supportsFieldSelection && showFieldSelector ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">Dynamic Fields</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFields(result.fields.map((field: AdmissionReportFieldOption) => field.key))}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFields([])}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {result.fields.map((field: AdmissionReportFieldOption) => (
                    <label
                      key={field.key}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(field.key)}
                        onChange={() => handleFieldToggle(field.key)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Results</p>
                  <p className="text-xs text-slate-500">
                    {result.rows.length > 0
                      ? `${result.rows.length} rows returned from the Laravel ERP`
                      : 'Run the selected report to load data.'}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search loaded report rows..."
                      className="pl-9 sm:w-[280px]"
                    />
                  </div>

                  <Select
                    value={entriesPerPage}
                    onValueChange={(value) => {
                      setEntriesPerPage(value ?? '10');
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="sm:w-[140px]">
                      <SelectValue placeholder="Rows per page" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / page</SelectItem>
                      <SelectItem value="25">25 / page</SelectItem>
                      <SelectItem value="50">50 / page</SelectItem>
                      <SelectItem value="100">100 / page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      {result.headers.map((header) => (
                        <TableHead
                          key={header}
                          onClick={() => handleSort(header)}
                          className="cursor-pointer select-none whitespace-nowrap text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                        >
                          <div className="flex items-center">
                            {formatReportHeaderLabel(header)}
                            {getSortIcon(sortKey, sortDirection, header)}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isMetaLoading ? (
                      <TableRow>
                        <TableCell colSpan={Math.max(result.headers.length, 1)} className="h-32 text-center text-sm text-slate-500">
                          <div className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading report metadata...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : isRunning ? (
                      <TableRow>
                        <TableCell colSpan={Math.max(result.headers.length, 1)} className="h-32 text-center text-sm text-slate-500">
                          <div className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Running {config.title.toLowerCase()}...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : result.headers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={1} className="h-32 text-center text-sm text-slate-500">
                          No report metadata available yet.
                        </TableCell>
                      </TableRow>
                    ) : paginatedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={result.headers.length} className="h-32 text-center text-sm text-slate-500">
                          {result.rows.length === 0
                            ? 'No rows loaded yet. Choose filters and click Search.'
                            : 'No rows match the current client-side search.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedRows.map((row, index) => (
                        <TableRow key={`${reportId}-${pageStartIndex + index}`}>
                          {result.headers.map((header) => (
                            <TableCell key={`${header}-${pageStartIndex + index}`} className="align-top text-sm text-slate-700">
                              {row[header] || '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-4 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Showing {totalEntries === 0 ? 0 : pageStartIndex + 1} to {pageEndIndex} of {totalEntries} entries
                </p>

                {totalPages > 1 ? (
                  <Pagination>
                    <PaginationContent className="gap-1">
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                          className={safeCurrentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>

                      {getPaginationItems(safeCurrentPage, totalPages).map((item, index) => (
                        <PaginationItem key={`${item}-${index}`}>
                          {item === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              isActive={safeCurrentPage === item}
                              onClick={() => setCurrentPage(item)}
                            >
                              {item}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
                          className={safeCurrentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
