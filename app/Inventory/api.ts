import {
  appendCommonParams, buildSessionContext, createAuthHeaders, normalizeApiStatus,
  readNumber, readString, type ApiEnvelope, type SessionContext,
} from "@/lib/erp-client";

export type InventoryRecord = { id: number; values: Record<string, string | number | boolean | null> };
export type InventoryOption = { id: number | string; label: string; parentId?: number; price?: number };
export type InventoryData = { records: InventoryRecord[]; options: Record<string, InventoryOption[]> };
type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function rows(value: unknown): UnknownRecord[] { return Array.isArray(value) ? value.filter(isRecord) : []; }
function message(value: unknown, fallback: string): string {
  return isRecord(value) ? readString(value.message) || fallback : fallback;
}
function normalize(value: unknown): InventoryData {
  const data = isRecord(value) && isRecord(value.data) ? value.data : isRecord(value) ? value : {};
  const sourceRows = rows(data.records ?? data.data ?? data.items);
  const records = sourceRows.map((row) => {
    const values: InventoryRecord["values"] = {};
    Object.entries(row).forEach(([key, item]) => {
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null) values[key] = item;
    });
    return { id: readNumber(row.id ?? row.ID), values };
  });
  const options: InventoryData["options"] = {};
  Object.entries(data).forEach(([key, value]) => {
    if (!Array.isArray(value) || ["records", "data", "items"].includes(key)) return;
    const unique = new Map<string, InventoryOption>();
    rows(value).forEach((row) => {
      const rawId = row.id ?? row.ID ?? row.item_id ?? row.user_id;
      const numericId = readNumber(rawId);
      const id = numericId || readString(rawId);
      const label = readString(row.label ?? row.title ?? row.name ?? row.item_name ?? row.display_name);
      const parentId = readNumber(row.parent_id ?? row.category_id ?? row.sub_category_id ?? row.vendor_id);
      const price = Number(row.price);
      const key = `${String(id)}:${parentId}`;
      if (id && label && !unique.has(key)) unique.set(key, { id, label, ...(parentId ? { parentId } : {}), ...(Number.isFinite(price) ? { price } : {}) });
    });
    options[key] = [...unique.values()];
  });
  return { records, options };
}

export function getInventorySession(): SessionContext {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId || !session.syear || !session.userId) {
    throw new Error("Your login session is missing Inventory credentials.");
  }
  return session;
}

async function request(module: string, session: SessionContext, suffix = "", init?: RequestInit): Promise<unknown> {
  const params = new URLSearchParams();
  appendCommonParams(params, session);
  params.set("user_id", session.userId);
  if (session.termId) params.set("term_id", session.termId);
  const separator = suffix.includes("?") ? "&" : "?";
  const contentType = init?.body && !(init.body instanceof FormData) ? "application/json" : undefined;
  const response = await fetch(`${session.baseUrl}/api/inventory/${module}${suffix}${separator}${params}`, {
    cache: "no-store", ...init,
    headers: { ...createAuthHeaders(session, contentType), ...init?.headers },
  });
  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    if (response.status === 404) throw new Error("Backend API required for this Inventory menu.");
    throw new Error(message(payload, `Request failed (${response.status}).`));
  }
  if (isRecord(payload) && normalizeApiStatus(payload as ApiEnvelope) === "2") {
    throw new Error(message(payload, "Authentication failed."));
  }
  return payload;
}

export async function loadInventory(module: string, filters: Record<string, string>): Promise<InventoryData> {
  const session = getInventorySession();
  const query = new URLSearchParams(filters);
  const suffix = query.size ? `?${query}` : "";
  return normalize(await request(module, session, suffix));
}
export async function saveInventory(module: string, values: Record<string, unknown>, id?: number, files: Record<string, File> = {}): Promise<string> {
  const session = getInventorySession();
  const fileEntries = Object.entries(files);
  const body = fileEntries.length ? (() => {
    const form = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== null && value !== undefined) form.set(key, String(value));
    });
    fileEntries.forEach(([key, file]) => form.set(key, file));
    if (id) form.set("_method", "PUT");
    return form;
  })() : JSON.stringify({ ...values, type: "API", sub_institute_id: session.subInstituteId, syear: session.syear, user_id: session.userId });
  const payload = await request(module, session, id ? `/${id}` : "", {
    method: fileEntries.length ? "POST" : id ? "PUT" : "POST",
    body,
  });
  return message(payload, id ? "Record updated successfully." : "Record created successfully.");
}
export async function deleteInventory(module: string, id: number): Promise<string> {
  const session = getInventorySession();
  return message(await request(module, session, `/${id}`, { method: "DELETE" }), "Record deleted successfully.");
}
