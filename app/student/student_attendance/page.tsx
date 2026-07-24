'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Search, UserCheck, UserX } from 'lucide-react';

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
import {
  appendSessionParams,
  asRecord,
  getFeesSession,
  readApiStatus,
  readString,
  toArray,
  type FeesSession,
} from '@/app/fees/_lib/fees-api';

type MessageState = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type StandardDivisionOption = {
  value: string;
  label: string;
  standardId: string;
  divisionId: string;
  standardName: string;
  divisionName: string;
};

type StandardOption = {
  id: string;
  label: string;
  gradeId?: string;
};

type DivisionOption = {
  id: string;
  label: string;
};

type AttendanceCode = 'P' | 'A';

type StudentAttendanceRow = {
  id: string;
  enrollmentNo: string;
  rollNo: string;
  firstName: string;
  middleName: string;
  lastName: string;
  batchTitle: string;
};

type AttendanceSearchResult = {
  date: string;
  standardDivision: string;
  students: StudentAttendanceRow[];
  attendanceByStudent: Record<string, AttendanceCode>;
};

type LaravelAttendancePayload = {
  status?: string | number;
  status_code?: string | number;
  message?: string;
  standardDivision?: unknown;
  standard_division?: unknown;
  standard_data?: unknown;
  division_data?: unknown;
  standards?: unknown;
  divisions?: unknown;
  options?: unknown;
  data?: unknown;
  student_data?: unknown;
  attendance_data?: unknown;
  date?: unknown;
  batchs?: unknown;
};

function normalizePayload(response: unknown): LaravelAttendancePayload {
  const root = asRecord(response);
  const nested = asRecord(root.data);

  if (
    Object.keys(nested).length > 0 &&
    (
      nested.standardDivision ||
      nested.student_data ||
      nested.attendance_data ||
      nested.standard_division ||
      nested.status_code
    )
  ) {
    const status = nested.status ?? root.status;
    const status_code = nested.status_code ?? root.status_code;

    return {
      status: typeof status === 'string' || typeof status === 'number' ? status : undefined,
      status_code: typeof status_code === 'string' || typeof status_code === 'number' ? status_code : undefined,
      message: readString(nested.message) || readString(root.message),
      standardDivision: nested.standardDivision,
      standard_division: nested.standard_division,
      standard_data: nested.standard_data,
      division_data: nested.division_data,
      standards: nested.standards,
      divisions: nested.divisions,
      options: nested.options,
      data: nested.data,
      student_data: nested.student_data,
      attendance_data: nested.attendance_data,
      date: nested.date,
      batchs: nested.batchs,
    };
  }

  return {
    status: typeof root.status === 'string' || typeof root.status === 'number' ? root.status : undefined,
    status_code: typeof root.status_code === 'string' || typeof root.status_code === 'number' ? root.status_code : undefined,
    message: readString(root.message),
    standardDivision: root.standardDivision,
    standard_division: root.standard_division,
    standard_data: root.standard_data,
    division_data: root.division_data,
    standards: root.standards,
    divisions: root.divisions,
    options: root.options,
    data: root.data,
    student_data: root.student_data,
    attendance_data: root.attendance_data,
    date: root.date,
    batchs: root.batchs,
  };
}

function buildProxyHeaders(session: FeesSession, contentType?: string): HeadersInit {
  return {
    Accept: 'application/json',
    ...(contentType ? { 'Content-Type': contentType } : {}),
    ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
  };
}

function parseStandardDivisionOptions(value: unknown): StandardDivisionOption[] {
  return toArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      const standardId = readString(record.standard_id);
      const divisionId = readString(record.division_id);
      const standardName = readString(record.standard_name);
      const divisionName = readString(record.division_name);

      return {
        value: `${standardId}||${divisionId}`,
        label: `${standardName} / ${divisionName}`,
        standardId,
        divisionId,
        standardName,
        divisionName,
      };
    })
    .filter((option) => option.standardId && option.divisionId);
}

function parseStandardDivisionOptionsFromPayload(payload: LaravelAttendancePayload): StandardDivisionOption[] {
  const candidates = [
    payload.standardDivision,
    payload.standard_division,
    payload.standard_data,
    payload.division_data,
    payload.standards,
    payload.options,
    asRecord(payload.data).standardDivision,
    asRecord(payload.data).standard_division,
    asRecord(payload.data).standard_data,
    asRecord(payload.data).options,
  ];

  for (const candidate of candidates) {
    const options = parseStandardDivisionOptions(candidate);
    if (options.length > 0) {
      return options;
    }
  }

  return [];
}

function parseStandardDivisionOptionsFromStoredSession(): StandardDivisionOption[] {
  if (typeof window === 'undefined') return [];

  const sources = ['userData', 'menuContext', 'sessionData', 'sessiondata', 'user_data', 'session'];
  for (const key of sources) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = asRecord(JSON.parse(raw));
      const ids = readString(parsed.standard_division);
      const titles = readString(parsed.standard_division_title);
      if (!ids || !titles) continue;

      const idParts = ids.split(',').map((item) => item.trim()).filter(Boolean);
      const titleParts = titles.split(',').map((item) => item.trim()).filter(Boolean);

      const options = idParts.map((pair, index) => {
        const [standardId, divisionId] = pair.split('||').map((item) => item.trim());
        const [standardName, divisionName] = (titleParts[index] || '').split('||').map((item) => item.trim());

        return {
          value: `${standardId}||${divisionId}`,
          label: [standardName, divisionName].filter(Boolean).join(' - '),
          standardId,
          divisionId,
          standardName: standardName || '',
          divisionName: divisionName || '',
        };
      }).filter((option) => option.standardId && option.divisionId);

      if (options.length > 0) {
        return options;
      }
    } catch {
      continue;
    }
  }

  return [];
}

function buildStandardOptions(options: StandardDivisionOption[]): StandardOption[] {
  const seen = new Set<string>();
  return options
    .filter((option) => {
      if (seen.has(option.standardId)) return false;
      seen.add(option.standardId);
      return true;
    })
    .map((option) => ({
      id: option.standardId,
      label: option.standardName,
    }));
}

function buildDivisionOptions(options: StandardDivisionOption[], standardId: string): DivisionOption[] {
  return options
    .filter((option) => option.standardId === standardId)
    .map((option) => ({
      id: option.divisionId,
      label: option.divisionName,
    }));
}

async function fetchAcademicSections(session: FeesSession): Promise<Array<Record<string, unknown>>> {
  const form = new FormData();
  form.set('sub_institute_id', session.subInstituteId);
  form.set('token', session.token);

  const response = await fetch(`${session.hostName.replace(/\/$/, '')}/get_adminAcademicSection`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: form,
  });
  const payload = asRecord(await response.json());
  if (!response.ok || Number(payload.status) !== 1) {
    throw new Error(readString(payload.message) || 'Unable to load academic sections.');
  }
  return toArray(payload.data).map((item) => asRecord(item));
}

async function fetchStandardsByGrade(session: FeesSession, gradeId: string): Promise<StandardOption[]> {
  const form = new FormData();
  form.set('sub_institute_id', session.subInstituteId);
  form.set('grade_id', gradeId);
  form.set('token', session.token);

  const response = await fetch(`${session.hostName.replace(/\/$/, '')}/get_adminStandard`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: form,
  });
  const payload = asRecord(await response.json());
  if (!response.ok || Number(payload.status) !== 1) {
    return [];
  }

  return toArray(payload.data)
    .map((item) => {
      const record = asRecord(item);
      return {
        id: readString(record.id),
        label: readString(record.name),
        gradeId,
      };
    })
    .filter((option) => option.id && option.label);
}

async function fetchDivisionsByStandard(session: FeesSession, standardId: string): Promise<DivisionOption[]> {
  const form = new FormData();
  form.set('sub_institute_id', session.subInstituteId);
  form.set('standard_id', standardId);
  form.set('token', session.token);

  const response = await fetch(`${session.hostName.replace(/\/$/, '')}/get_adminDivision`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: form,
  });
  const payload = asRecord(await response.json());
  if (!response.ok || Number(payload.status) !== 1) {
    throw new Error(readString(payload.message) || 'Unable to load divisions.');
  }

  return toArray(payload.data)
    .map((item) => {
      const record = asRecord(item);
      return {
        id: readString(record.id),
        label: readString(record.name),
      };
    })
    .filter((option) => option.id && option.label);
}

function parseStudents(value: unknown): StudentAttendanceRow[] {
  return toArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      return {
        id: readString(record.id),
        enrollmentNo: readString(record.enrollment_no),
        rollNo: readString(record.roll_no),
        firstName: readString(record.first_name),
        middleName: readString(record.middle_name),
        lastName: readString(record.last_name),
        batchTitle: readString(record.batch_title),
      };
    })
    .filter((student) => student.id);
}

function parseAttendanceMap(value: unknown): Record<string, AttendanceCode> {
  const record = asRecord(value);
  const result: Record<string, AttendanceCode> = {};

  Object.entries(record).forEach(([studentId, attendance]) => {
    const normalized = readString(attendance).toUpperCase();
    if (normalized === 'P' || normalized === 'A') {
      result[studentId] = normalized;
    }
  });

  return result;
}

function toSearchResult(payload: LaravelAttendancePayload): AttendanceSearchResult {
  return {
    date: readString(payload.date),
    standardDivision: readString(payload.standard_division),
    students: parseStudents(payload.student_data),
    attendanceByStudent: parseAttendanceMap(payload.attendance_data),
  };
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function isSunday(dateValue: string) {
  if (!dateValue) return false;
  return new Date(`${dateValue}T00:00:00`).getDay() === 0;
}

function formatDateDisplay(value: string) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function StudentAttendancePage() {
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingDivisions, setLoadingDivisions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [standardDivisions, setStandardDivisions] = useState<StandardDivisionOption[]>([]);
  const [standards, setStandards] = useState<StandardOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [selectedStandardId, setSelectedStandardId] = useState('');
  const [selectedDivisionId, setSelectedDivisionId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResult, setSearchResult] = useState<AttendanceSearchResult | null>(null);
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceCode>>({});

  const selectedStandardDivision = useMemo(() => {
    if (!selectedStandardId || !selectedDivisionId) return '';
    return `${selectedStandardId}||${selectedDivisionId}`;
  }, [selectedDivisionId, selectedStandardId]);

  const selectedStandardDivisionOption = useMemo(
    () => standardDivisions.find((option) => option.value === selectedStandardDivision) ?? null,
    [selectedStandardDivision, standardDivisions],
  );

  const totalStudents = searchResult?.students.length ?? 0;
  const presentCount = useMemo(
    () => Object.values(attendanceState).filter((value) => value === 'P').length,
    [attendanceState],
  );
  const absentCount = useMemo(
    () => Object.values(attendanceState).filter((value) => value === 'A').length,
    [attendanceState],
  );

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      const session = getFeesSession();
      setLoadingOptions(true);
      setMessage(null);

      if (!session.subInstituteId || !session.academicYearId || !session.userId) {
        if (!cancelled) {
          setMessage({
            type: 'error',
            text: 'Session institute, academic year, or user context is missing. Please sign in again.',
          });
          setLoadingOptions(false);
        }
        return;
      }

      try {
        const params = new URLSearchParams({ path: 'student/student_attendance' });
        appendSessionParams(params, session);

        const response = await fetch(`/api/proxy?${params.toString()}`, {
          method: 'GET',
          headers: buildProxyHeaders(session),
          cache: 'no-store',
        });
        const payload = normalizePayload(await response.json());
        console.log('Student Attendance API response:', payload);

        if (!response.ok) {
          throw new Error(payload.message || `HTTP ${response.status}: Unable to load student attendance options.`);
        }

        let options = parseStandardDivisionOptionsFromPayload(payload);
        if (options.length === 0) {
          options = parseStandardDivisionOptionsFromStoredSession();
        }

        let fallbackMessage = '';
        let standardOptions = buildStandardOptions(options);

        if (standardOptions.length === 0) {
          const sections = await fetchAcademicSections(session);
          const standardsByGrade = await Promise.all(
            sections.map((section) => fetchStandardsByGrade(session, readString(section.id))),
          );
          const flattenedStandards = standardsByGrade.flat();
          const seenStandards = new Set<string>();
          standardOptions = flattenedStandards.filter((option) => {
            if (seenStandards.has(option.id)) return false;
            seenStandards.add(option.id);
            return true;
          });
          fallbackMessage = 'Attendance API returned no standard/division rows, so the page fell back to the standard/division master APIs.';
        }

        if (cancelled) return;

        setStandardDivisions(options);
        setStandards(standardOptions);
        setSelectedStandardId((current) => current || standardOptions[0]?.id || '');
        setSelectedDivisionId('');

        if (fallbackMessage) {
          setMessage({
            type: 'info',
            text: fallbackMessage,
          });
        } else if (standardOptions.length === 0) {
          setMessage({
            type: 'info',
            text: 'No standard records were returned for this user or institute.',
          });
        }
      } catch (error) {
        if (cancelled) return;
        setStandardDivisions([]);
        setStandards([]);
        setDivisions([]);
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Unable to load student attendance options.',
        });
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      }
    };

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDivisions = async () => {
      if (!selectedStandardId) {
        setDivisions([]);
        setSelectedDivisionId('');
        return;
      }

      const derivedDivisions = buildDivisionOptions(standardDivisions, selectedStandardId);
      if (derivedDivisions.length > 0) {
        setDivisions(derivedDivisions);
        setSelectedDivisionId((current) => {
          if (derivedDivisions.some((option) => option.id === current)) return current;
          return derivedDivisions[0]?.id || '';
        });
        return;
      }

      const session = getFeesSession();
      setLoadingDivisions(true);
      try {
        const apiDivisions = await fetchDivisionsByStandard(session, selectedStandardId);
        if (cancelled) return;

        setDivisions(apiDivisions);
        setSelectedDivisionId((current) => {
          if (apiDivisions.some((option) => option.id === current)) return current;
          return apiDivisions[0]?.id || '';
        });

        if (apiDivisions.length === 0) {
          setMessage({
            type: 'info',
            text: 'No divisions are mapped to the selected standard.',
          });
        }
      } catch (error) {
        if (cancelled) return;
        setDivisions([]);
        setSelectedDivisionId('');
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Unable to load divisions for the selected standard.',
        });
      } finally {
        if (!cancelled) {
          setLoadingDivisions(false);
        }
      }
    };

    void loadDivisions();
    return () => {
      cancelled = true;
    };
  }, [selectedStandardId, standardDivisions]);

  const handleSearch = async () => {
    const session = getFeesSession();

    if (!selectedStandardDivision || !selectedDate) {
      setMessage({
        type: 'info',
        text: 'Select a standard/division and a date before searching.',
      });
      setSearchResult(null);
      setHasSearched(false);
      return;
    }

    if (isSunday(selectedDate)) {
      setMessage({
        type: 'error',
        text: "Sunday is already a holiday, so attendance can't be taken on that day.",
      });
      setSearchResult(null);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    setHasSearched(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({ path: 'student/show_student_attendance' });
      const body = new URLSearchParams();
      appendSessionParams(body, session);
      body.set('date', selectedDate);
      body.set('standard_division', selectedStandardDivision);

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        headers: buildProxyHeaders(session, 'application/x-www-form-urlencoded;charset=UTF-8'),
        body: body.toString(),
      });
      const payload = normalizePayload(await response.json());

      if (!response.ok) {
        throw new Error(payload.message || `HTTP ${response.status}: Unable to search student attendance.`);
      }

      if (readApiStatus(payload) !== 1) {
        setSearchResult(null);
        setAttendanceState({});
        setMessage({
          type: 'info',
          text: payload.message || 'No student attendance data found for the selected filters.',
        });
        return;
      }

      const result = toSearchResult(payload);
      const initialAttendanceState = result.students.reduce<Record<string, AttendanceCode>>((accumulator, student) => {
        accumulator[student.id] = result.attendanceByStudent[student.id] || 'P';
        return accumulator;
      }, {});

      setSearchResult(result);
      setAttendanceState(initialAttendanceState);
      setMessage({
        type: 'success',
        text: payload.message || 'Student attendance loaded successfully.',
      });

      if (toArray(payload.batchs).length > 0) {
        setMessage({
          type: 'info',
          text: 'Student attendance loaded. Batch filtering exists in Laravel, but the current backend does not expose an API-safe batch-options endpoint for the Next frontend.',
        });
      }
    } catch (error) {
      setSearchResult(null);
      setAttendanceState({});
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to search student attendance.',
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    const session = getFeesSession();

    if (!searchResult || searchResult.students.length === 0) {
      setMessage({
        type: 'info',
        text: 'Search and load students before saving attendance.',
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({ path: 'student/save_student_attendance' });
      const body = new URLSearchParams();
      body.set('type', 'API');
      body.set('syear', session.academicYearId);
      body.set('sub_institute_id', session.subInstituteId);
      body.set('teacher_id', session.userId);
      body.set('user_profile_id', session.userProfileId);
      body.set('date', searchResult.date || selectedDate);
      body.set('standard_division', searchResult.standardDivision || selectedStandardDivision);

      Object.entries(attendanceState).forEach(([studentId, attendance]) => {
        body.set(`student[${studentId}]`, attendance);
      });

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        headers: buildProxyHeaders(session, 'application/x-www-form-urlencoded;charset=UTF-8'),
        body: body.toString(),
      });
      const payload = normalizePayload(await response.json());

      if (!response.ok) {
        throw new Error(payload.message || `HTTP ${response.status}: Unable to save student attendance.`);
      }

      if (readApiStatus(payload) !== 1) {
        throw new Error(payload.message || 'Student attendance could not be saved.');
      }

      setMessage({
        type: 'success',
        text: payload.message || 'Student attendance saved successfully.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to save student attendance.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAttendanceChange = (studentId: string, attendance: AttendanceCode) => {
    setAttendanceState((current) => ({
      ...current,
      [studentId]: attendance,
    }));
  };

  const handleMarkAll = (attendance: AttendanceCode) => {
    if (!searchResult) return;

    const nextState = searchResult.students.reduce<Record<string, AttendanceCode>>((accumulator, student) => {
      accumulator[student.id] = attendance;
      return accumulator;
    }, {});

    setAttendanceState(nextState);
  };

  return (
    <PageFrame>
      <PageHeader
        title="Student Attendance"
        description="Take and update student attendance using the existing Laravel attendance workflow and the current Next.js design system."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => handleMarkAll('P')} disabled={!searchResult || saving}>
              <UserCheck className="h-4 w-4" />
              Mark All Present
            </Button>
            <Button type="button" variant="outline" onClick={() => handleMarkAll('A')} disabled={!searchResult || saving}>
              <UserX className="h-4 w-4" />
              Mark All Absent
            </Button>
            <Button type="button" onClick={handleSave} disabled={!searchResult || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save Attendance
            </Button>
          </div>
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel
        title="Filters"
        description="Load standards first, then divisions for the selected standard, then search attendance by date. Batch selection in Laravel is still a backend API gap for the token-based frontend flow."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Select standard">
            <NativeSelect
              value={selectedStandardId}
              onChange={(value) => {
                setSelectedStandardId(value);
                setSelectedDivisionId('');
              }}
              disabled={loadingOptions}
            >
              <option value="">
                {loadingOptions ? 'Loading standards...' : 'Select standard'}
              </option>
              {standards.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Select division">
            <NativeSelect
              value={selectedDivisionId}
              onChange={setSelectedDivisionId}
              disabled={loadingOptions || loadingDivisions || !selectedStandardId}
            >
              <option value="">
                {loadingDivisions
                  ? 'Loading divisions...'
                  : !selectedStandardId
                    ? 'Select standard first'
                    : 'Select division'}
              </option>
              {divisions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Select date">
            <Input
              type="date"
              max={getTodayIsoDate()}
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </Field>

          <div className="flex items-end">
            <Button type="button" className="h-10 w-full" onClick={handleSearch} disabled={loadingOptions || searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>

        
      </SectionPanel>

      <SectionPanel title="Register" description="Laravel defaults unmarked students to Present. Existing attendance records are preselected when the register is loaded.">
        {searchResult && (
          <div className="mb-4 flex flex-wrap gap-4 text-sm text-slate-700">
            <span>Total students: <strong className="text-slate-950">{totalStudents}</strong></span>
            <span>Present: <strong className="text-emerald-700">{presentCount}</strong></span>
            <span>Absent: <strong className="text-rose-700">{absentCount}</strong></span>
            <span>Date: <strong className="text-slate-950">{formatDateDisplay(searchResult.date || selectedDate)}</strong></span>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100">
                <TableHead>Sr No</TableHead>
                <TableHead>GR No</TableHead>
                <TableHead>Roll No</TableHead>
                <TableHead>Last Name</TableHead>
                <TableHead>First Name</TableHead>
                <TableHead>Middle Name</TableHead>
                <TableHead className="text-center">Present</TableHead>
                <TableHead className="text-center">Absent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searching ? (
                <LoadingRows colSpan={8} label="Loading student attendance register" />
              ) : searchResult && searchResult.students.length > 0 ? (
                searchResult.students.map((student, index) => (
                  <TableRow key={student.id} className="odd:bg-white even:bg-slate-50/60">
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{student.enrollmentNo || '-'}</TableCell>
                    <TableCell>{student.rollNo || '-'}</TableCell>
                    <TableCell>{student.lastName || '-'}</TableCell>
                    <TableCell className="font-medium text-slate-950">{student.firstName || '-'}</TableCell>
                    <TableCell>{student.middleName || '-'}</TableCell>
                    <TableCell className="text-center">
                      <input
                        type="radio"
                        name={`student-${student.id}`}
                        value="P"
                        checked={attendanceState[student.id] === 'P'}
                        onChange={() => handleAttendanceChange(student.id, 'P')}
                        className="h-4 w-4 accent-emerald-600"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <input
                        type="radio"
                        name={`student-${student.id}`}
                        value="A"
                        checked={attendanceState[student.id] === 'A'}
                        onChange={() => handleAttendanceChange(student.id, 'A')}
                        className="h-4 w-4 accent-rose-600"
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyTableRow
                  colSpan={8}
                  label={hasSearched ? 'No students were returned for the selected attendance filters.' : 'Search to load the student attendance register.'}
                />
              )}
            </TableBody>
          </Table>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
