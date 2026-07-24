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

export type TeacherOption = {
  id: number;
  teacherName: string;
};

export type ProxyRecord = {
  id: number;
  proxyDate: string;
  standardName: string;
  divisionName: string;
  teacherName: string;
  proxyTeacherName: string;
  proxyTeacherId: number;
  periodName: string;
  subjectName: string;
};

export type AvailableLecture = {
  key: string;
  date: string;
  timetableId: number;
  weekDay: string;
  standardName: string;
  divisionName: string;
  batchName: string;
  periodName: string;
  subjectName: string;
  teachers: TeacherOption[];
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function recordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function unwrapData(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;
  if ("data" in payload) return payload.data;
  return payload;
}

function messageFrom(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  return readString(payload.message) || fallback;
}

function teacherFrom(record: UnknownRecord): TeacherOption {
  return {
    id: readNumber(record.id),
    teacherName:
      readString(record.teacher_name).trim() ||
      [record.first_name, record.middle_name, record.last_name]
        .map(readString)
        .filter(Boolean)
        .join(" "),
  };
}

function mapTeachers(value: unknown): TeacherOption[] {
  return recordArray(value)
    .map(teacherFrom)
    .filter((teacher) => teacher.id > 0 && teacher.teacherName);
}

function mapProxyRecord(record: UnknownRecord): ProxyRecord {
  return {
    id: readNumber(record.id),
    proxyDate: readString(record.proxy_date),
    standardName: readString(record.standard_name),
    divisionName: readString(record.division_name),
    teacherName: readString(record.teacher_name).trim(),
    proxyTeacherName: readString(record.proxy_teacher_name).trim(),
    proxyTeacherId: readNumber(record.proxy_teacher_id),
    periodName: readString(record.period_name),
    subjectName: readString(record.sub_name || record.subject_name),
  };
}

async function request(
  path: string,
  session: SessionContext,
  init?: RequestInit,
  params?: URLSearchParams
): Promise<unknown> {
  const query = params ?? new URLSearchParams();
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
  if (
    isRecord(payload) &&
    normalizeApiStatus(payload as ApiEnvelope) === "2"
  ) {
    throw new Error(messageFrom(payload, "Authentication failed."));
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

export function getProxySession(): SessionContext {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId || !session.syear) {
    throw new Error(
      "Your login session is missing a token, institute, or academic year."
    );
  }
  return session;
}

export async function listProxies(
  session: SessionContext
): Promise<ProxyRecord[]> {
  const payload = await request("proxy_master", session);
  return recordArray(unwrapData(payload))
    .map(mapProxyRecord)
    .filter((record) => record.id > 0);
}

export async function listTeachers(
  session: SessionContext
): Promise<TeacherOption[]> {
  const payload = await request("proxy_master/create", session);
  const source = unwrapData(payload);
  if (isRecord(source)) return mapTeachers(source.teacher_data);
  if (isRecord(payload)) return mapTeachers(payload.teacher_data);
  return [];
}

export async function findAvailableLectures(
  session: SessionContext,
  input: { fromDate: string; toDate: string; absentTeacherId: number }
): Promise<AvailableLecture[]> {
  const payload = await request("ajax_getproxyperiod", session, {
    method: "POST",
    body: bodyWithSession(session, {
      from_date: input.fromDate,
      to_date: input.toDate,
      proxy_teacher_id: input.absentTeacherId,
    }),
  });
  const source = unwrapData(payload);
  const proxyData = isRecord(source)
    ? source.proxydata
    : isRecord(payload)
      ? payload.proxydata
      : [];

  return recordArray(proxyData).map((record) => {
    const date = readString(record.date);
    const timetableId = readNumber(record.timetable_id);
    return {
      key: `${date}/${timetableId}`,
      date,
      timetableId,
      weekDay: readString(record.week_day),
      standardName: readString(record.standard_name),
      divisionName: readString(record.division_name),
      batchName: readString(record.batch_name),
      periodName: readString(record.period_name),
      subjectName: readString(record.subject_name),
      teachers: mapTeachers(record.teacher_data),
    };
  });
}

export async function createProxies(
  session: SessionContext,
  selections: Array<{ key: string; teacherId: number }>
): Promise<string> {
  const proxyId = Object.fromEntries(
    selections.map((selection) => [selection.key, "1"])
  );
  const teacherId = Object.fromEntries(
    selections.map((selection) => [selection.key, selection.teacherId])
  );
  const payload = await request("proxy_master", session, {
    method: "POST",
    body: bodyWithSession(session, {
      proxy_id: proxyId,
      teacher_id: teacherId,
    }),
  });
  return messageFrom(payload, "Proxy assignments added.");
}

export async function updateProxy(
  session: SessionContext,
  id: number,
  teacherId: number
): Promise<string> {
  const payload = await request(`proxy_master/${id}`, session, {
    method: "POST",
    body: bodyWithSession(session, {
      _method: "PUT",
      proxy_teacher_id: teacherId,
    }),
  });
  return messageFrom(payload, "Proxy assignment updated.");
}

export async function deleteProxy(
  session: SessionContext,
  id: number
): Promise<string> {
  const payload = await request(`proxy_master/${id}`, session, {
    method: "POST",
    body: bodyWithSession(session, { _method: "DELETE" }),
  });
  return messageFrom(payload, "Proxy assignment deleted.");
}
