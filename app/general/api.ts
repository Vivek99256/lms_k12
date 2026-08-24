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

export type GeneralModule = "templates" | "forms" | "user-profiles" | "implementations" | "bulk-upload";
export type GeneralOption = { id: number; label: string; parentId?: number };
export type GeneralRecord = { id: number; values: Record<string, string | number | boolean | null> };
export type GeneralData = {
  records: GeneralRecord[];
  profiles: GeneralOption[];
  grades: GeneralOption[];
  standards: GeneralOption[];
  subjects: GeneralOption[];
};
<<<<<<< HEAD
=======
export type TemplateTag = { key: string; label: string };
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

type UnknownRecord = Record<string, unknown>;
function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function array(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}
function message(value: unknown, fallback: string): string {
  return isRecord(value) ? readString(value.message) || fallback : fallback;
}
function unwrap(value: unknown): UnknownRecord {
  return isRecord(value) && isRecord(value.data) ? value.data : isRecord(value) ? value : {};
}
function options(value: unknown): GeneralOption[] {
  const result = new Map<string, GeneralOption>();
  array(value).forEach((item) => {
    const id = readNumber(item.id ?? item.subject_id);
    const label = readString(item.name ?? item.title ?? item.subject_name ?? item.display_name);
    const parentId = readNumber(item.grade_id ?? item.standard_id);
    const key = `${id}:${parentId}`;
    if (id && label && !result.has(key)) result.set(key, { id, label, ...(parentId ? { parentId } : {}) });
  });
  return [...result.values()];
}
function normalize(value: unknown): GeneralData {
  const data = unwrap(value);
  return {
    records: array(data.records).map((record) => {
      const values: GeneralRecord["values"] = {};
      Object.entries(record).forEach(([key, item]) => {
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null) values[key] = item;
      });
      return { id: readNumber(record.id), values };
    }),
    profiles: options(data.profiles),
    grades: options(data.grades),
    standards: options(data.standards),
    subjects: options(data.subjects),
  };
}

export function getGeneralSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId || !session.syear || !session.userId) {
    throw new Error("Your login session is missing General module credentials.");
  }
  return session;
}

async function request(module: GeneralModule, session: SessionContext, suffix = "", init?: RequestInit): Promise<unknown> {
  const params = new URLSearchParams();
  appendCommonParams(params, session);
  params.set("user_id", session.userId);
  if (session.termId) params.set("term_id", session.termId);
  const response = await fetch(`${session.baseUrl}/api/general-setup/${module}${suffix}?${params}`, {
    cache: "no-store", ...init,
    headers: { ...createAuthHeaders(session, init?.body ? "application/json" : undefined), ...init?.headers },
  });
  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    if (response.status === 404) throw new Error("Backend API required for this General menu.");
    throw new Error(message(payload, `Request failed (${response.status}).`));
  }
  if (isRecord(payload) && normalizeApiStatus(payload as ApiEnvelope) === "2") throw new Error(message(payload, "Authentication failed."));
  return payload;
}

export async function loadGeneral(module: GeneralModule, session: SessionContext): Promise<GeneralData> {
  return normalize(await request(module, session));
}
<<<<<<< HEAD
=======
export async function loadTemplateTags(session: SessionContext): Promise<TemplateTag[]> {
  const payload = unwrap(await request("templates", session, "/tags"));
  const tags = isRecord(payload.tags) ? payload.tags : {};
  return Object.entries(tags).filter(([, label]) => typeof label === "string").map(([key, label]) => ({ key, label: String(label) }));
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
export async function saveGeneral(module: GeneralModule, session: SessionContext, values: Record<string, unknown>, id?: number): Promise<string> {
  const payload = await request(module, session, id ? `/${id}` : "", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify({ ...values, type: "API", sub_institute_id: session.subInstituteId, syear: session.syear, user_id: session.userId }),
  });
  return message(payload, id ? "Record updated successfully." : "Record created successfully.");
}
export async function deleteGeneral(module: GeneralModule, session: SessionContext, id: number): Promise<string> {
  return message(await request(module, session, `/${id}`, { method: "DELETE" }), "Record deleted successfully.");
}
