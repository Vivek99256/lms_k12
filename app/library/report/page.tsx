'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { downloadFile, escapeCsv, MessageState, normalizePayload } from '@/app/library/_lib/library-module-utils';

type ReportOption = { id: string; label: string };
type ReportRow = Record<string, string>;

const reportLabels: Record<string, string> = {
  material_resource: 'Material Resource',
  author: 'Author',
  publisher_name: 'Publisher Name',
  publishing_place: 'Publishing Place',
  language: 'Language',
  subject: 'Subject',
};

const optionMap: Record<string, string> = {
  material_resource: 'get_material_resource_type',
  author: 'get_author_name',
  publisher_name: 'get_publisher_name',
  publishing_place: 'get_publish_place',
  language: 'get_language',
  subject: 'get_subject',
};

const columnOrder = [
  'item_code', 'title', 'sub_title', 'material_resource_type', 'edition', 'tags', 'vol_no', 'author_name', 'isbn_issn',
  'classification', 'publisher_name', 'publish_year', 'publish_place', 'pages', 'series_title', 'call_number',
  'language', 'source', 'subject', 'price', 'notes', 'review',
];

const columnLabels: Record<string, string> = {
  item_code: 'Item Code',
  title: 'Title',
  sub_title: 'Sub Title',
  material_resource_type: 'Material Resource Type',
  edition: 'Edition',
  tags: 'Tags',
  vol_no: 'No. of Items',
  author_name: 'Author/Editor Name',
  isbn_issn: 'ISBN/ISSN',
  classification: 'Classification',
  publisher_name: 'Publisher Name',
  publish_year: 'Publish Year',
  publish_place: 'Publishing Place',
  pages: 'Book Size / No. page',
  series_title: 'Series Title',
  call_number: 'Call Number',
  language: 'Language',
  source: 'Source',
  subject: 'Subject',
  price: 'Price',
  notes: 'Notes',
  review: 'Review',
};

function toOptions(payload: Record<string, unknown>, key: string, valueField: string): ReportOption[] {
  return toArray(payload[key]).map((item, index) => {
    const record = asRecord(item);
    return {
      id: readString(record[valueField]) || `${index}`,
      label: readString(record[valueField]),
    };
  }).filter((item) => item.label);
}

function parseRows(payload: Record<string, unknown>): ReportRow[] {
  return toArray(payload.all_data).map((item) => {
    const record = asRecord(item);
    const row: ReportRow = {};
    columnOrder.forEach((key) => {
      row[key] = readString(record[key]);
    });
    return row;
  });
}

function printRows(rows: ReportRow[]) {
  const headers = columnOrder.map((key) => columnLabels[key]);
  const html = `
    <html><head><title>Library Report</title><style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; vertical-align: top; }
      th { background: #f1f5f9; }
    </style></head><body>
      <h2>Library Report</h2>
      <table><thead><tr><th>Sr No</th>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>
      ${rows.map((row, index) => `<tr><td>${index + 1}</td>${columnOrder.map((key) => `<td>${row[key] || '-'}</td>`).join('')}</tr>`).join('')}
      </tbody></table>
    </body></html>
  `;

  const printWindow = window.open('', '_blank', 'width=1400,height=900');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export default function LibraryReportPage() {
  const session = useMemo(() => getFeesSession(), []);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [reportOf, setReportOf] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [bookType, setBookType] = useState('all');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [reportOptions, setReportOptions] = useState<ReportOption[]>([]);
  const [filterOptions, setFilterOptions] = useState<Record<string, ReportOption[]>>({});

  const visibleOptions = filterOptions[reportOf] ?? [];

  useEffect(() => {
    const run = async () => {
      setLoadingFilters(true);
      try {
        const params = new URLSearchParams({ path: 'library_report' });
        appendSessionParams(params, session);
        const response = await fetch(`/api/proxy?${params.toString()}`, { headers: { Accept: 'application/json' } });
        const payload = normalizePayload(await response.json());
        setReportOptions(
          Object.entries(asRecord(payload.report_list)).map(([id, label]) => ({ id, label: readString(label) })),
        );
        setFilterOptions({
          material_resource: toOptions(payload, optionMap.material_resource, 'material_resource_type'),
          author: toOptions(payload, optionMap.author, 'author_name'),
          publisher_name: toOptions(payload, optionMap.publisher_name, 'publisher_name'),
          publishing_place: toOptions(payload, optionMap.publishing_place, 'publish_place'),
          language: toOptions(payload, optionMap.language, 'language'),
          subject: toOptions(payload, optionMap.subject, 'subject'),
        });
      } catch (error) {
        setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load library report filters.' });
      } finally {
        setLoadingFilters(false);
      }
    };
    void run();
  }, [session]);

  const filteredRows = useMemo(() => {
    if (!globalSearch) return rows;
    return rows.filter((row) => columnOrder.some((key) => (row[key] || '').toLowerCase().includes(globalSearch.toLowerCase())));
  }, [globalSearch, rows]);

  const exportRows = useMemo(() => filteredRows.map((row, index) => {
    const exportRow: Record<string, string> = { 'Sr No': String(index + 1) };
    columnOrder.forEach((key) => {
      exportRow[columnLabels[key]] = row[key] || '-';
    });
    return exportRow;
  }), [filteredRows]);

  const handleSearch = async () => {
    if (!reportOf) {
      setMessage({ type: 'info', text: 'Select report type first.' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ path: 'show_library_report' });
      const body = new URLSearchParams();
      appendSessionParams(body, session);
      body.set('report_of', reportOf);
      if (fieldValue) body.set(reportOf, fieldValue);
      if (session.subInstituteId === '47' && reportOf === 'material_resource' && fieldValue === 'book') {
        body.set('book_type', bookType);
      }

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
      });
      const payload = normalizePayload(await response.json());
      const nextRows = parseRows(payload);
      setRows(nextRows);
      setMessage({
        type: nextRows.length > 0 ? 'success' : 'info',
        text: readString(payload.message) || (nextRows.length > 0 ? `Loaded ${nextRows.length} book row${nextRows.length === 1 ? '' : 's'}.` : 'No books found for the selected report.'),
      });
    } catch (error) {
      setRows([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load library report.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="Report"
        description="Filter library books by one legacy report dimension at a time and review the matching item-level rows."
        action={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => {
              if (exportRows.length === 0) return;
              const headers = Object.keys(exportRows[0]);
              const csv = [headers.join(','), ...exportRows.map((row) => headers.map((header) => escapeCsv(row[header] ?? '')).join(','))].join('\n');
              downloadFile('library-report.csv', csv, 'text/csv;charset=utf-8;');
            }}><Download className="h-4 w-4" />CSV</Button>
            <Button type="button" variant="outline" onClick={() => {
              if (exportRows.length === 0) return;
              const headers = Object.keys(exportRows[0]);
              const lines = [headers.join('\t'), ...exportRows.map((row) => headers.map((header) => row[header] ?? '').join('\t'))];
              downloadFile('library-report.xls', lines.join('\n'), 'application/vnd.ms-excel');
            }}><FileText className="h-4 w-4" />Excel</Button>
            <Button type="button" variant="outline" onClick={() => printRows(filteredRows)}><Printer className="h-4 w-4" />Print</Button>
          </div>
        )}
      />

      {message ? <InlineMessage type={message.type} text={message.text} /> : null}

      <SectionPanel title="Filters" description="The Laravel report exposes one active dimension at a time: material resource, author, publisher, publishing place, language, or subject.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Select Report">
            <NativeSelect value={reportOf} onChange={(value) => { setReportOf(value); setFieldValue(''); }}>
              <option value="">{loadingFilters ? 'Loading reports...' : 'Select Report'}</option>
              {reportOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </NativeSelect>
          </Field>
          <Field label={reportLabels[reportOf] || 'Report Value'}>
            <NativeSelect value={fieldValue} onChange={setFieldValue} disabled={!reportOf}>
              <option value="">All</option>
              {visibleOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </NativeSelect>
          </Field>
          {session.subInstituteId === '47' && reportOf === 'material_resource' && fieldValue === 'book' ? (
            <Field label="Book Type">
              <NativeSelect value={bookType} onChange={setBookType}>
                <option value="all">All</option>
                <option value="purchase">Purchase</option>
                <option value="donate">Donate</option>
              </NativeSelect>
            </Field>
          ) : <div />}
          <div className="flex items-end">
            <Button type="button" onClick={() => void handleSearch()} disabled={loading || loadingFilters}>
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
            <Table className="min-w-[2200px]">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableHead>Sr No</TableHead>
                  {columnOrder.map((key) => <TableHead key={key}>{columnLabels[key]}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <LoadingRows colSpan={columnOrder.length + 1} label="Loading library report" /> : filteredRows.length > 0 ? (
                  filteredRows.map((row, index) => (
                    <TableRow key={`${row.item_code}-${index}`} className="odd:bg-white even:bg-slate-50/60">
                      <TableCell>{index + 1}</TableCell>
                      {columnOrder.map((key) => <TableCell key={`${key}-${index}`}>{row[key] || '-'}</TableCell>)}
                    </TableRow>
                  ))
                ) : (
                  <EmptyTableRow colSpan={columnOrder.length + 1} label="No library report rows available." />
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
