'use client';

import { useState } from 'react';
import { Download, Loader2, Search } from 'lucide-react';

import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import {
  appendSessionParams,
  asRecord,
  assertApiSuccess,
  fetchLaravelJson,
  getApiBaseUrl,
  getFeesSession,
  joinUrl,
  readFirstString,
  readString,
  toArray,
  type ApiStatusPayload,
  type FeesSession,
} from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type S1Row = {
  studentId: string;
  studentName: string;
  enrollmentNo: string;
  mobile: string;
  paymentMethod: string;
  registrationDate: string;
  accountHolderName: string;
  accountNumber: string;
  bankName: string;
  ifsc: string;
  accountType: string;
  umrn: string;
};

type S1Response = ApiStatusPayload & {
  student_data?: unknown;
  excelFile_path?: unknown;
  from_date?: unknown;
  to_date?: unknown;
};

export default function NachS1ExcelExportPage() {
  const [session, setSession] = useState<FeesSession>(() => getFeesSession());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rows, setRows] = useState<S1Row[]>([]);
  const [downloadPath, setDownloadPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleSearch = async () => {
    const currentSession = getFeesSession();
    setSession(currentSession);

    if (!currentSession.subInstituteId || !currentSession.academicYearId) {
      setMessage({ type: 'error', text: 'Session institute or academic year is missing.' });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setMessage(null);
    setRows([]);
    setDownloadPath('');

    try {
      const params = new URLSearchParams();
      appendSessionParams(params, currentSession);
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);

      const payload = await fetchLaravelJson<S1Response>(currentSession, `${getApiBaseUrl(currentSession)}/fees/NACH_s1excel_export/create?${params.toString()}`);
      assertApiSuccess(payload, 'Unable to export S1 NACH data.');
      const nextRows = toS1Rows(payload.student_data);
      setRows(nextRows);
      setDownloadPath(readString(payload.excelFile_path));
      setMessage({ type: nextRows.length ? 'success' : 'info', text: payload.message || (nextRows.length ? `Loaded ${nextRows.length} mandate record${nextRows.length === 1 ? '' : 's'}.` : 'No records found.') });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to export S1 NACH data.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="S1-NACH excel export"
        description="Export unregistered NACH mandate records from Laravel for the selected registration date range."
        action={downloadPath ? (
          <a
            href={joinUrl(getApiBaseUrl(session), downloadPath)}
            download
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary-blue)] px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[color-mix(in_srgb,var(--primary-blue),#000_12%)]"
          >
            <Download className="h-4 w-4" />
            Export S1 excel
          </a>
        ) : undefined}
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Search">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Field label="From date">
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </Field>
          <Field label="To date">
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </Field>
          <Button type="button" className="h-10" onClick={handleSearch} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>
      </SectionPanel>

      <SectionPanel title="Mandate records">
        <Table className="min-w-[1180px]">
          <TableHeader>
            <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
              <TableHead>Student ID</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>GR no</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Payment method</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Account holder</TableHead>
              <TableHead>Account number</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>IFSC</TableHead>
              <TableHead>Account type</TableHead>
              <TableHead>UMRN</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingRows colSpan={12} label="Loading S1 mandate records" />
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={`${row.studentId}-${row.accountNumber}`} className="odd:bg-white even:bg-slate-50/70">
                  <TableCell>{row.studentId}</TableCell>
                  <TableCell className="font-semibold text-slate-950">{row.studentName || '-'}</TableCell>
                  <TableCell>{row.enrollmentNo || '-'}</TableCell>
                  <TableCell>{row.mobile || '-'}</TableCell>
                  <TableCell>{row.paymentMethod || '-'}</TableCell>
                  <TableCell>{row.registrationDate || '-'}</TableCell>
                  <TableCell>{row.accountHolderName || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{row.accountNumber || '-'}</TableCell>
                  <TableCell>{row.bankName || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{row.ifsc || '-'}</TableCell>
                  <TableCell>{row.accountType || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{row.umrn || '-'}</TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyTableRow colSpan={12} label={hasSearched ? 'No S1 mandate records found.' : 'Search to load S1 mandate records.'} />
            )}
          </TableBody>
        </Table>
      </SectionPanel>
    </PageFrame>
  );
}

function toS1Rows(value: unknown): S1Row[] {
  return toArray(value).map((item) => {
    const record = asRecord(item);
    return {
      studentId: readFirstString(record, ['student_id', 'id']),
      studentName: readFirstString(record, ['student_name', 'name']),
      enrollmentNo: readFirstString(record, ['enrollment_no', 'gr_no']),
      mobile: readFirstString(record, ['mobile', 'mobile_no']),
      paymentMethod: readFirstString(record, ['payment_method']),
      registrationDate: readFirstString(record, ['registration_date', 'date']),
      accountHolderName: readFirstString(record, ['ac_holder_name', 'account_holder_name']),
      accountNumber: readFirstString(record, ['ac_number', 'account_number']),
      bankName: readFirstString(record, ['bank_name']),
      ifsc: readFirstString(record, ['ifsc_code', 'ifsc']),
      accountType: readFirstString(record, ['ac_type', 'account_type']),
      umrn: readFirstString(record, ['UMRN', 'umrn']),
    };
  }).filter((row) => row.studentId || row.accountNumber);
}
