'use client';

import { useMemo, useState } from 'react';
import { Download, Loader2, Printer, Search } from 'lucide-react';

import SearchDropdown from '@/components/search-dropdown/SearchDropdown';
import type {
  AcademicSection,
  Division,
  DropdownValue,
  Standard,
} from '@/components/search-dropdown/types';
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
import { appendSessionParams, getFeesSession } from '@/app/fees/_lib/fees-api';
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  exportRowsAsPdf,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from '@/lib/table-export';

type ReportMessage = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type StudentRecord = {
  id: string;
  enrollmentNo: string;
  name: string;
};

type YearlyAttendanceReport = {
  months: number[];
  workingDayByMonth: Record<number, number>;
  students: StudentRecord[];
  attendanceByStudent: Record<string, Record<number, number>>;
  fromDate: string;
  toDate: string;
};

type LaravelYearlyAttendancePayload = {
  status?: string | number;
  status_code?: string | number;
  message?: string;
  month?: unknown;
  working_day?: unknown;
  student_data?: unknown;
  attendance_data?: unknown;
  from_date?: unknown;
  to_date?: unknown;
};

const MONTH_LABELS: Record<number, string> = {
  1: 'Jan',
  2: 'Feb',
  3: 'Mar',
  4: 'Apr',
  5: 'May',
  6: 'Jun',
  7: 'Jul',
  8: 'Aug',
  9: 'Sep',
  10: 'Oct',
  11: 'Nov',
  12: 'Dec',
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function readNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function readStringOrNumber(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') return value;
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>);
  return [];
}

function getSingleValue(value: DropdownValue | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function formatStudentName(record: Record<string, unknown>) {
  return [
    readString(record.first_name),
    readString(record.middle_name),
    readString(record.last_name),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
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

function normalizePayload(response: unknown): LaravelYearlyAttendancePayload {
  const root = asRecord(response);
  const nested = asRecord(root.data);

  if (Object.keys(nested).length > 0 && (nested.month || nested.student_data || nested.attendance_data || nested.status_code)) {
    return {
      status: readStringOrNumber(nested.status) ?? readStringOrNumber(root.status),
      status_code: readStringOrNumber(nested.status_code) ?? readStringOrNumber(root.status_code),
      message: readString(nested.message) || readString(root.message),
      month: nested.month,
      working_day: nested.working_day,
      student_data: nested.student_data,
      attendance_data: nested.attendance_data,
      from_date: nested.from_date,
      to_date: nested.to_date,
    };
  }

  return {
    status: readStringOrNumber(root.status),
    status_code: readStringOrNumber(root.status_code),
    message: readString(root.message),
    month: root.month,
    working_day: root.working_day,
    student_data: root.student_data,
    attendance_data: root.attendance_data,
    from_date: root.from_date,
    to_date: root.to_date,
  };
}

function parseMonths(value: unknown): number[] {
  return toArray(value)
    .map((month) => readNumber(month))
    .filter((month, index, collection) => month >= 1 && month <= 12 && collection.indexOf(month) === index)
    .sort((left, right) => left - right);
}

function parseStudents(value: unknown): StudentRecord[] {
  return toArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      return {
        id: readString(record.id),
        enrollmentNo: readString(record.enrollment_no),
        name: formatStudentName(record) || readString(record.student_name),
      };
    })
    .filter((student) => student.id && student.name);
}

function parseWorkingDays(value: unknown): Record<number, number> {
  const record = asRecord(value);
  const result: Record<number, number> = {};

  Object.entries(record).forEach(([key, monthValue]) => {
    const month = readNumber(key);
    if (month >= 1 && month <= 12) {
      result[month] = readNumber(monthValue);
    }
  });

  return result;
}

function parseAttendanceByStudent(value: unknown): Record<string, Record<number, number>> {
  const attendanceRoot = asRecord(value);
  const result: Record<string, Record<number, number>> = {};

  Object.entries(attendanceRoot).forEach(([studentId, monthEntries]) => {
    const monthRecord = asRecord(monthEntries);
    const normalizedMonths: Record<number, number> = {};

    Object.entries(monthRecord).forEach(([monthKey, monthValue]) => {
      const month = readNumber(monthKey);
      if (month >= 1 && month <= 12) {
        normalizedMonths[month] = readNumber(monthValue);
      }
    });

    result[studentId] = normalizedMonths;
  });

  return result;
}

function buildReport(payload: LaravelYearlyAttendancePayload): YearlyAttendanceReport {
  return {
    months: parseMonths(payload.month),
    workingDayByMonth: parseWorkingDays(payload.working_day),
    students: parseStudents(payload.student_data),
    attendanceByStudent: parseAttendanceByStudent(payload.attendance_data),
    fromDate: readString(payload.from_date),
    toDate: readString(payload.to_date),
  };
}

export default function YearlyStudentAttendancePage() {
  const [section, setSection] = useState('');
  const [standard, setStandard] = useState('');
  const [division, setDivision] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sectionLabel, setSectionLabel] = useState('');
  const [standardLabel, setStandardLabel] = useState('');
  const [divisionLabel, setDivisionLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [report, setReport] = useState<YearlyAttendanceReport | null>(null);

  const totalWorkingDays = useMemo(() => {
    if (!report) return 0;
    return report.months.reduce((total, month) => total + (report.workingDayByMonth[month] || 0), 0);
  }, [report]);

  const exportColumns = useMemo<TableExportColumn[]>(() => {
    const monthColumns = (report?.months || []).map((month) => ({
      key: `month_${month}`,
      label: MONTH_LABELS[month] || `Month ${month}`,
      align: 'center' as const,
    }));

    return [
      { key: 'srNo', label: 'Sr No', align: 'center' },
      { key: 'enrollmentNo', label: 'GR No' },
      { key: 'studentName', label: 'Student Name', width: '220px' },
      ...monthColumns,
      { key: 'totalSchoolYearDay', label: 'Total School Year Day', align: 'center' },
      { key: 'percentage', label: 'Per %', align: 'center' },
    ];
  }, [report]);

  const exportRows = useMemo<TableExportRow[]>(() => {
    if (!report) return [];

    return report.students.map((student, index) => {
      const attendance = report.attendanceByStudent[student.id] || {};
      const totalAttendance = report.months.reduce((sum, month) => sum + (attendance[month] || 0), 0);
      const percentage = totalWorkingDays > 0 ? ((totalAttendance * 100) / totalWorkingDays).toFixed(2) : '0.00';

      const monthCells = report.months.reduce<Record<string, string>>((cells, month) => {
        cells[`month_${month}`] = String(attendance[month] || 0);
        return cells;
      }, {});

      return {
        srNo: String(index + 1),
        enrollmentNo: student.enrollmentNo || '-',
        studentName: student.name,
        ...monthCells,
        totalSchoolYearDay: String(totalAttendance),
        percentage,
      };
    });
  }, [report, totalWorkingDays]);

  const selectedSummary = useMemo(() => {
    const values = [sectionLabel, standardLabel, divisionLabel].filter(Boolean);
    return values.length > 0 ? values.join(' | ') : '';
  }, [divisionLabel, sectionLabel, standardLabel]);

  const handleSectionChange = (value: DropdownValue, selectedData: AcademicSection[]) => {
    const selectedValue = getSingleValue(value);
    setSection(selectedValue);
    setSectionLabel(selectedData[0]?.title || '');
    setStandard('');
    setStandardLabel('');
    setDivision('');
    setDivisionLabel('');
  };

  const handleStandardChange = (value: DropdownValue, selectedData: Standard[]) => {
    const selectedValue = getSingleValue(value);
    setStandard(selectedValue);
    setStandardLabel(selectedData[0]?.name || '');
    setDivision('');
    setDivisionLabel('');
  };

  const handleDivisionChange = (value: DropdownValue, selectedData: Division[]) => {
    const selectedValue = getSingleValue(value);
    setDivision(selectedValue);
    setDivisionLabel(selectedData[0]?.name || '');
  };

  const handleSearch = async () => {
    if (!section || !standard || !division || !fromDate || !toDate) {
      setMessage({ type: 'info', text: 'Select section, standard, division, from date, and to date before searching.' });
      setReport(null);
      setHasSearched(false);
      return;
    }

    if (fromDate > toDate) {
      setMessage({ type: 'error', text: 'From date cannot be later than to date.' });
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
      const params = new URLSearchParams({
        path: 'student/yearly_student_attendance',
      });

      const body = new URLSearchParams();
      appendSessionParams(body, session);
      body.set('from_date', fromDate);
      body.set('to_date', toDate);
      body.set('grade', section);
      body.set('standard', standard);
      body.set('division', division);

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      const responseBody = (await response.json()) as unknown;
      console.log('Yearly Attendance Report API response:', responseBody);
      const payload = normalizePayload(responseBody);

      if (!response.ok) {
        throw new Error(payload.message || `HTTP ${response.status}: Unable to fetch yearly attendance report.`);
      }

      const normalizedReport = buildReport(payload);
      setReport(normalizedReport);
      setMessage({
        type: normalizedReport.students.length > 0 && normalizedReport.months.length > 0 ? 'success' : 'info',
        text: payload.message || (normalizedReport.students.length > 0 ? 'Yearly attendance report loaded successfully.' : 'No attendance found for the selected filters.'),
      });
    } catch (error) {
      setReport(null);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to fetch yearly attendance report.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    openPrintPreview({
      title: 'Yearly Attendance Report',
      subtitle: `From ${formatDateDisplay(report?.fromDate || fromDate)} to ${formatDateDisplay(report?.toDate || toDate)}${selectedSummary ? ` | ${selectedSummary}` : ''}`,
      columns: exportColumns,
      rows: exportRows,
    });
  };

  return (
    <PageFrame>
      <PageHeader
        title="Yearly Attendance Report"
        description="Compare the old ERP yearly attendance report against the new frontend with the same filter and reporting behavior."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => exportRowsAsCsv({ filename: 'yearly-attendance-report.csv', columns: exportColumns, rows: exportRows })} disabled={exportRows.length === 0}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => exportRowsAsExcel({ filename: 'yearly-attendance-report.xls', title: 'Yearly Attendance Report', columns: exportColumns, rows: exportRows })} disabled={exportRows.length === 0}>
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button type="button" variant="outline" onClick={() => exportRowsAsPdf({ filename: 'yearly-attendance-report.pdf', title: 'Yearly Attendance Report', subtitle: 'Legacy parity print view', columns: exportColumns, rows: exportRows })} disabled={exportRows.length === 0}>
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

      <SectionPanel title="Filters" description="Reuse the existing section, standard, and division selectors, then load the legacy yearly attendance data through the current proxy layer.">
        <div className="space-y-4">
          <SearchDropdown
            fields={['section', 'standard', 'division']}
            values={{ section, standard, division }}
            required={{ section: true, standard: true, division: true }}
            labels={{ section: 'Grade', standard: 'Standard', division: 'Division' }}
            placeholders={{ section: 'Select grade', standard: 'Select standard', division: 'Select division' }}
            onSectionChange={handleSectionChange}
            onStandardChange={handleStandardChange}
            onDivisionChange={handleDivisionChange}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="From date">
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} required />
            </Field>
            <Field label="To date">
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} required />
            </Field>
            <div className="flex items-end">
              <Button type="button" className="h-10 w-full" onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
            </div>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Report"
        description={selectedSummary ? `Academic Section : ${selectedSummary}` : 'Search to load the yearly attendance report.'}
      >
        {report && (
          <div className="mb-4 flex flex-wrap gap-4 text-sm text-slate-700">
            <span>From Date: {formatDateDisplay(report.fromDate || fromDate)}</span>
            <span>To Date: {formatDateDisplay(report.toDate || toDate)}</span>
            <span>Total School Year Days: {totalWorkingDays}</span>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100">
                <TableHead className="text-center">Sr No</TableHead>
                <TableHead>GR No</TableHead>
                <TableHead>Student Name</TableHead>
                {(report?.months || []).map((month) => (
                  <TableHead key={month} className="text-center">
                    {MONTH_LABELS[month] || `Month ${month}`}
                  </TableHead>
                ))}
                {report && <TableHead className="text-center">Total School Year Day</TableHead>}
                {report && <TableHead className="text-center">Per %</TableHead>}
              </TableRow>
              {report && report.months.length > 0 && (
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableCell className="text-center font-medium">-</TableCell>
                  <TableCell className="font-medium">-</TableCell>
                  <TableCell className="font-medium">Working Days</TableCell>
                  {report.months.map((month) => (
                    <TableCell key={`working-${month}`} className="text-center font-medium">
                      {report.workingDayByMonth[month] || 0}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-semibold">{totalWorkingDays}</TableCell>
                  <TableCell className="text-center font-medium">Per %</TableCell>
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows colSpan={Math.max(5, 3 + (report?.months.length || 0) + 2)} label="Loading yearly attendance report" />
              ) : report && report.students.length > 0 ? (
                report.students.map((student, index) => {
                  const attendance = report.attendanceByStudent[student.id] || {};
                  const totalAttendance = report.months.reduce((sum, month) => sum + (attendance[month] || 0), 0);
                  const percentage = totalWorkingDays > 0 ? ((totalAttendance * 100) / totalWorkingDays).toFixed(2) : '0.00';

                  return (
                    <TableRow key={student.id} className="odd:bg-white even:bg-slate-50/60">
                      <TableCell className="text-center">{index + 1}</TableCell>
                      <TableCell>{student.enrollmentNo || '-'}</TableCell>
                      <TableCell className="font-medium text-slate-950">{student.name}</TableCell>
                      {report.months.map((month) => (
                        <TableCell key={`${student.id}-${month}`} className="text-center">
                          {attendance[month] || 0}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-semibold">{totalAttendance}</TableCell>
                      <TableCell className="text-center font-semibold">{percentage}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <EmptyTableRow
                  colSpan={Math.max(5, 3 + (report?.months.length || 0) + 2)}
                  label={hasSearched ? 'No yearly attendance rows match the current filters.' : 'Search to load the yearly attendance report.'}
                />
              )}
            </TableBody>
          </Table>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
