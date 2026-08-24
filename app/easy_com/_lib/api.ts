'use client';

import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readString,
  type ApiEnvelope,
} from '@/lib/erp-client';
import type { JsonRecord, Recipient } from './types';

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

export function records(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.map(asRecord);
  const row = asRecord(value);
  return Object.values(row).map(asRecord).filter((item) => Object.keys(item).length > 0);
}

export function dataRecords(payload: unknown): JsonRecord[] {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const candidate = root.data ?? data.data ?? root;
  return records(candidate);
}

export function responseMessage(payload: unknown, fallback: string) {
  return readString(asRecord(payload).message) || fallback;
}

export async function communicationRequest(
  path: string,
  init?: RequestInit,
  params?: URLSearchParams,
): Promise<unknown> {
  const session = buildSessionContext();
  const query = new URLSearchParams(params);
  appendCommonParams(query, session);
  const proxyQuery = new URLSearchParams(query);
  proxyQuery.set('path', path.replace(/^\/+/, ''));

  const headers = new Headers(init?.headers);
  Object.entries(createAuthHeaders(session)).forEach(([key, value]) => headers.set(key, String(value)));
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
    throw new Error('The Laravel endpoint returned HTML instead of an API response.');
  }
  if (!response.ok) throw new Error(responseMessage(payload, `Request failed with HTTP ${response.status}.`));
  if (normalizeApiStatus(asRecord(payload) as ApiEnvelope) === '2') {
    throw new Error(responseMessage(payload, 'The request was rejected.'));
  }
  return payload;
}

export function formWithContext(values: Record<string, string | File | string[]>) {
  const session = buildSessionContext();
  const form = new FormData();
  form.set('type', 'API');
  if (session.subInstituteId) form.set('sub_institute_id', session.subInstituteId);
  if (session.syear) form.set('syear', session.syear);
  if (session.userId) form.set('teacher_id', session.userId);
  Object.entries(values).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => form.append(key, item));
    else form.set(key, value);
  });
  return form;
}

export async function postForm(path: string, values: Record<string, string | File | string[]>) {
  return communicationRequest(path, { method: 'POST', body: formWithContext(values) });
}

export async function deleteRecord(path: string) {
  return postForm(path, { _method: 'DELETE' });
}

export function mapRecipient(row: JsonRecord, contactField: 'mobile' | 'email'): Recipient {
  const contact = readString(row[contactField] ?? row.parent_email);
  const id = readString(row.student_id ?? row.id ?? contact);
  return {
    id,
    name: readString(row.name) || [row.first_name, row.middle_name, row.last_name].map(readString).filter(Boolean).join(' '),
    enrollment: readString(row.enrollment_no ?? row.gr_no ?? row.student_gr_no),
    standard: readString(row.standard_name ?? row.standard),
    division: readString(row.division_name ?? row.division),
    contact,
    eligible: contactField === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) : /^[6-9]\d{9}$/.test(contact),
  };
}
