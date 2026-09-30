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
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import { appendSessionParams, asRecord, getFeesSession, readString, toArray } from '@/app/fees/_lib/fees-api';
import { downloadFile, escapeCsv, MessageState, normalizePayload, readMessage, readStatus } from '@/app/library/_lib/library-module-utils';
import { escapeHtml } from '@/lib/security/sanitize-html';

type ScanRecord = {
  id: string;
  itemCode: string;
  title: string;
  collectionType: string;
  scanStatus: string;
  syear: string;
};

function parseRecords(payload: Record<string, unknown>): ScanRecord[] {
  return toArray(payload.bookData).map((item, index) => {
    const record = asRecord(item);
    return {
      id: readString(record.id) || `${index}`,
      itemCode: readString(record.item_code),
      title: readString(record.book_title),
      collectionType: readString(record.collection_type),
      scanStatus: readString(record.scan_status),
      syear: readString(record.syear),
    };
  });
}

function recordMatchesFilters(record: ScanRecord, globalSearch: string, columnFilters: Record<string, string>) {
  const haystack = [record.itemCode, record.title, record.collectionType, record.scanStatus, record.syear].join(' ').toLowerCase();
  if (globalSearch && !haystack.includes(globalSearch.toLowerCase())) {
    return false;
  }

  const columns: Record<string, string> = {
    itemCode: record.itemCode,
    title: record.title,
    collectionType: record.collectionType,
    scanStatus: record.scanStatus,
    syear: record.syear,
  };

  for (const [key, value] of Object.entries(columnFilters)) {
    if (!value.trim()) continue;
    if (!(columns[key] || '').toLowerCase().includes(value.toLowerCase())) {
      return false;
    }
  }

  return true;
}

function printRows(rows: ScanRecord[]) {
  const html = `
    <html>
      <head>
        <title>Scan Book</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f1f5f9; }
        </style>
      </head>
      <body>
        <h2>Scan book</h2>
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Item code</th>
              <th>Title</th>
              <th>Collection type</th>
              <th>Scan status</th>
              <th>SYear</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.itemCode || '-')}</td><td>${escapeHtml(row.title || '-')}</td><td>${escapeHtml(row.collectionType || '-')}</td><td>${escapeHtml(row.scanStatus || '-')}</td><td>${escapeHtml(row.syear || '-')}</td></tr>`).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=1200,height=900');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export default function ScanBookPage() {
  const session = useMemo(() => getFeesSession(), []);
  const [itemCode, setItemCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [lastScannedItem, setLastScannedItem] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const filteredRecords = useMemo(
    () => records.filter((record) => recordMatchesFilters(record, globalSearch, columnFilters)),
    [columnFilters, globalSearch, records],
  );

  const exportRows = useMemo(
    () => filteredRecords.map((record, index) => ({
      'No.': String(index + 1),
      'Item Code': record.itemCode || '-',
      Title: record.title || '-',
      'Collection Type': record.collectionType || '-',
      'Scan Status': record.scanStatus || '-',
      SYear: record.syear || '-',
    })),
    [filteredRecords],
  );

  const handleSubmit = async (overrideItemCode?: string) => {
    // A physical barcode scanner types the whole code and its trailing Enter
    // in rapid succession -- fast enough that the keydown handler can fire
    // before this component has re-rendered with the last character's
    // onChange. Reading the DOM input's live value here (passed in from the
    // keydown handler below) avoids submitting a stale, empty `itemCode`
    // from React state.
    const value = (overrideItemCode ?? itemCode).trim();

    if (!value) {
      setMessage({ type: 'info', text: 'Item code is required.' });
      return;
    }

    if (!session.subInstituteId || !session.academicYearId || !session.userId) {
      setMessage({ type: 'error', text: 'Session context is missing. Please sign in again.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({ path: 'scan_books' });
      const payload = new URLSearchParams();
      payload.set('item_code', value);
      appendSessionParams(payload, session);

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: payload.toString(),
      });

      const normalized = normalizePayload(await response.json());
      const status = readStatus(normalized);
      const nextMessage = readMessage(normalized, "Couldn't scan book. Try again.");

      setMessage({ type: status === 1 ? 'success' : 'error', text: nextMessage });
      setRecords(parseRecords(normalized));
      setLastScannedItem(readString(normalized.searchedItem) || value);
      setItemCode('');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : "Couldn't scan book. Try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="Scan book"
        description="Scan item codes and review the matching verification rows using the existing library verification flow."
        action={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => {
              if (exportRows.length === 0) return;
              const headers = Object.keys(exportRows[0]);
              const csv = [headers.join(','), ...exportRows.map((row) => headers.map((header) => escapeCsv(row[header as keyof typeof row] ?? '')).join(','))].join('\n');
              downloadFile('scan-book.csv', csv, 'text/csv;charset=utf-8;');
            }}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => {
              if (exportRows.length === 0) return;
              const headers = Object.keys(exportRows[0]);
              const lines = [headers.join('\t'), ...exportRows.map((row) => headers.map((header) => String(row[header as keyof typeof row] ?? '')).join('\t'))];
              downloadFile('scan-book.xls', lines.join('\n'), 'application/vnd.ms-excel');
            }}>
              <FileText className="h-4 w-4" />
              Excel
            </Button>
            <Button type="button" variant="outline" onClick={() => printRows(filteredRecords)}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        )}
      />

      {message ? <InlineMessage type={message.type} text={message.text} /> : null}

      <SectionPanel title="Scanner" description="Scan one item code at a time. Each scan is recorded for the current academic year.">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <Field label="Item code">
            <Input
              value={itemCode}
              onChange={(event) => setItemCode(event.target.value)}
              placeholder="Scan item code"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSubmit(event.currentTarget.value);
                }
              }}
            />
          </Field>
          <div className="flex items-end">
            <Button type="button" onClick={() => void handleSubmit()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Scan Books
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Scanned books"
        description={lastScannedItem ? `Showing the result for item code ${lastScannedItem}.` : 'Scan results appear after you scan an item.'}
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Global search">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                  className="pl-9"
                  placeholder="Search all columns"
                />
              </div>
            </Field>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableHead>No.</TableHead>
                  <TableHead>Item code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Collection type</TableHead>
                  <TableHead>Scan status</TableHead>
                  <TableHead>SYear</TableHead>
                </TableRow>
                <TableRow className="bg-white hover:bg-white">
                  <TableHead />
                  {['itemCode', 'title', 'collectionType', 'scanStatus', 'syear'].map((key) => (
                    <TableHead key={key}>
                      <Input
                        value={columnFilters[key] ?? ''}
                        onChange={(event) => setColumnFilters((current) => ({ ...current, [key]: event.target.value }))}
                        placeholder="Filter"
                      />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingRows colSpan={6} label="Scanning item code" />
                ) : filteredRecords.length > 0 ? (
                  filteredRecords.map((record, index) => (
                    <TableRow key={`${record.id}-${index}`} className="odd:bg-white even:bg-slate-50/60">
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{record.itemCode || '-'}</TableCell>
                      <TableCell>{record.title || '-'}</TableCell>
                      <TableCell>{record.collectionType || '-'}</TableCell>
                      <TableCell>{record.scanStatus || '-'}</TableCell>
                      <TableCell>{record.syear || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <EmptyTableRow colSpan={6} label="No scanned book rows available." />
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
