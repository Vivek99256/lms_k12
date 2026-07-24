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

export type UserOption = { id: number; name: string };
export type UserLogRecord = {
  id: number;
  url: string;
  module: string;
  action: string;
  createdAt: string;
  userName: string;
};

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const records = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

function session(): SessionContext {
  const value = buildSessionContext();
  if (!value.token || !value.subInstituteId || !value.userId) {
    throw new Error("Your login session is incomplete.");
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

export async function loadUserLogUsers(): Promise<UserOption[]> {
  const payload = await request("user-logs/bootstrap");
  const data = isRecord(payload.data) ? payload.data : {};
  return records(data.users).map((record) => ({
    id: readNumber(record.id),
    name: readString(record.name).trim(),
  }));
}

export async function searchUserLogs(input: {
  fromDate: string;
  toDate: string;
  selectedUserId: number | null;
}): Promise<UserLogRecord[]> {
  const payload = await request("user-logs/search", {
    method: "POST",
    body: body({
      from_date: input.fromDate,
      to_date: input.toDate,
      selected_user_id: input.selectedUserId,
    }),
  });
  const data = isRecord(payload.data) ? payload.data : {};
  return records(data.logs).map((record) => ({
    id: readNumber(record.id),
    url: readString(record.url),
    module: readString(record.module),
    action: readString(record.action),
    createdAt: readString(record.created_at),
    userName: readString(record.user_name).trim(),
  }));
}
