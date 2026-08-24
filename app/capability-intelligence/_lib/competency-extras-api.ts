'use client';

/**
 * GAP NOTICE — endpoints in this file are NOT part of the Capability Library /
 * Competency Framework backend context given for this migration task. They
 * back secondary features reached from inside the two ported screens
 * (`CourseBuilderPanel`, the "what this role requires" picker in
 * `LibraryForm` / `RoleCompetencyInlinePanel`, `RoleRequirementsPanel`, and
 * the framework "Submit for publish" action) but were never listed in the
 * Capability Library / Competency Framework endpoint set that was confirmed
 * built this session. Ported here as an EXACT mechanical translation of the
 * G2G source paths/methods/shapes so the components compile and behave
 * identically to G2G — but their existence and correctness on this tenant's
 * Laravel backend is UNCONFIRMED. See the migration report for the full list.
 *
 * Sources:
 *   services/competency/skill-detail.ts       -> skillDetailService
 *   services/competency/course-builder.ts     -> courseBuilderService
 *   services/competency/role-requirements.ts  -> roleRequirementsService
 *   services/competency/library.ts            -> competencyLibraryService (subset actually used: list, create)
 *   services/competency/definitions.ts        -> competencyDefinitionsService (subset actually used: list)
 *   services/competency/approvals.ts          -> competencyApprovalService (subset actually used: submit)
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';

export { buildSessionContext };
export type { SessionContext };

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
  options?: { params?: Record<string, string | undefined>; body?: unknown },
): Promise<T> {
  const search = new URLSearchParams();
  Object.entries(options?.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value);
  });

  const url = `${session.baseUrl}/api${path}${search.toString() ? `?${search.toString()}` : ''}`;

  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
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
const apiPost = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'POST', path, { body });
const apiPut = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'PUT', path, { body });
const apiDelete = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'DELETE', path, { params });

function contextParams(session: SessionContext, extra?: Record<string, string | undefined>): Record<string, string> {
  const params: Record<string, string> = {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
    type: 'API',
  };
  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value !== undefined) params[key] = value;
  });
  return params;
}

function toStringParams(input: Record<string, string | number | undefined | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized === '') continue;
    out[key] = normalized;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Skill detail popup payloads
 * ------------------------------------------------------------------ */

export interface ClassificationItem {
  id: number;
  skill_id: number;
  proficiency_level: string | null;
  proficiency_description: string | null;
  classification: string;
  classification_category: string | null;
  classification_sub_category: string | null;
  classification_item: string | null;
}

export interface ProficiencyGroup {
  proficiency_level: number | string;
  items: ClassificationItem[];
}

export interface MappedJobRole {
  id: number;
  sector: string | null;
  track: string | null;
  jobrole: string;
  skill?: string | null;
  jobrole_category?: string | null;
  description?: string | null;
  proficiency_level: string | null;
  proficiency_description: string | null;
}

export interface ProficiencyLevelRow {
  id: number;
  proficiency_level: string | null;
  description?: string | null;
  proficiency_type?: string | null;
  type_description?: string | null;
  proficiency_description?: string | null;
  classification?: string | null;
  classification_item?: string | null;
}

export interface DetailRow {
  id: number;
  title?: string;
  [key: string]: unknown;
}

export interface SkillDetailResponse {
  editData: DetailRow | null;
  skillName?: string;
  userJobroleData: MappedJobRole[];
  userproficiency_levelData: ProficiencyLevelRow[];
  userAttitudeData: ClassificationItem[];
  userBehaviourData: ClassificationItem[];
  userKnowledgeData: ClassificationItem[];
  userabilityData: ClassificationItem[];
  userApplicationData: ClassificationItem[];
  userViewKnowledge: ProficiencyGroup[];
  userViewAbility: ProficiencyGroup[];
  userViewApplication: ProficiencyGroup[];
}

export interface KasaUsageSkill {
  id: number;
  skill_id: number;
  proficiency_level: string | null;
  classification_category: string | null;
  classification_sub_category: string | null;
  skill_title: string;
  skill_category: string | null;
  skill_sub_category: string | null;
  skill_department: string | null;
}

export interface KasaUsage {
  item: DetailRow;
  skills: KasaUsageSkill[];
  jobroles: MappedJobRole[];
  levels: string[];
  skill_count: number;
}

/** GAP: `GET /skill_library/{id}/edit` — not in the given backend context. */
export const skillDetailService = {
  get: (session: SessionContext, skillId: number, formType: 'user' | 'admin' = 'user') =>
    apiGet<SkillDetailResponse>(session, `/skill_library/${skillId}/edit`, contextParams(session, { formType })),

  /** This one IS in scope: GET /competency/library/kasa/{type}/{id}/usage. */
  kasaUsage: (session: SessionContext, type: string, id: number) =>
    apiGet<{ status: number; message: string; data: KasaUsage }>(session, `/competency/library/kasa/${type}/${id}/usage`, contextParams(session)),
};

/* ------------------------------------------------------------------ *
 * Course builder (AI outline + Gamma slides) — GAP: /lms/ai/* not given.
 * ------------------------------------------------------------------ */

export interface AiStatus {
  deepseek_configured: boolean;
  deepseek_model: string;
  gamma_configured: boolean;
}

export interface OutlineSlide {
  title: string;
  bullets?: string[];
  notes?: string;
  [key: string]: unknown;
}

export interface CourseOutline {
  course_title?: string;
  summary?: string;
  learning_objectives?: string[];
  slides: OutlineSlide[];
  [key: string]: unknown;
}

export interface OutlineResult {
  outline: CourseOutline;
  plain_text: string;
  model: string;
  slide_count: number;
}

export interface OutlineRequest {
  course_title?: string;
  job_role?: string;
  department?: string;
  industry?: string;
  skills?: string[];
  proficiency?: string;
  critical_work_function?: string;
  tasks?: string[];
  slide_count?: number;
}

export interface PresentationStart {
  outline_id: number;
  generation_id: string;
  status: string;
}

export interface PresentationStatus {
  outline_id: number | null;
  generation_id: string;
  generation_status: string;
  gamma_url: string | null;
  export_url: string | null;
}

export const courseBuilderService = {
  status: (session: SessionContext) => apiGet<{ status: boolean; data: AiStatus }>(session, '/lms/ai/status', contextParams(session)),

  generateOutline: (session: SessionContext, payload: OutlineRequest) =>
    apiPost<{ status: boolean; data: OutlineResult }>(session, '/lms/ai/outline', { ...contextParams(session), ...payload }),

  generatePresentation: (session: SessionContext, outline: CourseOutline, slideCount: number, courseType?: string) =>
    apiPost<{ status: boolean; data: PresentationStart }>(session, '/lms/ai/presentation', {
      ...contextParams(session),
      outline,
      slide_count: slideCount,
      ...(courseType ? { course_type: courseType } : {}),
    }),

  presentationStatus: (session: SessionContext, generationId: string) =>
    apiGet<{ status: boolean; data: PresentationStatus }>(session, `/lms/ai/presentation/${generationId}`, contextParams(session)),
};

/* ------------------------------------------------------------------ *
 * Role requirements sync (jobrole_competency_map) — GAP: /competency/role-map
 * is NOT the same route family as the given /competency/role-mapping/* cell
 * endpoints (different table, different semantics — see role-requirements.ts
 * header comment in G2G for why). Not in the given backend context.
 * ------------------------------------------------------------------ */

export interface RoleRequirement {
  id: number;
  competency_id: number;
  competency_name: string;
  competency_code: string | null;
  required_proficiency: number;
  is_mandatory: boolean;
}

export interface RoleRequirementInput {
  competency_id: number;
  required_proficiency: number;
  is_mandatory: boolean;
}

export interface RoleRequirementsResponse {
  status: number;
  data: RoleRequirement[];
}

export interface RoleRequirementsSaveResult {
  status: number;
  message: string;
  data: { jobrole_id: number; written: number; removed: number };
}

const ROLE_MAP = '/competency/role-map';

export const roleRequirementsService = {
  list: (session: SessionContext, jobroleId: number) =>
    apiGet<RoleRequirementsResponse>(session, ROLE_MAP, contextParams(session, { jobrole_id: String(jobroleId) })),

  save: (session: SessionContext, jobroleId: number, items: RoleRequirementInput[]) =>
    apiPost<RoleRequirementsSaveResult>(session, ROLE_MAP, { ...contextParams(session), jobrole_id: jobroleId, items }),

  remove: (session: SessionContext, id: number) =>
    apiDelete<{ status: number; message: string }>(session, `${ROLE_MAP}/${id}`, contextParams(session)),
};

/* ------------------------------------------------------------------ *
 * Competency Library (KASBA-composed competencies) — GAP: /competency-library/*
 * belongs to a separate "Competency Library" screen not part of this task.
 * Only the subset actually called from the ported screens (list, create) is
 * ported here.
 * ------------------------------------------------------------------ */

export interface CompetencyLibraryItem {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  sub_category: string | null;
  competency_type: string | null;
  proficiency_level: string | null;
  department: string | null;
  department_id: number | null;
  status: string | null;
  approve_status: string | null;
  owner: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CompetencyLibraryPayload {
  name: string;
  category?: string;
  status?: string;
  [key: string]: unknown;
}

const COMPETENCY_LIBRARY = '/competency-library';

export const competencyLibraryService = {
  list: (session: SessionContext, params?: { search?: string; category?: string; per_page?: number }) =>
    apiGet<{ status: number; message: string; data: CompetencyLibraryItem[]; pagination?: unknown }>(
      session,
      `${COMPETENCY_LIBRARY}/competency-list`,
      contextParams(session, toStringParams({ ...params })),
    ),

  create: (session: SessionContext, payload: CompetencyLibraryPayload) =>
    apiPost<{ status: number; message: string; data: { id: number } }>(session, `${COMPETENCY_LIBRARY}/competency`, {
      ...contextParams(session),
      ...payload,
    }),
};

/* ------------------------------------------------------------------ *
 * Competency Definitions — GAP: /competency/definitions not in given context.
 * ------------------------------------------------------------------ */

export interface CompetencyDefinition {
  id: number;
  name: string;
  [key: string]: unknown;
}

export const competencyDefinitionsService = {
  list: (session: SessionContext) =>
    apiGet<{ status: number; message: string; data: CompetencyDefinition[] }>(session, '/competency/definitions', contextParams(session)),
};

/* ------------------------------------------------------------------ *
 * Library delete-impact check — GAP: /competency/library/dependants not in
 * given context. Powers the "N records depend on it" delete-confirm copy.
 * ------------------------------------------------------------------ */

export interface LibraryImpact {
  total: number
  basis: string
  breakdown: { label: string; count: number }[]
  divergence: { by_text: number; difference: number; reason: string } | null
}

export const libraryDependantsService = {
  get: (session: SessionContext, kind: string, id: number) =>
    apiGet<{ status: number; data: LibraryImpact }>(session, '/competency/library/dependants', contextParams(session, { kind, id: String(id) })),
}

/* ------------------------------------------------------------------ *
 * Competency approvals.
 *
 * UPDATE (this session) — `/competency/approvals*` IS confirmed-live
 * (`CompetencyApprovalController`, routes registered in
 * `routes/competency_management.php`): `GET/POST /competency/approvals`,
 * `POST /competency/approvals/bulk-approve`,
 * `GET /competency/approvals/for/{type}/{id}`, `PUT /competency/approvals/{id}`.
 * The earlier "GAP" note above only ever applied to `submit`, which was
 * already ported; `trail` is added here for the Competency Library screen's
 * detail-panel History tab (`useApprovalTrail('competency', id)`).
 *
 * NOTE — a real naming overlap flagged in
 * `CompetencyLibraryCrudController::archive()`'s doc comment: this
 * controller's `SUBJECTS['competency']` entry reads/writes
 * `s_users_skills.approve_status` (the legacy skill-as-competency screen),
 * NOT the `competency` table this screen's rows come from. So
 * `useSubmitForApproval('competency', id)` / `useApprovalTrail('competency',
 * id)` here operate on a DIFFERENT id space than the competency rows they
 * are called with — `subject_id` values from this screen and from the
 * legacy skill screen share the `subject_type = 'competency'` string but do
 * not refer to the same underlying record. This is a pre-existing backend
 * design gap (not introduced or fixed by this port) — ported faithfully
 * because the frontend call shape genuinely matches G2G's, but flagged
 * here and in the migration report since it means "Submit for Approval" /
 * the History tab's Approvals section may show or act on the wrong
 * subject's trail for a given competency id.
 * ------------------------------------------------------------------ */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | string;

/** One entry in a subject's approval trail. */
export interface ApprovalTrailEntry {
  id: number;
  status: ApprovalStatus;
  note: string | null;
  submitted_by_name: string | null;
  submitted_at: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
}

export const competencyApprovalService = {
  submit: (session: SessionContext, payload: { subject_type: 'competency' | 'framework'; subject_id: number; note?: string }) =>
    apiPost<{ status: number; message: string; data: { id: number } }>(session, '/competency/approvals', {
      ...contextParams(session),
      ...payload,
    }),

  /** One subject's approval trail, for its detail panel's History tab. */
  trail: (session: SessionContext, subjectType: 'competency' | 'framework', subjectId: number) =>
    apiGet<{ status: number; message: string; data: ApprovalTrailEntry[] }>(
      session,
      `/competency/approvals/for/${subjectType}/${subjectId}`,
      contextParams(session),
    ),
};
