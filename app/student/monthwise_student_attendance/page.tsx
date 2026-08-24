'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Printer, Search } from 'lucide-react';

import SearchDropdown from '@/components/search-dropdown/SearchDropdown';
import type {
  AcademicSection,
  Division,
  DropdownValue,
  Standard,
} from '@/components/search-dropdown/types';
import { Button } from '@/components/ui/button';
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
import { getStoredMenuContext } from '@/app/hooks/useMenuRights';
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  exportRowsAsPdf,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from '@/lib/table-export';
import { useAuth } from '@/contexts/AuthContext';

type ReportMessage = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type BatchOption = {
  id: string;
  title: string;
};

type StudentRecord = {
  id: string;
  enrollmentNo: string;
  name: string;
  standardName: string;
  divisionName: string;
  batchTitle: string;
};

type MonthwiseAttendanceReport = {
  month: string;
  year: string;
  daysInMonth: number;
  students: StudentRecord[];
  attendanceByStudent: Record<string, Record<number, string>>;
  sundays: number[];
  holidays: number[];
  vacations: number[];
  events: number[];
};

type LaravelMonthwiseAttendancePayload = {
  status?: string | number;
  status_code?: string | number;
  message?: string;
  month?: unknown;
  year?: unknown;
  grade_id?: unknown;
  standard_id?: unknown;
  division_id?: unknown;
  student_data?: unknown;
  attendance_data?: unknown;
  sundays?: unknown;
  holidays?: unknown;
  vacations?: unknown;
  events?: unknown;
  to_date?: unknown;
  batchs?: unknown;
  batch_id?: unknown;
};

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

function readNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function readStringOrNumber(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') return value;
  return undefined;
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

function parseNumberArray(value: unknown): number[] {
  return toArray(value)
    .map((entry) => readNumber(entry))
    .filter((entry, index, collection) => entry > 0 && collection.indexOf(entry) === index)
    .sort((left, right) => left - right);
}

function parseAttendanceMap(value: unknown): Record<string, Record<number, string>> {
  const root = asRecord(value);
  const result: Record<string, Record<number, string>> = {};

  Object.entries(root).forEach(([studentId, days]) => {
    const dayRecord = asRecord(days);
    const attendance: Record<number, string> = {};

    Object.entries(dayRecord).forEach(([dayKey, code]) => {
      const day = readNumber(dayKey);
      if (day > 0) {
        attendance[day] = readString(code).toUpperCase();
      }
    });

    result[studentId] = attendance;
  });

  return result;
}

function parseStudents(value: unknown): StudentRecord[] {
  return toArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      return {
        id: readString(record.id),
        enrollmentNo: readString(record.enrollment_no),
        name: formatStudentName(record) || readString(record.student_name),
        standardName: readString(record.standard_name) || readString(record.standard),
        divisionName: readString(record.division_name) || readString(record.division),
        batchTitle: readString(record.batch_title),
      };
    })
    .filter((student) => student.id && student.name);
}

function parseBatchOptions(value: unknown): BatchOption[] {
  return toArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      return {
        id: readString(record.id),
        title: readString(record.title),
      };
    })
    .filter((batch) => batch.id && batch.title);
}

function getDaysInMonth(year: string, month: string) {
  const numericYear = Number(year);
  const numericMonth = Number(month);
  if (!Number.isFinite(numericYear) || !Number.isFinite(numericMonth) || numericMonth < 1 || numericMonth > 12) {
    return 31;
  }

  return new Date(numericYear, numericMonth, 0).getDate();
}

function normalizePayload(response: unknown): LaravelMonthwiseAttendancePayload {
  const root = asRecord(response);
  const nested = asRecord(root.data);

  if (
    Object.keys(nested).length > 0 &&
    (nested.student_data || nested.attendance_data || nested.status_code || nested.message)
  ) {
    return {
      status: readStringOrNumber(nested.status) ?? readStringOrNumber(root.status),
      status_code: readStringOrNumber(nested.status_code) ?? readStringOrNumber(root.status_code),
      message: readString(nested.message) || readString(root.message),
      month: nested.month,
      year: nested.year,
      grade_id: nested.grade_id,
      standard_id: nested.standard_id,
      division_id: nested.division_id,
      student_data: nested.student_data,
      attendance_data: nested.attendance_data,
      sundays: nested.sundays,
      holidays: nested.holidays,
      vacations: nested.vacations,
      events: nested.events,
      to_date: nested.to_date,
      batchs: nested.batchs,
      batch_id: nested.batch_id,
    };
  }

  return {
    status: readStringOrNumber(root.status),
    status_code: readStringOrNumber(root.status_code),
    message: readString(root.message),
    month: root.month,
    year: root.year,
    grade_id: root.grade_id,
    standard_id: root.standard_id,
    division_id: root.division_id,
    student_data: root.student_data,
    attendance_data: root.attendance_data,
    sundays: root.sundays,
    holidays: root.holidays,
    vacations: root.vacations,
    events: root.events,
    to_date: root.to_date,
    batchs: root.batchs,
    batch_id: root.batch_id,
  };
}

function buildReport(payload: LaravelMonthwiseAttendancePayload, fallbackMonth: string, fallbackYear: string): MonthwiseAttendanceReport {
  const month = readString(payload.month) || fallbackMonth;
  const year = readString(payload.year) || fallbackYear;

  return {
    month,
    year,
    daysInMonth: readNumber(payload.to_date) || getDaysInMonth(year, month),
    students: parseStudents(payload.student_data),
    attendanceByStudent: parseAttendanceMap(payload.attendance_data),
    sundays: parseNumberArray(payload.sundays),
    holidays: parseNumberArray(payload.holidays),
    vacations: parseNumberArray(payload.vacations),
    events: parseNumberArray(payload.events),
  };
}

function getDayMarker(report: MonthwiseAttendanceReport, studentId: string, day: number) {
  const attendance = report.attendanceByStudent[studentId]?.[day];
  if (attendance) return attendance;
  if (report.sundays.includes(day)) return 'S';
  if (report.holidays.includes(day)) return 'H';
  if (report.vacations.includes(day)) return 'V';
  if (report.events.includes(day)) return '-';
  return '-';
}

function calculateStudentSummary(report: MonthwiseAttendanceReport, studentId: string) {
  let totalWorkingDays = 0;
  let totalPresent = 0;
  let totalAbsent = 0;

  for (let day = 1; day <= report.daysInMonth; day += 1) {
    const attendance = report.attendanceByStudent[studentId]?.[day];
    if (attendance) {
      if (attendance === 'A') {
        totalAbsent += 1;
      } else {
        totalPresent += 1;
      }
      totalWorkingDays += 1;
      continue;
    }

    if (report.sundays.includes(day) || report.holidays.includes(day) || report.vacations.includes(day) || report.events.includes(day)) {
      continue;
    }

    totalWorkingDays += 1;
  }

  const percentage = totalWorkingDays > 0 ? ((totalPresent * 100) / totalWorkingDays).toFixed(2) : '0.00';

  return {
    totalWorkingDays,
    totalPresent,
    totalAbsent,
    percentage,
  };
}

function formatMonthYear(month: string, year: string) {
  const monthLabel = MONTH_OPTIONS.find((option) => option.value === month)?.label || month;
  return `${monthLabel} / ${year}`;
}

function readStoredAcademicYears(): string[] {
  if (typeof window === 'undefined') return [];

  const recordKeys = ['userData', 'menuContext', 'sessionData', 'sessiondata', 'user_data', 'session'];
  const values = new Set<string>();

  for (const key of recordKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = asRecord(JSON.parse(raw));
      const academicYears = Array.isArray(parsed.academicYears) ? parsed.academicYears : [];

      academicYears.forEach((entry) => {
        const record = asRecord(entry);
        const syear = readString(record.syear ?? record.academic_year);
        if (syear) values.add(syear);
      });
    } catch {
      continue;
    }
  }

  const sorted = Array.from(values).sort((left, right) => Number(left) - Number(right));
  const maxYear = sorted.reduce((current, entry) => {
    const numeric = Number(entry);
    return Number.isFinite(numeric) && numeric > current ? numeric : current;
  }, 0);

  if (maxYear > 0) {
    sorted.push(String(maxYear + 1));
  }

  return sorted;
}

function readStoredRecords() {
  if (typeof window === 'undefined') return [] as Array<Record<string, unknown>>;

  const storageKeys = ['userData', 'menuContext', 'sessionData', 'sessiondata', 'user_data', 'session', 'auth'];
  const records: Array<Record<string, unknown>> = [];

  for (const storage of [sessionStorage, localStorage]) {
    for (const key of storageKeys) {
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const parsed = asRecord(JSON.parse(raw));
        if (Object.keys(parsed).length > 0) {
          records.push(parsed);
        }
      } catch {
        continue;
      }
    }
  }

  return records;
}

function getNestedValue(source: unknown, keys: string[]): unknown {
  if (!source || typeof source !== 'object') return undefined;

  const record = source as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] != null && record[key] !== '') {
      return record[key];
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      const nestedValue = getNestedValue(value, keys);
      if (nestedValue != null && nestedValue !== '') {
        return nestedValue;
      }
    }
  }

  return undefined;
}

function readFirstStoredValue(keys: string[]): string {
  const records = readStoredRecords();

  for (const record of records) {
    const value = readString(getNestedValue(record, keys));
    if (value) return value;
  }

  if (typeof window !== 'undefined') {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of keys) {
        const value = readString(storage.getItem(key));
        if (value) return value;
      }
    }
  }

  return '';
}

function resolveMonthwiseSession(authContext?: {
  menuContext: {
    sub_institute_id: number;
    user_id: number;
    user_profile_name: string;
    user_profile_id: number;
    client_id: number;
  } | null;
  academicYears: Array<Record<string, unknown>>;
}) {
  const helperSession = getFeesSession();
  const storedMenuContext = getStoredMenuContext();
  const menuContext = authContext?.menuContext ?? storedMenuContext;
  const academicYears = authContext?.academicYears?.length
    ? authContext.academicYears
        .map((entry) => readString(asRecord(entry).syear ?? asRecord(entry).academic_year))
        .filter(Boolean)
    : readStoredAcademicYears();

  const token =
    helperSession.token ||
    readFirstStoredValue(['user_token', 'token']);
  const subInstituteId =
    helperSession.subInstituteId ||
    readString(menuContext?.sub_institute_id) ||
    readFirstStoredValue(['sub_institute_id', 'subInstituteId']);
  const academicYearId =
    helperSession.academicYearId ||
    readFirstStoredValue(['selectedAcademicYear', 'syear', 'academic_year_id', 'academicYearId']) ||
    academicYears[0] ||
    '';
  const userId =
    helperSession.userId ||
    readString(menuContext?.user_id) ||
    readFirstStoredValue(['user_id', 'userId', 'id']);
  const userProfileId =
    helperSession.userProfileId ||
    readString(menuContext?.user_profile_id) ||
    readFirstStoredValue(['user_profile_id', 'userProfileId', 'profile_id', 'profileId']);
  const userProfileName =
    helperSession.userProfileName ||
    readString(menuContext?.user_profile_name) ||
    readFirstStoredValue(['user_profile_name', 'userProfileName', 'profile_name', 'profileName']);
  const clientId =
    helperSession.clientId ||
    readString(menuContext?.client_id) ||
    readFirstStoredValue(['client_id', 'clientId']);

  return {
    ...helperSession,
    token,
    subInstituteId,
    academicYearId,
    userId,
    userProfileId,
    userProfileName,
    clientId,
  };
}

export default function MonthwiseStudentAttendancePage() {
  const { menuContext, academicYears } = useAuth();
  const yearOptions = useMemo(() => {
    if (academicYears.length > 0) {
      const values = academicYears
        .map((entry) => readString(asRecord(entry).syear ?? asRecord(entry).academic_year))
        .filter(Boolean);
      const sorted = Array.from(new Set(values)).sort((left, right) => Number(left) - Number(right));
      const maxYear = sorted.reduce((current, entry) => {
        const numeric = Number(entry);
        return Number.isFinite(numeric) && numeric > current ? numeric : current;
      }, 0);

      if (maxYear > 0) {
        sorted.push(String(maxYear + 1));
      }

      return sorted;
    }

    return readStoredAcademicYears();
  }, [academicYears]);
  const [section, setSection] = useState('');
  const [standard, setStandard] = useState('');
  const [division, setDivision] = useState('');
  const [batch, setBatch] = useState('');
  const [sectionLabel, setSectionLabel] = useState('');
  const [standardLabel, setStandardLabel] = useState('');
  const [divisionLabel, setDivisionLabel] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(() => getFeesSession().academicYearId || readStoredAcademicYears()[0] || '');
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [report, setReport] = useState<MonthwiseAttendanceReport | null>(null);

  useEffect(() => {
    if (!standard || !division) {
      return;
    }

    let active = true;

    const loadBatchOptions = async () => {
      const currentSession = resolveMonthwiseSession({ menuContext, academicYears });
      setLoadingBatch(true);

      try {
        const params = new URLSearchParams({
          path: 'get_batch',
          standard_id: standard,
          division_id: division,
        });

        const response = await fetch(`/api/proxy?${params.toString()}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(currentSession.token ? { Authorization: `Bearer ${currentSession.token}` } : {}),
          },
        });

        const responseBody = (await response.json()) as unknown;
        const nextOptions = parseBatchOptions(responseBody);

        if (!active) return;

        if (!response.ok) {
          throw new Error('Unable to load batch options.');
        }

        setBatchOptions(nextOptions);
        setBatch((currentBatch) => (nextOptions.some((option) => option.id === currentBatch) ? currentBatch : ''));
      } catch {
        if (!active) return;
        setBatchOptions([]);
        setBatch('');
        setMessage((previous) => previous ?? {
          type: 'info',
          text: 'Monthwise report batch filtering exists in Laravel, but the current backend batch endpoint depends on Laravel session flow and may be unavailable for the token-based frontend.',
        });
      } finally {
        if (active) {
          setLoadingBatch(false);
        }
      }
    };

    void loadBatchOptions();

    return () => {
      active = false;
    };
  }, [academicYears, division, menuContext, standard]);

  const selectedSummary = useMemo(() => {
    const values = [sectionLabel, standardLabel, divisionLabel].filter(Boolean);
    return values.length > 0 ? values.join(' | ') : '';
  }, [divisionLabel, sectionLabel, standardLabel]);

  const exportColumns = useMemo<TableExportColumn[]>(() => {
    const dayColumns = Array.from({ length: report?.daysInMonth || getDaysInMonth(year, month) }, (_, index) => ({
      key: `day_${index + 1}`,
      label: String(index + 1),
      align: 'center' as const,
    }));

    return [
      { key: 'srNo', label: 'Sr No', align: 'center' },
      { key: 'monthYear', label: 'Month/Year' },
      { key: 'standardDivision', label: 'Standard/Division', width: '160px' },
      { key: 'enrollmentNo', label: 'GR No' },
      { key: 'studentName', label: 'Student Name', width: '220px' },
      ...(batchOptions.length > 0 || report?.students.some((student) => student.batchTitle) ? [{ key: 'batchTitle', label: 'Batch' }] : []),
      ...dayColumns,
      { key: 'totalWorkingDays', label: 'Total Working Days', align: 'center' },
      { key: 'totalPresent', label: 'Total Present', align: 'center' },
      { key: 'totalAbsent', label: 'Total Absent', align: 'center' },
      { key: 'percentage', label: 'Per %', align: 'center' },
    ];
  }, [batchOptions.length, month, report, year]);

  const exportRows = useMemo<TableExportRow[]>(() => {
    if (!report) return [];

    return report.students.map((student, index) => {
      const summary = calculateStudentSummary(report, student.id);
      const dayCells = Array.from({ length: report.daysInMonth }, (_, dayIndex) => {
        const day = dayIndex + 1;
        return [ `day_${day}`, getDayMarker(report, student.id, day) ] as const;
      }).reduce<Record<string, string>>((accumulator, [key, value]) => {
        accumulator[key] = value;
        return accumulator;
      }, {});

      return {
        srNo: String(index + 1),
        monthYear: formatMonthYear(report.month, report.year),
        standardDivision: `${student.standardName} / ${student.divisionName}`,
        enrollmentNo: student.enrollmentNo || '-',
        studentName: student.name,
        batchTitle: student.batchTitle || '-',
        ...dayCells,
        totalWorkingDays: String(summary.totalWorkingDays),
        totalPresent: String(summary.totalPresent),
        totalAbsent: String(summary.totalAbsent),
        percentage: `${summary.percentage}%`,
      };
    });
  }, [report]);

  const handleSectionChange = (value: DropdownValue, selectedData: AcademicSection[]) => {
    const selectedValue = getSingleValue(value);
    setSection(selectedValue);
    setSectionLabel(selectedData[0]?.title || '');
    setStandard('');
    setStandardLabel('');
    setDivision('');
    setDivisionLabel('');
    setBatch('');
    setBatchOptions([]);
  };

  const handleStandardChange = (value: DropdownValue, selectedData: Standard[]) => {
    const selectedValue = getSingleValue(value);
    setStandard(selectedValue);
    setStandardLabel(selectedData[0]?.name || '');
    setDivision('');
    setDivisionLabel('');
    setBatch('');
    setBatchOptions([]);
  };

  const handleDivisionChange = (value: DropdownValue, selectedData: Division[]) => {
    const selectedValue = getSingleValue(value);
    setDivision(selectedValue);
    setDivisionLabel(selectedData[0]?.name || '');
    setBatch('');
  };

  const handleSearch = async () => {
    const session = resolveMonthwiseSession({ menuContext, academicYears });

    if (!section || !standard || !division || !month || !year) {
      setMessage({ type: 'info', text: 'Select grade, standard, division, year, and month before searching.' });
      setReport(null);
      setHasSearched(false);
      return;
    }

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
      const params = new URLSearchParams({ path: 'student/show_monthwise_student_attendance' });
      const body = new URLSearchParams();
      appendSessionParams(body, session);
      body.set('grade', section);
      body.set('standard', standard);
      body.set('division', division);
      body.set('year', year);
      body.set('month', month);
      if (batch) body.set('batch_sel', batch);

      for (const [key, value] of body.entries()) {
        params.set(key, value);
      }

      console.log('Monthwise Attendance Report resolved session:', {
        subInstituteId: session.subInstituteId,
        academicYearId: session.academicYearId,
        userId: session.userId,
        userProfileId: session.userProfileId,
        userProfileName: session.userProfileName,
        clientId: session.clientId,
        hasToken: Boolean(session.token),
      });
      console.log('Monthwise Attendance Report request payload:', Object.fromEntries(body.entries()));

      if (!session.subInstituteId || !session.academicYearId) {
        throw new Error('Monthwise report session context is missing sub_institute_id or syear in browser storage.');
      }

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
      console.log('Monthwise Attendance Report API response:', responseBody);
      const payload = normalizePayload(responseBody);

      if (!response.ok) {
        throw new Error(payload.message || `HTTP ${response.status}: Unable to fetch monthwise attendance report.`);
      }

      const normalizedReport = buildReport(payload, month, year);
      setReport(normalizedReport);
      setMessage({
        type: normalizedReport.students.length > 0 ? 'success' : 'info',
        text: payload.message || (normalizedReport.students.length > 0 ? 'Monthwise attendance report loaded successfully.' : 'No attendance rows found for the selected filters.'),
      });
    } catch (error) {
      setReport(null);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to fetch monthwise attendance report.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    openPrintPreview({
      title: 'Monthwise Attendance Report',
      subtitle: `${formatMonthYear(report?.month || month, report?.year || year)}${selectedSummary ? ` | ${selectedSummary}` : ''}`,
      columns: exportColumns,
      rows: exportRows,
    });
  };

  const showBatchField = batchOptions.length > 0;

  return (
    <PageFrame>
      <PageHeader
        title="Monthwise Attendance Report"
        description="Reuse the existing academic filters and proxy-based API flow to render the legacy monthwise attendance grid."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => exportRowsAsCsv({ filename: 'monthwise-attendance-report.csv', columns: exportColumns, rows: exportRows })} disabled={exportRows.length === 0}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => exportRowsAsExcel({ filename: 'monthwise-attendance-report.xls', title: 'Monthwise Attendance Report', columns: exportColumns, rows: exportRows })} disabled={exportRows.length === 0}>
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button type="button" variant="outline" onClick={() => exportRowsAsPdf({ filename: 'monthwise-attendance-report.pdf', title: 'Monthwise Attendance Report', subtitle: 'Legacy parity print view', columns: exportColumns, rows: exportRows })} disabled={exportRows.length === 0}>
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

      <SectionPanel title="Filters" description="Laravel uses grade, standard, division, year, month, and an optional batch filter when available.">
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

          <div className={`grid gap-4 ${showBatchField ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            {showBatchField && (
              <Field label="Batch">
                <NativeSelect value={batch} onChange={setBatch} disabled={loadingBatch}>
                  <option value="">Select Batch</option>
                  {batchOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}

            <Field label="Year">
              <NativeSelect value={year} onChange={setYear} required>
                <option value="">Select Year</option>
                {yearOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Month">
              <NativeSelect value={month} onChange={setMonth} required>
                <option value="">Select Month</option>
                {MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
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
        description={report ? `${formatMonthYear(report.month, report.year)}${selectedSummary ? ` | ${selectedSummary}` : ''}` : 'Search to load the monthwise attendance report.'}
      >
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table className="min-w-[1600px]">
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100">
                <TableHead>Sr No</TableHead>
                <TableHead>Month/Year</TableHead>
                <TableHead>Standard/Division</TableHead>
                <TableHead>GR No</TableHead>
                <TableHead>Student Name</TableHead>
                {showBatchField && <TableHead>Batch</TableHead>}
                {Array.from({ length: report?.daysInMonth || getDaysInMonth(year, month) }, (_, index) => (
                  <TableHead key={index + 1} className="text-center">
                    {index + 1}
                  </TableHead>
                ))}
                <TableHead className="text-center">Total Working Days</TableHead>
                <TableHead className="text-center">Total Present</TableHead>
                <TableHead className="text-center">Total Absent</TableHead>
                <TableHead className="text-center">Per %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows colSpan={(report?.daysInMonth || getDaysInMonth(year, month)) + (showBatchField ? 10 : 9)} label="Loading monthwise attendance report" />
              ) : report && report.students.length > 0 ? (
                report.students.map((student, index) => {
                  const summary = calculateStudentSummary(report, student.id);

                  return (
                    <TableRow key={student.id} className="odd:bg-white even:bg-slate-50/60">
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{formatMonthYear(report.month, report.year)}</TableCell>
                      <TableCell>{`${student.standardName} / ${student.divisionName}`}</TableCell>
                      <TableCell>{student.enrollmentNo || '-'}</TableCell>
                      <TableCell className="font-medium text-slate-950">{student.name}</TableCell>
                      {showBatchField && <TableCell>{student.batchTitle || '-'}</TableCell>}
                      {Array.from({ length: report.daysInMonth }, (_, dayIndex) => {
                        const day = dayIndex + 1;
                        return (
                          <TableCell key={`${student.id}-${day}`} className="text-center">
                            {getDayMarker(report, student.id, day)}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-semibold">{summary.totalWorkingDays}</TableCell>
                      <TableCell className="text-center font-semibold">{summary.totalPresent}</TableCell>
                      <TableCell className="text-center font-semibold">{summary.totalAbsent}</TableCell>
                      <TableCell className="text-center font-semibold">{summary.percentage}%</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <EmptyTableRow
                  colSpan={(report?.daysInMonth || getDaysInMonth(year, month)) + (showBatchField ? 10 : 9)}
                  label={hasSearched ? 'No monthwise attendance rows match the current filters.' : 'Search to load the monthwise attendance report.'}
                />
              )}
            </TableBody>
          </Table>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
