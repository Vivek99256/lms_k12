"use client";

import { buildSessionContext, createAuthHeaders, readNumber, readString, type SessionContext } from "@/lib/erp-client";

type UnknownRecord = Record<string, unknown>;

export type HostelSession = SessionContext;

export type HostelOption = {
  id: string;
  label: string;
};

export type VisitorRecord = {
  id: string;
  appointmentType: string;
  visitorTypeName: string;
  name: string;
  contact: string;
  email: string;
  comingFrom: string;
  toMeetName: string;
  relation: string;
  purpose: string;
  visitorIdCard: string;
  meetDate: string;
  inTime: string;
  outTime: string;
  createdBy: string;
  photoUrl: string;
};

export type VisitorFilters = {
  fromDate: string;
  toDate: string;
};

export type VisitorFormState = {
  appointment_type: string;
  visitor_type: string;
  name: string;
  contact: string;
  email: string;
  coming_from: string;
  to_meet: string;
  relation: string;
  purpose: string;
  visitor_idcard: string;
  meet_date: string;
  in_time: string;
  visitor_photo: File | null;
};

export type VisitorFormOptions = {
  visitorTypes: HostelOption[];
  toMeet: HostelOption[];
};

type HostelApiResult<T> = {
  status?: number | string;
  status_code?: number | string;
  message?: string;
  data?: T;
  visitor_type_data?: unknown;
  to_meet_array?: unknown;
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function messageFrom(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  return readString(payload.message) || fallback;
}

function normalizeStatus(payload: unknown): string {
  if (!isRecord(payload)) return "";
  return String(payload.status ?? payload.status_code ?? "");
}

export function getHostelSession(): HostelSession {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId || !session.userId) {
    throw new Error("Your login session is missing hostel API credentials.");
  }
  return session;
}

async function postProxy<T>(path: string, session: HostelSession, body: BodyInit, contentType?: string): Promise<HostelApiResult<T>> {
  const response = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: {
      ...createAuthHeaders(session, contentType),
    },
    body,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as HostelApiResult<T>;
  if (!response.ok) {
    throw new Error(messageFrom(payload, `Request failed (${response.status}).`));
  }
  if (normalizeStatus(payload) === "2") {
    throw new Error(messageFrom(payload, "Authentication failed."));
  }
  return payload;
}

function normalizeVisitor(record: UnknownRecord): VisitorRecord {
  return {
    id: readString(record.id),
    appointmentType: readString(record.appointment_type),
    visitorTypeName: readString(record.visitor_type_name),
    name: readString(record.name),
    contact: readString(record.contact),
    email: readString(record.email),
    comingFrom: readString(record.coming_from),
    toMeetName: readString(record.staff_name),
    relation: readString(record.relation),
    purpose: readString(record.purpose),
    visitorIdCard: readString(record.visitor_idcard),
    meetDate: readString(record.meet_date),
    inTime: readString(record.in_time),
    outTime: readString(record.out_time),
    createdBy: readString(record.created_by),
    photoUrl: readString(record.visitor_photo),
  };
}

function normalizeOptions(list: unknown, labelKeys: string[]): HostelOption[] {
  return toArray(list)
    .map((item) => {
      const id = readString(item.id);
      const label = labelKeys.map((key) => readString(item[key])).find(Boolean) || "";
      return id && label ? { id, label } : null;
    })
    .filter((item): item is HostelOption => Boolean(item));
}

export async function loadVisitorList(session: HostelSession, filters: VisitorFilters): Promise<VisitorRecord[]> {
  const payload = await postProxy<unknown[]>(
    "get_adminVisitorListAPI",
    session,
    JSON.stringify({
      sub_institute_id: session.subInstituteId,
      syear: session.syear || new Date().getFullYear().toString(),
      from_date: filters.fromDate,
      to_date: filters.toDate,
    }),
    "application/json"
  );

  return toArray(payload.data).map(normalizeVisitor);
}

export async function loadVisitorFormOptions(session: HostelSession): Promise<VisitorFormOptions> {
  const payload = await postProxy(
    "get_visitorTypeAPI",
    session,
    JSON.stringify({
      sub_institute_id: session.subInstituteId,
      type: "API",
    }),
    "application/json"
  );

  return {
    visitorTypes: normalizeOptions(payload.visitor_type_data, ["title"]),
    toMeet: normalizeOptions(payload.to_meet_array, ["staff_name"]),
  };
}

export async function createVisitor(session: HostelSession, values: VisitorFormState): Promise<string> {
  const formData = new FormData();
  formData.set("type", "API");
  formData.set("sub_institute_id", session.subInstituteId);
  formData.set("user_id", session.userId);
  formData.set("appointment_type", values.appointment_type || "Direct");
  formData.set("visitor_type", values.visitor_type);
  formData.set("name", values.name);
  formData.set("contact", values.contact);
  formData.set("email", values.email);
  formData.set("coming_from", values.coming_from);
  formData.set("to_meet", values.to_meet);
  formData.set("relation", values.relation);
  formData.set("purpose", values.purpose);
  formData.set("visitor_idcard", values.visitor_idcard);
  if (values.meet_date) formData.set("meet_date", values.meet_date);
  if (values.in_time) formData.set("in_time", values.in_time);
  if (values.visitor_photo) formData.set("visitor_photo", values.visitor_photo);

  const payload = await postProxy("add_visitorAPI", session, formData);
  return messageFrom(payload, "Visitor added successfully.");
}

export function todayRange(): VisitorFilters {
  const today = new Date().toISOString().slice(0, 10);
  return { fromDate: today, toDate: today };
}

export function defaultVisitorForm(): VisitorFormState {
  const now = new Date();
  return {
    appointment_type: "Direct",
    visitor_type: "",
    name: "",
    contact: "",
    email: "",
    coming_from: "",
    to_meet: "",
    relation: "",
    purpose: "",
    visitor_idcard: "",
    meet_date: now.toISOString().slice(0, 10),
    in_time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    visitor_photo: null,
  };
}

export function visitorStats(records: VisitorRecord[]) {
  return {
    total: records.length,
    active: records.filter((record) => !record.outTime).length,
    completed: records.filter((record) => Boolean(record.outTime)).length,
    direct: records.filter((record) => record.appointmentType.toLowerCase() === "direct").length,
  };
}

export function mobileValidity(value: string): string {
  if (!value.trim()) return "Mobile Number is required.";
  if (!/^\d{10}$/.test(value.trim())) return "Mobile Number must be 10 digits.";
  return "";
}

export function visitorValidation(values: VisitorFormState): string {
  if (!values.visitor_type) return "Visitor Type is required.";
  if (!values.name.trim()) return "Visitor Name is required.";
  const mobileMessage = mobileValidity(values.contact);
  if (mobileMessage) return mobileMessage;
  if (!values.to_meet.trim()) return "To Meet is required.";
  if (!values.purpose.trim()) return "Purpose of Visit is required.";
  if (values.appointment_type === "Prior" && !values.meet_date) return "Meet Date is required.";
  return "";
}

export function readId(value: unknown): number {
  return readNumber(value);
}
