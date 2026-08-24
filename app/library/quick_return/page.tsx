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
import {
  downloadFile,
  escapeCsv,
  formatDate,
  formatDateTime,
  MessageState,
  normalizePayload,
  readMessage,
  readStatus,
} from '@/app/library/_lib/library-module-utils';

type ReturnRecord = {
  id: string;
  studentName: string;
  standardDivision: string;
  enrollmentNo: string;
  mobile: string;
  itemCode: string;
  bookName: string;
  issuedDate: string;
  dueDate: string;
  returnDate: string;
  publisherName: string;
  authorName: string;
};

function parseRecords(payload: Record<string, unknown>): ReturnRecord[] {
  return toArray(payload.circulation_data).map((item, index) => {
    const record = asRecord(item);
    return {
      id: readString(record.circulation_id) || `${index}`,
      studentName: readString(record.student_name),
      standardDivision: [readString(record.standard), readString(record.division)].filter(Boolean).join(' / '),
      enrollmentNo: readString(record.enrollment_no),
      mobile: readString(record.mobile),
      itemCode: readString(record.item_code),
      bookName: readString(record.book_name),
      issuedDate: readString(record.issued_date),
      dueDate: readString(record.due_date),
      returnDate: readString(record.return_date),
      publisherName: readString(record.publisher_name),
      authorName: readString(record.author_name),
    };
  });
}

function printRows(rows: ReturnRecord[]) {
  const html = `
    <html>
      <head>
        <title>Quick Return</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f1f5f9; }
        </style>
      </head>
      <body>
        <h2>Quick Return</h2>
        <table>
          <thead>
            <tr>
              <th>Sr No</th>
              <th>Student Name</th>
              <th>Std / Div</th>
              <th>Enrollment No</th>
              <th>Mobile</th>
              <th>Item Code</th>
              <th>Book Name</th>
              <th>Issued Date</th>
              <th>Due Date</th>
              <th>Return Date</th>
              <th>Publisher Name</th>
              <th>Author Name</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, index) => `<tr><td>${index + 1}</td><td>${row.studentName || '-'}</td><td>${row.standardDivision || '-'}</td><td>${row.enrollmentNo || '-'}</td><td>${row.mobile || '-'}</td><td>${row.itemCode || '-'}</td><td>${row.bookName || '-'}</td><td>${formatDate(row.issuedDate)}</td><td>${formatDate(row.dueDate)}</td><td>${formatDateTime(row.returnDate)}</td><td>${row.publisherName || '-'}</td><td>${row.authorName || '-'}</td></tr>`).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=1280,height=900');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export default function QuickReturnPage() {
  const session = useMemo(() => getFeesSession(), []);
  const [itemCode, setItemCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const haystack = [
        record.studentName,
        record.standardDivision,
        record.enrollmentNo,
        record.mobile,
        record.itemCode,
        record.bookName,
        record.publisherName,
        record.authorName,
      ].join(' ').toLowerCase();

      if (globalSearch && !haystack.includes(globalSearch.toLowerCase())) {
        return false;
      }

      const columns: Record<string, string> = {
        studentName: record.studentName,
        standardDivision: record.standardDivision,
        enrollmentNo: record.enrollmentNo,
        mobile: record.mobile,
        itemCode: record.itemCode,
        bookName: record.bookName,
        publisherName: record.publisherName,
        authorName: record.authorName,
      };

      return Object.entries(columnFilters).every(([key, value]) => {
        if (!value.trim()) return true;
        return (columns[key] || '').toLowerCase().includes(value.toLowerCase());
      });
    });
  }, [columnFilters, globalSearch, records]);

  const exportRows = useMemo(() => {
    return filteredRecords.map((record, index) => ({
      'Sr No': String(index + 1),
      'Student Name': record.studentName || '-',
      'Std / Div': record.standardDivision || '-',
      'Enrollment No': record.enrollmentNo || '-',
      Mobile: record.mobile || '-',
      'Item Code': record.itemCode || '-',
      'Book Name': record.bookName || '-',
      'Issued Date': formatDate(record.issuedDate),
      'Due Date': formatDate(record.dueDate),
      'Return Date': formatDateTime(record.returnDate),
      'Publisher Name': record.publisherName || '-',
      'Author Name': record.authorName || '-',
    }));
  }, [filteredRecords]);

  const handleSubmit = async () => {
    if (!itemCode.trim()) {
      setMessage({ type: 'info', text: 'Item code is required.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({ path: 'quick_return' });
      const payload = new URLSearchParams();
      payload.set('item_code', itemCode.trim());
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

      setMessage({
        type: status === 1 ? 'success' : 'error',
        text: readMessage(normalized, 'Unable to complete quick return.'),
      });
      setRecords(parseRecords(normalized));
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to complete quick return.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="Quick Return"
        description="Return a library item by item code and review the circulation row returned by the legacy Laravel workflow."
        action={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => {
              if (exportRows.length === 0) return;
              const headers = Object.keys(exportRows[0]);
              const csv = [headers.join(','), ...exportRows.map((row) => headers.map((header) => escapeCsv(row[header as keyof typeof row] ?? '')).join(','))].join('\n');
              downloadFile('quick-return.csv', csv, 'text/csv;charset=utf-8;');
            }}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => {
              if (exportRows.length === 0) return;
              const headers = Object.keys(exportRows[0]);
              const lines = [headers.join('\t'), ...exportRows.map((row) => headers.map((header) => String(row[header as keyof typeof row] ?? '')).join('\t'))];
              downloadFile('quick-return.xls', lines.join('\n'), 'application/vnd.ms-excel');
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

      <SectionPanel title="Return Item" description="Laravel accepts one item code and returns the student circulation row if that issue record is still open.">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <Field label="Item Code">
            <Input
              value={itemCode}
              onChange={(event) => setItemCode(event.target.value)}
              placeholder="Enter Item Id"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
            />
          </Field>
          <div className="flex items-end">
            <Button type="button" onClick={() => void handleSubmit()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Return
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title="Return Results" description="The legacy page only renders the table after a successful return.">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Global Search">
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
            <Table className="min-w-[1600px]">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableHead>Sr No</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Std / Div</TableHead>
                  <TableHead>Enrollment No</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Book Name</TableHead>
                  <TableHead>Issued Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Return Date</TableHead>
                  <TableHead>Publisher Name</TableHead>
                  <TableHead>Author Name</TableHead>
                </TableRow>
                <TableRow className="bg-white hover:bg-white">
                  <TableHead />
                  {['studentName', 'standardDivision', 'enrollmentNo', 'mobile', 'itemCode', 'bookName', 'issuedDate', 'dueDate', 'returnDate', 'publisherName', 'authorName'].map((key) => (
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
                  <LoadingRows colSpan={12} label="Returning book" />
                ) : filteredRecords.length > 0 ? (
                  filteredRecords.map((record, index) => (
                    <TableRow key={`${record.id}-${index}`} className="odd:bg-white even:bg-slate-50/60">
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{record.studentName || '-'}</TableCell>
                      <TableCell>{record.standardDivision || '-'}</TableCell>
                      <TableCell>{record.enrollmentNo || '-'}</TableCell>
                      <TableCell>{record.mobile || '-'}</TableCell>
                      <TableCell>{record.itemCode || '-'}</TableCell>
                      <TableCell>{record.bookName || '-'}</TableCell>
                      <TableCell>{formatDate(record.issuedDate)}</TableCell>
                      <TableCell>{formatDate(record.dueDate)}</TableCell>
                      <TableCell>{formatDateTime(record.returnDate)}</TableCell>
                      <TableCell>{record.publisherName || '-'}</TableCell>
                      <TableCell>{record.authorName || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <EmptyTableRow colSpan={12} label="No quick return rows available." />
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
