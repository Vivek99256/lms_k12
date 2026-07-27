'use client';

import { useMemo, useState } from 'react';
import { Download, FileText, Loader2, Printer, Search } from 'lucide-react';

import SearchDropdown from '@/components/search-dropdown/SearchDropdown';
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
import type { SearchDropdownValues } from '@/components/search-dropdown/types';
import { appendSessionParams, asRecord, getFeesSession, readString, toArray } from '@/app/fees/_lib/fees-api';
import { downloadFile, escapeCsv, formatDate, formatDateTime, MessageState, normalizePayload } from '@/app/library/_lib/library-module-utils';

type Row = {
  studentName: string;
  enrollmentNo: string;
  mobile: string;
  standardDivision: string;
  bookTitle: string;
  itemCode: string;
  issuedDate: string;
  dueDate: string;
  returnDate: string;
};

function getSingleValue(value: SearchDropdownValues[keyof SearchDropdownValues] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function parseRows(payload: Record<string, unknown>): Row[] {
  return toArray(payload.details).map((item) => {
    const record = asRecord(item);
    return {
      studentName: readString(record.student_name),
      enrollmentNo: readString(record.enrollment_no),
      mobile: readString(record.mobile),
      standardDivision: [readString(record.standard), readString(record.division)].filter(Boolean).join(' / '),
      bookTitle: readString(record.book_title),
      itemCode: readString(record.item_code),
      issuedDate: readString(record.issued_date),
      dueDate: readString(record.due_date),
      returnDate: readString(record.return_date),
    };
  });
}

function printRows(rows: Row[]) {
  const html = `<html><head><title>Issue / Overdue Report</title><style>
    body { font-family: Arial, sans-serif; padding: 24px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; }
    th { background: #f1f5f9; }
  </style></head><body><h2>Issue / Overdue Report</h2><table><thead><tr>
  <th>Sr No</th><th>Student Name</th><th>GR No</th><th>Mobile</th><th>Std / Div</th><th>Book Name</th><th>Item Code</th><th>Issued Date</th><th>Due Date</th><th>Return Date</th>
  </tr></thead><tbody>${rows.map((row, index) => `<tr><td>${index + 1}</td><td>${row.studentName || '-'}</td><td>${row.enrollmentNo || '-'}</td><td>${row.mobile || '-'}</td><td>${row.standardDivision || '-'}</td><td>${row.bookTitle || '-'}</td><td>${row.itemCode || '-'}</td><td>${formatDate(row.issuedDate)}</td><td>${formatDate(row.dueDate)}</td><td>${formatDateTime(row.returnDate)}</td></tr>`).join('')}</tbody></table></body></html>`;
  const printWindow = window.open('', '_blank', 'width=1400,height=900');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export default function IssueOverdueReportPage() {
  const session = useMemo(() => getFeesSession(), []);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [reportType, setReportType] = useState<'loan' | 'overdue'>('loan');
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({ section: '', standard: '', division: '' });
  const [studentName, setStudentName] = useState('');
  const [mobile, setMobile] = useState('');
  const [grNo, setGrNo] = useState('');
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');

  const filteredRows = useMemo(() => {
    if (!globalSearch) return rows;
    return rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(globalSearch.toLowerCase()));
  }, [globalSearch, rows]);

  const exportRows = useMemo<Record<string, string>[]>(() => filteredRows.map((row, index) => ({
    'Sr No': String(index + 1),
    'Student Name': row.studentName || '-',
    'GR No': row.enrollmentNo || '-',
    Mobile: row.mobile || '-',
    'Std / Div': row.standardDivision || '-',
    'Book Name': row.bookTitle || '-',
    'Item Code': row.itemCode || '-',
    'Issued Date': formatDate(row.issuedDate),
    'Due Date': formatDate(row.dueDate),
    'Return Date': formatDateTime(row.returnDate),
  })), [filteredRows]);

  const handleSearch = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ path: 'book_issue_report' });
      const body = new URLSearchParams();
      appendSessionParams(body, session);
      body.set('report_type', reportType);
      body.set('grade', getSingleValue(academicFilters.section));
      body.set('standard', getSingleValue(academicFilters.standard));
      body.set('division', getSingleValue(academicFilters.division));
      if (studentName.trim()) body.set('stu_name', studentName.trim());
      if (mobile.trim()) body.set('mobile', mobile.trim());
      if (grNo.trim()) body.set('grno', grNo.trim());
      body.set('from_date', fromDate);
      body.set('to_date', toDate);

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
      });
      const payload = normalizePayload(await response.json());
      const nextRows = parseRows(payload);
      setRows(nextRows);
      setMessage({ type: nextRows.length > 0 ? 'success' : 'info', text: nextRows.length > 0 ? `Loaded ${nextRows.length} row${nextRows.length === 1 ? '' : 's'}.` : 'No rows found for the selected filters.' });
    } catch (error) {
      setRows([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load issue/overdue report.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="Issue/Overdue Report"
        description="Search the legacy loan or overdue circulation report by academic filters, student details, and date range."
        action={<div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => {
            if (exportRows.length === 0) return;
            const headers = Object.keys(exportRows[0]);
            const csv = [headers.join(','), ...exportRows.map((row) => headers.map((header) => escapeCsv(row[header] ?? '')).join(','))].join('\n');
            downloadFile('issue-overdue-report.csv', csv, 'text/csv;charset=utf-8;');
          }}><Download className="h-4 w-4" />CSV</Button>
          <Button type="button" variant="outline" onClick={() => {
            if (exportRows.length === 0) return;
            const headers = Object.keys(exportRows[0]);
            const lines = [headers.join('\t'), ...exportRows.map((row) => headers.map((header) => row[header] ?? '').join('\t'))];
            downloadFile('issue-overdue-report.xls', lines.join('\n'), 'application/vnd.ms-excel');
          }}><FileText className="h-4 w-4" />Excel</Button>
          <Button type="button" variant="outline" onClick={() => printRows(filteredRows)}><Printer className="h-4 w-4" />Print</Button>
        </div>}
      />
      {message ? <InlineMessage type={message.type} text={message.text} /> : null}

      <SectionPanel title="Filters">
        <div className="grid gap-4 lg:grid-cols-4">
          <Field label="Report Type">
            <NativeSelect value={reportType} onChange={(value) => setReportType(value as 'loan' | 'overdue')}>
              <option value="loan">Loan Report</option>
              <option value="overdue">Overdue Report</option>
            </NativeSelect>
          </Field>
          <div className="lg:col-span-3">
            <SearchDropdown
              fields={['section', 'standard', 'division']}
              values={academicFilters}
              labels={{ section: 'Grade', standard: 'Standard', division: 'Division' }}
              placeholders={{ section: 'Select grade', standard: 'Select standard', division: 'Select division' }}
              onChange={(values) => setAcademicFilters(values)}
            />
          </div>
          <Field label="Student Name"><Input value={studentName} onChange={(event) => setStudentName(event.target.value)} /></Field>
          <Field label="Mobile"><Input value={mobile} onChange={(event) => setMobile(event.target.value)} /></Field>
          <Field label="GR No"><Input value={grNo} onChange={(event) => setGrNo(event.target.value)} /></Field>
          <Field label="From Date"><Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></Field>
          <Field label="To Date"><Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></Field>
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
            <Table className="min-w-[1400px]">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableHead>Sr No</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>GR No</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Std / Div</TableHead>
                  <TableHead>Book Name</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Issued Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Return Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <LoadingRows colSpan={10} label="Loading issue/overdue report" /> : filteredRows.length > 0 ? (
                  filteredRows.map((row, index) => (
                    <TableRow key={`${row.itemCode}-${index}`} className="odd:bg-white even:bg-slate-50/60">
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{row.studentName || '-'}</TableCell>
                      <TableCell>{row.enrollmentNo || '-'}</TableCell>
                      <TableCell>{row.mobile || '-'}</TableCell>
                      <TableCell>{row.standardDivision || '-'}</TableCell>
                      <TableCell>{row.bookTitle || '-'}</TableCell>
                      <TableCell>{row.itemCode || '-'}</TableCell>
                      <TableCell>{formatDate(row.issuedDate)}</TableCell>
                      <TableCell>{formatDate(row.dueDate)}</TableCell>
                      <TableCell>{formatDateTime(row.returnDate)}</TableCell>
                    </TableRow>
                  ))
                ) : <EmptyTableRow colSpan={10} label="No issue/overdue rows available." />}
              </TableBody>
            </Table>
          </div>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
