'use client';

import { useMemo, useState } from 'react';
import { Download, Loader2, Printer, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  exportRowsAsPdf,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from '@/lib/table-export';

type MessageState = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type TakenFilter = '' | 'yes' | 'no';

type LaravelDaywiseAttendancePayload = {
  status?: string | number;
  status_code?: string | number;
  message?: string;
  date?: unknown;
  taken?: unknown;
  attendance_data?: unknown;
  attendance_totals?: unknown;
};

type DaywiseAttendanceRow = {
  standardName: string;
  boys: number;
  girls: number;
  totalStudents: number;
  boysPresent: number;
  girlsPresent: number;
  totalPresent: number;
  boysAbsent: number;
  girlsAbsent: number;
  totalAbsent: number;
  taken: string;
  average: string;
  staffSignature: string;
};

type AttendanceTotals = {
  boys: number;
  girls: number;
  totalStudents: number;
  boysPresent: number;
  girlsPresent: number;
  totalPresent: number;
  boysAbsent: number;
  girlsAbsent: number;
  totalAbsent: number;
  taken: string;
  average: string;
};

type DaywiseAttendanceReport = {
  date: string;
  taken: TakenFilter;
  rows: DaywiseAttendanceRow[];
  totals: AttendanceTotals | null;
};

function readNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function readStringOrNumber(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') return value;
  return undefined;
}

function normalizePayload(response: unknown): LaravelDaywiseAttendancePayload {
  const root = asRecord(response);
  const nested = asRecord(root.data);

  if (
    Object.keys(nested).length > 0 &&
    (nested.attendance_data || nested.attendance_totals || nested.status_code || nested.message)
  ) {
    return {
      status: readStringOrNumber(nested.status) ?? readStringOrNumber(root.status),
      status_code: readStringOrNumber(nested.status_code) ?? readStringOrNumber(root.status_code),
      message: readString(nested.message) || readString(root.message),
      date: nested.date,
      taken: nested.taken,
      attendance_data: nested.attendance_data,
      attendance_totals: nested.attendance_totals,
    };
  }

  return {
    status: readStringOrNumber(root.status),
    status_code: readStringOrNumber(root.status_code),
    message: readString(root.message),
    date: root.date,
    taken: root.taken,
    attendance_data: root.attendance_data,
    attendance_totals: root.attendance_totals,
  };
}

function formatDateDisplay(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseReportRow(entry: unknown): DaywiseAttendanceRow {
  const record = asRecord(entry);
  const boys = readNumber(record.BOY);
  const girls = readNumber(record.GIRL);
  const boysPresent = readNumber(record.TBP);
  const girlsPresent = readNumber(record.TGP);
  const boysAbsent = readNumber(record.TBA);
  const girlsAbsent = readNumber(record.TGA);
  const totalStudents = boys + girls;
  const totalPresent = boysPresent + girlsPresent;
  const totalAbsent = boysAbsent + girlsAbsent;
  const average = totalStudents > 0 ? `${((totalPresent * 100) / totalStudents).toFixed(2)}%` : '0.00%';

  return {
    standardName: readString(record.standard_name) || readString(record.division_name),
    boys,
    girls,
    totalStudents,
    boysPresent,
    girlsPresent,
    totalPresent,
    boysAbsent,
    girlsAbsent,
    totalAbsent,
    taken: totalPresent + totalAbsent > 0 ? 'Yes' : 'No',
    average,
    staffSignature: '',
  };
}

function parseRows(value: unknown): DaywiseAttendanceRow[] {
  return toArray(value)
    .map(parseReportRow)
    .filter((row) => row.standardName);
}

function parseTotals(value: unknown): AttendanceTotals | null {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return null;

  const boys = readNumber(record.BOY);
  const girls = readNumber(record.GIRL);
  const totalStudents = readNumber(record.total_student) || boys + girls;
  const boysPresent = readNumber(record.TBP);
  const girlsPresent = readNumber(record.TGP);
  const totalPresent = readNumber(record.total_present) || boysPresent + girlsPresent;
  const boysAbsent = readNumber(record.TBA);
  const girlsAbsent = readNumber(record.TGA);
  const totalAbsent = readNumber(record.total_absent) || boysAbsent + girlsAbsent;

  return {
    boys,
    girls,
    totalStudents,
    boysPresent,
    girlsPresent,
    totalPresent,
    boysAbsent,
    girlsAbsent,
    totalAbsent,
    taken: totalPresent + totalAbsent > 0 ? 'Yes' : '',
    average: totalStudents > 0 ? `${((totalPresent * 100) / totalStudents).toFixed(2)}%` : '0.00%',
  };
}

function buildReport(payload: LaravelDaywiseAttendancePayload): DaywiseAttendanceReport {
  return {
    date: readString(payload.date),
    taken: (readString(payload.taken).toLowerCase() as TakenFilter) || '',
    rows: parseRows(payload.attendance_data),
    totals: parseTotals(payload.attendance_totals),
  };
}

export default function DaywiseStudentAttendancePage() {
  const [attendanceDate, setAttendanceDate] = useState(getTodayIsoDate());
  const [taken, setTaken] = useState<TakenFilter>('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [report, setReport] = useState<DaywiseAttendanceReport | null>(null);

  const exportColumns = useMemo<TableExportColumn[]>(() => ([
    { key: 'standardName', label: 'Standard' },
    { key: 'boys', label: 'Total Student B', align: 'center' },
    { key: 'girls', label: 'Total Student G', align: 'center' },
    { key: 'totalStudents', label: 'Total Student T', align: 'center' },
    { key: 'boysPresent', label: 'Present B', align: 'center' },
    { key: 'girlsPresent', label: 'Present G', align: 'center' },
    { key: 'totalPresent', label: 'Present T', align: 'center' },
    { key: 'boysAbsent', label: 'Absent B', align: 'center' },
    { key: 'girlsAbsent', label: 'Absent G', align: 'center' },
    { key: 'totalAbsent', label: 'Absent T', align: 'center' },
    { key: 'taken', label: 'Taken', align: 'center' },
    { key: 'average', label: 'Average', align: 'center' },
    { key: 'staffSignature', label: 'Staff Signature' },
  ]), []);

  const exportRows = useMemo<TableExportRow[]>(() => {
    if (!report) return [];

    const rows: TableExportRow[] = report.rows.map((row) => ({
      standardName: row.standardName,
      boys: String(row.boys),
      girls: String(row.girls),
      totalStudents: String(row.totalStudents),
      boysPresent: String(row.boysPresent),
      girlsPresent: String(row.girlsPresent),
      totalPresent: String(row.totalPresent),
      boysAbsent: String(row.boysAbsent),
      girlsAbsent: String(row.girlsAbsent),
      totalAbsent: String(row.totalAbsent),
      taken: row.taken,
      average: row.average,
      staffSignature: row.staffSignature,
    }));

    if (report.totals) {
      rows.push({
        standardName: 'TOTAL',
        boys: String(report.totals.boys),
        girls: String(report.totals.girls),
        totalStudents: String(report.totals.totalStudents),
        boysPresent: String(report.totals.boysPresent),
        girlsPresent: String(report.totals.girlsPresent),
        totalPresent: String(report.totals.totalPresent),
        boysAbsent: String(report.totals.boysAbsent),
        girlsAbsent: String(report.totals.girlsAbsent),
        totalAbsent: String(report.totals.totalAbsent),
        taken: report.totals.taken,
        average: report.totals.average,
        staffSignature: '',
      });
    }

    return rows;
  }, [report]);

  const handleSearch = async () => {
    if (!attendanceDate) {
      setMessage({ type: 'info', text: 'Select attendance date before searching.' });
      setReport(null);
      setHasSearched(false);
      return;
    }

    const session = getFeesSession();
    if (!session.subInstituteId || !session.academicYearId) {
      setMessage({ type: 'error', text: 'Session institute or academic year is missing. Please sign in again.' });
      setReport(null);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({ path: 'student/show_daywise_student_attendance' });
      const body = new URLSearchParams();
      appendSessionParams(body, session);
      body.set('date', attendanceDate);
      if (taken) body.set('taken', taken);

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: body.toString(),
      });

      const responseBody = (await response.json()) as unknown;
      console.log('Daywise Attendance Report API response:', responseBody);
      const payload = normalizePayload(responseBody);

      if (!response.ok) {
        throw new Error(payload.message || `HTTP ${response.status}: Unable to fetch daywise attendance report.`);
      }

      const nextReport = buildReport(payload);
      setReport(nextReport);
      setMessage({
        type: nextReport.rows.length > 0 ? 'success' : 'info',
        text:
          payload.message ||
          (nextReport.rows.length > 0
            ? 'Daywise attendance report loaded successfully.'
            : 'No attendance rows found for the selected filters.'),
      });
    } catch (error) {
      setReport(null);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to fetch daywise attendance report.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    openPrintPreview({
      title: 'Boys Girls Daywise Attendance Report',
      subtitle: `Attendance Date: ${formatDateDisplay(report?.date || attendanceDate)}${taken ? ` | Taken: ${taken}` : ''}`,
      columns: exportColumns,
      rows: exportRows,
    });
  };

  return (
    <PageFrame>
      <PageHeader
        title="Boys Girls Daywise Attendance Report"
        description="Compare daywise attendance totals by boys and girls using the same Laravel filters, grouping, and summary calculations."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => exportRowsAsCsv({ filename: 'boys-girls-daywise-attendance-report.csv', columns: exportColumns, rows: exportRows })} disabled={exportRows.length === 0}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => exportRowsAsExcel({ filename: 'boys-girls-daywise-attendance-report.xls', title: 'Boys Girls Daywise Attendance Report', columns: exportColumns, rows: exportRows })} disabled={exportRows.length === 0}>
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button type="button" variant="outline" onClick={() => exportRowsAsPdf({ filename: 'boys-girls-daywise-attendance-report.pdf', title: 'Boys Girls Daywise Attendance Report', subtitle: 'Legacy parity summary', columns: exportColumns, rows: exportRows })} disabled={exportRows.length === 0}>
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button type="button" variant="outline" onClick={handlePrint} disabled={exportRows.length === 0}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Filters" description="Use the same Laravel date and taken filters, then search through the existing proxy-based API layer.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Attendance Date">
            <Input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} required />
          </Field>

          <Field label="Taken">
            <NativeSelect value={taken} onChange={(value) => setTaken((value || '') as TakenFilter)}>
              <option value="">Select Taken</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </NativeSelect>
          </Field>

          <div className="flex items-end">
            <Button type="button" className="h-10 w-full" onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Report"
        description={`Attendance Date: ${formatDateDisplay(report?.date || attendanceDate)}${taken ? ` | Taken: ${taken}` : ''}`}
      >
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table className="min-w-[1280px]">
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100">
                <TableHead rowSpan={2}>Standard</TableHead>
                <TableHead colSpan={3} className="text-center">Total Student</TableHead>
                <TableHead colSpan={3} className="text-center">Present</TableHead>
                <TableHead colSpan={3} className="text-center">Absent</TableHead>
                <TableHead rowSpan={2} className="text-center">Taken</TableHead>
                <TableHead rowSpan={2} className="text-center">Average</TableHead>
                <TableHead rowSpan={2}>Staff Signature</TableHead>
              </TableRow>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-center">B</TableHead>
                <TableHead className="text-center">G</TableHead>
                <TableHead className="text-center">T</TableHead>
                <TableHead className="text-center">B</TableHead>
                <TableHead className="text-center">G</TableHead>
                <TableHead className="text-center">T</TableHead>
                <TableHead className="text-center">B</TableHead>
                <TableHead className="text-center">G</TableHead>
                <TableHead className="text-center">T</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows colSpan={13} label="Loading boys girls daywise attendance report" />
              ) : report && report.rows.length > 0 ? (
                report.rows.map((row) => (
                  <TableRow key={row.standardName} className="odd:bg-white even:bg-slate-50/60">
                    <TableCell className="font-medium text-slate-950">{row.standardName}</TableCell>
                    <TableCell className="text-center">{row.boys}</TableCell>
                    <TableCell className="text-center">{row.girls}</TableCell>
                    <TableCell className="bg-amber-50 text-center font-semibold">{row.totalStudents}</TableCell>
                    <TableCell className="text-center">{row.boysPresent}</TableCell>
                    <TableCell className="text-center">{row.girlsPresent}</TableCell>
                    <TableCell className="bg-emerald-50 text-center font-semibold">{row.totalPresent}</TableCell>
                    <TableCell className="text-center">{row.boysAbsent}</TableCell>
                    <TableCell className="text-center">{row.girlsAbsent}</TableCell>
                    <TableCell className="bg-rose-50 text-center font-semibold">{row.totalAbsent}</TableCell>
                    <TableCell className="text-center">{row.taken}</TableCell>
                    <TableCell className="bg-orange-50 text-center font-semibold">{row.average}</TableCell>
                    <TableCell />
                  </TableRow>
                ))
              ) : (
                <EmptyTableRow
                  colSpan={13}
                  label={hasSearched ? 'No daywise attendance rows match the current filters.' : 'Search to load the boys girls daywise attendance report.'}
                />
              )}
            </TableBody>
            {report?.totals && (
              <TableFooter>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableCell className="font-bold">TOTAL</TableCell>
                  <TableCell className="text-center font-semibold">{report.totals.boys}</TableCell>
                  <TableCell className="text-center font-semibold">{report.totals.girls}</TableCell>
                  <TableCell className="bg-amber-100 text-center font-bold">{report.totals.totalStudents}</TableCell>
                  <TableCell className="text-center font-semibold">{report.totals.boysPresent}</TableCell>
                  <TableCell className="text-center font-semibold">{report.totals.girlsPresent}</TableCell>
                  <TableCell className="bg-emerald-100 text-center font-bold">{report.totals.totalPresent}</TableCell>
                  <TableCell className="text-center font-semibold">{report.totals.boysAbsent}</TableCell>
                  <TableCell className="text-center font-semibold">{report.totals.girlsAbsent}</TableCell>
                  <TableCell className="bg-rose-100 text-center font-bold">{report.totals.totalAbsent}</TableCell>
                  <TableCell className="text-center">{report.totals.taken}</TableCell>
                  <TableCell className="bg-orange-100 text-center font-bold">{report.totals.average}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
