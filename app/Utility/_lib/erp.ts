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

export { readNumber, readString };
export type { SessionContext };

export type UnknownRecord = Record<string, unknown>;

/**
 * Shared transport for the Utility menus.
 *
 * Every Utility screen talks to the legacy Laravel controllers through the
 * existing `/api/proxy` (JSON) and `/api/proxy-file` (multipart) routes with
 * `type=API`, which is how `App\Helpers\is_mobile()` switches those controllers
 * from Blade rendering to a JSON envelope. The envelope is flat — the payload
 * keys sit next to `status`/`message` rather than under `data` — so the helpers
 * below read from the root record.
 */

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/** Laravel returns list payloads either as arrays or as id-keyed objects. */
export function recordArray(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) return Object.values(value).filter(isRecord);
  return [];
}

export type LabelledKey = {
  key: string;
  label: string;
};

/** Reads a Laravel `['key' => 'Label']` associative array into an ordered list. */
export function labelledKeys(value: unknown): LabelledKey[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([key, label]) => ({
    key,
    label: readString(label) || key,
  }));
}

export function messageFrom(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  return readString(payload.message).trim() || fallback;
}

export function errorMessage(value: unknown, fallback: string): string {
  return value instanceof Error && value.message ? value.message : fallback;
}

export function requireSession(): SessionContext {
  const current = buildSessionContext();
  if (!current.token || !current.subInstituteId || !current.syear || !current.userId) {
    throw new Error(
      "Your login session is missing a token, institute, academic year, or user."
    );
  }
  return current;
}

export type QueryValue = string | number | boolean | Array<string | number> | null | undefined;
export type QueryInput = Record<string, QueryValue>;

function applyQuery(params: URLSearchParams, query?: QueryInput) {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      // Laravel reads repeated `name[]` keys as an array.
      for (const entry of value) params.append(`${key}[]`, String(entry));
      continue;
    }
    params.set(key, String(value));
  }
}

/**
 * Builds the query string every legacy controller expects: `type=API` plus the
 * institute / academic-year / user context that the Laravel session would
 * otherwise supply.
 */
export function buildQuery(session: SessionContext, query?: QueryInput): URLSearchParams {
  const params = new URLSearchParams();
  appendCommonParams(params, session);
  params.set("user_id", session.userId);
  if (session.termId) params.set("term_id", session.termId);
  applyQuery(params, query);
  return params;
}

/** The context fields the controllers read from the request body on writes. */
export function contextBody(session: SessionContext, values: UnknownRecord = {}): UnknownRecord {
  return {
    type: "API",
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
    ...(session.termId ? { term_id: session.termId } : {}),
    ...values,
  };
}

type RequestOptions = {
  method?: "GET" | "POST";
  query?: QueryInput;
  body?: UnknownRecord;
  session?: SessionContext;
};

function failureFrom(payload: unknown, status: number): string {
  if (isRecord(payload)) {
    // Laravel validation failures come back as { errors: { field: [msg] } }.
    const errors = payload.errors;
    if (isRecord(errors)) {
      const first = Object.values(errors).find((entry) => Array.isArray(entry) && entry.length > 0);
      if (Array.isArray(first)) return readString(first[0]);
    }
    const message = readString(payload.message).trim();
    if (message) return message;
  }
  if (status === 419) {
    return "The ERP rejected the request (CSRF token mismatch). This Utility endpoint is not exposed as a stateless API yet.";
  }
  return `Request failed (${status}).`;
}

export async function utilityRequest(
  path: string,
  options: RequestOptions = {}
): Promise<UnknownRecord> {
  const session = options.session ?? requireSession();
  const params = buildQuery(session, options.query);
  const method = options.method ?? "GET";
  const body = options.body ? JSON.stringify(contextBody(session, options.body)) : undefined;

  const response = await fetch(
    `/api/proxy?path=${encodeURIComponent(path)}&${params.toString()}`,
    {
      method,
      cache: "no-store",
      headers: createAuthHeaders(session, body ? "application/json" : undefined),
      ...(body ? { body } : {}),
    }
  );

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(failureFrom(payload, response.status));
  }
  // is_mobile() reports business failures with status 0 (and the JWT guards use 2).
  if (isRecord(payload) && ["0", "2"].includes(normalizeApiStatus(payload as ApiEnvelope))) {
    throw new Error(messageFrom(payload, "The request could not be completed."));
  }
  return isRecord(payload) ? payload : {};
}

/** Multipart writes (Excel imports) go through the file proxy, which streams FormData. */
export async function utilityUpload(
  path: string,
  formData: FormData,
  query?: QueryInput
): Promise<UnknownRecord> {
  const session = requireSession();
  const params = buildQuery(session, query);
  formData.set("type", "API");
  formData.set("sub_institute_id", session.subInstituteId);
  formData.set("syear", session.syear);
  formData.set("user_id", session.userId);

  const response = await fetch(
    `/api/proxy-file?path=${encodeURIComponent(path)}&${params.toString()}`,
    {
      method: "POST",
      cache: "no-store",
      headers: createAuthHeaders(session),
      body: formData,
    }
  );

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    throw new Error(failureFrom(payload, response.status));
  }
  if (isRecord(payload) && normalizeApiStatus(payload as ApiEnvelope) === "0") {
    throw new Error(messageFrom(payload, "The upload could not be completed."));
  }
  return isRecord(payload) ? payload : {};
}
