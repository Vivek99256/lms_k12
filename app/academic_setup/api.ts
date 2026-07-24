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

export type AcademicSetupModule =
  | "standard-division-mapping"
  | "subject-standard-mapping"
  | "periods"
  | "batches"
  | "division-capacities"
  | "subjects";

export type AcademicOption = {
  id: number;
  label: string;
  parentId?: number;
};

export type AcademicRecord = {
  id: number;
  values: Record<string, string | number | boolean | null>;
};

export type AcademicSetupData = {
  records: AcademicRecord[];
  grades: AcademicOption[];
  standards: AcademicOption[];
  divisions: AcademicOption[];
  subjects: AcademicOption[];
  academicYears: AcademicOption[];
  categories: AcademicOption[];
  mappings: Record<string, number[]>;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function records(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function messageFrom(value: unknown, fallback: string): string {
  return isRecord(value) ? readString(value.message) || fallback : fallback;
}

function optionFrom(
  value: UnknownRecord,
  labelKeys: string[],
  parentKeys: string[] = []
): AcademicOption {
  const label = labelKeys.map((key) => readString(value[key])).find(Boolean) || "";
  const parentId = parentKeys.map((key) => readNumber(value[key])).find(Boolean);
  return {
    id: readNumber(value.id ?? value.division_id ?? value.subject_id),
    label,
    ...(parentId ? { parentId } : {}),
  };
}

function options(
  value: unknown,
  labelKeys: string[],
  parentKeys: string[] = []
): AcademicOption[] {
  const unique = new Map<string, AcademicOption>();
  records(value).forEach((item) => {
    const option = optionFrom(item, labelKeys, parentKeys);
    const key = `${option.id}:${option.parentId ?? 0}`;
    if (option.id > 0 && option.label && !unique.has(key)) {
      unique.set(key, option);
    }
  });
  return [...unique.values()];
}

function normalizeValues(value: UnknownRecord): AcademicRecord {
  const normalized: AcademicRecord["values"] = {};
  Object.entries(value).forEach(([key, item]) => {
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean" ||
      item === null
    ) {
      normalized[key] = item;
    }
  });
  return { id: readNumber(value.id), values: normalized };
}

function unwrap(payload: unknown): UnknownRecord {
  if (!isRecord(payload)) return {};
  return isRecord(payload.data) ? payload.data : payload;
}

function normalizeData(payload: unknown): AcademicSetupData {
  const data = unwrap(payload);
  const rawRecords = data.records ?? data.data ?? [];
  const rawMappings = isRecord(data.mappings ?? data.std_div_map_data)
    ? (data.mappings ?? data.std_div_map_data) as UnknownRecord
    : {};
  const mappings: Record<string, number[]> = {};
  Object.entries(rawMappings).forEach(([key, value]) => {
    mappings[key] = Array.isArray(value)
      ? [...new Set(value.map(readNumber).filter(Boolean))]
      : [];
  });

  return {
    records: records(rawRecords).map(normalizeValues),
    grades: options(data.grades ?? data.grade_data, ["title", "name", "short_name"]),
    standards: options(data.standards ?? data.std_data ?? data.standard_data, ["name", "title", "short_name"], ["grade_id"]),
    divisions: options(data.divisions ?? data.div_data ?? data.division_data, ["name", "title"], ["standard_id"]),
    subjects: options(data.subjects ?? data.sub_data, ["subject_name", "display_name", "name"]),
    academicYears: options(data.academic_years ?? data.academic_year_data, ["title", "syear", "name"]),
    categories: options(data.categories ?? data.content_category, ["category_name", "name", "title"]),
    mappings,
  };
}

export function getAcademicSetupSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId || !session.syear) {
    throw new Error("Your login session is missing a token, institute, or academic year.");
  }
  return session;
}

async function request(
  module: AcademicSetupModule,
  session: SessionContext,
  path = "",
  init?: RequestInit
): Promise<unknown> {
  const params = new URLSearchParams();
  appendCommonParams(params, session);
  params.set("user_id", session.userId);
  if (session.termId) params.set("term_id", session.termId);
  const endpoint = `${session.baseUrl}/api/academic-setup/${module}${path}?${params}`;
  const response = await fetch(endpoint, {
    cache: "no-store",
    ...init,
    headers: {
      ...createAuthHeaders(session, init?.body ? "application/json" : undefined),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Backend API required for this academic setup menu.");
    }
    throw new Error(messageFrom(payload, `Request failed (${response.status}).`));
  }
  if (isRecord(payload) && normalizeApiStatus(payload as ApiEnvelope) === "2") {
    throw new Error(messageFrom(payload, "Authentication failed."));
  }
  return payload;
}

export async function loadAcademicSetup(
  module: AcademicSetupModule,
  session: SessionContext
): Promise<AcademicSetupData> {
  return normalizeData(await request(module, session));
}

export async function saveAcademicSetup(
  module: AcademicSetupModule,
  session: SessionContext,
  values: Record<string, unknown>,
  id?: number
): Promise<string> {
  const payload = await request(module, session, id ? `/${id}` : "", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify({
      ...values,
      type: "API",
      sub_institute_id: session.subInstituteId,
      syear: session.syear,
      user_id: session.userId,
      ...(session.termId ? { term_id: session.termId } : {}),
    }),
  });
  return messageFrom(payload, id ? "Record updated successfully." : "Record added successfully.");
}

export async function deleteAcademicSetup(
  module: AcademicSetupModule,
  session: SessionContext,
  id: number
): Promise<string> {
  const payload = await request(module, session, `/${id}`, { method: "DELETE" });
  return messageFrom(payload, "Record deleted successfully.");
}
