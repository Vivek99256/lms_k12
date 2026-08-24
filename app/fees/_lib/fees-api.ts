'use client';

import { API_BASE_URL } from '@/app/components/utils/api_url';

export type FeesSession = {
  token: string;
  subInstituteId: string;
  userId: string;
  academicYearId: string;
  hostName: string;
  termId: string;
  userProfileId: string;
  userProfileName: string;
  clientId: string;
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

function getStorageSources(): Storage[] {
  if (typeof window === 'undefined') return [];
  return [sessionStorage, localStorage];
}

function readStoredRecordFromStorage(storage: Storage, key: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(storage.getItem(key) || '{}'));
  } catch {
    return {};
  }
}

function readStorageValue(keys: string[]): string {
  for (const storage of getStorageSources()) {
    for (const key of keys) {
      const value = readString(storage.getItem(key));
      if (value) return value;
    }
  }

  return '';
}

function getSessionSources(): Record<string, unknown>[] {
  const sources: Record<string, unknown>[] = [];
  const recordKeys = [
    'userData',
    'menuContext',
    'sessionData',
    'sessiondata',
    'user_data',
    'session',
    'academicSession',
    'academicData',
    'auth',
  ];

  for (const storage of getStorageSources()) {
    for (const key of recordKeys) {
      const record = readStoredRecordFromStorage(storage, key);
      if (Object.keys(record).length > 0) {
        sources.push(record);
      }
    }
  }

  return sources;
}

function normalizeAcademicYear(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const yearMatch = trimmed.match(/\d{4}/);
  return yearMatch ? yearMatch[0] : trimmed;
}

function readStoredValue(keys: string[], ...sources: Array<Record<string, unknown>>): string {
  for (const source of sources) {
    for (const key of keys) {
      const value = readString(source[key]);
      if (value) return value;
    }
  }

  return readStorageValue(keys);
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
      userProfileId: '',
      userProfileName: '',
      clientId: '',
    };
  }

  const sessionSources = getSessionSources();
  const [userData = {}, menuContext = {}] = sessionSources;
  const academicYearsSource = sessionSources.find((source) => Array.isArray(source.academicYears));
  const academicYears = Array.isArray(academicYearsSource?.academicYears) ? academicYearsSource.academicYears : [];
  let selectedAcademicYear = readStorageValue(['selectedAcademicYear', 'syear']);
  if (!selectedAcademicYear && academicYears.length > 0) {
    const firstYear = asRecord(academicYears[0]);
    selectedAcademicYear = readString(firstYear.syear ?? firstYear.academic_year);
  }

  return {
    token: readStoredValue(['user_token', 'token'], userData, menuContext),
    subInstituteId: readStoredValue(['sub_institute_id', 'subInstituteId'], userData, menuContext),
    userId: readStoredValue(['user_id', 'userId'], userData, menuContext),
    academicYearId: normalizeAcademicYear(selectedAcademicYear || readStoredValue(['academic_year_id', 'academicYearId'], userData, menuContext)),
    hostName: readStoredValue(['host_name', 'hostName'], userData, menuContext) || API_BASE_URL,
    termId: readStoredValue(['term_id', 'marking_period_id', 'academic_term_id', 'termId', 'markingPeriodId', 'academicTermId'], userData, menuContext),
    userProfileId: readStoredValue(['user_profile_id', 'userProfileId', 'profile_id', 'profileId'], userData, menuContext),
    userProfileName: readStoredValue(['user_profile_name', 'userProfileName', 'profile_name', 'profileName'], userData, menuContext),
    clientId: readStoredValue(['client_id', 'clientId'], userData, menuContext),
  };
}

export function getApiBaseUrl(session: FeesSession): string {
  return (API_BASE_URL || session.hostName || '').replace(/\/$/, '');
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
  if (session.token) params.set('token', session.token);
  if (session.userProfileId) params.set('user_profile_id', session.userProfileId);
  if (session.userProfileName) params.set('user_profile_name', session.userProfileName);
  if (session.clientId) params.set('client_id', session.clientId);
}

export function appendSessionFormData(form: FormData, session: FeesSession) {
  form.set('type', 'API');
  if (session.subInstituteId) form.set('sub_institute_id', session.subInstituteId);
  if (session.academicYearId) form.set('syear', session.academicYearId);
  if (session.userId) form.set('user_id', session.userId);
  if (session.termId) form.set('term_id', session.termId);
  if (session.token) form.set('token', session.token);
  if (session.userProfileId) form.set('user_profile_id', session.userProfileId);
  if (session.userProfileName) form.set('user_profile_name', session.userProfileName);
  if (session.clientId) form.set('client_id', session.clientId);
}

function summarizeResponseText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function parseJsonResponseBody<T>(text: string, contentType: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Laravel returned a non-JSON response (${contentType || 'unknown content type'}). ${summarizeResponseText(text) || 'Empty response body.'}`
    );
  }
}

export async function fetchLaravelJson<T>(session: FeesSession, url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (session.token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${session.token}`);
  headers.set('X-Requested-With', 'XMLHttpRequest');

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: init?.credentials ?? 'include',
  });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  const payload = parseJsonResponseBody<T>(text, contentType);

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
