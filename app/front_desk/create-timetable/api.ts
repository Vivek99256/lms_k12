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

export type SectionOption = { id: number; title: string };
export type StandardOption = { id: number; name: string };
export type DivisionOption = { id: number; name: string };
export type WeekdayOption = { key: string; label: string };
export type PeriodOption = { id: number; title: string; sortOrder: number };
export type SubjectOption = { subjectId: number; displayName: string };
export type TeacherOption = {
  id: number;
  name: string;
  remainingLecture: number | null;
};
export type BatchOption = { id: number; title: string };

export type TimetableEntry = {
  id: number;
  weekDay: string;
  periodId: number;
  periodName: string;
  subjectId: number;
  subjectName: string;
  teacherId: number;
  teacherName: string;
  batchId: number | null;
  batchName: string;
};

export type TimetableGrid = {
  weekdays: WeekdayOption[];
  periods: PeriodOption[];
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  batches: BatchOption[];
  entries: TimetableEntry[];
};

export type ClassSelection = {
  academicSectionId: number;
  standardId: number;
  divisionId: number;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function recordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function messageFrom(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  return readString(payload.message) || fallback;
}

async function request(
  path: string,
  session: SessionContext,
  init?: RequestInit
): Promise<unknown> {
  const query = new URLSearchParams();
  appendCommonParams(query, session);
  const response = await fetch(
    `/api/proxy?path=${encodeURIComponent(path)}&${query.toString()}`,
    {
      cache: "no-store",
      ...init,
      headers: {
        ...createAuthHeaders(session, init?.body ? "application/json" : undefined),
        ...init?.headers,
      },
    }
  );
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(messageFrom(payload, `Request failed (${response.status}).`));
  }
  if (isRecord(payload) && normalizeApiStatus(payload as ApiEnvelope) === "2") {
    throw new Error(messageFrom(payload, "Authentication failed."));
  }
  if (isRecord(payload) && readString(payload.status) === "ERROR") {
    throw new Error(messageFrom(payload, "Request failed."));
  }
  return payload;
}

function bodyWithSession(
  session: SessionContext,
  values: UnknownRecord
): string {
  return JSON.stringify({
    ...values,
    type: "API",
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
  });
}

export function getTimetableSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId || !session.syear) {
    throw new Error(
      "Your login session is missing a token, institute, or academic year."
    );
  }
  return session;
}

export async function listSections(
  session: SessionContext
): Promise<SectionOption[]> {
  const payload = await request("school_setup/ajax_getTimetableSections", session, {
    method: "POST",
    body: bodyWithSession(session, {}),
  });
  const source = isRecord(payload) ? payload.data : [];
  return recordArray(source)
    .map((record) => ({ id: readNumber(record.id), title: readString(record.title) }))
    .filter((section) => section.id > 0);
}

export async function listStandards(
  session: SessionContext,
  academicSectionId: number
): Promise<StandardOption[]> {
  const payload = await request("school_setup/ajax_getTimetableStandards", session, {
    method: "POST",
    body: bodyWithSession(session, { academic_section_id: academicSectionId }),
  });
  const source = isRecord(payload) ? payload.data : [];
  return recordArray(source)
    .map((record) => ({ id: readNumber(record.id), name: readString(record.name) }))
    .filter((standard) => standard.id > 0);
}

export async function listDivisions(
  session: SessionContext,
  standardId: number
): Promise<DivisionOption[]> {
  const payload = await request("school_setup/ajax_getTimetableDivisions", session, {
    method: "POST",
    body: bodyWithSession(session, { standard_id: standardId }),
  });
  const source = isRecord(payload) ? payload.data : [];
  return recordArray(source)
    .map((record) => ({ id: readNumber(record.id), name: readString(record.name) }))
    .filter((division) => division.id > 0);
}

function mapEntry(record: UnknownRecord): TimetableEntry {
  const batchId = record.batch_id == null ? null : readNumber(record.batch_id);
  return {
    id: readNumber(record.id),
    weekDay: readString(record.week_day),
    periodId: readNumber(record.period_id),
    periodName: readString(record.period_name),
    subjectId: readNumber(record.subject_id),
    subjectName: readString(record.subject_name),
    teacherId: readNumber(record.teacher_id),
    teacherName: readString(record.teacher_name).trim(),
    batchId: batchId && batchId > 0 ? batchId : null,
    batchName: readString(record.batch_name),
  };
}

export async function getTimetableGrid(
  session: SessionContext,
  selection: ClassSelection
): Promise<TimetableGrid> {
  const payload = await request("school_setup/ajax_getTimetableGrid", session, {
    method: "POST",
    body: bodyWithSession(session, {
      academic_section_id: selection.academicSectionId,
      standard_id: selection.standardId,
      division_id: selection.divisionId,
    }),
  });

  const record = isRecord(payload) ? payload : {};
  return {
    weekdays: recordArray(record.weekdays).map((weekday) => ({
      key: readString(weekday.key),
      label: readString(weekday.label),
    })),
    periods: recordArray(record.periods).map((period) => ({
      id: readNumber(period.id),
      title: readString(period.title),
      sortOrder: readNumber(period.sort_order),
    })),
    subjects: recordArray(record.subjects).map((subject) => ({
      subjectId: readNumber(subject.subject_id),
      displayName: readString(subject.display_name),
    })),
    teachers: recordArray(record.teachers).map((teacher) => ({
      id: readNumber(teacher.id),
      name: readString(teacher.name).trim(),
      remainingLecture:
        teacher.remaining_lecture == null ? null : readNumber(teacher.remaining_lecture),
    })),
    batches: recordArray(record.batches).map((batch) => ({
      id: readNumber(batch.id),
      title: readString(batch.title),
    })),
    entries: recordArray(record.entries).map(mapEntry).filter((entry) => entry.id > 0),
  };
}

export async function saveTimetableEntry(
  session: SessionContext,
  input: ClassSelection & {
    periodId: number;
    weekDay: string;
    subjectId: number;
    teacherId: number;
    batchId?: number | null;
  }
): Promise<{ message: string; entry: TimetableEntry | null }> {
  const payload = await request("school_setup/ajax_saveTimetableEntry", session, {
    method: "POST",
    body: bodyWithSession(session, {
      academic_section_id: input.academicSectionId,
      standard_id: input.standardId,
      division_id: input.divisionId,
      period_id: input.periodId,
      week_day: input.weekDay,
      subject_id: input.subjectId,
      teacher_id: input.teacherId,
      batch_id: input.batchId ?? null,
    }),
  });

  const record = isRecord(payload) ? payload : {};
  const entry = isRecord(record.data) ? mapEntry(record.data) : null;
  return { message: messageFrom(payload, "Timetable entry saved."), entry };
}

export async function deleteTimetableEntry(
  session: SessionContext,
  id: number
): Promise<string> {
  const payload = await request("school_setup/ajax_deleteTimetableEntry", session, {
    method: "POST",
    body: bodyWithSession(session, { id }),
  });
  return messageFrom(payload, "Timetable entry deleted.");
}
