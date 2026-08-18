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
  grades: TransportOption[];
  standards: TransportOption[];
  divisions: TransportOption[];
};

/** Shift fare settings — amount = shift_rate + distance × km_amount. */
export type ShiftRate = {
  id: number;
  shiftRate: number;
  kmAmount: number;
};

/** Vehicle seating, and how many seats the academic year has already taken. */
export type VehicleSeats = {
  vehicleId: number;
  shiftId: number;
  capacity: number;
  reserved: number;
};

/** A stop a vehicle can serve, derived from its route mappings. */
export type VehicleStop = {
  vehicleId: number;
  shiftId: number;
  stopId: number;
  stopName: string;
};

/** One row of the student mapping grid. */
export type StudentMappingRow = {
  studentId: number;
  studentName: string;
  enrollmentNo: string;
  mobile: string;
  address: string;
  standardDivision: string;
  mapped: boolean;
  fromShiftId: string;
  fromBusId: string;
  fromStop: string;
  toShiftId: string;
  toBusId: string;
  toStop: string;
  distance: string;
  amount: string;
};

export type StudentMappingFilters = {
  grade?: string;
  standard?: string;
  division?: string;
  name?: string;
  grno?: string;
  area?: string;
};

export type StudentMappingData = {
  rows: StudentMappingRow[];
  mapped: TransportRecord[];
  shifts: TransportOption[];
  shiftRates: ShiftRate[];
  vehicles: TransportOption[];
  vehicleStops: VehicleStop[];
  seats: VehicleSeats[];
  stops: TransportOption[];
  grades: TransportOption[];
  standards: TransportOption[];
  divisions: TransportOption[];
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
    grades: options(data.grades),
    standards: options(data.standards),
    divisions: options(data.divisions),
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

/* ---------------------------------------------------------------- mapping */

function numberText(value: unknown): string {
  const text = readString(value).trim();
  return text && text !== "0" ? text : "";
}

function mappingRow(record: UnknownRecord): StudentMappingRow {
  return {
    studentId: readNumber(record.student_id),
    studentName: readString(record.student_name).replace(/\s+/g, " ").trim(),
    enrollmentNo: readString(record.enrollment_no),
    mobile: readString(record.mobile),
    address: readString(record.address),
    standardDivision: readString(record.standard_division),
    mapped: readNumber(record.mapping_id) > 0,
    fromShiftId: numberText(record.from_shift_id),
    fromBusId: numberText(record.from_bus_id),
    fromStop: numberText(record.from_stop),
    toShiftId: numberText(record.to_shift_id),
    toBusId: numberText(record.to_bus_id),
    toStop: numberText(record.to_stop),
    distance: readString(record.distance ?? ""),
    amount: readString(record.amount ?? ""),
  };
}

/**
 * The mapping screen in one call: the searched students (with the mapping they
 * already have), plus every lookup the grid needs to cascade shift → vehicle →
 * stop and to price a row without further round trips.
 */
export async function loadStudentMappings(
  session: SessionContext,
  filters?: StudentMappingFilters
): Promise<StudentMappingData> {
  const payload = await request("student-mappings", session, "", undefined, filters as Record<string, string>);
  const data = unwrap(payload);
  const base = normalize(payload);

  return {
    rows: recordArray(data.students).map(mappingRow),
    mapped: base.records,
    shifts: base.shifts,
    shiftRates: recordArray(data.shifts).map((shift) => ({
      id: readNumber(shift.id),
      shiftRate: readNumber(shift.shift_rate),
      kmAmount: readNumber(shift.km_amount),
    })),
    vehicles: base.vehicles,
    vehicleStops: recordArray(data.vehicle_stops).map((stop) => ({
      vehicleId: readNumber(stop.vehicle_id),
      shiftId: readNumber(stop.shift_id),
      stopId: readNumber(stop.stop_id),
      stopName: readString(stop.stop_name),
    })),
    seats: recordArray(data.vehicles).map((vehicle) => {
      const vehicleId = readNumber(vehicle.id);
      const shiftId = readNumber(vehicle.parent_id);
      const reserved = recordArray(data.reserved_seats).find(
        (seat) => readNumber(seat.vehicle_id) === vehicleId && readNumber(seat.shift_id) === shiftId
      );
      return {
        vehicleId,
        shiftId,
        capacity: readNumber(vehicle.sitting_capacity),
        reserved: reserved ? readNumber(reserved.reserved) : 0,
      };
    }),
    stops: base.stops,
    grades: base.grades,
    standards: base.standards,
    divisions: base.divisions,
  };
}

export type StudentMappingPayload = {
  student_id: number;
  student_name: string;
  from_shift_id: number;
  from_bus_id: number;
  from_stop: number;
  to_shift_id: number;
  to_bus_id: number;
  to_stop: number;
  distance: number;
  amount: number;
};

/** Bulk upsert — each row replaces that student's mapping for the year. */
export async function saveStudentMappings(
  session: SessionContext,
  mappings: StudentMappingPayload[]
): Promise<string> {
  const payload = await request("student-mappings", session, "/bulk", {
    method: "POST",
    body: JSON.stringify({
      mappings,
      type: "API",
      sub_institute_id: session.subInstituteId,
      syear: session.syear,
      user_id: session.userId,
    }),
  });
  return messageFrom(payload, "Student mappings saved successfully.");
}

/** Bulk unmap for the current academic year. */
export async function deleteStudentMappings(
  session: SessionContext,
  studentIds: number[]
): Promise<string> {
  const payload = await request("student-mappings", session, "/bulk-delete", {
    method: "POST",
    body: JSON.stringify({
      student_ids: studentIds,
      type: "API",
      sub_institute_id: session.subInstituteId,
      syear: session.syear,
      user_id: session.userId,
    }),
  });
  return messageFrom(payload, "Student mappings removed successfully.");
}
