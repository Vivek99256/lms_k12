'use client';

import { API_BASE_URL } from '@/app/components/utils/api_url';

export type FeesSession = {
  token: string;
  subInstituteId: string;
  userId: string;
  academicYearId: string;
  hostName: string;
  termId: string;
};

export type SelectOption = {
  id: string;
  label: string;
};

export type ApiStatusPayload = {
  status?: string | number;
  status_code?: string | number;
  message?: string;
};

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function readNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) return 0;
    const numberValue = Number(normalized);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  return 0;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>);
  return [];
}

export function readStoredRecord(key: string): Record<string, unknown> {
  if (typeof window === 'undefined') return {};

  try {
    return asRecord(JSON.parse(localStorage.getItem(key) || '{}'));
  } catch {
    return {};
  }
}

export function getFeesSession(): FeesSession {
  if (typeof window === 'undefined') {
    return {
      token: '',
      subInstituteId: '',
      userId: '',
      academicYearId: '',
      hostName: API_BASE_URL,
      termId: '',
    };
  }

  const userData = readStoredRecord('userData');
  const menuContext = readStoredRecord('menuContext');
  const selectedAcademicYear = localStorage.getItem('selectedAcademicYear');

  return {
    token: readString(userData.user_token ?? userData.token ?? menuContext.user_token ?? menuContext.token),
    subInstituteId: readString(userData.sub_institute_id ?? menuContext.sub_institute_id),
    userId: readString(userData.user_id ?? menuContext.user_id),
    academicYearId: readString(selectedAcademicYear || userData.academic_year_id || userData.academicYearId || menuContext.academic_year_id),
    hostName: readString(userData.host_name ?? menuContext.host_name) || API_BASE_URL,
    termId: readString(userData.term_id ?? menuContext.term_id ?? userData.marking_period_id ?? menuContext.marking_period_id),
  };
}

export function getApiBaseUrl(session: FeesSession): string {
  return (session.hostName || API_BASE_URL || '').replace(/\/$/, '');
}

export function buildApiUrl(session: FeesSession, path: string, params?: Record<string, string | number | undefined>): string {
  const baseUrl = getApiBaseUrl(session);
  const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });

  return url.toString();
}

export function appendSessionParams(params: URLSearchParams, session: FeesSession) {
  params.set('type', 'API');
  if (session.subInstituteId) params.set('sub_institute_id', session.subInstituteId);
  if (session.academicYearId) params.set('syear', session.academicYearId);
  if (session.userId) params.set('user_id', session.userId);
  if (session.termId) params.set('term_id', session.termId);
}

export function appendSessionFormData(form: FormData, session: FeesSession) {
  form.set('type', 'API');
  if (session.subInstituteId) form.set('sub_institute_id', session.subInstituteId);
  if (session.academicYearId) form.set('syear', session.academicYearId);
  if (session.userId) form.set('user_id', session.userId);
  if (session.termId) form.set('term_id', session.termId);
}

export async function fetchLaravelJson<T>(session: FeesSession, url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (session.token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${session.token}`);

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: init?.credentials ?? 'omit',
  });
  const text = await response.text();
  const payload = parseJsonText<T>(text);

  if (!response.ok) {
    const message = readString(asRecord(payload).message) || `HTTP ${response.status}: Unable to complete request.`;
    throw new Error(message);
  }

  return payload;
}

export function parseJsonText<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Laravel returned an HTML page instead of JSON. This route needs type=API support or an active Laravel session.');
  }
}

export function readApiStatus(payload: ApiStatusPayload): number {
  const rawStatus = payload.status ?? payload.status_code;
  const normalized = readString(rawStatus).toUpperCase();
  const numeric = Number(normalized);

  if (Number.isFinite(numeric)) return numeric;
  if (normalized === 'SUCCESS') return 1;

  return normalized === '1' ? 1 : 0;
}

export function assertApiSuccess(payload: ApiStatusPayload, fallbackMessage: string) {
  if (payload.status !== undefined || payload.status_code !== undefined) {
    if (readApiStatus(payload) !== 1) {
      throw new Error(payload.message || fallbackMessage);
    }
  }
}

export function toSelectOptions(value: unknown, idKeys: string[], labelKeys: string[]): SelectOption[] {
  return toArray(value).map((item, index) => {
    const record = asRecord(item);
    const id = readFirstString(record, idKeys) || String(index);
    const label = readFirstString(record, labelKeys) || id;
    return { id, label };
  }).filter((option) => option.id !== '');
}

export function readFirstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = readString(record[key]);
    if (value) return value;
  }

  return '';
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function joinUrl(baseUrl: string, path: string): string {
  if (!path) return '#';
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\/+/, '')}`;
}
