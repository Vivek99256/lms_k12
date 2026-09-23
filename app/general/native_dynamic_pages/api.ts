import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
} from "@/lib/erp-client";

/**
 * Client for MobileDynamicPageAdminApiController
 * (next_lms_erp/app/Http/Controllers/api/MobileDynamicPageAdminApiController.php,
 * routes/api.php: prefix api/mobile/dynamic-page-admin).
 *
 * Configures the native, server-driven pages the K12 mobile app renders as
 * real widgets for a `render_type = 'native_dynamic'` menu row -- not a
 * WebView. Same request/response shape and `/api/proxy` routing as the
 * sibling mobile_app_rights module, so this app never talks to the ERP
 * cross-origin.
 */

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function records(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function message(value: unknown, fallback: string): string {
  return isRecord(value) ? readString(value.message) || fallback : fallback;
}

async function request(path: string, init?: RequestInit): Promise<RecordValue> {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId || !session.userId) {
    throw new Error("Your login session is incomplete.");
  }

  const params = new URLSearchParams();
  appendCommonParams(params, session);
  params.set("user_id", session.userId);

  const response = await fetch(`/api/proxy?path=${encodeURIComponent(`api/${path}`)}&${params.toString()}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...createAuthHeaders(session, init?.body ? "application/json" : undefined),
      ...init?.headers,
    },
  });

  const payload: unknown = await response.json();
  if (!response.ok || (isRecord(payload) && ["0", "2"].includes(normalizeApiStatus(payload as ApiEnvelope)))) {
    throw new Error(message(payload, `Request failed (${response.status}).`));
  }

  return isRecord(payload) ? payload : {};
}

function body(values: RecordValue) {
  const session = buildSessionContext();
  return JSON.stringify({
    ...values,
    type: "API",
    sub_institute_id: Number(session.subInstituteId),
    user_id: Number(session.userId),
    syear: Number(session.syear),
  });
}

export type DynamicFieldOption = {
  fieldKey: string;
  label: string;
  fieldType: string;
  displayKey: string | null;
};

export type DynamicPageField = {
  id: number;
  fieldKey: string;
  displayKey: string | null;
  label: string;
  fieldType: string;
  sortOrder: number;
  status: string;
};

export type DynamicPage = {
  id: number;
  pageKey: string;
  title: string;
  dataEndpoint: string;
  status: string;
  fields: DynamicPageField[];
};

function fieldOption(row: RecordValue): DynamicFieldOption {
  const displayKey = readString(row.display_key).trim();
  return {
    fieldKey: readString(row.field_key).trim(),
    label: readString(row.label).trim(),
    fieldType: readString(row.field_type).trim(),
    displayKey: displayKey ? displayKey : null,
  };
}

function pageField(row: RecordValue): DynamicPageField {
  const displayKey = readString(row.display_key).trim();
  return {
    id: readNumber(row.id),
    fieldKey: readString(row.field_key).trim(),
    displayKey: displayKey ? displayKey : null,
    label: readString(row.label).trim(),
    fieldType: readString(row.field_type).trim(),
    sortOrder: readNumber(row.sort_order),
    status: readString(row.status).trim(),
  };
}

function page(row: RecordValue): DynamicPage {
  return {
    id: readNumber(row.id),
    pageKey: readString(row.page_key).trim(),
    title: readString(row.title).trim(),
    dataEndpoint: readString(row.data_endpoint).trim(),
    status: readString(row.status).trim(),
    fields: records(row.fields).map(pageField),
  };
}

export async function loadRegistry(): Promise<{
  endpoints: string[];
  fieldsByEndpoint: Record<string, DynamicFieldOption[]>;
}> {
  const payload = await request("mobile/dynamic-page-admin/registry");
  const data = isRecord(payload.data) ? payload.data : {};
  const endpoints = Array.isArray(data.endpoints)
    ? data.endpoints.map((entry) => readString(entry).trim()).filter(Boolean)
    : [];
  const fieldsByEndpoint: Record<string, DynamicFieldOption[]> = {};
  const rawFieldsByEndpoint = isRecord(data.fields_by_endpoint) ? data.fields_by_endpoint : {};
  for (const endpoint of endpoints) {
    fieldsByEndpoint[endpoint] = records(rawFieldsByEndpoint[endpoint]).map(fieldOption);
  }
  return { endpoints, fieldsByEndpoint };
}

export async function loadPages(): Promise<DynamicPage[]> {
  const payload = await request("mobile/dynamic-page-admin/pages");
  return records(payload.data).map(page);
}

export async function createPage(input: {
  pageKey: string;
  title: string;
  dataEndpoint: string;
}): Promise<string> {
  const payload = await request("mobile/dynamic-page-admin/pages", {
    method: "POST",
    body: body({
      page_key: input.pageKey,
      title: input.title,
      data_endpoint: input.dataEndpoint,
    }),
  });
  return message(payload, "Page created.");
}

export async function updatePage(
  id: number,
  input: { title: string; status: "Yes" | "No" }
): Promise<string> {
  const payload = await request(`mobile/dynamic-page-admin/pages/${id}`, {
    method: "POST",
    body: body({ title: input.title, status: input.status }),
  });
  return message(payload, "Page updated.");
}

export async function addField(pageId: number, fieldKey: string): Promise<string> {
  const payload = await request(`mobile/dynamic-page-admin/pages/${pageId}/fields`, {
    method: "POST",
    body: body({ field_key: fieldKey }),
  });
  return message(payload, "Tile added.");
}

export async function updateField(
  fieldId: number,
  input: { label: string; sortOrder: number; status: "Yes" | "No" }
): Promise<string> {
  const payload = await request(`mobile/dynamic-page-admin/fields/${fieldId}`, {
    method: "POST",
    body: body({ label: input.label, sort_order: input.sortOrder, status: input.status }),
  });
  return message(payload, "Tile updated.");
}

export async function deleteField(fieldId: number): Promise<string> {
  const payload = await request(`mobile/dynamic-page-admin/fields/${fieldId}`, {
    method: "DELETE",
  });
  return message(payload, "Tile removed.");
}
