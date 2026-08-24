'use client';

/**
 * Onboarding & Employee Lifecycle Center API client.
 *
 * Ported from G2G's `services/talent/onboarding.ts` — backed by the Laravel
 * `/api/onboarding/*` module (App\Http\Controllers\Api\Onboarding). Endpoint
 * paths, HTTP methods, query params, body field names and response shapes are
 * kept exactly as in G2G. Only the transport changed: native `fetch` + this
 * project's `buildSessionContext()` / `createAuthHeaders()` (see
 * `lib/erp-client.ts`) instead of G2G's `apiClient` + `LaravelContext`.
 *
 * Multipart uploads (`uploadDocument`, `uploadDocumentFile`) follow the same
 * FormData + spoofed-PUT (`_method: 'PUT'` field, sent as POST) pattern
 * documented in `app/hrit/_lib/attendance-api.ts`.
 *
 *   Header
 *     GET  /onboarding/overview      - the 5 KPI cards
 *     GET  /onboarding/filters       - journey / department / owner / offer options
 *
 *   Journeys (list sheet, profile sidebar, "Start onboarding")
 *     GET|POST /onboarding/journeys
 *     POST /onboarding/journeys/from-offer/{offerId}
 *     GET|PUT|DELETE /onboarding/journeys/{id}
 *     GET  /onboarding/journeys/{id}/stages, /contacts, /timeline
 *     PUT  /onboarding/stages/{id}, POST /onboarding/stages/{id}/complete
 *
 *   Tasks (Preboarding table, row actions, Add Task, integration cards)
 *     GET|POST /onboarding/tasks, PUT|DELETE /onboarding/tasks/{id}
 *     POST /onboarding/tasks/{id}/complete, POST /onboarding/tasks/bulk
 *     GET  /onboarding/workstreams
 *
 *   Documents / Notes / Probation
 *     GET|POST /onboarding/journeys/{id}/documents, PUT|DELETE /onboarding/documents/{id}
 *     GET|POST /onboarding/journeys/{id}/notes, PUT|DELETE /onboarding/notes/{id}
 *     GET  /onboarding/probation, PUT /onboarding/probation/{journeyId}
 *     POST /onboarding/probation/{journeyId}/confirm | /extend | /terminate
 *
 * NOTE: `user_id` is the CONTEXT ACTOR on every call (withContextParams sends
 * the signed-in user). The subject is `employee_id` on a journey and
 * `owner_id` on a task - never `user_id`.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';

export { buildSessionContext };
export type { SessionContext };

// ---------------------------------------------------------------------------
// Low-level transport
// ---------------------------------------------------------------------------

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
  options?: { params?: Record<string, string | undefined>; body?: unknown; form?: FormData }
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
    headers: createAuthHeaders(session, isForm ? undefined : 'application/json'),
    body: isForm ? options?.form : options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`));
  }

  return payload as T;
}

const apiGet = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'GET', path, { params });
const apiPost = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'POST', path, { body });
const apiPut = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'PUT', path, { body });
const apiDelete = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'DELETE', path, { params });
/** Multipart create - the Documents sheet's file picker. */
const apiPostForm = <T,>(session: SessionContext, path: string, form: FormData) =>
  request<T>(session, 'POST', path, { form });
/** Multipart update - replacing a document's file (spoofed PUT via _method). */
const apiPutForm = <T,>(session: SessionContext, path: string, form: FormData) => {
  form.set('_method', 'PUT');
  return request<T>(session, 'POST', path, { form });
};

/** Standard Laravel context params, mirroring G2G's `withLaravelParams`. */
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
 * Filter objects carry numbers and booleans; the query string needs strings.
 * Drops undefined/null/'' so Laravel's filled() checks skip the param.
 */
function queryOf<T extends object>(filters: T | undefined) {
  const query: Record<string, string> = {};

  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query[key] = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
  });

  return query;
}

// ---------------------------------------------------------------------------
// Envelopes (unchanged from G2G)
// ---------------------------------------------------------------------------

export interface OnbResponse<T> {
  status: number
  message: string
  data: T
}

export interface OnbPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface OnbListResponse<T> extends OnbResponse<T> {
  pagination: OnbPagination
}

export interface OnbSummaryListResponse<T, S> extends OnbListResponse<T> {
  summary: S
}

// ---------------------------------------------------------------------------
// Shared vocabulary (mirrors the Laravel enums exactly)
// ---------------------------------------------------------------------------

export type JourneyStage =
  | 'preboarding' | 'first_day' | 'orientation' | 'team_integration'
  | 'probation' | 'confirmed' | 'exited'

export type JourneyStatus = 'not-started' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled'
export type TaskStatus = 'pending' | 'in_progress' | 'sent' | 'completed' | 'blocked'
export type TaskCategory = 'documents' | 'compliance' | 'it' | 'learning' | 'payroll' | 'benefits' | 'personal'
export type WorkstreamKey = 'it' | 'learning' | 'payroll' | 'benefits' | 'compliance'
export type StageKey =
  | 'offer_accepted' | 'preboarding' | 'first_day' | 'orientation'
  | 'team_integration' | 'probation' | 'confirmation'
export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'
export type DocumentStatus = 'pending' | 'sent' | 'received' | 'verified' | 'rejected'
export type ConfirmationStatus = 'pending' | 'confirmed' | 'extended' | 'terminated'
export type NoteVisibility = 'internal' | 'shared'
export type OnboardingTab = 'preboarding' | 'journey' | 'probation' | 'timeline'

export interface OnbOption {
  value: string
  label: string
}

export interface JourneyOption extends OnbOption {
  journey_code: string | null
  position: string | null
  stage: JourneyStage
  status: JourneyStatus
  joining_date: string | null
}

export interface EmployeeOption extends OnbOption {
  employee_no: string | null
  department_id: string | null
}

/** An offer the "Start from Accepted Offer" action can seed a journey from. */
export interface OfferOption extends OnbOption {
  position: string | null
  start_date: string | null
  candidate_name: string | null
  candidate_email: string | null
  candidate_phone: string | null
  location: string | null
  department_id: string | null
  manager_id: string | null
  application_id: string | null
}

export interface OnbFilterOptions {
  journeys: JourneyOption[]
  departments: OnbOption[]
  owners: OnbOption[]
  employees: EmployeeOption[]
  offers: OfferOption[]
  document_types: OnbOption[]
  categories: OnbOption[]
  task_statuses: OnbOption[]
  journey_statuses: OnbOption[]
  stages: OnbOption[]
  document_statuses: OnbOption[]
  confirmation_statuses: OnbOption[]
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/** Icon keys the KPI row maps to lucide components. */
export type OnbKpiIcon = 'users' | 'user-check' | 'calendar' | 'check-circle' | 'shield'

/** The filter a KPI card's "View all" applies when drilling into the list. */
export interface OnbKpiFilter {
  stage?: JourneyStage
  status?: JourneyStatus
  joining_from?: string
  joining_to?: string
  probation_due?: string
}

export interface OnbKpi {
  id: string
  title: string
  value: string
  subtitle: string
  icon: OnbKpiIcon
  /** Present only on the "Onboarding Completion" card (the progress bar). */
  progress?: number
  filter: OnbKpiFilter
}

export interface OnbOverview {
  kpis: OnbKpi[]
  totals: {
    total_journeys: number
    open_journeys: number
    total_tasks: number
    completed_tasks: number
    overdue_tasks: number
    completion_pct: number
    probation_due: number
    first_day_thisweek: number
  }
}

// ---------------------------------------------------------------------------
// Journeys
// ---------------------------------------------------------------------------

export interface OnbJourney {
  id: number
  journey_code: string | null
  name: string
  initials: string
  email: string | null
  employee_no: string | null
  image: string | null
  employee_id: number | null
  offer_id: number | null
  application_id: number | null
  position: string | null
  department_id: number | null
  department: string | null
  location: string | null
  joining_date: string | null
  joining_date_label: string | null
  stage: JourneyStage
  stage_label: string | null
  status: JourneyStatus
  status_label: string | null
  manager_id: number | null
  manager_name: string | null
  buddy_id: number | null
  buddy_name: string | null
  probation_start: string | null
  probation_end: string | null
  probation_label: string | null
  extension_end: string | null
  confirmation_status: ConfirmationStatus
  confirmation_label: string | null
  confirmed_on: string | null
  completed_at: string | null
  task_total: number
  task_completed: number
  progress_pct: number
  created_at: string | null
  /** Detail-only fields, present on show / store / update. */
  candidate_name?: string | null
  candidate_email?: string | null
  candidate_phone?: string | null
  confirmation_notes?: string | null
  notes?: string | null
}

export interface JourneyFilters {
  search?: string
  stage?: string
  status?: string
  department_id?: string
  confirmation_status?: string
  joining_from?: string
  joining_to?: string
  probation_due?: string
  page?: number
  per_page?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface JourneyPayload {
  employee_id?: number | null
  candidate_name?: string | null
  candidate_email?: string | null
  candidate_phone?: string | null
  offer_id?: number | null
  application_id?: number | null
  department_id?: number | null
  location?: string | null
  position?: string | null
  joining_date?: string | null
  stage?: JourneyStage
  status?: JourneyStatus
  buddy_id?: number | null
  manager_id?: number | null
  probation_start?: string | null
  probation_end?: string | null
  notes?: string | null
}

export interface OnbStage {
  id: number
  journey_id: number
  stage_key: StageKey
  title: string
  start_date: string | null
  end_date: string | null
  date_label: string | null
  status: StageStatus
  status_label: string | null
  sort_order: number
  completed_at: string | null
  notes: string | null
}

export interface OnbStageList {
  stages: OnbStage[]
  total: number
  completed: number
  progress_pct: number
}

export interface StagePayload {
  title?: string
  start_date?: string | null
  end_date?: string | null
  status?: StageStatus
  notes?: string | null
}

export interface OnbContact {
  id: string
  role: string
  name: string
  email: string | null
  mobile: string | null
  initials: string
  user_id: number
  designation: string | null
  department: string | null
}

export interface OnbTimelineEntry {
  id: string
  type: string
  title: string
  detail: string | null
  date: string
  date_label: string | null
  source: 'milestone' | 'activity'
  actor?: string | null
  changes?: Array<{ field: string; label: string; old: unknown; new: unknown }> | null
}

export interface OnbTimeline {
  milestones: OnbTimelineEntry[]
  activity: OnbTimelineEntry[]
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface OnbTask {
  id: number
  journey_id: number
  title: string
  description: string | null
  category: TaskCategory | null
  category_label: string | null
  owner_id: number | null
  owner_label: string | null
  owner_name: string | null
  owner_initials: string
  owner_image: string | null
  due_date: string | null
  due_date_label: string | null
  status: TaskStatus
  status_label: string | null
  is_overdue: boolean
  completed_at: string | null
  sort_order: number
}

export interface TaskFilters {
  journey_id?: string
  category?: string
  status?: string
  owner_id?: string
  search?: string
  overdue_only?: boolean
  due_from?: string
  due_to?: string
  page?: number
  per_page?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface TaskSummary {
  total: number
  completed: number
  pending: number
  sent: number
}

export interface TaskPayload {
  journey_id: number
  title: string
  description?: string | null
  category?: TaskCategory | null
  owner_id?: number | null
  owner_label?: string | null
  due_date?: string | null
  status?: TaskStatus
}

export type TaskUpdatePayload = Partial<Omit<TaskPayload, 'journey_id'>>

export type BulkTaskAction = 'complete' | 'reopen' | 'delete' | 'reassign' | 'remind'

export interface OnbWorkstream {
  id: WorkstreamKey
  category: WorkstreamKey
  title: string
  icon: WorkstreamKey
  description: string
  status: 'Not Started' | 'In Progress' | 'Completed'
  total: number
  completed: number
  progress_pct: number
}

// ---------------------------------------------------------------------------
// Documents / Notes / Probation
// ---------------------------------------------------------------------------

export interface OnbDocument {
  id: number
  journey_id: number
  title: string
  document_type_id: number | null
  document_type: string | null
  file_name: string | null
  file_path: string | null
  url: string | null
  status: DocumentStatus
  status_label: string | null
  is_mandatory: boolean
  due_date: string | null
  due_date_label: string | null
  requested_at: string | null
  submitted_at: string | null
  verified_at: string | null
  remarks: string | null
  sort_order: number
}

export interface DocumentSummary {
  total: number
  pending: number
  sent: number
  received: number
  verified: number
}

export interface DocumentPayload {
  title: string
  document_type_id?: number | null
  status?: DocumentStatus
  is_mandatory?: boolean
  due_date?: string | null
  remarks?: string | null
}

export interface OnbNote {
  id: number
  journey_id: number
  note: string
  visibility: NoteVisibility
  author_name: string | null
  author_id: number | null
  initials: string
  created_at: string | null
  created_label: string | null
}

export interface NotePayload {
  note: string
  visibility?: NoteVisibility
}

export interface OnbProbation {
  id: number
  journey_code: string | null
  name: string
  initials: string
  email: string | null
  employee_id: number | null
  employee_no: string | null
  position: string | null
  department: string | null
  department_id: number | null
  manager_name: string | null
  joining_date: string | null
  joining_date_label: string | null
  probation_start: string | null
  probation_end: string | null
  probation_label: string | null
  extension_end: string | null
  days_remaining: number | null
  is_overdue: boolean
  confirmation_status: ConfirmationStatus
  confirmation_label: string | null
  confirmed_on: string | null
  confirmed_on_label: string | null
  confirmed_by: number | null
  confirmed_by_name: string | null
  confirmation_notes: string | null
}

export interface ProbationFilters {
  confirmation_status?: string
  department_id?: string
  due_in_days?: string
  search?: string
  overdue_only?: boolean
  page?: number
  per_page?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface ProbationSummary {
  total: number
  pending: number
  confirmed: number
  extended: number
  terminated: number
}

export interface ProbationDecisionPayload {
  effective_date?: string | null
  notes?: string | null
  /** Required by /extend only. */
  extension_end?: string
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const onboardingService = {
  /* Header ---------------------------------------------------------- */
  getOverview: (session: SessionContext, departmentId?: string) =>
    apiGet<OnbResponse<OnbOverview>>(
      session,
      '/onboarding/overview',
      withContextParams(session, { department_id: departmentId }),
    ),
  getFilters: (session: SessionContext) =>
    apiGet<OnbResponse<OnbFilterOptions>>(session, '/onboarding/filters', withContextParams(session)),

  /* Journeys -------------------------------------------------------- */
  getJourneys: (session: SessionContext, filters?: JourneyFilters) =>
    apiGet<OnbListResponse<OnbJourney[]>>(
      session,
      '/onboarding/journeys',
      withContextParams(session, queryOf(filters)),
    ),
  getJourney: (session: SessionContext, id: number) =>
    apiGet<OnbResponse<OnbJourney>>(session, `/onboarding/journeys/${id}`, withContextParams(session)),
  createJourney: (session: SessionContext, payload: JourneyPayload) =>
    apiPost<OnbResponse<OnbJourney>>(session, '/onboarding/journeys', {
      ...payload,
      ...withContextParams(session),
    }),
  createJourneyFromOffer: (session: SessionContext, offerId: number) =>
    apiPost<OnbResponse<OnbJourney>>(
      session,
      `/onboarding/journeys/from-offer/${offerId}`,
      withContextParams(session),
    ),
  updateJourney: (session: SessionContext, id: number, payload: Partial<JourneyPayload>) =>
    apiPut<OnbResponse<OnbJourney>>(session, `/onboarding/journeys/${id}`, {
      ...payload,
      ...withContextParams(session),
    }),
  deleteJourney: (session: SessionContext, id: number) =>
    apiDelete<OnbResponse<{ id: number }>>(session, `/onboarding/journeys/${id}`, withContextParams(session)),

  /* Journey stages -------------------------------------------------- */
  getStages: (session: SessionContext, journeyId: number) =>
    apiGet<OnbResponse<OnbStageList>>(
      session,
      `/onboarding/journeys/${journeyId}/stages`,
      withContextParams(session),
    ),
  updateStage: (session: SessionContext, id: number, payload: StagePayload) =>
    apiPut<OnbResponse<OnbStage>>(session, `/onboarding/stages/${id}`, {
      ...payload,
      ...withContextParams(session),
    }),
  completeStage: (session: SessionContext, id: number, reopen = false) =>
    apiPost<OnbResponse<OnbStage>>(session, `/onboarding/stages/${id}/complete`, {
      ...withContextParams(session),
      reopen: reopen ? '1' : '0',
    }),

  /* Contacts / timeline --------------------------------------------- */
  getContacts: (session: SessionContext, journeyId: number) =>
    apiGet<OnbResponse<OnbContact[]>>(
      session,
      `/onboarding/journeys/${journeyId}/contacts`,
      withContextParams(session),
    ),
  getTimeline: (session: SessionContext, journeyId: number) =>
    apiGet<OnbResponse<OnbTimeline>>(
      session,
      `/onboarding/journeys/${journeyId}/timeline`,
      withContextParams(session),
    ),

  /* Tasks ------------------------------------------------------------ */
  getTasks: (session: SessionContext, filters?: TaskFilters) =>
    apiGet<OnbSummaryListResponse<OnbTask[], TaskSummary>>(
      session,
      '/onboarding/tasks',
      withContextParams(session, queryOf(filters)),
    ),
  createTask: (session: SessionContext, payload: TaskPayload) =>
    apiPost<OnbResponse<OnbTask>>(session, '/onboarding/tasks', {
      ...payload,
      ...withContextParams(session),
    }),
  updateTask: (session: SessionContext, id: number, payload: TaskUpdatePayload) =>
    apiPut<OnbResponse<OnbTask>>(session, `/onboarding/tasks/${id}`, {
      ...payload,
      ...withContextParams(session),
    }),
  completeTask: (session: SessionContext, id: number, reopen = false) =>
    apiPost<OnbResponse<OnbTask>>(session, `/onboarding/tasks/${id}/complete`, {
      ...withContextParams(session),
      reopen: reopen ? '1' : '0',
    }),
  deleteTask: (session: SessionContext, id: number) =>
    apiDelete<OnbResponse<{ id: number }>>(session, `/onboarding/tasks/${id}`, withContextParams(session)),
  bulkTasks: (
    session: SessionContext,
    action: BulkTaskAction,
    taskIds: number[],
    extra?: { owner_id?: number; owner_label?: string },
  ) =>
    apiPost<OnbResponse<{ affected: number }>>(session, '/onboarding/tasks/bulk', {
      action,
      task_ids: taskIds,
      ...extra,
      ...withContextParams(session),
    }),
  getWorkstreams: (session: SessionContext, journeyId?: string) =>
    apiGet<OnbResponse<OnbWorkstream[]>>(
      session,
      '/onboarding/workstreams',
      withContextParams(session, { journey_id: journeyId }),
    ),

  /* Documents -------------------------------------------------------- */
  getDocuments: (session: SessionContext, journeyId: number, filters?: { status?: string; search?: string }) =>
    apiGet<
      OnbSummaryListResponse<OnbDocument[], DocumentSummary> | (OnbResponse<OnbDocument[]> & { summary: DocumentSummary })
    >(session, `/onboarding/journeys/${journeyId}/documents`, withContextParams(session, queryOf(filters))),
  createDocument: (session: SessionContext, journeyId: number, payload: DocumentPayload) =>
    apiPost<OnbResponse<OnbDocument>>(session, `/onboarding/journeys/${journeyId}/documents`, {
      ...payload,
      ...withContextParams(session),
    }),
  /** Multipart create - the Documents sheet's file picker. */
  uploadDocument: (session: SessionContext, journeyId: number, form: FormData) => {
    Object.entries(withContextParams(session)).forEach(([key, value]) => {
      if (value !== undefined) form.set(key, value);
    });
    return apiPostForm<OnbResponse<OnbDocument>>(session, `/onboarding/journeys/${journeyId}/documents`, form);
  },
  updateDocument: (session: SessionContext, id: number, payload: Partial<DocumentPayload>) =>
    apiPut<OnbResponse<OnbDocument>>(session, `/onboarding/documents/${id}`, {
      ...payload,
      ...withContextParams(session),
    }),
  /** Replacing the file on an existing request (multipart, spoofed PUT). */
  uploadDocumentFile: (session: SessionContext, id: number, form: FormData) => {
    Object.entries(withContextParams(session)).forEach(([key, value]) => {
      if (value !== undefined) form.set(key, value);
    });
    return apiPutForm<OnbResponse<OnbDocument>>(session, `/onboarding/documents/${id}`, form);
  },
  deleteDocument: (session: SessionContext, id: number) =>
    apiDelete<OnbResponse<{ id: number }>>(session, `/onboarding/documents/${id}`, withContextParams(session)),

  /* Notes ------------------------------------------------------------ */
  getNotes: (session: SessionContext, journeyId: number) =>
    apiGet<OnbResponse<OnbNote[]>>(session, `/onboarding/journeys/${journeyId}/notes`, withContextParams(session)),
  createNote: (session: SessionContext, journeyId: number, payload: NotePayload) =>
    apiPost<OnbResponse<OnbNote>>(session, `/onboarding/journeys/${journeyId}/notes`, {
      ...payload,
      ...withContextParams(session),
    }),
  updateNote: (session: SessionContext, id: number, payload: Partial<NotePayload>) =>
    apiPut<OnbResponse<OnbNote>>(session, `/onboarding/notes/${id}`, {
      ...payload,
      ...withContextParams(session),
    }),
  deleteNote: (session: SessionContext, id: number) =>
    apiDelete<OnbResponse<{ id: number }>>(session, `/onboarding/notes/${id}`, withContextParams(session)),

  /* Probation -------------------------------------------------------- */
  getProbation: (session: SessionContext, filters?: ProbationFilters) =>
    apiGet<OnbSummaryListResponse<OnbProbation[], ProbationSummary>>(
      session,
      '/onboarding/probation',
      withContextParams(session, queryOf(filters)),
    ),
  updateProbation: (
    session: SessionContext,
    journeyId: number,
    payload: { probation_start: string; probation_end: string },
  ) =>
    apiPut<OnbResponse<OnbProbation>>(session, `/onboarding/probation/${journeyId}`, {
      ...payload,
      ...withContextParams(session),
    }),
  decideProbation: (
    session: SessionContext,
    journeyId: number,
    decision: 'confirm' | 'extend' | 'terminate',
    payload: ProbationDecisionPayload = {},
  ) =>
    apiPost<OnbResponse<OnbProbation>>(session, `/onboarding/probation/${journeyId}/${decision}`, {
      ...payload,
      ...withContextParams(session),
    }),
}
