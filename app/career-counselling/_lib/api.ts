import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
} from '@/lib/erp-client';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import type {
  CounsellingAttempt, CounsellingCourse, CounsellingCoursesPayload,
  RiasecQuestion, RiasecQuestionsPayload, RiasecResultItem, RiasecResultsPayload,
} from './types';

function messageFrom(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

/**
 * Same proxy/session pattern every other career module uses
 * (see app/career-intelligence/_lib/api.ts's careerRequest): build the
 * session context, append the common params, call through /api/proxy.
 */
async function counsellingRequest<T = unknown>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const session = buildSessionContext();
  const search = new URLSearchParams();
  appendCommonParams(search, session);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) search.set(key, String(value));
  });
  const path = `/api/proxy?path=${encodeURIComponent(endpoint)}&${search.toString()}`;
  let response: Response;
  try {
    response = await fetch(path, {
      cache: 'no-store',
      headers: createAuthHeaders(session, 'application/json'),
    });
  } catch {
    throw new Error('The career counselling service could not be reached. Check your connection and try again.');
  }
  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('The career counselling service returned an unreadable response.');
  }
  const envelope = payload as { status_code?: number | string; status?: number | string };
  const envelopeStatus = String(envelope.status_code ?? envelope.status ?? '');
  if (!response.ok || ['0', '2'].includes(envelopeStatus)) {
    throw new Error(messageFrom(payload, `Request failed (HTTP ${response.status}).`));
  }
  return payload as T;
}

/**
 * RIASEC Interest Profile quiz bank (60 questions). Reads `payload.question`
 * directly — the shape is fixed and known, no generic envelope-unwrapping
 * needed.
 */
export async function loadInterestQuestions(): Promise<RiasecQuestion[]> {
  const payload = await counsellingRequest<RiasecQuestionsPayload>('intrestQuestions', {
    start: 1,
    end: 60,
  });
  return Array.isArray(payload.question) ? payload.question : [];
}

/**
 * RIASEC Interest Profile results for a completed quiz. `answers` is the
 * 60-digit encoded answer string (see encodeAnswers in InterestProfileHub).
 */
export async function loadInterestResults(answers: string): Promise<RiasecResultItem[]> {
  const payload = await counsellingRequest<RiasecResultsPayload>('intrestResults', { answers });
  return Array.isArray(payload.result) ? payload.result : [];
}

/**
 * Counselling course listing + the current student's past attempts per
 * course, backed by `lmsCounsellingController::index` (the same data that
 * feeds show_lmsCounselling.blade.php). `lmsCounselling` is a resource route
 * nested under the `lms` prefix group, hence the `lms/` path here (unlike
 * the un-prefixed RIASEC endpoints above).
 */
export async function loadCounsellingCourses(): Promise<{
  courses: CounsellingCourse[];
  attemptsByCourse: Record<string, CounsellingAttempt[]>;
}> {
  const payload = await counsellingRequest<CounsellingCoursesPayload>('lms/lmsCounselling');
  return {
    courses: Array.isArray(payload.counselling_course) ? payload.counselling_course : [],
    attemptsByCourse: payload.user_data && typeof payload.user_data === 'object' ? payload.user_data : {},
  };
}

/**
 * Absolute ERP-hosted URL for a course's stored image. Built from
 * API_BASE_URL — the same host the `/api/proxy` route (and therefore the
 * course list itself) actually resolves through — rather than the client
 * session's `host_name`, which can point at a different tenant host and
 * silently 404 the image while the JSON data still loads fine via the proxy.
 */
export function counsellingCourseImageUrl(image: string): string {
  if (!image) return '';
  return `${API_BASE_URL}/storage/counselling_course/${encodeURIComponent(image)}`;
}

/**
 * These two link out to the legacy ERP's own hosted exam-taking pages
 * (`lmsCounsellingExam`/`lmsMBTIPaper`) — re-implementing the MBTI paper and
 * counselling-exam UIs themselves is a separate, much larger migration, so
 * "Take the test" opens the existing ERP page in a new tab, same as
 * show_lmsCounselling.blade.php's own `target="_blank"` links. Same
 * API_BASE_URL as the image URL above, for the same reason.
 */
export function counsellingExamUrl(courseId: number): string {
  return `${API_BASE_URL}/lms/lmsCounsellingExam?course_id=${courseId}`;
}

export function mbtiPaperUrl(courseId: number): string {
  return `${API_BASE_URL}/lms/lmsMBTIPaper?course_id=${courseId}`;
}
