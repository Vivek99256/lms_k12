'use client';

import {
  appendSessionParams,
  asRecord,
  buildApiUrl,
  fetchLaravelJson,
  formatCurrency,
  getApiBaseUrl,
  getFeesSession,
  readNumber,
  readString,
  toArray,
  type FeesSession,
} from '@/app/fees/_lib/fees-api';

export type ReportMessage = {
  type: 'success' | 'error' | 'info';
  text: string;
};

export type ReportApiPayload = {
  status?: string | number;
  message?: string;
  [key: string]: unknown;
};

export type ExportColumn = {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
};

export type ExportRow = Record<string, string>;

export type PaginatedResult<T> = {
  rows: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
};

export const REPORT_PAGE_SIZE = 25;

export function createEmptyPagination<T>(pageSize = REPORT_PAGE_SIZE): PaginatedResult<T> {
  return {
    rows: [],
    page: 1,
    pageSize,
    totalPages: 1,
    totalItems: 0,
    startIndex: 0,
    endIndex: 0,
  };
}

export function paginateRows<T>(rows: T[], page: number, pageSize = REPORT_PAGE_SIZE): PaginatedResult<T> {
  if (rows.length === 0) {
    return createEmptyPagination<T>(pageSize);
  }

  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return {
    rows: rows.slice(startIndex, endIndex),
    page: safePage,
    pageSize,
    totalPages,
    totalItems,
    startIndex: startIndex + 1,
    endIndex,
  };
}

export function readArrayRecords(value: unknown): Record<string, unknown>[] {
  return toArray(value).map((item) => asRecord(item));
}

export function readBooleanFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = readString(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export function appendIfValue(params: URLSearchParams, key: string, value: string | undefined) {
  if (value && value.trim()) {
    params.set(key, value.trim());
  }
}

export function buildReportUrl(session: FeesSession, path: string, params?: URLSearchParams) {
  const url = new URL(buildApiUrl(session, path));
  if (params) {
    params.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

export async function fetchReportIndex<T extends ReportApiPayload>(path: string): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const params = new URLSearchParams();
  appendSessionParams(params, session);
  const payload = await fetchLaravelJson<T>(session, `${getApiBaseUrl(session)}${path}?${params.toString()}`);
  return { session, payload };
}

export async function fetchReportGet<T extends ReportApiPayload>(
  path: string,
  params: URLSearchParams
): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  appendSessionParams(params, session);
  const payload = await fetchLaravelJson<T>(session, `${getApiBaseUrl(session)}${path}?${params.toString()}`);
  return { session, payload };
}

export async function fetchReportPost<T extends ReportApiPayload>(
  path: string,
  params: URLSearchParams
): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  appendSessionParams(params, session);
  const payload = await fetchLaravelJson<T>(session, `${getApiBaseUrl(session)}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: params.toString(),
  });
  return { session, payload };
}

function buildReportProxyHeaders(session: FeesSession) {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  headers.set('x-laravel-base-url', getApiBaseUrl(session));
  if (session.token) headers.set('x-laravel-token', session.token);
  if (session.subInstituteId) headers.set('x-sub-institute-id', session.subInstituteId);
  if (session.academicYearId) headers.set('x-academic-year-id', session.academicYearId);
  if (session.userId) headers.set('x-user-id', session.userId);
  if (session.termId) headers.set('x-term-id', session.termId);
  if (session.userProfileId) headers.set('x-user-profile-id', session.userProfileId);
  if (session.userProfileName) headers.set('x-user-profile-name', session.userProfileName);
  if (session.clientId) headers.set('x-client-id', session.clientId);
  return headers;
}

function summarizeResponseText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function parseProxyJsonBody<T>(text: string, contentType: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Fees report proxy returned a non-JSON response (${contentType || 'unknown content type'}). ${summarizeResponseText(text) || 'Empty response body.'}`
    );
  }
}

async function fetchReportProxyJson<T extends ReportApiPayload>(
  session: FeesSession,
  proxyPath: string,
  params?: URLSearchParams,
  init?: RequestInit
): Promise<T> {
  const url = params && params.toString() ? `${proxyPath}?${params.toString()}` : proxyPath;
  const response = await fetch(url, {
    method: init?.method ?? 'GET',
    headers: init?.headers ?? buildReportProxyHeaders(session),
    body: init?.body,
    cache: 'no-store',
    credentials: 'include',
  });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  const payload = parseProxyJsonBody<T>(text, contentType);

  if (!response.ok) {
    const message = readString(asRecord(payload).message) || `HTTP ${response.status}: Unable to complete request.`;
    throw new Error(message);
  }

  return payload;
}

export async function fetchReportProxyText(
  session: FeesSession,
  proxyPath: string,
  params?: URLSearchParams
): Promise<string> {
  const url = params && params.toString() ? `${proxyPath}?${params.toString()}` : proxyPath;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...Object.fromEntries(buildReportProxyHeaders(session).entries()),
      Accept: 'text/html,application/xhtml+xml',
    },
    cache: 'no-store',
    credentials: 'include',
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(summarizeResponseText(text) || `HTTP ${response.status}: Unable to complete request.`);
  }

  return text;
}

export async function fetchFeesCollectionReportIndex<T extends ReportApiPayload>(): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/fees-collection');
  return { session, payload };
}

export async function fetchFeesCollectionReportGet<T extends ReportApiPayload>(
  params: URLSearchParams
): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const primaryParams = new URLSearchParams(params.toString());
  const primaryPayload = await fetchReportProxyJson<T>(session, '/api/fees/reports/fees-collection/create', primaryParams);

  if (hasFeesCollectionRows(primaryPayload)) {
    return { session, payload: primaryPayload };
  }

  const fallbackParams = new URLSearchParams(params.toString());
  const fallbackPayload = await fetchReportProxyJson<T>(session, '/api/fees/reports/fees-collection', fallbackParams);
  return { session, payload: fallbackPayload };
}

export async function fetchFeesTypeWiseReportGet<T extends ReportApiPayload>(
  params: URLSearchParams
): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/fees-type-wise/create', params);
  return { session, payload };
}

export async function fetchFeesDefaulterReportPost<T extends ReportApiPayload>(
  params: URLSearchParams
): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  appendSessionParams(params, session);
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/fees-defaulter', undefined, {
    method: 'POST',
    headers: {
      ...Object.fromEntries(buildReportProxyHeaders(session).entries()),
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: params.toString(),
  });
  return { session, payload };
}

export async function fetchOtherFeesReportIndex<T extends ReportApiPayload>(): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/other-fees');
  return { session, payload };
}

export async function fetchOtherFeesReportGet<T extends ReportApiPayload>(
  params: URLSearchParams
): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/other-fees/create', params);
  return { session, payload };
}

export async function fetchOtherFeesCancelReportIndex<T extends ReportApiPayload>(): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/other-fees-cancel');
  return { session, payload };
}

export async function fetchOtherFeesCancelReportGet<T extends ReportApiPayload>(
  params: URLSearchParams
): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/other-fees-cancel/create', params);
  return { session, payload };
}

export async function fetchStudentBreakoffReportIndex<T extends ReportApiPayload>(): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/student-breakoff');
  return { session, payload };
}

export async function fetchStudentBreakoffReportGet<T extends ReportApiPayload>(
  params: URLSearchParams
): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/student-breakoff/create', params);
  return { session, payload };
}

export async function fetchDatewiseSummaryReportIndex<T extends ReportApiPayload>(): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/datewise-summary');
  return { session, payload };
}

export async function fetchDatewiseSummaryReportGet<T extends ReportApiPayload>(
  params: URLSearchParams
): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/datewise-summary', params);
  return { session, payload };
}

export async function fetchDatewiseSummaryFeesTitleGet<T extends ReportApiPayload>(
  params: URLSearchParams
): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/datewise-summary/fees-title', params);
  return { session, payload };
}

export async function fetchFeesStructureReportPost<T extends ReportApiPayload>(
  params: URLSearchParams
): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  appendSessionParams(params, session);
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/fees-structure', undefined, {
    method: 'POST',
    headers: {
      ...Object.fromEntries(buildReportProxyHeaders(session).entries()),
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: params.toString(),
  });
  return { session, payload };
}

export async function fetchFeesCancelReportIndex<T extends ReportApiPayload>(): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/fees-cancel');
  return { session, payload };
}

export async function fetchFeesCancelReportPost<T extends ReportApiPayload>(
  params: URLSearchParams
): Promise<{ session: FeesSession; payload: T }> {
  const session = getFeesSession();
  appendSessionParams(params, session);
  const payload = await fetchReportProxyJson<T>(session, '/api/fees/reports/fees-cancel', undefined, {
    method: 'POST',
    headers: {
      ...Object.fromEntries(buildReportProxyHeaders(session).entries()),
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: params.toString(),
  });
  return { session, payload };
}

export function getSingleFilterValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}

export function getMultiFilterValues(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return value ? [value] : [];
}

export function toExportCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') return String(value);
  return readString(value);
}

export function formatAmount(value: unknown): string {
  return formatCurrency(readNumber(value));
}

export function formatPlainAmount(value: unknown): string {
  return readNumber(value).toLocaleString('en-IN');
}

export function formatDateDisplay(value: unknown): string {
  const text = readString(value);
  if (!text) return '-';
  const rawDate = new Date(text);
  if (Number.isNaN(rawDate.getTime())) return text;

  const day = String(rawDate.getDate()).padStart(2, '0');
  const month = String(rawDate.getMonth() + 1).padStart(2, '0');
  const year = rawDate.getFullYear();
  return `${day}-${month}-${year}`;
}

export function getPaymentModes(subInstituteId: string) {
  return subInstituteId === '76'
    ? [
        { value: 'Cash', label: 'CASH' },
        { value: 'Cheque', label: 'CHEQUE' },
        { value: 'POS', label: 'POS' },
        { value: 'Online', label: 'ONLINE' },
        { value: 'UPI', label: 'UPI' },
        { value: 'RTGS/NEFT', label: 'RTGS/NEFT' },
      ]
    : [
        { value: 'Cash', label: 'Cash' },
        { value: 'Cheque', label: 'Cheque' },
        { value: 'DD', label: 'DD' },
        { value: 'Online', label: 'Online' },
        { value: 'NACH', label: 'NACH' },
        { value: 'UPI', label: 'UPI' },
        { value: 'Swipe1', label: 'Swipe1' },
        { value: 'Swipe2', label: 'Swipe2' },
        { value: 'Swipe3', label: 'Swipe3' },
        { value: 'POS', label: 'POS' },
      ];
}

export function buildMonthMap(value: unknown): Record<string, string> {
  const record = asRecord(value);
  const result: Record<string, string> = {};
  Object.entries(record).forEach(([key, monthLabel]) => {
    result[key] = readString(monthLabel);
  });
  return result;
}

function hasFeesCollectionRows(payload: ReportApiPayload): boolean {
  const data = (payload as Record<string, unknown>).data;
  if (Array.isArray(data) && data.length > 0) return true;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const nestedFeesData = (data as Record<string, unknown>).fees_data;
    if (Array.isArray(nestedFeesData)) return nestedFeesData.length > 0;
    if (nestedFeesData && typeof nestedFeesData === 'object') {
      return Object.keys(nestedFeesData as Record<string, unknown>).length > 0;
    }
  }

  const feesData = (payload as Record<string, unknown>).fees_data;
  if (Array.isArray(feesData)) return feesData.length > 0;
  if (feesData && typeof feesData === 'object') {
    return Object.keys(feesData as Record<string, unknown>).length > 0;
  }

  return false;
}
