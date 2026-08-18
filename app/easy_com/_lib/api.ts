'use client';

import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  readString,
  type SessionContext,
} from '@/lib/erp-client';
import type { JsonRecord } from './types';

/**
 * Client for the Easy Communication REST API
 * (Laravel: routes/easycomapi.php -> /api/easy_com/*, `api.session` middleware).
 *
 * Every endpoint answers the standard envelope:
 *   { success: boolean, message: string, data: unknown, errors: unknown }
 *
 * The module previously called the Blade `easy_com/*` web routes, which have no
 * JWT validation and read tenant context from a session that does not exist for
 * a stateless call - producing SQL errors, empty listings and HTML responses.
 */

const API_ROOT = 'api/easy_com';

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

/** Field-level validation errors, flattened to one message per field. */
export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  readonly fieldErrors: FieldErrors;
  readonly status: number;
  /**
   * The untouched `errors` payload. Validation failures put field messages
   * here, but a rejected send puts its per-recipient breakdown
   * ({ requested, sent, failed[], skipped[] }) here instead, which does not
   * survive flattening.
   */
  readonly raw: unknown;

  constructor(message: string, fieldErrors: FieldErrors = {}, status = 0, raw: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.fieldErrors = fieldErrors;
    this.status = status;
    this.raw = raw;
  }
}

function flattenErrors(errors: unknown): FieldErrors {
  const source = asRecord(errors);
  const flat: FieldErrors = {};

  Object.entries(source).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === 'string');
      if (first) flat[key] = String(first);
    } else if (typeof value === 'string') {
      flat[key] = value;
    }
  });

  return flat;
}

/** Envelope shape returned by every easy_com endpoint. */
export interface Envelope<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: JsonRecord;
}

async function request<T = unknown>(
  path: string,
  init?: RequestInit,
  params?: URLSearchParams,
): Promise<Envelope<T>> {
  const session = buildSessionContext();
  const query = new URLSearchParams(params);
  appendCommonParams(query, session);

  const proxyQuery = new URLSearchParams(query);
  proxyQuery.set('path', `${API_ROOT}/${path.replace(/^\/+/, '')}`);

  const headers = new Headers(init?.headers);
  Object.entries(createAuthHeaders(session)).forEach(([key, value]) =>
    headers.set(key, String(value)),
  );

  const response = await fetch(`/api/proxy?${proxyQuery.toString()}`, {
    ...init,
    headers,
    cache: 'no-store',
    credentials: 'include',
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(
      'The server returned an unexpected response. Check that the Easy Communication API is deployed.',
      {},
      response.status,
    );
  }

  const body = asRecord(payload);
  const message = readString(body.message);

  if (!response.ok || body.success === false) {
    throw new ApiError(
      message || `Request failed with HTTP ${response.status}.`,
      flattenErrors(body.errors),
      response.status,
      body.errors ?? null,
    );
  }

  return {
    success: true,
    message: message || 'Success',
    data: body.data as T,
    meta: asRecord(body.meta),
  };
}

/* ------------------------------------------------------------------ */
/* Verb helpers                                                        */
/* ------------------------------------------------------------------ */

export function getJson<T = unknown>(path: string, params?: Record<string, string>) {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== '' && value != null) query.set(key, value);
  });

  return request<T>(path, { method: 'GET' }, query);
}

export type FormValue = string | number | boolean | File | string[] | undefined | null;

function toFormData(values: Record<string, FormValue>, session: SessionContext): FormData {
  const form = new FormData();

  // Kept for parity with the rest of the ERP client; api.session also forces it.
  form.set('type', 'API');
  if (session.subInstituteId) form.set('sub_institute_id', session.subInstituteId);
  if (session.syear) form.set('syear', session.syear);
  if (session.termId) form.set('term_id', session.termId);

  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => form.append(`${key}[]`, item));
    } else if (value instanceof File) {
      form.set(key, value);
    } else {
      form.set(key, String(value));
    }
  });

  return form;
}

export function postForm<T = unknown>(path: string, values: Record<string, FormValue>) {
  return request<T>(path, { method: 'POST', body: toFormData(values, buildSessionContext()) });
}

/**
 * PUT/PATCH bodies are sent as JSON rather than multipart, because PHP does not
 * populate $_POST for a PUT request - the reason a form-encoded "update" silently
 * arrived with no fields. Laravel parses a JSON body on any verb.
 */
export function putJson<T = unknown>(path: string, values: Record<string, FormValue>) {
  const session = buildSessionContext();

  // /api/proxy forwards the query string on GET only, so the session context
  // has to travel in the body for PUT - otherwise api.session falls back to
  // whatever term covers today and an explicit year switch would be lost.
  const body: Record<string, unknown> = {
    type: 'API',
    ...(session.subInstituteId ? { sub_institute_id: session.subInstituteId } : {}),
    ...(session.syear ? { syear: session.syear } : {}),
    ...(session.termId ? { term_id: session.termId } : {}),
  };

  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof File) return;
    body[key] = value;
  });

  return request<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteJson<T = unknown>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** Cell renderer shared by the report and master tables. */
export function cellValue(row: JsonRecord, key: string): string {
  const value = row[key];
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  return String(value);
}
