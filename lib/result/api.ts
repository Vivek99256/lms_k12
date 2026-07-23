'use client';

/**
 * Result module API client.
 *
 * Every call goes through the local `/api/proxy` route so the Laravel
 * backend keeps receiving the exact same query params / form bodies the
 * Blade screens sent. Session context (token, sub_institute_id, user_id,
 * syear) is read from localStorage the same way the rest of the app does.
 */

export type SelectOption = { id: string; label: string };

export type ResultSession = {
  token: string;
  subInstituteId: string;
  userId: string;
  syear: string;
};

export function readString(value: unknown): string {
  return value == null ? '' : String(value);
}

export function readNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function toCollection(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>);
  return [];
}

export function getResultSession(): ResultSession {
  if (typeof window === 'undefined') return { token: '', subInstituteId: '', userId: '', syear: '' };
  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    return {
      token: readString(userData.user_token ?? userData.token ?? menuContext.user_token ?? menuContext.token),
      subInstituteId: readString(userData.sub_institute_id ?? menuContext.sub_institute_id),
      userId: readString(userData.user_id ?? menuContext.user_id),
      syear: readString(localStorage.getItem('selectedAcademicYear') ?? userData.syear ?? menuContext.syear),
    };
  } catch {
    return { token: '', subInstituteId: '', userId: '', syear: '' };
  }
}

/** GET through the proxy with session params appended. */
export async function resultGet(path: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const session = getResultSession();
  const query = new URLSearchParams({
    path,
    type: 'API',
    ...params,
    ...(session.subInstituteId ? { sub_institute_id: session.subInstituteId } : {}),
    ...(session.userId ? { user_id: session.userId } : {}),
    ...(session.syear ? { syear: session.syear } : {}),
    ...(session.token ? { token: session.token } : {}),
  });
  const response = await fetch(`/api/proxy?${query.toString()}`, {
    headers: session.token ? { Authorization: `Bearer ${session.token}` } : undefined,
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(readString(payload.message) || `HTTP ${response.status}: Request failed`);
  }
  return payload;
}

export type ResultPostOptions = {
  /** Laravel method spoofing (`_method`) for PUT / DELETE resource routes. */
  method?: 'POST' | 'PUT' | 'DELETE';
  /** Send as multipart/form-data instead of urlencoded (file uploads). */
  multipart?: boolean;
};

export type PostValue = string | Blob | null | undefined;

/**
 * POST through the proxy. Values may be nested (`values[12][points]`) —
 * callers pass fully-bracketed keys exactly as the Blade forms did.
 */
export async function resultPost(
  path: string,
  data: Record<string, PostValue> | FormData,
  options: ResultPostOptions = {},
): Promise<Record<string, unknown>> {
  const session = getResultSession();
  const { method = 'POST', multipart = false } = options;

  const appendSession = (append: (key: string, value: string) => void) => {
    append('type', 'API');
    if (session.subInstituteId) append('sub_institute_id', session.subInstituteId);
    if (session.userId) append('user_id', session.userId);
    if (session.syear) append('syear', session.syear);
    if (session.token) append('token', session.token);
    if (method !== 'POST') append('_method', method);
  };

  let body: FormData | string;
  const headers: Record<string, string> = session.token ? { Authorization: `Bearer ${session.token}` } : {};

  if (data instanceof FormData || multipart) {
    const form = data instanceof FormData ? data : new FormData();
    if (!(data instanceof FormData)) {
      for (const [key, value] of Object.entries(data)) {
        if (value == null) continue;
        form.append(key, value);
      }
    }
    appendSession((key, value) => form.append(key, value));
    body = form;
  } else {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      if (value == null || value instanceof Blob) continue;
      form.append(key, value);
    }
    appendSession((key, value) => form.append(key, value));
    body = form.toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const response = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`, { method: 'POST', headers, body });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(readString(payload.message) || `HTTP ${response.status}: Request failed`);
  }
  return payload;
}

/** Interpret the standard Laravel `{status: 1, message}` envelope. */
export function assertOk(payload: Record<string, unknown>, fallbackMessage: string): string {
  const status = readString(payload.status ?? payload.status_code ?? '');
  if (status && status !== '1' && status.toLowerCase() !== 'success' && status !== '200') {
    throw new Error(readString(payload.message) || fallbackMessage);
  }
  return readString(payload.message);
}

/**
 * Normalise any of the backend's list shapes (array of records, keyed
 * object, or `{id: label}` dictionary) into select options.
 */
export function toOptions(items: unknown): SelectOption[] {
  const record = asRecord(items);
  if (
    !Array.isArray(items) &&
    Object.keys(record).length > 0 &&
    Object.values(record).every((value) => typeof value !== 'object' || value === null)
  ) {
    return Object.entries(record)
      .map(([id, label]) => ({ id, label: readString(label) }))
      .filter((item) => item.id && item.label);
  }

  return toCollection(items)
    .map((item) => {
      const row = asRecord(item);
      const id = readString(
        row.id ?? row.term_id ?? row.section_id ?? row.standard_id ?? row.division_id ??
        row.subject_id ?? row.exam_master_id ?? row.exam_id ?? row.value ?? row.key,
      );
      const label = readString(
        row.name ?? row.term_name ?? row.section_name ?? row.standard_name ?? row.division_name ??
        row.subject_name ?? row.display_name ?? row.exam_master_name ?? row.exam_name ??
        row.main_title ?? row.grade_name ?? row.ExamTitle ?? row.label ?? row.title ?? row.value,
      );
      return { id, label: label || id };
    })
    .filter((item) => item.id && item.label);
}

/** Pull the row collection out of a list payload (handles data/data.data/rows). */
export function extractRows(payload: Record<string, unknown>, listKey?: string): Record<string, unknown>[] {
  const source = listKey
    ? asRecord(payload.data ?? payload)[listKey] ?? asRecord(payload)[listKey]
    : payload.data ?? payload;
  const inner = asRecord(source);
  const collection = Array.isArray(source)
    ? source
    : Array.isArray(inner.data)
      ? inner.data
      : toCollection(source);
  return collection.map(asRecord);
}
