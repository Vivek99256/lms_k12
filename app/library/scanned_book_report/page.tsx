'use client';

import { useMemo, useState } from 'react';
import { Download, FileText, Loader2, Printer, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
  NativeSelect,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import { appendSessionParams, asRecord, getFeesSession, readString, toArray } from '@/app/fees/_lib/fees-api';
import { downloadFile, escapeCsv, getStoredAcademicYears, MessageState, normalizePayload } from '@/app/library/_lib/library-module-utils';

type Row = {
  syear: string;
  itemCode: string;
  title: string;
  remarks: string;
  collectionType: string;
};

function parseRows(payload: Record<string, unknown>): Row[] {
  return toArray(payload.bookData).map((item) => {
    const record = asRecord(item);
    return {
      syear: readString(record.syear),
      itemCode: readString(record.item_code),
      title: readString(record.book_title),
      remarks: readString(record.remarks),
      collectionType: readString(record.collection_type),
    };
  });
}

function printRows(rows: Row[]) {
  const html = `<html><head><title>Scanned Book Report</title><style>
  body { font-family: Arial, sans-serif; padding: 24px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; }
  th { background: #f1f5f9; }
  </style></head><body><h2>Scanned Book Report</h2><table><thead><tr><th>Sr No</th><th>SYear</th><th>Item Code</th><th>Title</th><th>Remarks</th><th>Collection Type</th></tr></thead><tbody>${rows.map((row, index) => `<tr><td>${index + 1}</td><td>${row.syear || '-'}</td><td>${row.itemCode || '-'}</td><td>${row.title || '-'}</td><td>${row.remarks || '-'}</td><td>${row.collectionType || '-'}</td></tr>`).join('')}</tbody></table></body></html>`;
  const printWindow = window.open('', '_blank', 'width=1200,height=900');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export default function ScannedBookReportPage() {
  const session = useMemo(() => getFeesSession(), []);
  const academicYears = useMemo(() => getStoredAcademicYears(), []);
  const [itemCode, setItemCode] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');

  const filteredRows = useMemo(() => {
    if (!globalSearch) return rows;
    return rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(globalSearch.toLowerCase()));
  }, [globalSearch, rows]);

  const exportRows = useMemo<Record<string, string>[]>(() => filteredRows.map((row, index) => ({
    'Sr No': String(index + 1),
    SYear: row.syear || '-',
    'Item Code': row.itemCode || '-',
    Title: row.title || '-',
    Remarks: row.remarks || '-',
    'Collection Type': row.collectionType || '-',
  })), [filteredRows]);

  const handleSearch = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ path: 'verified_book_report' });
      if (itemCode.trim()) params.set('item_code', itemCode.trim());
      if (year) params.set('year', year);
      appendSessionParams(params, session);

      const response = await fetch(`/api/proxy?${params.toString()}`, { headers: { Accept: 'application/json' } });
      const payload = normalizePayload(await response.json());
      const nextRows = parseRows(payload);
      setRows(nextRows);
      setMessage({ type: nextRows.length > 0 ? 'success' : 'info', text: nextRows.length > 0 ? `Loaded ${nextRows.length} row${nextRows.length === 1 ? '' : 's'}.` : 'No scanned book rows found.' });
    } catch (error) {
      setRows([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load scanned book report.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="Scanned Book Report"
        description="Search verified scanned books by item code and academic year."
        action={<div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => {
            if (exportRows.length === 0) return;
            const headers = Object.keys(exportRows[0]);
            const csv = [headers.join(','), ...exportRows.map((row) => headers.map((header) => escapeCsv(row[header] ?? '')).join(','))].join('\n');
            downloadFile('scanned-book-report.csv', csv, 'text/csv;charset=utf-8;');
          }}><Download className="h-4 w-4" />CSV</Button>
          <Button type="button" variant="outline" onClick={() => {
            if (exportRows.length === 0) return;
            const headers = Object.keys(exportRows[0]);
            const lines = [headers.join('\t'), ...exportRows.map((row) => headers.map((header) => row[header] ?? '').join('\t'))];
            downloadFile('scanned-book-report.xls', lines.join('\n'), 'application/vnd.ms-excel');
          }}><FileText className="h-4 w-4" />Excel</Button>
          <Button type="button" variant="outline" onClick={() => printRows(filteredRows)}><Printer className="h-4 w-4" />Print</Button>
        </div>}
      />
      {message ? <InlineMessage type={message.type} text={message.text} /> : null}

      <SectionPanel title="Filters">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem_auto]">
          <Field label="Item Code"><Input value={itemCode} onChange={(event) => setItemCode(event.target.value)} placeholder="Search item code" /></Field>
          <Field label="Academic Year">
            <NativeSelect value={year} onChange={setYear}>
              <option value="">All</option>
              {academicYears.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </NativeSelect>
          </Field>
          <div className="flex items-end">
            <Button type="button" onClick={() => void handleSearch()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Search
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title="Results">
        <div className="space-y-4">
          <Field label="Global Search">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} className="pl-9" placeholder="Search all columns" />
            </div>
          </Field>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table className="min-w-[900px]">
              <TableHeader><TableRow className="bg-slate-100 hover:bg-slate-100"><TableHead>Sr No</TableHead><TableHead>SYear</TableHead><TableHead>Item Code</TableHead><TableHead>Title</TableHead><TableHead>Remarks</TableHead><TableHead>Collection Type</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? <LoadingRows colSpan={6} label="Loading scanned book report" /> : filteredRows.length > 0 ? filteredRows.map((row, index) => (
                  <TableRow key={`${row.itemCode}-${index}`} className="odd:bg-white even:bg-slate-50/60">
                    <TableCell>{index + 1}</TableCell><TableCell>{row.syear || '-'}</TableCell><TableCell>{row.itemCode || '-'}</TableCell><TableCell>{row.title || '-'}</TableCell><TableCell>{row.remarks || '-'}</TableCell><TableCell>{row.collectionType || '-'}</TableCell>
                  </TableRow>
                )) : <EmptyTableRow colSpan={6} label="No scanned book rows available." />}
              </TableBody>
            </Table>
          </div>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
