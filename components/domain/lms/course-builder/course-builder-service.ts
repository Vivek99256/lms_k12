'use client';

/**
 * Course Builder — the 5-step authoring wizard. G2G LMS migration (Package 3).
 *
 * Ported from G2G's `services/lms/course-builder.ts`. Backed by
 * `App\Http\Controllers\G2gLms\CourseBuilderController`
 * (next_lms_erp), reachable at `/api/g2g-lms/course-builder/*`.
 *
 * Transport pattern copied verbatim from `certifications-records-service.ts`
 * (native `fetch` + `buildSessionContext()`/`createAuthHeaders()`).
 *
 * ADAPTATION: `createWithImage` posts multipart with the session params
 * flattened as form fields (matching this repo's `SessionContext` shape)
 * instead of G2G's `withLaravelParams`.
 */

import { buildSessionContext, createAuthHeaders, type SessionContext } from '@/lib/erp-client';

export { buildSessionContext };
export type { SessionContext };

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in (payload as Record<string, unknown>)) {
    const message = (payload as { message?: unknown }).message;
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
    throw new ApiError(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`), response.status);
  }

  return payload as T;
}

const apiGet = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'GET', path, { params });
const apiPost = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'POST', path, { body });
const apiPut = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'PUT', path, { body });
const apiDelete = <T,>(session: SessionContext, path: string) => request<T>(session, 'DELETE', path, {});
const apiPostForm = <T,>(session: SessionContext, path: string, form: FormData) =>
  request<T>(session, 'POST', path, { form });

// ---------------------------------------------------------------------------
// Types (ported from G2G's services/lms/course-builder.ts)
// ---------------------------------------------------------------------------

export interface BuilderApiResponse<T> {
  status: boolean;
  message?: string;
  data: T;
}

export type CourseVisibility = 'all' | 'restricted';
export type EnrollmentRule = 'open' | 'approval';

export interface CourseSettings {
  description: string | null;
  duration_minutes: number | null;
  language: string | null;
  is_mandatory: boolean;
  discussion_enabled: boolean;
  visibility: CourseVisibility;
  passing_score: number | null;
  max_attempts: number | null;
  issue_certificate: boolean;
  certificate_template: string | null;
  recert_alerts: boolean;
  /** Passing this course writes the mapped competency rating without a review step. */
  auto_apply_rating: boolean;
  enrollment_rule: EnrollmentRule;
  restrict_departments: number[] | null;
  restrict_roles: string[] | null;
  available_from: string | null;
  available_until: string | null;
}

export interface CoursePrerequisite {
  id: number;
  title: string | null;
}

export interface BuilderModule {
  id: number;
  chapter_name: string;
  chapter_desc: string | null;
  sort_order: number | null;
  content: BuilderContent[];
}

export type ContentKind = 'mp4' | 'pdf' | 'pptx' | 'docx' | 'jpg' | 'link';

export interface BuilderContent {
  id: number;
  title: string | null;
  description: string | null;
  file_type: string | null;
  url: string | null;
  filename: string | null;
  sort_order: number | null;
}

export interface BuilderAssessment {
  id: number;
  paper_name: string;
  paper_desc: string | null;
  attempt_allowed: number | null;
  time_allowed: number | null;
  timelimit_enable: number | null;
  open_date: string | null;
  close_date: string | null;
  shuffle_question: number | null;
  show_feedback: number | null;
  result_show_ans: number | null;
  exam_type: string | null;
  total_ques: number;
  total_marks: number;
  question_ids: number[];
}

export interface AssessmentPayload {
  course_id: number;
  paper_name: string;
  paper_desc?: string | null;
  attempt_allowed?: number | null;
  time_allowed?: number | null;
  timelimit_enable?: boolean;
  open_date?: string | null;
  close_date?: string | null;
  shuffle_question?: boolean;
  show_feedback?: boolean;
  result_show_ans?: boolean;
  exam_type?: string | null;
  question_ids?: number[];
}

/**
 * `correct` is present here and NOWHERE on a learner-facing path — the
 * authoring endpoint is admin-gated precisely so this field can exist.
 */
export interface QuestionOptionDraft {
  id?: number;
  answer: string;
  correct: boolean;
}

/** A question on a paper, with its options and which of them are right. */
export interface PaperQuestion {
  id: number;
  question_title: string | null;
  description: string | null;
  points: number;
  hint_text: string | null;
  options: { id: number; answer: string; correct: boolean }[];
}

export interface PaperQuestionsResponse {
  status: boolean;
  data: PaperQuestion[];
  total_marks: number;
}

/**
 * What the author submits. An empty `options` array means a WRITTEN answer;
 * options with none marked correct are refused by the server — that
 * combination can never be marked.
 */
export interface QuestionPayload {
  question_title: string;
  description?: string | null;
  points?: number;
  hint_text?: string | null;
  options?: QuestionOptionDraft[];
}

export interface GenerateQuestionsResult {
  created: number;
  dropped: number;
}

/** A competency mapped to a course, i.e. what the course develops. */
export interface CourseCompetency {
  id: number;
  competency_id: number;
  competency_name: string | null;
  competency_code: string | null;
  proficiency_level: number | null;
  is_primary: boolean;
}

export interface CourseCompetencyInput {
  competency_id: number;
  proficiency_level?: number | null;
  is_primary?: boolean;
}

export interface BuilderCoursePayload {
  display_name: string;
  standard_id: number;
  subject_category?: string | null;
  subject_code?: string | null;
  subject_type?: string | null;
  jobrole?: string | null;
  sort_order?: number | null;
  certificate_validity_months?: number | null;
  /** 0 = draft, 1 = published. */
  status: number;
  settings?: Partial<CourseSettings>;
  prerequisites?: number[];
}

export interface BuilderCourseResponse {
  status: boolean;
  message?: string;
  data: Record<string, unknown>;
  course_id?: number;
  settings: CourseSettings | null;
  prerequisites: CoursePrerequisite[];
}

export interface CatalogDepartment {
  id: number;
  department: string;
}

export interface CatalogJobRole {
  id: number;
  jobrole: string;
  department_id: number | null;
}

export interface CourseBuilderOptions {
  categories: string[];
  subject_types: string[];
  departments: CatalogDepartment[];
  job_roles: CatalogJobRole[];
  languages: string[];
  certificate_templates: { value: string; label: string }[];
  courses: { id: number; display_name: string }[];
}

export const lmsCourseBuilderService = {
  /** GET /api/g2g-lms/course-builder/options — reference data for the wizard's selects. */
  options: (session: SessionContext) =>
    apiGet<BuilderApiResponse<CourseBuilderOptions>>(session, '/g2g-lms/course-builder/options'),

  /** GET /api/g2g-lms/course-builder/courses/{id} */
  load: (session: SessionContext, courseId: number) =>
    apiGet<BuilderCourseResponse>(session, `/g2g-lms/course-builder/courses/${courseId}`),

  /** POST /api/g2g-lms/course-builder/courses — create the draft. */
  create: (session: SessionContext, payload: BuilderCoursePayload) =>
    apiPost<BuilderCourseResponse>(session, '/g2g-lms/course-builder/courses', payload),

  /** PUT /api/g2g-lms/course-builder/courses/{id} */
  update: (session: SessionContext, courseId: number, payload: BuilderCoursePayload) =>
    apiPut<BuilderCourseResponse>(session, `/g2g-lms/course-builder/courses/${courseId}`, payload),

  /** POST /api/g2g-lms/course-builder/courses (multipart) — create with a thumbnail. */
  createWithImage: (session: SessionContext, payload: BuilderCoursePayload, image: File) => {
    const form = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === 'settings' || key === 'prerequisites') {
        form.append(key, JSON.stringify(value));
        return;
      }
      form.append(key, String(value));
    });
    form.append('display_image', image);
    return apiPostForm<BuilderCourseResponse>(session, '/g2g-lms/course-builder/courses', form);
  },

  /* ── Modules (chapter_master) ── */

  modules: (session: SessionContext, courseId: number) =>
    apiGet<BuilderApiResponse<{ chapters?: BuilderModule[] }>>(
      session,
      `/g2g-lms/course-builder/courses/${courseId}/modules`
    ),

  createModule: (
    session: SessionContext,
    courseId: number,
    body: { chapter_name: string; chapter_desc?: string | null; sort_order?: number }
  ) =>
    apiPost<BuilderApiResponse<BuilderModule>>(session, '/g2g-lms/course-builder/chapters', {
      subject_id: courseId,
      ...body,
    }),

  updateModule: (
    session: SessionContext,
    moduleId: number,
    body: { chapter_name: string; chapter_desc?: string | null; sort_order?: number }
  ) => apiPut<BuilderApiResponse<BuilderModule>>(session, `/g2g-lms/course-builder/chapters/${moduleId}`, body),

  deleteModule: (session: SessionContext, moduleId: number) =>
    apiDelete<BuilderApiResponse<null>>(session, `/g2g-lms/course-builder/chapters/${moduleId}`),

  /* ── Content (content_master) ── */

  createContent: (
    session: SessionContext,
    body: {
      chapter_id: number;
      title: string;
      description?: string | null;
      file_type: string;
      filename?: string | null;
      url?: string | null;
      sort_order?: number;
    }
  ) => apiPost<BuilderApiResponse<BuilderContent>>(session, '/g2g-lms/course-builder/content', body),

  deleteContent: (session: SessionContext, contentId: number) =>
    apiDelete<BuilderApiResponse<null>>(session, `/g2g-lms/course-builder/content/${contentId}`),

  /* ── Assessments (question_paper) ── */

  assessments: (session: SessionContext, courseId: number) =>
    apiGet<BuilderApiResponse<BuilderAssessment[]>>(session, '/g2g-lms/course-builder/assessments', {
      course_id: String(courseId),
    }),

  createAssessment: (session: SessionContext, payload: AssessmentPayload) =>
    apiPost<BuilderApiResponse<BuilderAssessment>>(session, '/g2g-lms/course-builder/assessments', payload),

  deleteAssessment: (session: SessionContext, id: number) =>
    apiDelete<BuilderApiResponse<null>>(session, `/g2g-lms/course-builder/assessments/${id}`),

  /* ── Questions on a quiz ── */

  paperQuestions: (session: SessionContext, paperId: number) =>
    apiGet<PaperQuestionsResponse>(session, `/g2g-lms/course-builder/assessments/${paperId}/questions`),

  addQuestion: (session: SessionContext, paperId: number, payload: QuestionPayload) =>
    apiPost<BuilderApiResponse<{ id: number }>>(
      session,
      `/g2g-lms/course-builder/assessments/${paperId}/questions`,
      payload,
    ),

  updateQuestion: (
    session: SessionContext,
    paperId: number,
    questionId: number,
    payload: QuestionPayload,
  ) =>
    apiPut<BuilderApiResponse<null>>(
      session,
      `/g2g-lms/course-builder/assessments/${paperId}/questions/${questionId}`,
      payload,
    ),

  deleteQuestion: (session: SessionContext, paperId: number, questionId: number) =>
    apiDelete<BuilderApiResponse<null>>(
      session,
      `/g2g-lms/course-builder/assessments/${paperId}/questions/${questionId}`,
    ),

  /**
   * Write this quiz from the course's own modules and lessons. Appends —
   * never replaces what an author already wrote.
   */
  generateQuestions: (session: SessionContext, paperId: number, count: number) =>
    apiPost<BuilderApiResponse<GenerateQuestionsResult>>(
      session,
      `/g2g-lms/course-builder/assessments/${paperId}/questions/generate`,
      { count },
    ),

  /* ── Audience ── */

  previewAudience: (session: SessionContext, courseId: number, audience: AudiencePayload) =>
    apiGet<BuilderApiResponse<AudiencePreview>>(
      session,
      `/g2g-lms/course-builder/courses/${courseId}/audience/preview`,
      audienceQuery(audience)
    ),

  assignAudience: (session: SessionContext, courseId: number, audience: AudiencePayload) =>
    apiPost<BuilderApiResponse<AudienceResult>>(
      session,
      `/g2g-lms/course-builder/courses/${courseId}/audience`,
      audience
    ),

  /* ── Competencies this course develops ── */

  courseCompetencies: (session: SessionContext, courseId: number) =>
    apiGet<BuilderApiResponse<CourseCompetency[]>>(
      session,
      `/g2g-lms/course-builder/courses/${courseId}/competencies`,
    ),

  /** SYNC — replaces the course's complete competency list. */
  syncCourseCompetencies: (session: SessionContext, courseId: number, items: CourseCompetencyInput[]) =>
    apiPost<BuilderApiResponse<{ course_id: number; written: number; removed: number }>>(
      session,
      `/g2g-lms/course-builder/courses/${courseId}/competencies`,
      { items },
    ),

  removeCourseCompetency: (session: SessionContext, id: number) =>
    apiDelete<BuilderApiResponse<{ removed: boolean }>>(
      session,
      `/g2g-lms/course-builder/competencies/${id}`,
    ),
};

export interface AudiencePayload {
  user_ids: number[];
  department_ids: number[];
  jobrole_ids: number[];
  assignment_type?: string;
  due_date?: string | null;
}

export interface AudiencePreview {
  count: number;
  already_enrolled: number;
  will_assign: number;
  sample: { id: number; name: string; department: string | null; jobrole: string | null }[];
}

export interface AudienceResult {
  assigned: number;
  already_had_it: number;
  reached: number;
}

function audienceQuery(audience: AudiencePayload): Record<string, string> {
  const query: Record<string, string> = {};
  audience.user_ids.forEach((id, index) => { query[`user_ids[${index}]`] = String(id); });
  audience.department_ids.forEach((id, index) => { query[`department_ids[${index}]`] = String(id); });
  audience.jobrole_ids.forEach((id, index) => { query[`jobrole_ids[${index}]`] = String(id); });
  return query;
}
