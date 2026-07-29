'use client';

import {
  asRecord,
  assertApiSuccess,
  getApiBaseUrl,
  readString,
  type ApiStatusPayload,
  type FeesSession,
} from '@/app/fees/_lib/fees-api';

/**
 * Client for the Fees dashboard aggregate endpoint.
 *
 * Backend:  next_lms_erp/app/Http/Controllers/api/FeesDashboardApiController.php
 * Route:    next_lms_erp/routes/api.php:205
 *             Route::post('fees-dashboard/summary', [FeesDashboardApiController::class, 'summary']);
 * Contract: next_lms_erp/docs/fees-api/fees-dashboard-contract.md  (§3, "Part A")
 *
 * Upstream call is POST {LARAVEL_BASE_URL}/api/fees-dashboard/summary, but the
 * browser goes through the Next route handler below — same convention as every
 * other fees screen (app/api/fees/reports/*), which keeps Laravel off the
 * browser's origin and avoids CORS.
 *
 * The Laravel route sits on the `api` middleware group — no session — so the
 * controller seeds session from the request body itself (seedRequestSession).
 * That is why sub_institute_id / syear / user_id are sent explicitly.
 */
export const FEES_DASHBOARD_SUMMARY_PATH = '/api/fees/dashboard/summary';

/** Contract §3 "Request". `type` must be "JSON" or "API" — is_mobile() only returns JSON for those. */
export type FeesDashboardRequest = {
  sub_institute_id: string | number;
  syear: string | number;
  user_id: string | number;
  /** Scopes `collectedThisTerm` to one fee-month bucket. Omit ⇒ whole syear. */
  month_id?: string | number | null;
  /** `Y-m-d`; filters `receiptdate` for the collection figure. */
  from_date?: string | null;
  to_date?: string | null;
  grade_id?: string | number | null;
  standard_id?: string | number | null;
  section_id?: string | number | null;
};

export type FeesDashboardContext = {
  sub_institute_id: number;
  syear: number;
  month_id: number | null;
  month_label: string | null;
  from_date: string | null;
  to_date: string | null;
  currency: string;
  generated_at: string;
};

export type FeesDashboardSummary = {
  collected_amount: number;
  collected_display: string;
  demand_amount: number;
  demand_display: string;
  outstanding_amount: number;
  outstanding_display: string;
  collection_rate: number;
  collection_rate_display: string;
  defaulters_count: number;
  students_considered: number;
  receipts_count: number;
  fine_amount: number;
  discount_amount: number;
};

export type CollectionVsTargetRow = {
  month_id: number;
  month_label: string;
  target_amount: number;
  collected_amount: number;
};

export type HeadwiseRow = {
  fee_title: string;
  display_name: string;
  sort_order: number;
  target_amount: number;
  collected_amount: number;
  pending_amount: number;
};

export type PaymentModeRow = {
  payment_mode: string;
  receipts: number;
  amount: number;
};

export type FeesDashboardPayload = ApiStatusPayload & {
  context: FeesDashboardContext;
  summary: FeesDashboardSummary;
  collection_vs_target: CollectionVsTargetRow[];
  headwise: HeadwiseRow[];
  payment_mode_mix: PaymentModeRow[];
};

function optional(value: string | number | null | undefined) {
  return value === '' || value === undefined ? null : value;
}

/** Mirrors buildReportProxyHeaders in fees-report-utils.ts — the proxy reads session from these. */
function buildDashboardProxyHeaders(session: FeesSession) {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  headers.set('x-laravel-base-url', getApiBaseUrl(session));
  if (session.token) headers.set('x-laravel-token', session.token);
  if (session.subInstituteId) headers.set('x-sub-institute-id', session.subInstituteId);
  if (session.academicYearId) headers.set('x-academic-year-id', session.academicYearId);
  if (session.userId) headers.set('x-user-id', session.userId);
  if (session.termId) headers.set('x-term-id', session.termId);
  return headers;
}

export async function fetchFeesDashboardSummary(
  session: FeesSession,
  request: FeesDashboardRequest,
  signal?: AbortSignal
): Promise<FeesDashboardPayload> {
  const response = await fetch(FEES_DASHBOARD_SUMMARY_PATH, {
    method: 'POST',
    signal,
    headers: buildDashboardProxyHeaders(session),
    cache: 'no-store',
    credentials: 'include',
    body: JSON.stringify({
      type: 'JSON',
      sub_institute_id: request.sub_institute_id,
      syear: request.syear,
      user_id: request.user_id,
      month_id: optional(request.month_id),
      from_date: optional(request.from_date),
      to_date: optional(request.to_date),
      grade_id: optional(request.grade_id),
      standard_id: optional(request.standard_id),
      section_id: optional(request.section_id),
    }),
  });

  const text = await response.text();

  let payload: FeesDashboardPayload;
  try {
    payload = JSON.parse(text) as FeesDashboardPayload;
  } catch {
    throw new Error(
      `Fees dashboard proxy returned a non-JSON response (${response.headers.get('content-type') || 'unknown content type'}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      readString(asRecord(payload).message) || `HTTP ${response.status}: Unable to load the fees dashboard summary.`
    );
  }

  assertApiSuccess(payload, 'Unable to load the fees dashboard summary.');

  return payload;
}
