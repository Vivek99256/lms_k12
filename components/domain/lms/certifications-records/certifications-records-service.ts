'use client';

/**
 * Certifications & Records — G2G LMS migration (Package 3).
 *
 * Ported from G2G's `services/lms/learning.ts` (the `lmsCertificateService`
 * slice only — course-completion certificates, distinct from the
 * externally-issued credential + compliance domain already ported at
 * `app/talent-management/_lib/certifications-api.ts` /
 * `App\Http\Controllers\api\TalentManagement\Competency\CertificationController`).
 * Backed by `App\Http\Controllers\G2gLms\CertificationsRecordsController`
 * (`app/Http/Controllers/G2gLms/CertificationsRecordsController.php` in
 * next_lms_erp), reachable at `/api/g2g-lms/certifications-records/*`.
 *
 * Transport pattern copied verbatim from `talent-management/_lib/
 * certifications-api.ts` (native `fetch` + `buildSessionContext()` /
 * `createAuthHeaders()` from `lib/erp-client.ts`, replacing G2G's
 * `apiClient` + `LaravelContext`).
 *
 * ADAPTATIONS FROM SOURCE:
 * - `transcript` / `completion-history` are NEW endpoints this package adds
 *   (the source read them from `lmsDashboardService.getEnrolledCourses` /
 *   `lmsLearningService.getMyCourses`, both owned by Package 1). Rather than
 *   duplicate Package 1's screens, this package's own backend controller
 *   answers those two tabs directly, reading the same underlying tables
 *   (`lms_course_enroll`, `content_master`, `lms_content_progress`) — see the
 *   controller's doc-comment for the defensive table-exists guards this
 *   entails while Package 1/2's migrations may not have landed yet.
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
    readonly errors?: Record<string, string[]>
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
  options?: { params?: Record<string, string | undefined>; body?: unknown }
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
    const errors =
      payload && typeof payload === 'object' && 'errors' in (payload as Record<string, unknown>)
        ? (payload as { errors?: Record<string, string[]> }).errors
        : undefined;
    throw new ApiError(
      messageFrom(payload, `API Error: ${response.status} ${response.statusText}`),
      response.status,
      errors
    );
  }

  return payload as T;
}

const apiGet = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'GET', path, { params });
const apiPost = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'POST', path, { body });

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

// ---------------------------------------------------------------------------
// Types (ported from G2G's services/lms/learning.ts)
// ---------------------------------------------------------------------------

export type CertificateExpiryState = 'active' | 'expiring' | 'expired';

export interface LearningCertificate {
  user_id: number;
  learner_name: string | null;
  employee_no: string | null;
  /** Negative once expired. Null when the certificate never expires. */
  days_to_expiry: number | null;
  id: number;
  course_id: number;
  skill_id: number | null;
  certificate_number: string;
  course_title: string | null;
  /** Credential title. Falls back to course_title when never customised. */
  name: string | null;
  description: string | null;
  tags: string[] | null;
  verification_code: string | null;
  supersedes: number | null;
  superseded_by: number | null;
  reissued_at: string | null;
  issued_at: string | null;
  expires_at: string | null;
  status: string;
  display_image: string | null;
  subject_category: string | null;
  skill_title: string | null;
  expiry_state: CertificateExpiryState;
}

export interface CertificateVerification {
  valid: boolean;
  message: string;
  certificate_number: string | null;
  name: string | null;
  course_title: string | null;
  learner_name: string | null;
  issued_at: string | null;
  expires_at: string | null;
  is_expired: boolean;
  is_superseded: boolean;
}

export interface CertificateQuery {
  scope?: 'mine' | 'all';
  search?: string;
  courseId?: number;
}

export interface CertificateListResponse {
  status: boolean;
  data: LearningCertificate[];
  meta: { scope: 'mine' | 'all'; warning_days: number };
}

export interface LearningCourseSummary {
  id: number;
  display_name: string | null;
  total_content: number;
  completed_content: number;
  progress_percent: number;
  enrollment_status: string | null;
  end_date: string | null;
}

export interface EnrolledCourse {
  enrollment_id: number;
  id: number;
  display_name: string | null;
  subject_category: string | null;
  start_date: string | null;
  end_date: string | null;
}

export const lmsCertificationsRecordsService = {
  /** GET /api/g2g-lms/certifications-records/certificates */
  list: (session: SessionContext, query: CertificateQuery = {}) =>
    apiGet<CertificateListResponse>(
      session,
      '/g2g-lms/certifications-records/certificates',
      toStringParams({
        scope: query.scope,
        search: query.search,
        course_id: query.courseId,
      })
    ),

  /** Absolute URL for the rendered PDF — a download navigation, not a fetch. */
  downloadUrl: (session: SessionContext, certificateId: number) => {
    const params = new URLSearchParams({
      type: 'API',
      ...(session.subInstituteId ? { sub_institute_id: session.subInstituteId } : {}),
      ...(session.syear ? { syear: session.syear } : {}),
      ...(session.token ? { token: session.token } : {}),
    });
    return `${session.baseUrl}/api/g2g-lms/certifications-records/certificates/${certificateId}/download?${params.toString()}`;
  },

  /** GET /api/g2g-lms/certifications-records/certificates/verify/{code} — public, no session required. */
  verify: async (session: SessionContext, code: string) => {
    const url = `${session.baseUrl}/api/g2g-lms/certifications-records/certificates/verify/${encodeURIComponent(code)}`;
    const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
    const payload = (await response.json().catch(() => ({}))) as ApiEnvelope & {
      valid?: boolean;
      data?: Omit<CertificateVerification, 'valid' | 'message'>;
    };
    if (!response.ok && response.status !== 404) {
      throw new ApiError(messageFrom(payload, 'Verification failed.'), response.status);
    }
    return payload;
  },

  /** POST /api/g2g-lms/certifications-records/certificates/{id}/reissue — admin/HR only. */
  reissue: (session: SessionContext, certificateId: number) =>
    apiPost<ApiEnvelope & { data?: LearningCertificate }>(
      session,
      `/g2g-lms/certifications-records/certificates/${certificateId}/reissue`,
      {}
    ),

  /** GET /api/g2g-lms/certifications-records/transcript — completed enrolments. */
  transcript: (session: SessionContext) =>
    apiGet<ApiEnvelope & { data?: EnrolledCourse[] }>(session, '/g2g-lms/certifications-records/transcript'),

  /** GET /api/g2g-lms/certifications-records/completion-history — every enrolled course with progress. */
  completionHistory: (session: SessionContext) =>
    apiGet<ApiEnvelope & { data?: LearningCourseSummary[] }>(
      session,
      '/g2g-lms/certifications-records/completion-history'
    ),
};
