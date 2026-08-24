'use client';

/**
 * Attendance dashboard API client.
 *
 * Wraps the legacy Laravel `student_attendance` web routes (see
 * `routes/student.php` / `App\Http\Controllers\student\studentAttendanceController`)
 * using this project's shared `lib/erp-client.ts` session/header helpers.
 *
 * - `GET  /student/student_attendance`             -> class sections assigned to the signed-in teacher
 * - `POST /student/show_student_attendance`        -> daily register (student list + marked codes) for a section/date
 * - `POST /student/show_monthwise_student_attendance` -> per-day attendance codes for a section/month, used to build the trend chart and month overview
 * - `POST /student/save_student_attendance`        -> persists a day's marks for a section
 *
 * The backend's `attendance_student.attendance_code` column (and the legacy
 * blade UI at resources/views/student/student_attendance.blade.php) only ever
 * supports two codes, P and A — there is no "late" or "leave" concept in the
 * data model, so this client only models present/absent.
 */

import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  readString,
  type SessionContext,
} from '@/lib/erp-client';
import { getRequestContext } from '@/app/course-master/page';

export { buildSessionContext };
export type { SessionContext };

export type AttendanceStatus = 'present' | 'absent';

export type AttendanceStudent = {
  id: string;
  name: string;
  rollNo: string;
  class: string;
  section: string;
  status: AttendanceStatus;
  admissionNo: string;
};

export type ClassSection = {
  standardId: string;
  divisionId: string;
  standardName: string;
  divisionName: string;
};

export type AttendanceTrend = {
  labels: string[];
  present: number[];
  absent: number[];
};

export type MonthlyOverviewDay = {
  date: number;
  present: number;
  absent: number;
  marked: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>);
  return [];
}

function readFirstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = readString(record[key]);
    if (value) return value;
  }
  return '';
}

function statusFromCode(code: string): AttendanceStatus {
  return code.trim().toUpperCase() === 'P' ? 'present' : 'absent';
}

function codeFromStatus(status: AttendanceStatus): string {
  return status === 'present' ? 'P' : 'A';
}

async function fetchJson<T>(url: string, session: SessionContext, init?: RequestInit): Promise<T> {
  // No `credentials: 'include'` here: auth is via the Bearer token in
  // createAuthHeaders (studentAttendanceController validates a JWT for
  // type=API calls, not a session cookie), and the backend's CORS config
  // uses a wildcard origin with supports_credentials=false — browsers
  // reject credentialed requests against a wildcard origin outright.
  const response = await fetch(url, {
    ...init,
    headers: createAuthHeaders(session, init?.body ? 'application/x-www-form-urlencoded' : undefined),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(readString(payload.message) || `Request failed (${response.status})`);
  }
  return payload as T;
}

export async function fetchClassSections(session: SessionContext): Promise<ClassSection[]> {
  const params = new URLSearchParams();
  appendCommonParams(params, session);
  if (session.userId) params.set('user_id', session.userId);

  const payload = await fetchJson<Record<string, unknown>>(
    `${session.baseUrl}/student/student_attendance?${params.toString()}`,
    session
  );

  return toArray(payload.standardDivision)
    .map((row) => {
      const record = asRecord(row);
      return {
        standardId: readFirstString(record, ['standard_id']),
        divisionId: readFirstString(record, ['division_id']),
        standardName: readFirstString(record, ['standard_name']),
        divisionName: readFirstString(record, ['division_name']),
      };
    })
    .filter((section) => section.standardId && section.divisionId);
}

export async function fetchDailyRegister(
  session: SessionContext,
  section: ClassSection,
  date: string
): Promise<AttendanceStudent[]> {
  const body = new URLSearchParams();
  appendCommonParams(body, session);
  body.set('date', date);
  body.set('standard_division', `${section.standardId}||${section.divisionId}`);
  if (session.termId) body.set('term_id', session.termId);

  const payload = await fetchJson<Record<string, unknown>>(`${session.baseUrl}/student/show_student_attendance`, session, {
    method: 'POST',
    body,
  });

  const attendanceData = asRecord(payload.attendance_data);

  return toArray(payload.student_data).map((row) => {
    const record = asRecord(row);
    const studentId = readFirstString(record, ['student_id', 'id']);
    const name =
      [record.first_name, record.middle_name, record.last_name]
        .map((part) => readString(part))
        .filter(Boolean)
        .join(' ') || readFirstString(record, ['name']);

    return {
      id: studentId,
      name,
      rollNo: readFirstString(record, ['roll_no', 'rollNo']),
      class: readFirstString(record, ['standard', 'standard_name']) || section.standardName,
      section: readFirstString(record, ['division', 'division_name']) || section.divisionName,
      status: statusFromCode(readString(attendanceData[studentId])),
      admissionNo: readFirstString(record, ['admission_no', 'enrollment_no', 'admissionNo']),
    };
  });
}

/** Raw per-day {present, absent} totals for a whole calendar month. */
async function fetchMonthDayTotals(
  session: SessionContext,
  section: ClassSection,
  month: number,
  year: number
): Promise<Map<number, { present: number; absent: number }>> {
  const body = new URLSearchParams();
  appendCommonParams(body, session);
  body.set('month', String(month).padStart(2, '0'));
  body.set('year', String(year));
  body.set('standard', section.standardId);
  body.set('division', section.divisionId);

  const payload = await fetchJson<Record<string, unknown>>(
    `${session.baseUrl}/student/show_monthwise_student_attendance`,
    session,
    { method: 'POST', body }
  );

  const attendanceData = asRecord(payload.attendance_data);
  const dayTotals = new Map<number, { present: number; absent: number }>();

  Object.values(attendanceData).forEach((studentDays) => {
    Object.entries(asRecord(studentDays)).forEach(([day, code]) => {
      const dayNumber = Number(day);
      if (!Number.isFinite(dayNumber)) return;
      const bucket = dayTotals.get(dayNumber) ?? { present: 0, absent: 0 };
      bucket[statusFromCode(readString(code))] += 1;
      dayTotals.set(dayNumber, bucket);
    });
  });

  return dayTotals;
}

export async function fetchAttendanceTrend(
  session: SessionContext,
  section: ClassSection,
  around: Date
): Promise<AttendanceTrend> {
  const dayTotals = await fetchMonthDayTotals(session, section, around.getMonth() + 1, around.getFullYear());

  const days = Array.from(dayTotals.keys())
    .sort((a, b) => a - b)
    .slice(-8);

  const labels = days.map((day) =>
    new Date(around.getFullYear(), around.getMonth(), day).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
    })
  );

  return {
    labels,
    present: days.map((day) => dayTotals.get(day)?.present ?? 0),
    absent: days.map((day) => dayTotals.get(day)?.absent ?? 0),
  };
}

/** Every marked day in a calendar month, for the month-overview calendar grid. */
export async function fetchMonthlyOverview(
  session: SessionContext,
  section: ClassSection,
  month: number,
  year: number
): Promise<MonthlyOverviewDay[]> {
  const dayTotals = await fetchMonthDayTotals(session, section, month, year);

  return Array.from(dayTotals.entries())
    .map(([date, totals]) => ({
      date,
      present: totals.present,
      absent: totals.absent,
      marked: totals.present + totals.absent,
    }))
    .sort((a, b) => a.date - b.date);
}

export async function saveAttendance(
  session: SessionContext,
  section: ClassSection,
  date: string,
  students: { id: string; status: AttendanceStatus }[]
): Promise<string> {
  const requestContext = getRequestContext();
  if (!requestContext || !requestContext.user_id || !requestContext.user_profile_id) {
    throw new Error('Your session is missing teacher/profile info — please sign in again.');
  }

  const body = new URLSearchParams();
  appendCommonParams(body, session);
  body.set('date', date);
  body.set('standard_division', `${section.standardId}||${section.divisionId}`);
  body.set('teacher_id', String(requestContext.user_id));
  body.set('user_profile_id', String(requestContext.user_profile_id));
  students.forEach((student) => {
    body.set(`student[${student.id}]`, codeFromStatus(student.status));
  });

  const payload = await fetchJson<Record<string, unknown>>(
    `${session.baseUrl}/student/save_student_attendance`,
    session,
    { method: 'POST', body }
  );

  if (readString(payload.status_code) !== '1') {
    throw new Error(readString(payload.message) || 'Failed to save attendance.');
  }
  return readString(payload.message) || 'Attendance saved.';
}
