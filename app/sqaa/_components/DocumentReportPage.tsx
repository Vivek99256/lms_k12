'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationFooter, ReportActions } from '@/app/fees/_components/fees-report-shared';
import { paginateRows } from '@/app/fees/_lib/fees-report-utils';
import { Field, LoadingState, Message, NativeSelect, PageFrame, PageHeader, Panel } from '@/app/inward_outward/_components/shared';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf, openPrintPreview, type TableExportColumn, type TableExportRow } from '@/lib/table-export';
import HierarchyFields from './HierarchyFields';
import { loadSqaaDocumentReport, sqaaFileUrl } from '../_lib/api';
import { emptySqaaSelection, type SqaaDocumentRow, type SqaaHierarchySelection, type SqaaLevel } from '../_lib/types';

type FilterKey = 'menuTitle' | 'documentTitle' | 'availability' | 'file';
const filterKeys: FilterKey[] = ['menuTitle', 'documentTitle', 'availability', 'file'];
const emptyFilters = (): Record<FilterKey, string> => ({
  menuTitle: '', documentTitle: '', availability: '', file: '',
});

export default function DocumentReportPage() {
  const [rows, setRows] = useState<SqaaDocumentRow[]>([]);
  const [level1, setLevel1] = useState<SqaaLevel[]>([]);
  const [selection, setSelection] = useState<SqaaHierarchySelection>(emptySqaaSelection);
  const [availability, setAvailability] = useState('yes');
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reportError = useCallback((message: string) => setError(message), []);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loadSqaaDocumentReport(availability, selection);
      setRows(result.rows);
      setLevel1(result.level1);
      setPage(1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the SQAA document report.');
    } finally {
      setLoading(false);
    }
  }, [availability, selection]);

  useEffect(() => {
    loadSqaaDocumentReport('yes', emptySqaaSelection())
      .then((result) => {
        setRows(result.rows);
        setLevel1(result.level1);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the SQAA document report.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => rows.filter((row) => filterKeys.every((key) => {
    const needle = filters[key].trim().toLowerCase();
    return !needle || row[key].toLowerCase().includes(needle);
  })), [filters, rows]);
  const pagination = useMemo(() => paginateRows(filtered, page, 25), [filtered, page]);

  const columns = useMemo<TableExportColumn[]>(() => [
    { key: 'serial', label: 'S. No.' },
    { key: 'menuTitle', label: 'SQAA Title' },
    { key: 'documentTitle', label: 'Document Title' },
    { key: 'availability', label: 'Availability' },
    { key: 'file', label: 'File' },
  ], []);
  const exportRows = useMemo<TableExportRow[]>(() => filtered.map((row, index) => ({
    serial: String(index + 1),
    menuTitle: row.menuTitle,
    documentTitle: row.documentTitle,
    availability: displayAvailability(row.availability),
    file: row.file,
  })), [filtered]);
  const exportOptions = {
    title: 'SQAA Document Report',
    subtitle: `${filtered.length} matching document${filtered.length === 1 ? '' : 's'}`,
    columns,
    rows: exportRows,
  };

  return (
    <PageFrame>
      <PageHeader
        title="SQAA Document Report"
        description="Filter, review, and export SQAA evidence documents."
        action={<ReportActions
          onExportCsv={() => exportRowsAsCsv({ filename: 'sqaa-document-report.csv', columns, rows: exportRows })}
          onExportExcel={() => exportRowsAsExcel({ filename: 'sqaa-document-report.xls', title: exportOptions.title, columns, rows: exportRows })}
          onExportPdf={() => exportRowsAsPdf({ filename: 'sqaa-document-report.pdf', ...exportOptions })}
          onPrint={() => openPrintPreview(exportOptions)}
        />}
      />
      <Message value={error ? { type: 'error', text: error } : null} />
      <Panel title="Report filters">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Availability">
            <NativeSelect value={availability} onChange={setAvailability}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="inprocess">In-Process</option>
              <option value="all">All</option>
            </NativeSelect>
          </Field>
          <HierarchyFields level1={level1} value={selection} onChange={setSelection} onError={reportError} />
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={() => void load()} disabled={loading}>
            <Search className="h-4 w-4" />Search
          </Button>
        </div>
      </Panel>
      <Panel>
        {loading ? <LoadingState label="Loading SQAA documents" /> : (
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                {columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}
              </TableRow>
              <TableRow className="bg-slate-50">
                <TableHead />
                {filterKeys.map((key) => (
                  <TableHead key={key} className="p-1">
                    <Input
                      className="h-7 min-w-28 bg-white text-xs normal-case"
                      aria-label={`Filter ${key}`}
                      placeholder="Filter"
                      value={filters[key]}
                      onChange={(event) => {
                        setFilters((current) => ({ ...current, [key]: event.target.value }));
                        setPage(1);
                      }}
                    />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.rows.length ? pagination.rows.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell>{pagination.startIndex + index}</TableCell>
                  <TableCell>{row.menuTitle || '-'}</TableCell>
                  <TableCell className="max-w-md whitespace-normal">{row.documentTitle || '-'}</TableCell>
                  <TableCell>{displayAvailability(row.availability)}</TableCell>
                  <TableCell>
                    {row.file ? (
                      <a href={sqaaFileUrl(row.file)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                        {row.file}<ExternalLink className="h-3 w-3" />
                      </a>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="h-28 text-center text-slate-600">No SQAA documents match the selected filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
        {!loading && <PaginationFooter pagination={pagination} onPageChange={setPage} />}
      </Panel>
    </PageFrame>
  );
}

function displayAvailability(value: string) {
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  if (value === 'inprocess') return 'In-Process';
  return value || '-';
}
