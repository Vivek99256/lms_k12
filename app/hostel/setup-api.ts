"use client";

import { buildSessionContext, createAuthHeaders, readNumber, readString, type SessionContext } from "@/lib/erp-client";

type UnknownRecord = Record<string, unknown>;

export type HostelModule =
  | "type-master"
  | "room-type-master"
  | "admission-category-master"
  | "hostel-master"
  | "building-master"
  | "floor-master"
  | "room-master"
  | "hostel-room-allocation"
  | "hostel-report"
  | "available-room-report";

export type HostelPermissionSet = {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  admin: boolean;
};

export type HostelOption = {
  id: number;
  label: string;
  parentId?: number;
  extra?: Record<string, string | number>;
};

export type HostelCustomField = {
  id: number;
  field_name: string;
  field_label: string;
  field_type: string;
  field_message: string;
  required: number;
  options: Array<{ label: string; value: string }>;
};

export type HostelRecord = {
  id: number;
  values: Record<string, string | number | boolean | null>;
};

export type HostelModuleData = {
  records: HostelRecord[];
  permissions: HostelPermissionSet;
  hostelTypes: HostelOption[];
  roomTypes: HostelOption[];
  admissionCategories: HostelOption[];
  hostels: HostelOption[];
  buildings: HostelOption[];
  floors: HostelOption[];
  rooms: HostelOption[];
  profiles: HostelOption[];
  grades: HostelOption[];
  standards: HostelOption[];
  divisions: HostelOption[];
  students: HostelOption[];
  customFields: HostelCustomField[];
  availableRooms: HostelRecord[];
  selectedProfile: string;
};

export type HostelSetupSession = SessionContext & {
  userProfileId: string;
  userProfileName: string;
  clientId: string;
};

type ApiResult = {
  status?: number | string;
  status_code?: number | string;
  message?: string;
  data?: unknown;
  errors?: unknown;
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toRecords(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function getObject(value: unknown): UnknownRecord {
  if (isRecord(value) && isRecord(value.data)) return value.data;
  return isRecord(value) ? value : {};
}

function messageFrom(payload: unknown, fallback: string): string {
  return isRecord(payload) ? readString(payload.message) || fallback : fallback;
}

function statusFrom(payload: unknown): string {
  return isRecord(payload) ? String(payload.status ?? payload.status_code ?? "") : "";
}

function normalizeRecord(row: UnknownRecord): HostelRecord {
  const values: HostelRecord["values"] = {};
  Object.entries(row).forEach(([key, value]) => {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      values[key] = value;
    }
  });
  return { id: readNumber(row.id), values };
}

function normalizeOptionList(value: unknown, labelKeys: string[], parentKeys: string[] = []): HostelOption[] {
  return toRecords(value)
    .map((item) => {
      const id = readNumber(item.id);
      const label = labelKeys.map((key) => readString(item[key])).find(Boolean) || "";
      const parentId = parentKeys.map((key) => readNumber(item[key])).find((entry) => entry > 0);
      const extra: Record<string, string | number> = {};
      Object.entries(item).forEach(([key, entry]) => {
        if (typeof entry === "string" || typeof entry === "number") extra[key] = entry;
      });
      return id && label ? { id, label, ...(parentId ? { parentId } : {}), extra } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function normalizeCustomFields(value: unknown): HostelCustomField[] {
  return toRecords(value).map((field) => ({
    id: readNumber(field.id),
    field_name: readString(field.field_name),
    field_label: readString(field.field_label),
    field_type: readString(field.field_type),
    field_message: readString(field.field_message),
    required: readNumber(field.required),
    options: Array.isArray(field.options)
      ? field.options
          .filter(isRecord)
          .map((option) => ({ label: readString(option.label), value: readString(option.value) }))
          .filter((option) => option.label || option.value)
      : [],
  }));
}

export function getHostelSetupSession(): HostelSetupSession {
  const session = buildSessionContext();
  if (typeof window === "undefined") {
    throw new Error("Hostel session is only available in the browser.");
  }
  const userData = JSON.parse(localStorage.getItem("userData") || "{}") as UnknownRecord;
  const menuContext = JSON.parse(localStorage.getItem("menuContext") || "{}") as UnknownRecord;

  const result = {
    ...session,
    userProfileId: readString(userData.user_profile_id ?? menuContext.user_profile_id),
    userProfileName: readString(userData.user_profile_name ?? menuContext.user_profile_name),
    clientId: readString(userData.client_id ?? menuContext.client_id),
  };

  if (!result.token || !result.subInstituteId || !result.syear || !result.userId) {
    throw new Error("Your login session is missing hostel API credentials. Please sign in again before opening this module.");
  }

  return result;
}

async function request<T>(module: HostelModule, session: HostelSetupSession, method: "GET" | "POST" | "PUT" | "DELETE", body?: UnknownRecord, id?: number, query?: URLSearchParams): Promise<T> {
  const params = query ?? new URLSearchParams();
  params.set("path", `api/hostel-setup/${module}${id ? `/${id}` : ""}`);
  params.set("type", "API");
  params.set("sub_institute_id", session.subInstituteId);
  params.set("syear", session.syear);
  params.set("user_id", session.userId);
  if (session.termId) params.set("term_id", session.termId);
  if (session.userProfileId) params.set("user_profile_id", session.userProfileId);
  if (session.userProfileName) params.set("user_profile_name", session.userProfileName);
  if (session.clientId) params.set("client_id", session.clientId);

  const response = await fetch(`/api/proxy?${params.toString()}`, {
    method,
    headers: {
      ...createAuthHeaders(session, method === "GET" || method === "DELETE" ? undefined : "application/json"),
    },
    body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify({
      type: "API",
      sub_institute_id: session.subInstituteId,
      syear: session.syear,
      user_id: session.userId,
      term_id: session.termId,
      user_profile_id: session.userProfileId,
      user_profile_name: session.userProfileName,
      client_id: session.clientId,
      ...body,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as ApiResult;
  if (!response.ok) {
    throw new Error(messageFrom(payload, `Request failed (${response.status}).`));
  }
  if (statusFrom(payload) === "2") {
    throw new Error(messageFrom(payload, "Authentication failed."));
  }
  return payload as T;
}

export async function loadHostelModule(module: HostelModule, session: HostelSetupSession, filters?: Record<string, string>): Promise<HostelModuleData> {
  const query = new URLSearchParams();
  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });

  const payload = await request<ApiResult>(module, session, "GET", undefined, undefined, query);
  const data = getObject(payload);

  return {
    records: toRecords(data.records).map(normalizeRecord),
    permissions: {
      view: Boolean((data.permissions as HostelPermissionSet | undefined)?.view),
      add: Boolean((data.permissions as HostelPermissionSet | undefined)?.add),
      edit: Boolean((data.permissions as HostelPermissionSet | undefined)?.edit),
      delete: Boolean((data.permissions as HostelPermissionSet | undefined)?.delete),
      admin: Boolean((data.permissions as HostelPermissionSet | undefined)?.admin),
    },
    hostelTypes: normalizeOptionList(data.hostel_types, ["hostel_type"]),
    roomTypes: normalizeOptionList(data.room_types, ["room_type"]),
    admissionCategories: normalizeOptionList(data.admission_categories, ["title"]),
    hostels: normalizeOptionList(data.hostels, ["name"], ["hostel_type_id"]),
    buildings: normalizeOptionList(data.buildings, ["building_name"], ["hostel_id"]),
    floors: normalizeOptionList(data.floors, ["floor_name"], ["building_id"]),
    rooms: normalizeOptionList(data.rooms, ["room_name"], ["floor_id"]),
    profiles: normalizeOptionList(data.profiles, ["name"]),
    grades: normalizeOptionList(data.grades, ["title"]),
    standards: normalizeOptionList(data.standards, ["name"], ["grade_id"]),
    divisions: normalizeOptionList(data.divisions, ["name"]),
    students: normalizeOptionList(data.students, ["student_name"], ["standard_id"]),
    customFields: normalizeCustomFields(data.custom_fields),
    availableRooms: toRecords(data.available_rooms).map(normalizeRecord),
    selectedProfile: readString((data.selected_profile as UnknownRecord | undefined)?.name),
  };
}

export async function saveHostelModule(module: HostelModule, session: HostelSetupSession, values: UnknownRecord, id?: number): Promise<string> {
  const payload = await request<ApiResult>(module, session, id ? "PUT" : "POST", values, id);
  return messageFrom(payload, id ? "Updated successfully." : "Saved successfully.");
}

export async function deleteHostelModule(module: HostelModule, session: HostelSetupSession, id: number): Promise<string> {
  const payload = await request<ApiResult>(module, session, "DELETE", undefined, id);
  return messageFrom(payload, "Deleted successfully.");
}
