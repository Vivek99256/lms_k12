'use client';

/**
 * Recruitment & ATS Center API client.
 *
 * Ported from G2G's `services/talent/recruitment.ts` — backed directly by the
 * legacy Laravel recruitment routes (`/job-postings`, `/candidate`,
 * `/job-applications`, `/interview-*`, `/offers`, `/talent-offers`,
 * `/talent-screening-results`, `/interview-panel/*`, `/evaluation`,
 * `/feedback`, `/pending-feedback`, `/interviews/{id}/decision`,
 * `/talent-acquisition/*`, `/talent-templates`, `/talent/team-overview`).
 * Unlike the sibling onboarding/performance/mobility talent-management
 * ports, this module is an EXACT as-is migration: endpoint paths, HTTP
 * methods, query/body field names and response shapes are preserved exactly
 * as in G2G (per explicit instruction — recruitment's backend is not being
 * redesigned). Only the transport changed: native `fetch` + this project's
 * `buildSessionContext()` / `createAuthHeaders()` (see `lib/erp-client.ts`)
 * instead of G2G's `apiClient` + `LaravelContext`, following the same
 * adaptation shape as `app/hrit/_lib/payroll-api.ts` and
 * `app/talent-management/_lib/onboarding-api.ts`.
 *
 * Two endpoints are NOT Laravel REST calls and are ported as bare client-side
 * calls, exactly as G2G made them:
 *   - `analyzeJobDescription` POSTs to `/gemini/analyze-jd` through the same
 *     `/api` Laravel base used everywhere else. Whether that route exists on
 *     this repo's backend yet is NOT verified here — a separate agent owns
 *     the backend port, so this call is wired as-is and will 404/error until
 *     that route lands.
 *   - `sendJobPostingWebhook` fires a GET to an external n8n webhook URL
 *     (`https://n8n.triz.co.in/...`), completely outside this app's backend.
 *     Ported verbatim, fire-and-forget, swallowing its own errors like G2G.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';
import type {
  CandidateKanbanResponse, CandidateProfileApi, CandidateScreeningResponse, FeedbackApi,
  FeedbackPayload, FunnelResponse, InterviewApi, InterviewerApi, InterviewPanelApi,
  JobApplicationApi, JobPostingApi, RecruitmentLaravelId, RequisitionPage,
  OfferTemplateApi, ScreeningResultApi, TalentItemResponse, TalentListResponse, TalentOfferApi,
  TeamOverviewApi,
} from './talent-types';

export { buildSessionContext };
export type { SessionContext };

// ---------------------------------------------------------------------------
// Low-level transport
// ---------------------------------------------------------------------------

/** Laravel replies with {message, errors} on 4xx — mirrors G2G's `ApiError`. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as ApiEnvelope).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

async function request<T>(
  session: SessionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options?: { params?: Record<string, string | undefined>; body?: unknown; form?: FormData; headers?: Record<string, string> },
): Promise<T> {
  const search = new URLSearchParams();
  Object.entries(options?.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value);
  });

  const url = `${session.baseUrl}/api${path}${search.toString() ? `?${search.toString()}` : ''}`;

  const isForm = Boolean(options?.form);
  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: {
      ...createAuthHeaders(session, isForm ? undefined : 'application/json'),
      ...options?.headers,
    },
    body: isForm ? options?.form : options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    const errors = payload && typeof payload === 'object' && 'errors' in (payload as Record<string, unknown>)
      ? (payload as { errors?: Record<string, string[]> }).errors
      : undefined;
    throw new ApiError(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`), response.status, errors);
  }

  return payload as T;
}

const apiGet = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'GET', path, { params });
const apiPost = <T,>(session: SessionContext, path: string, body: unknown, headers?: Record<string, string>) =>
  request<T>(session, 'POST', path, { body, headers });
const apiPut = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'PUT', path, { body });
const apiDelete = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'DELETE', path, { params });
/** Multipart create. */
const apiPostForm = <T,>(session: SessionContext, path: string, form: FormData) =>
  request<T>(session, 'POST', path, { form });
/** Multipart update — spoofed PUT via `_method`, sent as POST (matches G2G's `apiClient.putForm`). */
const apiPutForm = <T,>(session: SessionContext, path: string, form: FormData) => {
  form.set('_method', 'PUT');
  return request<T>(session, 'POST', path, { form });
};

/**
 * Standard Laravel context params, mirroring G2G's `withLaravelParams`.
 *
 * Adaptation from G2G: `withLaravelParams` also sends `organization_id`,
 * `org_type` and `profile_id`, sourced from G2G's richer `LaravelContext`.
 * This repo's `SessionContext` (lib/erp-client.ts) carries no equivalent
 * fields, so those three are omitted here — same adaptation already made by
 * `app/talent-management/_lib/onboarding-api.ts`'s `withContextParams`.
 */
function contextParams(session: SessionContext, extra?: Record<string, string | undefined>): Record<string, string> {
  const params: Record<string, string> = {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    financial_year: session.syear,
    user_id: session.userId,
    type: 'API',
  };
  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value !== undefined) params[key] = value;
  });
  return params;
}

function bearerHeaders(session: SessionContext): Record<string, string> {
  return session.token ? { Authorization: `Bearer ${session.token}` } : {};
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Job availability is derived from its closing date, not its stored status. */
export function isOpenJobPosting(job: JobPostingApi) {
  if (job.status?.toLowerCase() !== 'active') return false;
  const closingDate = job.deadline ?? job.end_date;
  if (!closingDate) return true;

  const closingDateKey = closingDate.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(closingDateKey)
    ? localDateKey(new Date()) <= closingDateKey
    : new Date() <= new Date(closingDate);
}

export const recruitmentService = {
  async getJobs(session: SessionContext) {
    return (await apiGet<TalentListResponse<JobPostingApi>>(session, '/job-postings', contextParams(session))).data ?? [];
  },
  async getOpenJobs(session: SessionContext) {
    return (await this.getJobs(session)).filter(isOpenJobPosting);
  },
  createJob(session: SessionContext, data: Omit<JobPostingApi, 'id'>) {
    return apiPost<TalentItemResponse<JobPostingApi>>(session, '/job-postings', { ...data, ...contextParams(session) });
  },
  updateJob(session: SessionContext, id: RecruitmentLaravelId, data: Partial<JobPostingApi>) {
    return apiPut<TalentItemResponse<JobPostingApi>>(session, `/job-postings/${id}`, { ...data, ...contextParams(session) });
  },
  createJobForm(session: SessionContext, data: FormData) {
    Object.entries(contextParams(session)).forEach(([key, value]) => data.set(key, value));
    data.set('created_by', session.userId || '1');
    data.set('updated_at', '');
    data.set('skip_updated_at', 'true');
    return apiPostForm<TalentItemResponse<JobPostingApi>>(session, '/job-postings', data);
  },
  updateJobForm(session: SessionContext, id: RecruitmentLaravelId, data: FormData) {
    Object.entries(contextParams(session)).forEach(([key, value]) => data.set(key, value));
    data.set('updated_by', session.userId || '1');
    return apiPutForm<TalentItemResponse<JobPostingApi>>(session, `/job-postings/${id}`, data);
  },
  analyzeJobDescription(session: SessionContext, jd: string) {
    return apiPost<Record<string, unknown>>(session, '/gemini/analyze-jd', {
      jd, sub_institute_id: session.subInstituteId,
    });
  },
  /** Fires a GET at an external n8n webhook, outside this app's backend. Ported as-is. */
  async sendJobPostingWebhook(
    form: object,
    job: JobPostingApi,
    analysis: Record<string, unknown>,
  ) {
    try {
      const params = new URLSearchParams(Object.entries(form).map(([key, value]) => [key, String(value)]));
      params.set('jobPostingId', String(job?.id ?? ''));
      params.set('jobPostingCreatedAt', job?.created_at ?? '');
      params.set('jdAnalysis', JSON.stringify(analysis ?? {}));
      params.set('timestamp', new Date().toISOString());
      await fetch(`https://n8n.triz.co.in/ff441ace-87f3-4cb5-9d26-838653929aa7?${params}`, { method: 'GET' });
    } catch (cause) {
      console.error('Job posting webhook failed:', cause);
    }
  },
  deleteJob(session: SessionContext, id: RecruitmentLaravelId) {
    return apiDelete<{ message: string }>(session, `/job-postings/${id}`, contextParams(session));
  },
  async getApplications(session: SessionContext) {
    return (await apiGet<TalentListResponse<JobApplicationApi>>(session, '/job-applications', contextParams(session))).data ?? [];
  },
  getCandidateKanban(session: SessionContext, filters?: Record<string, string>) {
    return apiGet<CandidateKanbanResponse>(session, '/candidate', contextParams(session, filters));
  },
  getApplication(session: SessionContext, id: RecruitmentLaravelId) {
    return apiGet<TalentItemResponse<JobApplicationApi>>(session, `/job-applications/${id}`, contextParams(session));
  },
  createApplication(session: SessionContext, data: FormData) {
    Object.entries(contextParams(session)).forEach(([key, value]) => data.set(key, value));
    return apiPostForm<TalentItemResponse<JobApplicationApi>>(session, '/job-applications', data);
  },
  updateApplication(session: SessionContext, id: RecruitmentLaravelId, data: Partial<JobApplicationApi>) {
    return apiPut<TalentItemResponse<JobApplicationApi>>(session, `/job-applications/${id}`, { ...data, ...contextParams(session) });
  },
  moveCandidate(session: SessionContext, id: RecruitmentLaravelId, stage: string) {
    const statusByStage: Record<string, string> = {
      Applied: 'Pending Review',
      Screened: 'Shortlisted',
      Assessment: 'Assessment',
      Interview: 'Interview Scheduled',
      Offer: 'Offered',
      Hired: 'Hired',
      Rejected: 'Rejected',
    };
    return this.updateApplication(session, id, { status: statusByStage[stage] ?? stage });
  },
  async getInterviews(session: SessionContext) {
    return (await apiGet<{ data?: InterviewApi[] }>(session, '/interview-details', contextParams(session))).data ?? [];
  },
  createInterview(session: SessionContext, data: Partial<InterviewApi>) {
    return apiPost<TalentItemResponse<InterviewApi>>(session, '/interview-schedules', { ...data, ...contextParams(session) });
  },
  updateInterview(session: SessionContext, id: RecruitmentLaravelId, data: Partial<InterviewApi>) {
    return apiPut<TalentItemResponse<InterviewApi>>(session, `/interview-schedules/${id}`, { ...data, ...contextParams(session) });
  },
  async getOffers(session: SessionContext) {
    const result = await apiGet<TalentListResponse<TalentOfferApi> | TalentOfferApi[]>(session, '/offers', contextParams(session));
    return Array.isArray(result) ? result : result.data ?? [];
  },
  createOffer(session: SessionContext, data: Record<string, unknown>) {
    return apiPost<TalentItemResponse<TalentOfferApi>>(session, '/talent-offers', { ...data, ...contextParams(session) });
  },
  rejectOffer(session: SessionContext, id: RecruitmentLaravelId) {
    return apiPost<TalentItemResponse<TalentOfferApi>>(session, `/talent-offers/${id}/reject`, contextParams(session));
  },
  /** Not fetched — a download-link href, mirroring G2G's `buildApiUrl` usage. */
  offerLetterUrl(session: SessionContext, id: RecruitmentLaravelId) {
    const query = new URLSearchParams(contextParams(session)).toString();
    return `${session.baseUrl}/api/talent-offer-letter/${id}${query ? `?${query}` : ''}`;
  },
  getScreeningResult(session: SessionContext, candidateId: RecruitmentLaravelId) {
    return apiGet<CandidateScreeningResponse>(session, `/talent-screening-results/candidate/${candidateId}`, contextParams(session));
  },
  async getCandidateProfile(session: SessionContext, candidateId: RecruitmentLaravelId): Promise<CandidateProfileApi> {
    const [screening, applications] = await Promise.all([
      this.getScreeningResult(session, candidateId),
      this.getApplications(session),
    ]);
    const application = applications.find((item) => String(item.id) === String(candidateId));
    if (!application) {
      throw new ApiError('Candidate application not found', 404);
    }
    return { screening, application };
  },
  storeScreeningResult(session: SessionContext, data: Record<string, unknown>) {
    return apiPost<TalentItemResponse<ScreeningResultApi>>(session, '/talent-screening-results', {
      ...data, ...contextParams(session),
    });
  },
  async getPanels(session: SessionContext) {
    return (await apiGet<{ status: boolean; data: InterviewPanelApi[] }>(session, '/interview-panel/list', contextParams(session))).data ?? [];
  },
  async getInterviewers(session: SessionContext) {
    return (await apiGet<{ status: boolean; data: InterviewerApi[] }>(session, '/interview-panel/users', contextParams(session))).data ?? [];
  },
  createPanel(session: SessionContext, data: Omit<InterviewPanelApi, 'id'>) {
    return apiPost<TalentItemResponse<InterviewPanelApi>>(session, '/interview-panel/store', { ...data, ...contextParams(session) });
  },
  updatePanel(session: SessionContext, id: RecruitmentLaravelId, data: Partial<InterviewPanelApi>) {
    return apiPut<TalentItemResponse<InterviewPanelApi>>(session, `/interview-panel/update/${id}`, { ...data, ...contextParams(session) });
  },
  deletePanel(session: SessionContext, id: RecruitmentLaravelId) {
    return apiDelete<{ message: string }>(session, `/interview-panel/delete/${id}`, contextParams(session));
  },
  createFeedback(session: SessionContext, data: FeedbackPayload) {
    return apiPost<{ status: boolean; message: string }>(session, '/evaluation', { ...data, ...contextParams(session) });
  },
  async getFeedback(session: SessionContext) {
    return (await apiGet<{ status: boolean; data?: FeedbackApi[] }>(session, '/feedback', contextParams(session))).data ?? [];
  },
  getCandidateFeedback(session: SessionContext, candidateId: RecruitmentLaravelId) {
    return apiGet<{ status: boolean; data?: FeedbackApi }>(session, `/feedback/${candidateId}`, contextParams(session));
  },
  updateFeedback(session: SessionContext, id: RecruitmentLaravelId, data: FeedbackPayload) {
    return apiPut<{ status: boolean; message: string }>(session, `/feedback/${id}`, {
      ...data, ...contextParams(session),
    });
  },
  deleteFeedback(session: SessionContext, id: RecruitmentLaravelId) {
    return apiDelete<{ status: boolean; message: string }>(session, `/feedback/${id}`, contextParams(session));
  },
  async getPendingFeedback(session: SessionContext) {
    try {
      const result = await apiGet<{ status: boolean; count: number; data?: FeedbackApi[] }>(session, '/pending-feedback', contextParams(session));
      return result.data ?? [];
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) return [];
      throw cause;
    }
  },
  recordDecision(session: SessionContext, interviewId: RecruitmentLaravelId, decision: 'hired' | 'rejected', notes?: string) {
    return apiPost<{ status: boolean; message: string }>(session, `/interviews/${interviewId}/decision`, {
      decision, notes, ...contextParams(session),
    });
  },
  /** Explicit `Authorization` header, mirroring G2G's `bearerHeaders()` on this endpoint. */
  getRequisitions(session: SessionContext, page = 1, limit = 10) {
    return apiPost<RequisitionPage>(session, '/talent-acquisition/requisitions', {
      ...contextParams(session), page, limit, sortBy: 'age', order: 'desc',
    }, bearerHeaders(session));
  },
  getFunnel(session: SessionContext) {
    return apiPost<FunnelResponse>(session, '/talent-acquisition/funnel', contextParams(session), bearerHeaders(session));
  },
  async getTemplates(session: SessionContext) {
    const result = await apiGet<TalentListResponse<OfferTemplateApi> | OfferTemplateApi[]>(session, '/talent-templates', contextParams(session));
    return Array.isArray(result) ? result : result.data ?? [];
  },
  async getTeamOverview(session: SessionContext) {
    return apiGet<{ data: TeamOverviewApi; recent_team_updates?: string[] }>(session, '/talent/team-overview', contextParams(session));
  },
};
