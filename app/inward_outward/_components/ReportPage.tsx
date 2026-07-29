'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationFooter, ReportActions } from '@/app/fees/_components/fees-report-shared';
import { paginateRows } from '@/app/fees/_lib/fees-report-utils';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf, openPrintPreview, type TableExportColumn, type TableExportRow } from '@/lib/table-export';
import { attachmentUrl, listEntries } from '../_lib/api';
import type { Feedback, RegisterEntry, RegisterKind } from '../_lib/types';
import { LoadingState, Message, PageFrame, PageHeader, Panel } from './shared';

type FilterKey = 'syear' | 'placeName' | 'number' | 'title' | 'description' | 'fileName' | 'fileLocation' | 'date' | 'attachment';
const filterKeys: FilterKey[] = ['syear', 'placeName', 'number', 'title', 'description', 'fileName', 'fileLocation', 'date', 'attachment'];
const emptyFilters = (): Record<FilterKey, string> => Object.fromEntries(filterKeys.map((key) => [key, ''])) as Record<FilterKey, string>;
const displayDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
};

export default function ReportPage({ kind }: { kind: RegisterKind }) {
  const title = kind === 'inward' ? 'Inward report' : 'Outward report';
  const [rows, setRows] = useState<RegisterEntry[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Feedback | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await listEntries(kind)); }
    catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : `Unable to load ${title.toLowerCase()}.` }); }
    finally { setLoading(false); }
  }, [kind, title]);
  useEffect(() => {
    // Loading from Laravel is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => rows.filter((row) => filterKeys.every((key) => {
    const needle = filters[key].trim().toLowerCase();
    if (!needle) return true;
    const value = key === 'syear' ? row.syear || row.academicYear : key === 'date' ? displayDate(row.date) : row[key];
    return value.toLowerCase().includes(needle);
  })), [filters, rows]);
  const pagination = useMemo(() => paginateRows(filtered, page, 25), [filtered, page]);

  const columns = useMemo<TableExportColumn[]>(() => [
    { key: 'syear', label: 'Year' }, { key: 'placeName', label: kind === 'inward' ? 'From place' : 'To place' },
    { key: 'number', label: `${kind === 'inward' ? 'Inward' : 'Outward'} no.` }, { key: 'title', label: 'Subject' },
    { key: 'description', label: 'Description' }, { key: 'fileName', label: 'File name' },
    { key: 'fileLocation', label: 'File location' }, { key: 'date', label: `${kind === 'inward' ? 'Inward' : 'Outward'} date` },
    { key: 'attachment', label: 'Attachment' },
  ], [kind]);
  const exportRows = useMemo<TableExportRow[]>(() => filtered.map((row) => ({
    syear: row.syear || row.academicYear, placeName: row.placeName, number: row.number, title: row.title,
    description: row.description, fileName: row.fileName, fileLocation: row.fileLocation,
    date: displayDate(row.date), attachment: row.attachment,
  })), [filtered]);
  const exportOptions = { title, subtitle: `${filtered.length} matching record${filtered.length === 1 ? '' : 's'}`, columns, rows: exportRows };

  return <PageFrame>
    <PageHeader title={title} description={`Review, filter, export, and print ${kind} entries.`} action={<ReportActions onExportCsv={() => exportRowsAsCsv({ filename: `${kind}-report.csv`, columns, rows: exportRows })} onExportExcel={() => exportRowsAsExcel({ filename: `${kind}-report.xls`, title, columns, rows: exportRows })} onExportPdf={() => exportRowsAsPdf({ filename: `${kind}-report.pdf`, ...exportOptions })} onPrint={() => openPrintPreview(exportOptions)} />} />
    <Message value={message} />
    <Panel>
      {loading ? <LoadingState label={`Loading ${title.toLowerCase()}`} /> : <Table className="min-w-[1200px]">
        <TableHeader><TableRow>{columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}</TableRow>
        <TableRow className="bg-slate-50">{columns.map((column) => <TableHead key={column.key} className="p-1"><Input className="h-7 min-w-28 bg-white text-xs normal-case" aria-label={`Filter ${column.label}`} placeholder={`Filter ${column.label.toLowerCase()}`} value={filters[column.key as FilterKey]} onChange={(event) => { setFilters({ ...filters, [column.key]: event.target.value }); setPage(1); }} /></TableHead>)}</TableRow></TableHeader>
        <TableBody>{pagination.rows.length ? pagination.rows.map((row) => <TableRow key={row.id}><TableCell>{row.syear || row.academicYear}</TableCell><TableCell>{row.placeName}</TableCell><TableCell className="font-mono">{row.number}</TableCell><TableCell>{row.title}</TableCell><TableCell className="max-w-64 whitespace-normal">{row.description}</TableCell><TableCell>{row.fileName}</TableCell><TableCell>{row.fileLocation}</TableCell><TableCell>{displayDate(row.date)}</TableCell><TableCell>{row.attachment ? <a href={attachmentUrl(kind, row.attachment)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">{row.attachment}<ExternalLink className="h-3 w-3" /></a> : '-'}</TableCell></TableRow>) : <TableRow><TableCell colSpan={9} className="h-28 text-center text-slate-600">No records match the current filters.</TableCell></TableRow>}</TableBody>
      </Table>}
      {!loading && <PaginationFooter pagination={pagination} onPageChange={setPage} />}
    </Panel>
  </PageFrame>;
}
