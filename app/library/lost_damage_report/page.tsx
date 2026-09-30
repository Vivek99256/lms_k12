'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileDown, FileText, Loader2, Printer, Search } from 'lucide-react';

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
import { downloadFile, escapeCsv, exportRowsToPdf, getStoredAcademicYears, MessageState, normalizePayload } from '@/app/library/_lib/library-module-utils';

type StatusOption = { id: string; label: string };
type Row = { itemCode: string; title: string; collectionType: string; remarks: string; itemStatus: string };

function printRows(rows: Row[]) {
  const html = `<html><head><title>Lost & Damage Report</title><style>
  body { font-family: Arial, sans-serif; padding: 24px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; }
  th { background: #f1f5f9; }
  </style></head><body><h2>Lost & Damage Report</h2><table><thead><tr><th>No.</th><th>Item code</th><th>Title</th><th>Collection type</th><th>Remarks</th><th>Item status</th></tr></thead><tbody>${rows.map((row, index) => `<tr><td>${index + 1}</td><td>${row.itemCode || '-'}</td><td>${row.title || '-'}</td><td>${row.collectionType || '-'}</td><td>${row.remarks || '-'}</td><td>${row.itemStatus || '-'}</td></tr>`).join('')}</tbody></table></body></html>`;
  const printWindow = window.open('', '_blank', 'width=1200,height=900');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function parseRows(payload: Record<string, unknown>): Row[] {
  return toArray(payload.bookdata).map((item) => {
    const record = asRecord(item);
    return {
      itemCode: readString(record.item_code),
      title: readString(record.title),
      collectionType: readString(record.collection_type),
      remarks: readString(record.remarks),
      itemStatus: readString(record.item_status_name),
    };
  });
}

export default function LostDamageReportPage() {
  const session = useMemo(() => getFeesSession(), []);
  const fallbackAcademicYears = useMemo(() => getStoredAcademicYears(), []);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [itemCode, setItemCode] = useState('');
  const [status, setStatus] = useState('all');
  const [academicYear, setAcademicYear] = useState('all');
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [academicYears, setAcademicYears] = useState<string[]>(fallbackAcademicYears);
  const [rows, setRows] = useState<Row[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ path: 'Lost_and_Damage' });
        appendSessionParams(params, session);
        const response = await fetch(`/api/proxy?${params.toString()}`, { headers: { Accept: 'application/json' } });
        const payload = normalizePayload(await response.json());
        setRows(parseRows(payload));
        setStatusOptions(Object.entries(asRecord(payload.item_status_arr)).map(([id, label]) => ({ id, label: readString(label) })));
        const yearsFromPayload = toArray(payload.academicYears).map((item) => readString(asRecord(item).syear)).filter(Boolean);
        if (yearsFromPayload.length > 0) {
          setAcademicYears(yearsFromPayload);
        }
      } catch (error) {
        setMessage({ type: 'error', text: error instanceof Error ? error.message : "Couldn't load lost and damage report. Try again." });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [session, fallbackAcademicYears]);

  const filteredRows = useMemo(() => {
    if (!globalSearch) return rows;
    return rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(globalSearch.toLowerCase()));
  }, [globalSearch, rows]);

  const exportRows = useMemo<Record<string, string>[]>(() => filteredRows.map((row, index) => ({
    'No.': String(index + 1),
    'Item Code': row.itemCode || '-',
    Title: row.title || '-',
    'Collection Type': row.collectionType || '-',
    Remarks: row.remarks || '-',
    'Item Status': row.itemStatus || '-',
  })), [filteredRows]);

  const handleSearch = async () => {
    setSearching(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ path: 'Lost_and_Damage/create' });
      if (itemCode.trim()) params.set('item_code', itemCode.trim());
      if (status) params.set('status', status);
      if (academicYear) params.set('academic_year', academicYear);
      appendSessionParams(params, session);
      const response = await fetch(`/api/proxy?${params.toString()}`, { headers: { Accept: 'application/json' } });
      const payload = normalizePayload(await response.json());
      const nextRows = parseRows(payload);
      setRows(nextRows);
      setMessage({ type: nextRows.length > 0 ? 'success' : 'info', text: nextRows.length > 0 ? `Loaded ${nextRows.length} row${nextRows.length === 1 ? '' : 's'}.` : 'No lost/damage rows found.' });
    } catch (error) {
      setRows([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : "Couldn't load lost and damage report. Try again." });
    } finally {
      setSearching(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="Lost & Damage Report"
        description="Filter verified non-zero item statuses by item code, status, and academic year."
        action={<div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => {
            if (exportRows.length === 0) return;
            const headers = Object.keys(exportRows[0]);
            const csv = [headers.join(','), ...exportRows.map((row) => headers.map((header) => escapeCsv(row[header] ?? '')).join(','))].join('\n');
            downloadFile('lost-damage-report.csv', csv, 'text/csv;charset=utf-8;');
          }}><Download className="h-4 w-4" />CSV</Button>
          <Button type="button" variant="outline" onClick={() => {
            if (exportRows.length === 0) return;
            const headers = Object.keys(exportRows[0]);
            const lines = [headers.join('\t'), ...exportRows.map((row) => headers.map((header) => row[header] ?? '').join('\t'))];
            downloadFile('lost-damage-report.xls', lines.join('\n'), 'application/vnd.ms-excel');
          }}><FileText className="h-4 w-4" />Excel</Button>
          <Button type="button" variant="outline" onClick={() => void exportRowsToPdf('lost-damage-report', 'Lost & Damage Report', exportRows)}><FileDown className="h-4 w-4" />PDF</Button>
          <Button type="button" variant="outline" onClick={() => printRows(filteredRows)}><Printer className="h-4 w-4" />Print</Button>
        </div>}
      />
      {message ? <InlineMessage type={message.type} text={message.text} /> : null}

      <SectionPanel title="Filters">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem_16rem_auto]">
          <Field label="Item code"><Input value={itemCode} onChange={(event) => setItemCode(event.target.value)} placeholder="Enter item code" /></Field>
          <Field label="Status">
            <NativeSelect value={status} onChange={setStatus}>
              <option value="all">All</option>
              {statusOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Academic year">
            <NativeSelect value={academicYear} onChange={setAcademicYear}>
              <option value="all">All</option>
              {academicYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </NativeSelect>
          </Field>
          <div className="flex items-end">
            <Button type="button" onClick={() => void handleSearch()} disabled={searching || loading}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Search
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title="Results">
        <div className="space-y-4">
          <Field label="Global search">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} className="pl-9" placeholder="Search all columns" />
            </div>
          </Field>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table className="min-w-[900px]">
              <TableHeader><TableRow className="bg-slate-100 hover:bg-slate-100"><TableHead>No.</TableHead><TableHead>Item code</TableHead><TableHead>Title</TableHead><TableHead>Collection type</TableHead><TableHead>Remarks</TableHead><TableHead>Item status</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? <LoadingRows colSpan={6} label="Loading lost and damage report" /> : filteredRows.length > 0 ? filteredRows.map((row, index) => (
                  <TableRow key={`${row.itemCode}-${index}`} className="odd:bg-white even:bg-slate-50/60">
                    <TableCell>{index + 1}</TableCell><TableCell>{row.itemCode || '-'}</TableCell><TableCell>{row.title || '-'}</TableCell><TableCell>{row.collectionType || '-'}</TableCell><TableCell>{row.remarks || '-'}</TableCell><TableCell>{row.itemStatus || '-'}</TableCell>
                  </TableRow>
                )) : <EmptyTableRow colSpan={6} label="No lost and damage rows available." />}
              </TableBody>
            </Table>
          </div>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
