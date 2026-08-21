'use client';

/**
 * Performance & Rewards Center API client.
 *
 * Ported from G2G's `services/talent/performance.ts` — backed by the Laravel
 * `/api/performance/*` module (token + sub_institute_id via a Laravel-context
 * params bag, JSON envelope `{status, message, data}`). Every endpoint from
 * the source file is ported 1:1: same path, same HTTP method, same field
 * names. Only the transport changed, following the established port pattern
 * in `app/hrit/_lib/payroll-api.ts`: native `fetch` + this project's
 * `buildSessionContext()` / `createAuthHeaders()` (see `lib/erp-client.ts`)
 * instead of G2G's `apiClient` + `LaravelContext`/`withLaravelParams`.
 *
 * NOTE: `user_id` is the CONTEXT ACTOR on every call (the signed-in user, via
 * the session). The subject employee travels as `user_id_target` on writes
 * and `user_id_filter` on reads - never as `user_id`. This mirrors G2G's
 * comment verbatim; the field names are unchanged.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';

import type {
  ActivityEntryType,
  AppraisalPayload,
  AppraisalSummary,
  BonusDecisionAction,
  BonusPayload,
  BonusSummary,
  BoardColumn,
  CalibrationGrid,
  CalibrationSessionPayload,
  CalibrationSummary,
  CompensationPayload,
  CompensationSummary,
  CyclePayload,
  DecisionAction,
  GoalPayload,
  GoalSummary,
  GoalUpdatePayload,
  LaunchPayload,
  LaunchResult,
  PerfActivityEntry,
  PerfAppraisal,
  PerfAttachment,
  PerfBonus,
  PerfCalibrationSession,
  PerfCompensation,
  PerfCycle,
  PerfFilterOptions,
  PerfGoal,
  PerfListResponse,
  PerfNote,
  PerfOption,
  PerfOverview,
  PerfPagination,
  PerfResponse,
  PerfReview,
  PerfReviewDetail,
  PerfSavedView,
  PerfSummaryListResponse,
  PerfTab,
  ReviewFilters,
  ReviewStage,
  ReviewStatus,
  ReviewUpdatePayload,
  TeamComparison,
  TimelineCycle,
  BulkReviewAction,
} from './talent-types';

export { buildSessionContext };
export type { SessionContext };

// Re-exported so callers/hooks can `import type { ... } from './performance-api'`
// exactly like the source imported them from `services/talent/performance`.
export type {
  ActivityEntryType,
  AppraisalPayload,
  AppraisalSummary,
  BonusDecisionAction,
  BonusPayload,
  BonusSummary,
  BoardColumn,
  CalibrationGrid,
  CalibrationSessionPayload,
  CalibrationSummary,
  CompensationPayload,
  CompensationSummary,
  CyclePayload,
  DecisionAction,
  GoalPayload,
  GoalSummary,
  GoalUpdatePayload,
  LaunchPayload,
  LaunchResult,
  PerfActivityEntry,
  PerfAppraisal,
  PerfAttachment,
  PerfBonus,
  PerfCalibrationSession,
  PerfCompensation,
  PerfCycle,
  PerfFilterOptions,
  PerfGoal,
  PerfListResponse,
  PerfNote,
  PerfOption,
  PerfOverview,
  PerfPagination,
  PerfResponse,
  PerfReview,
  PerfReviewDetail,
  PerfSavedView,
  PerfSummaryListResponse,
  PerfTab,
  ReviewFilters,
  ReviewStage,
  ReviewStatus,
  ReviewUpdatePayload,
  TeamComparison,
  TimelineCycle,
  BulkReviewAction,
};

/** A `stage`/`recommendation`/`revision_type`/... enum with its option list. */
export type { CycleOption, CycleStatus, CycleType, EmployeeOption } from './talent-types';

/** Remaining status/enum types referenced by `performance-shared.tsx` etc. */
export type {
  CalibrationStatus,
  DecisionStatus,
  GoalStatus,
  GoalCategory,
  Recommendation,
  RevisionType,
  BonusType,
  BonusStatus,
} from './talent-types';

/** Icon keys the KPI row maps to lucide components. */
export type { PerfKpiIcon, PerfKpi } from './talent-types';

/* ------------------------------------------------------------------ *
 * Low-level transport
 * ------------------------------------------------------------------ */

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as ApiEnvelope).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

/** True once a session has the bare minimum a performance call needs to not 401. */
export function isPerformanceSessionReady(session: SessionContext): boolean {
  return Boolean(session.token && session.subInstituteId);
}

async function apiRequest<T>(
  session: SessionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown | FormData,
): Promise<T> {
  const url = `${session.baseUrl}/api${path}`;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: createAuthHeaders(session, isForm || body === undefined ? undefined : 'application/json'),
    body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`));
  }

  return payload as T;
}

function buildQuery(params: Record<string, string>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

const apiGet = <T,>(session: SessionContext, path: string, params: Record<string, string> = {}) =>
  apiRequest<T>(session, 'GET', `${path}${buildQuery(params)}`);

const apiPost = <T,>(session: SessionContext, path: string, body: unknown) =>
  apiRequest<T>(session, 'POST', path, body);

const apiPut = <T,>(session: SessionContext, path: string, body: unknown) =>
  apiRequest<T>(session, 'PUT', path, body);

const apiDelete = <T,>(session: SessionContext, path: string, params: Record<string, string> = {}) =>
  apiRequest<T>(session, 'DELETE', `${path}${buildQuery(params)}`);

const apiPostForm = <T,>(session: SessionContext, path: string, form: FormData) =>
  apiRequest<T>(session, 'POST', path, form);

/**
 * Standard Laravel context params, mirroring G2G's `withLaravelParams`.
 * `user_id` is the signed-in actor - every read/write on this screen sends it
 * this way, never as the subject employee (that is `user_id_target` /
 * `user_id_filter`, carried in each call's own payload/filters).
 */
function withContextParams(session: SessionContext, extra?: Record<string, string | undefined>) {
  return {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    financial_year: session.syear,
    user_id: session.userId,
    type: 'API',
    ...extra,
  };
}

/**
 * Query params must be strings. Drops null / undefined / '' so an unset filter
 * is absent rather than sent as the literal "undefined" (which the API would
 * treat as an active filter). Always includes the context params.
 */
function toParams(session: SessionContext, input: object = {}): Record<string, string> {
  const merged: Record<string, unknown> = { ...withContextParams(session), ...input };
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(merged)) {
    if (value === null || value === undefined || value === '') continue;
    params[key] = typeof value === 'string' ? value : String(value);
  }

  return params;
}

/** Same trimming for JSON bodies, but `null` is kept - it clears a column. */
function toBody(session: SessionContext, input: object = {}): Record<string, unknown> {
  const body: Record<string, unknown> = { ...withContextParams(session) };

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    body[key] = value;
  }

  return body;
}

/* ------------------------------------------------------------------ *
 * Service
 * ------------------------------------------------------------------ */

export const performanceService = {
  /* -- Header -- */

  getOverview: (session: SessionContext, cycleId?: string) =>
    apiGet<PerfResponse<PerfOverview>>(session, '/performance/overview', toParams(session, { cycle_id: cycleId })),

  getFilters: (session: SessionContext) =>
    apiGet<PerfResponse<PerfFilterOptions>>(session, '/performance/filters', toParams(session)),

  getTeamComparison: (session: SessionContext, departmentId: string, cycleId?: string) =>
    apiGet<PerfResponse<TeamComparison>>(
      session,
      '/performance/team-comparison',
      toParams(session, { department_id: departmentId, cycle_id: cycleId }),
    ),

  getTimeline: (session: SessionContext, cycleId?: string) =>
    apiGet<PerfResponse<TimelineCycle[]>>(session, '/performance/timeline', toParams(session, { cycle_id: cycleId })),

  /* -- Cycles -- */

  getCycles: (session: SessionContext, status?: string) =>
    apiGet<PerfResponse<PerfCycle[]>>(session, '/performance/cycles', toParams(session, { status })),

  getCycle: (session: SessionContext, id: number) =>
    apiGet<PerfResponse<PerfCycle>>(session, `/performance/cycles/${id}`, toParams(session)),

  createCycle: (session: SessionContext, payload: CyclePayload) =>
    apiPost<PerfResponse<PerfCycle>>(session, '/performance/cycles', toBody(session, payload)),

  updateCycle: (session: SessionContext, id: number, payload: Partial<CyclePayload>) =>
    apiPut<PerfResponse<PerfCycle>>(session, `/performance/cycles/${id}`, toBody(session, payload)),

  launchCycle: (session: SessionContext, id: number, payload: LaunchPayload = {}) =>
    apiPost<PerfResponse<LaunchResult>>(session, `/performance/cycles/${id}/launch`, toBody(session, payload)),

  closeCycle: (session: SessionContext, id: number, force = false) =>
    apiPost<PerfResponse<PerfCycle>>(
      session,
      `/performance/cycles/${id}/close`,
      toBody(session, force ? { force: 1 } : {}),
    ),

  deleteCycle: (session: SessionContext, id: number) =>
    apiDelete<PerfResponse<{ id: number }>>(session, `/performance/cycles/${id}`, toParams(session)),

  /* -- Reviews -- */

  getReviews: (session: SessionContext, filters: ReviewFilters = {}) =>
    apiGet<PerfListResponse<PerfReview[]>>(session, '/performance/reviews', toParams(session, filters)),

  getBoard: (session: SessionContext, filters: ReviewFilters = {}, columnLimit = 50) =>
    apiGet<PerfResponse<BoardColumn[]>>(
      session,
      '/performance/reviews/board',
      toParams(session, { ...filters, column_limit: columnLimit }),
    ),

  getReview: (session: SessionContext, id: number) =>
    apiGet<PerfResponse<PerfReviewDetail>>(session, `/performance/reviews/${id}`, toParams(session)),

  updateReview: (session: SessionContext, id: number, payload: ReviewUpdatePayload) =>
    apiPut<PerfResponse<PerfReview>>(session, `/performance/reviews/${id}`, toBody(session, payload)),

  advanceReview: (session: SessionContext, id: number, options: { stage?: ReviewStage; rating?: number } = {}) =>
    apiPost<PerfResponse<PerfReview>>(session, `/performance/reviews/${id}/advance`, toBody(session, options)),

  sendReminder: (session: SessionContext, id: number) =>
    apiPost<PerfResponse<{ id: number; last_reminder_label: string | null }>>(
      session,
      `/performance/reviews/${id}/reminder`,
      toBody(session),
    ),

  bulkReviews: (
    session: SessionContext,
    ids: number[],
    action: BulkReviewAction,
    options: { stage?: ReviewStage; manager_id?: number; due_date?: string } = {},
  ) =>
    apiPost<PerfResponse<{ affected: number; skipped: number[] }>>(session, '/performance/reviews/bulk', {
      ...toBody(session, options),
      ids,
      action,
    }),

  deleteReview: (session: SessionContext, id: number) =>
    apiDelete<PerfResponse<{ id: number }>>(session, `/performance/reviews/${id}`, toParams(session)),

  /* -- Goals -- */

  getGoals: (
    session: SessionContext,
    filters: ReviewFilters & { category?: string; goal_status?: string; review_id?: number } = {},
  ) =>
    apiGet<PerfSummaryListResponse<PerfGoal[], GoalSummary>>(session, '/performance/goals', toParams(session, filters)),

  createGoal: (session: SessionContext, payload: GoalPayload) =>
    apiPost<PerfResponse<PerfGoal>>(session, '/performance/goals', toBody(session, payload)),

  updateGoal: (session: SessionContext, id: number, payload: GoalUpdatePayload) =>
    apiPut<PerfResponse<PerfGoal>>(session, `/performance/goals/${id}`, toBody(session, payload)),

  deleteGoal: (session: SessionContext, id: number) =>
    apiDelete<PerfResponse<{ id: number }>>(session, `/performance/goals/${id}`, toParams(session)),

  /* -- Appraisals -- */

  getAppraisals: (session: SessionContext, filters: ReviewFilters & { recommendation?: string } = {}) =>
    apiGet<PerfSummaryListResponse<PerfAppraisal[], AppraisalSummary>>(
      session,
      '/performance/appraisals',
      toParams(session, filters),
    ),

  createAppraisal: (session: SessionContext, payload: AppraisalPayload) =>
    apiPost<PerfResponse<PerfAppraisal>>(session, '/performance/appraisals', toBody(session, payload)),

  updateAppraisal: (
    session: SessionContext,
    id: number,
    payload: Partial<Omit<AppraisalPayload, 'user_id_target'>>,
  ) => apiPut<PerfResponse<PerfAppraisal>>(session, `/performance/appraisals/${id}`, toBody(session, payload)),

  decideAppraisal: (session: SessionContext, id: number, action: DecisionAction, remarks?: string) =>
    apiPut<PerfResponse<PerfAppraisal>>(session, `/performance/appraisals/${id}/decision`, {
      ...toBody(session, { remarks }),
      action,
    }),

  bulkAppraisals: (session: SessionContext, ids: number[], action: DecisionAction) =>
    apiPost<PerfResponse<{ affected: number }>>(session, '/performance/appraisals/bulk', {
      ...toBody(session),
      ids,
      action,
    }),

  deleteAppraisal: (session: SessionContext, id: number) =>
    apiDelete<PerfResponse<{ id: number }>>(session, `/performance/appraisals/${id}`, toParams(session)),

  /* -- Compensation -- */

  getCompensation: (session: SessionContext, filters: ReviewFilters & { revision_type?: string } = {}) =>
    apiGet<PerfSummaryListResponse<PerfCompensation[], CompensationSummary>>(
      session,
      '/performance/compensation',
      toParams(session, filters),
    ),

  createCompensation: (session: SessionContext, payload: CompensationPayload) =>
    apiPost<PerfResponse<PerfCompensation>>(session, '/performance/compensation', toBody(session, payload)),

  updateCompensation: (
    session: SessionContext,
    id: number,
    payload: Partial<Omit<CompensationPayload, 'user_id_target'>>,
  ) =>
    apiPut<PerfResponse<PerfCompensation>>(session, `/performance/compensation/${id}`, toBody(session, payload)),

  decideCompensation: (session: SessionContext, id: number, action: DecisionAction, remarks?: string) =>
    apiPut<PerfResponse<PerfCompensation>>(session, `/performance/compensation/${id}/decision`, {
      ...toBody(session, { remarks }),
      action,
    }),

  bulkCompensation: (session: SessionContext, ids: number[], action: DecisionAction) =>
    apiPost<PerfResponse<{ affected: number }>>(session, '/performance/compensation/bulk', {
      ...toBody(session),
      ids,
      action,
    }),

  deleteCompensation: (session: SessionContext, id: number) =>
    apiDelete<PerfResponse<{ id: number }>>(session, `/performance/compensation/${id}`, toParams(session)),

  /* -- Bonus -- */

  getBonus: (session: SessionContext, filters: ReviewFilters & { bonus_type?: string; payout_month?: string } = {}) =>
    apiGet<PerfSummaryListResponse<PerfBonus[], BonusSummary> & { payout_months: PerfOption[] }>(
      session,
      '/performance/bonus',
      toParams(session, filters),
    ),

  createBonus: (session: SessionContext, payload: BonusPayload) =>
    apiPost<PerfResponse<PerfBonus>>(session, '/performance/bonus', toBody(session, payload)),

  updateBonus: (session: SessionContext, id: number, payload: Partial<Omit<BonusPayload, 'user_id_target'>>) =>
    apiPut<PerfResponse<PerfBonus>>(session, `/performance/bonus/${id}`, toBody(session, payload)),

  decideBonus: (session: SessionContext, id: number, action: BonusDecisionAction, remarks?: string) =>
    apiPut<PerfResponse<PerfBonus>>(session, `/performance/bonus/${id}/decision`, {
      ...toBody(session, { remarks }),
      action,
    }),

  bulkBonus: (session: SessionContext, ids: number[], action: BonusDecisionAction) =>
    apiPost<PerfResponse<{ affected: number }>>(session, '/performance/bonus/bulk', {
      ...toBody(session),
      ids,
      action,
    }),

  deleteBonus: (session: SessionContext, id: number) =>
    apiDelete<PerfResponse<{ id: number }>>(session, `/performance/bonus/${id}`, toParams(session)),

  /* -- Calibration -- */

  getCalibrationSessions: (session: SessionContext, filters: ReviewFilters = {}) =>
    apiGet<PerfSummaryListResponse<PerfCalibrationSession[], CalibrationSummary>>(
      session,
      '/performance/calibration-sessions',
      toParams(session, filters),
    ),

  getCalibrationGrid: (session: SessionContext, id: number) =>
    apiGet<PerfResponse<CalibrationGrid>>(session, `/performance/calibration-sessions/${id}/grid`, toParams(session)),

  createCalibrationSession: (session: SessionContext, payload: CalibrationSessionPayload) =>
    apiPost<PerfResponse<PerfCalibrationSession>>(
      session,
      '/performance/calibration-sessions',
      toBody(session, payload),
    ),

  updateCalibrationSession: (
    session: SessionContext,
    id: number,
    payload: Partial<Omit<CalibrationSessionPayload, 'cycle_id' | 'attach_reviews'>>,
  ) =>
    apiPut<PerfResponse<PerfCalibrationSession>>(
      session,
      `/performance/calibration-sessions/${id}`,
      toBody(session, payload),
    ),

  calibrateRatings: (
    session: SessionContext,
    id: number,
    payload:
      | { review_id: number; rating: number; potential_rating?: number }
      | { ratings: Array<{ review_id: number; rating: number }> },
  ) =>
    apiPut<PerfResponse<{ updated: number; skipped: number[] }>>(
      session,
      `/performance/calibration-sessions/${id}/calibrate`,
      toBody(session, payload),
    ),

  lockCalibrationSession: (
    session: SessionContext,
    id: number,
    options: { force?: boolean; advance?: boolean } = {},
  ) =>
    apiPost<PerfResponse<{ session: PerfCalibrationSession; advanced_reviews: number }>>(
      session,
      `/performance/calibration-sessions/${id}/lock`,
      {
        ...toBody(session),
        ...(options.force ? { force: 1 } : {}),
        ...(options.advance === false ? { advance: 0 } : {}),
      },
    ),

  deleteCalibrationSession: (session: SessionContext, id: number) =>
    apiDelete<PerfResponse<{ id: number }>>(
      session,
      `/performance/calibration-sessions/${id}`,
      toParams(session),
    ),

  /* -- Activity -- */

  getActivity: (
    session: SessionContext,
    filters: {
      tab?: 'feed' | 'audit'
      review_id?: number
      cycle_id?: string
      subject_type?: string
      actor_id?: string
      search?: string
      date_from?: string
      date_to?: string
      page?: number
      per_page?: number
    } = {},
  ) => apiGet<PerfListResponse<PerfActivityEntry[]>>(session, '/performance/activity', toParams(session, filters)),

  getActivityFilters: (session: SessionContext) =>
    apiGet<PerfResponse<{ actors: PerfOption[]; modules: PerfOption[] }>>(
      session,
      '/performance/activity/filters',
      toParams(session),
    ),

  /* -- Notes and comments -- */

  getNotes: (session: SessionContext, reviewId: number, noteType?: 'comment' | 'note') =>
    apiGet<PerfResponse<PerfNote[]> & { counts: { comment: number; note: number } }>(
      session,
      `/performance/reviews/${reviewId}/notes`,
      toParams(session, { note_type: noteType }),
    ),

  createNote: (
    session: SessionContext,
    reviewId: number,
    payload: { body: string; note_type?: 'comment' | 'note'; visibility?: PerfNote['visibility'] },
  ) => apiPost<PerfResponse<PerfNote>>(session, `/performance/reviews/${reviewId}/notes`, toBody(session, payload)),

  updateNote: (
    session: SessionContext,
    id: number,
    payload: { body?: string; visibility?: PerfNote['visibility'] },
  ) => apiPut<PerfResponse<PerfNote>>(session, `/performance/notes/${id}`, toBody(session, payload)),

  deleteNote: (session: SessionContext, id: number) =>
    apiDelete<PerfResponse<{ id: number }>>(session, `/performance/notes/${id}`, toParams(session)),

  /* -- Attachments -- */

  getAttachments: (session: SessionContext, reviewId: number) =>
    apiGet<PerfResponse<PerfAttachment[]> & { counts: { attachments: number } }>(
      session,
      `/performance/reviews/${reviewId}/attachments`,
      toParams(session),
    ),

  /**
   * Real upload. The auth params ride as query params because the body must stay
   * a multipart FormData for Laravel to see the file.
   */
  uploadAttachment: (
    session: SessionContext,
    reviewId: number,
    file: File,
    meta: { title?: string; document_type?: string } = {},
  ) => {
    const form = new FormData();
    form.append('file', file);
    if (meta.title) form.append('title', meta.title);
    if (meta.document_type) form.append('document_type', meta.document_type);

    const query = buildQuery(toParams(session));

    return apiPostForm<PerfResponse<PerfAttachment>>(session, `/performance/reviews/${reviewId}/attachments${query}`, form);
  },

  deleteAttachment: (session: SessionContext, id: number) =>
    apiDelete<PerfResponse<{ id: number }>>(session, `/performance/attachments/${id}`, toParams(session)),

  /* -- Saved views -- */

  getSavedViews: (session: SessionContext, tab?: PerfTab) =>
    apiGet<PerfResponse<PerfSavedView[]>>(session, '/performance/saved-views', toParams(session, { tab })),

  createSavedView: (
    session: SessionContext,
    payload: {
      name: string
      tab?: PerfTab
      filters?: Record<string, string>
      is_shared?: boolean
      is_default?: boolean
    },
  ) => apiPost<PerfResponse<PerfSavedView>>(session, '/performance/saved-views', toBody(session, payload)),

  updateSavedView: (
    session: SessionContext,
    id: number,
    payload: { name?: string; filters?: Record<string, string>; is_shared?: boolean; is_default?: boolean },
  ) => apiPut<PerfResponse<PerfSavedView>>(session, `/performance/saved-views/${id}`, toBody(session, payload)),

  deleteSavedView: (session: SessionContext, id: number) =>
    apiDelete<PerfResponse<{ id: number }>>(session, `/performance/saved-views/${id}`, toParams(session)),
};
