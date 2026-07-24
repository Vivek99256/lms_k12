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

export type TransportationModule =
  | "student-mappings" | "drivers" | "vehicles" | "routes" | "stops" | "rates"
  | "route-buses" | "route-stops" | "shifts" | "van-wise-report" | "van-summary-report";

export type TransportOption = {
  id: number;
  label: string;
  parentId?: number;
};

export type TransportRecord = {
  id: number;
  values: Record<string, string | number | boolean | null>;
};

export type TransportationData = {
  records: TransportRecord[];
  drivers: TransportOption[];
  conductors: TransportOption[];
  vehicles: TransportOption[];
  vehicleTypes: TransportOption[];
  routes: TransportOption[];
  stops: TransportOption[];
  shifts: TransportOption[];
  students: TransportOption[];
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function recordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function messageFrom(value: unknown, fallback: string): string {
  return isRecord(value) ? readString(value.message) || fallback : fallback;
}

function unwrap(value: unknown): UnknownRecord {
  if (!isRecord(value)) return {};
  return isRecord(value.data) ? value.data : value;
}

function options(value: unknown): TransportOption[] {
  const unique = new Map<string, TransportOption>();
  recordArray(value).forEach((item) => {
    const id = readNumber(item.id);
    const parentId = readNumber(item.parent_id);
    const label =
      readString(item.name || item.title || item.shift_title || item.route_name || item.stop_name) ||
      readString(item.enrollment_no);
    const key = `${id}:${parentId}`;
    if (id > 0 && label && !unique.has(key)) {
      unique.set(key, { id, label, ...(parentId ? { parentId } : {}) });
    }
  });
  return [...unique.values()];
}

function normalize(value: unknown): TransportationData {
  const data = unwrap(value);
  return {
    records: recordArray(data.records).map((record) => {
      const values: TransportRecord["values"] = {};
      Object.entries(record).forEach(([key, item]) => {
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null) {
          values[key] = item;
        }
      });
      return { id: readNumber(record.id || record.student_id || record.vehicle_id), values };
    }),
    drivers: options(data.drivers),
    conductors: options(data.conductors),
    vehicles: options(data.vehicles),
    vehicleTypes: options(data.vehicle_types),
    routes: options(data.routes),
    stops: options(data.stops),
    shifts: options(data.shifts),
    students: options(data.students),
  };
}

export function getTransportationSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId || !session.syear || !session.userId) {
    throw new Error("Your login session is missing transport API credentials.");
  }
  return session;
}

async function request(
  module: TransportationModule,
  session: SessionContext,
  suffix = "",
  init?: RequestInit,
  filters?: Record<string, string>
): Promise<unknown> {
  const params = new URLSearchParams();
  appendCommonParams(params, session);
  params.set("user_id", session.userId);
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const response = await fetch(`${session.baseUrl}/api/transportation-setup/${module}${suffix}?${params}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...createAuthHeaders(session, init?.body ? "application/json" : undefined),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) throw new Error(messageFrom(payload, `Request failed (${response.status}).`));
  if (isRecord(payload) && normalizeApiStatus(payload as ApiEnvelope) === "2") {
    throw new Error(messageFrom(payload, "Authentication failed."));
  }
  return payload;
}

export async function loadTransportation(
  module: TransportationModule,
  session: SessionContext,
  filters?: Record<string, string>
): Promise<TransportationData> {
  return normalize(await request(module, session, "", undefined, filters));
}

export async function saveTransportation(
  module: TransportationModule,
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
    }),
  });
  return messageFrom(payload, id ? "Record updated successfully." : "Record added successfully.");
}

export async function deleteTransportation(
  module: TransportationModule,
  session: SessionContext,
  id: number
): Promise<string> {
  return messageFrom(await request(module, session, `/${id}`, { method: "DELETE" }), "Record deleted successfully.");
}
