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

export type ActivityAction =
  | "attendance"
  | "homework_assign"
  | "homework_check"
  | "parent_comm"
  | "student_leave";
export type TeacherDailyRecord = {
  teacherId: number;
  teacherName: string;
  attendance: boolean;
  homeworkAssigned: boolean;
  homeworkChecked: boolean;
  parentCommunication: boolean;
  studentLeave: boolean;
};
export type DetailColumn = { key: string; label: string };
export type DetailResult = {
  columns: DetailColumn[];
  rows: Record<string, unknown>[];
};

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const records = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];
const yes = (value: unknown) => readString(value).toLowerCase() === "yes";

function session(): SessionContext {
  const value = buildSessionContext();
  if (
    !value.token ||
    !value.subInstituteId ||
    !value.userId ||
    !value.syear
  ) {
    throw new Error(
      "Your login session is missing a token, institute, user, or academic year."
    );
  }
  return value;
}

function message(payload: unknown, fallback: string) {
  return isRecord(payload) ? readString(payload.message) || fallback : fallback;
}

async function request(
  path: string,
  init?: RequestInit,
  extraParams?: URLSearchParams
) {
  const currentSession = session();
  const params = extraParams ?? new URLSearchParams();
  appendCommonParams(params, currentSession);
  params.set("user_id", currentSession.userId);
  const response = await fetch(
    `/api/proxy?path=${encodeURIComponent(`api/${path}`)}&${params}`,
    {
      cache: "no-store",
      ...init,
      headers: {
        ...createAuthHeaders(
          currentSession,
          init?.body ? "application/json" : undefined
        ),
        ...init?.headers,
      },
    }
  );
  const payload: unknown = await response.json();
  if (
    !response.ok ||
    (isRecord(payload) &&
      ["0", "2"].includes(normalizeApiStatus(payload as ApiEnvelope)))
  ) {
    throw new Error(message(payload, `Request failed (${response.status}).`));
  }
  return isRecord(payload) ? payload : {};
}

function body(values: UnknownRecord) {
  const currentSession = session();
  return JSON.stringify({
    ...values,
    type: "API",
    sub_institute_id: Number(currentSession.subInstituteId),
    user_id: Number(currentSession.userId),
    syear: Number(currentSession.syear),
  });
}

export async function searchTeacherDaily(input: {
  date: string;
  status: "" | "Y" | "N";
}): Promise<TeacherDailyRecord[]> {
  const payload = await request("teacher-daily-reports/search", {
    method: "POST",
    body: body({ date: input.date, status: input.status || null }),
  });
  const data = isRecord(payload.data) ? payload.data : {};
  return records(data.teachers).map((record) => ({
    teacherId: readNumber(record.teacher_id),
    teacherName: readString(record.teacher_name).trim(),
    attendance: yes(record.student_attendance),
    homeworkAssigned: yes(record.homework_assign),
    homeworkChecked: yes(record.homework_check),
    parentCommunication: yes(record.parent_comm),
    studentLeave: yes(record.student_leave),
  }));
}

export async function loadTeacherDailyDetails(input: {
  teacherId: number;
  date: string;
  action: ActivityAction;
}): Promise<DetailResult> {
  const currentSession = session();
  const params = new URLSearchParams({
    date: input.date,
    action: input.action,
    syear: currentSession.syear,
  });
  const payload = await request(
    `teacher-daily-reports/${input.teacherId}/details`,
    undefined,
    params
  );
  const data = isRecord(payload.data) ? payload.data : {};
  return {
    columns: records(data.columns).map((record) => ({
      key: readString(record.key),
      label: readString(record.label),
    })),
    rows: records(data.rows),
  };
}
