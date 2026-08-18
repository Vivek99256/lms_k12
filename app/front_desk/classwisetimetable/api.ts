import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
  type SessionContext,
} from "@/lib/erp-client";

export type TimetableEntry = {
  id: number;
  weekDay: string;
  periodId: number;
  subjectName: string;
  teacherName: string;
  batchName: string;
};

export type ClasswiseTimetable = {
  className: { section: string; standard: string; division: string };
  weekdays: Array<{ key: string; label: string }>;
  periods: Array<{ id: number; title: string; startTime: string; endTime: string; sortOrder: number }>;
  entries: TimetableEntry[];
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function recordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function messageFrom(payload: unknown, fallback: string) {
  return isRecord(payload) ? readString(payload.message) || fallback : fallback;
}

export function getTimetableSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId || !session.syear) {
    throw new Error("Your login session is missing a token, institute, or academic year.");
  }
  return session;
}

export async function getClasswiseTimetable(
  session: SessionContext,
  selection: { academicSectionId: number; standardId: number; divisionId: number }
): Promise<ClasswiseTimetable> {
  const query = new URLSearchParams();
  appendCommonParams(query, session);
  const response = await fetch(
    `/api/proxy?path=${encodeURIComponent("school_setup/ajax_getClasswiseTimetableApi")}&${query.toString()}`,
    {
      method: "POST",
      cache: "no-store",
      headers: createAuthHeaders(session, "application/json"),
      body: JSON.stringify({
        type: "API",
        sub_institute_id: session.subInstituteId,
        syear: session.syear,
        academic_section_id: selection.academicSectionId,
        standard_id: selection.standardId,
        division_id: selection.divisionId,
      }),
    }
  );
  const payload = (await response.json()) as unknown;
  if (!response.ok || (isRecord(payload) && (normalizeApiStatus(payload as ApiEnvelope) === "2" || readString(payload.status) === "ERROR"))) {
    throw new Error(messageFrom(payload, `Request failed (${response.status}).`));
  }
  const record = isRecord(payload) ? payload : {};
  const className = isRecord(record.class) ? record.class : {};
  return {
    className: {
      section: readString(className.section),
      standard: readString(className.standard),
      division: readString(className.division),
    },
    weekdays: recordArray(record.weekdays).map((day) => ({ key: readString(day.key), label: readString(day.label) })),
    periods: recordArray(record.periods).map((period) => ({
      id: readNumber(period.id), title: readString(period.title), startTime: readString(period.start_time), endTime: readString(period.end_time), sortOrder: readNumber(period.sort_order),
    })),
    entries: recordArray(record.entries).map((entry) => ({
      id: readNumber(entry.id), weekDay: readString(entry.week_day), periodId: readNumber(entry.period_id),
      subjectName: readString(entry.subject_name), teacherName: readString(entry.teacher_name).trim(), batchName: readString(entry.batch_name),
    })),
  };
}
