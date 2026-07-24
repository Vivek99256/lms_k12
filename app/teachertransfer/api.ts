import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
} from "@/lib/erp-client";

export type TransferTeacher = {
  id: number;
  name: string;
  timetableCount: number;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function messageFrom(value: unknown, fallback: string) {
  return isRecord(value) ? readString(value.message) || fallback : fallback;
}

function session() {
  const current = buildSessionContext();
  if (!current.token || !current.subInstituteId || !current.syear || !current.userId) {
    throw new Error("Your login session is missing a token, institute, academic year, or user.");
  }
  return current;
}

async function request(init?: RequestInit): Promise<UnknownRecord> {
  const current = session();
  const params = new URLSearchParams();
  appendCommonParams(params, current);
  params.set("user_id", current.userId);
  const response = await fetch(`/api/proxy?path=${encodeURIComponent("api/teacher-transfer")}&${params}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...createAuthHeaders(current, init?.body ? "application/json" : undefined),
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json();
  if (
    !response.ok ||
    (isRecord(payload) && ["0", "2"].includes(normalizeApiStatus(payload as ApiEnvelope)))
  ) {
    throw new Error(messageFrom(payload, `Request failed (${response.status}).`));
  }
  return isRecord(payload) ? payload : {};
}

export async function loadTransferTeachers(): Promise<TransferTeacher[]> {
  const payload = await request();
  const data = isRecord(payload.data) ? payload.data : {};
  const rows = Array.isArray(data.teachers) ? data.teachers.filter(isRecord) : [];
  return rows.map((row) => ({
    id: readNumber(row.id),
    name: readString(row.name).trim(),
    timetableCount: readNumber(row.timetable_count),
  }));
}

export async function transferTeacher(leftTeacherId: number, newTeacherId: number) {
  const current = session();
  const payload = await request({
    method: "POST",
    body: JSON.stringify({
      type: "API",
      sub_institute_id: Number(current.subInstituteId),
      syear: Number(current.syear),
      user_id: Number(current.userId),
      left_teacher_id: leftTeacherId,
      new_teacher_id: newTeacherId,
    }),
  });
  const data = isRecord(payload.data) ? payload.data : {};
  return {
    message: messageFrom(payload, "Teacher transferred successfully."),
    affectedRows: readNumber(data.affected_rows),
  };
}
