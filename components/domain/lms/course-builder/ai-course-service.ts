'use client';

/**
 * "Build with AI" — G2G LMS migration (Package 3).
 *
 * Ported from G2G's `services/lms/ai-course.ts`. Backed by
 * `App\Http\Controllers\G2gLms\AiCourseController` (next_lms_erp), reachable
 * at `/api/g2g-lms/course-builder/ai/*`.
 *
 * NOTE: in G2G the UI that drives this hook/service
 * (`components/domain/lms/catalog/ai-course-sheet.tsx`) lives under the
 * Learning Catalog screen, owned by Package 1 — this package only ports the
 * service layer (per the task brief), for Package 1 (or this screen) to wire
 * a UI onto. See the final report.
 */

import { buildSessionContext, createAuthHeaders, type SessionContext } from '@/lib/erp-client';
import { ApiError } from './course-builder-service';

export { buildSessionContext };
export type { SessionContext };

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in (payload as Record<string, unknown>)) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

async function request<T>(
  session: SessionContext,
  method: 'GET' | 'POST',
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
    throw new ApiError(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`), response.status);
  }

  return payload as T;
}

const apiGet = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'GET', path, { params });
const apiPost = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'POST', path, { body });

// ---------------------------------------------------------------------------
// Types (ported from G2G's services/lms/ai-course.ts)
// ---------------------------------------------------------------------------

export interface AiApiResponse<T> {
  status: boolean;
  message?: string;
  data: T;
}

export interface AiProviderStatus {
  deepseek_configured: boolean;
  deepseek_model: string;
  gamma_configured: boolean;
}

export interface AiSlide {
  slide_number: number;
  title: string;
  bullets: string[];
  speaker_notes: string;
}

export interface AiOutline {
  title: string;
  summary: string;
  learning_objectives: string[];
  slides: AiSlide[];
  requested_slide_count: number;
}

export interface AiOutlineResult {
  outline: AiOutline;
  plain_text: string;
  model: string;
  slide_count: number;
}

export interface AiOutlineRequest {
  industry?: string;
  department?: string;
  job_role?: string;
  critical_work_function?: string;
  tasks?: string[];
  skills?: string[];
  proficiency?: string;
  modality?: { selfPaced?: boolean; instructorLed?: boolean };
  course_title?: string;
  slide_count?: number;
  model?: string;
}

export interface AiPresentationRequest {
  outline: AiOutline;
  input_fields?: Record<string, unknown>;
  configure_fields?: Record<string, unknown>;
  course_type?: string;
  slide_count?: number;
  ai_model?: string;
}

export interface AiPresentationStarted {
  outline_id: number;
  generation_id: string;
  status: string;
}

export type AiGenerationStatus = 'draft' | 'pending' | 'completed' | 'failed' | string;

export interface AiGenerationStatusResult {
  outline_id: number | null;
  generation_id: string;
  generation_status: AiGenerationStatus;
  gamma_url: string | null;
  export_url: string | null;
}

export interface AiSavedOutline {
  id: number;
  course_type: string;
  outline: AiOutline | null;
  input_fields: Record<string, unknown> | null;
  configure_fields: Record<string, unknown> | null;
  presentation_platform: string | null;
  ai_model: string | null;
  slide_count: number | null;
  generation_id: string | null;
  gamma_url: string | null;
  export_url: string | null;
  status: AiGenerationStatus | null;
  course_id: number | null;
  created_at: string | null;
}

export interface AiPublishRequest {
  display_name: string;
  standard_id: number;
  subject_category?: string | null;
  subject_type?: string | null;
  jobrole?: string | null;
  status?: number;
}

export interface AiPublishResult {
  course_id: number;
  outline_id: number;
  gamma_url: string | null;
  export_url: string | null;
}

export const aiCourseService = {
  /** GET /api/g2g-lms/course-builder/ai/status */
  getStatus: (session: SessionContext) =>
    apiGet<AiApiResponse<AiProviderStatus>>(session, '/g2g-lms/course-builder/ai/status'),

  /** POST /api/g2g-lms/course-builder/ai/outline */
  generateOutline: (session: SessionContext, payload: AiOutlineRequest) =>
    apiPost<AiApiResponse<AiOutlineResult>>(session, '/g2g-lms/course-builder/ai/outline', payload),

  /** POST /api/g2g-lms/course-builder/ai/presentation */
  generatePresentation: (session: SessionContext, payload: AiPresentationRequest) =>
    apiPost<AiApiResponse<AiPresentationStarted>>(session, '/g2g-lms/course-builder/ai/presentation', payload),

  /** GET /api/g2g-lms/course-builder/ai/presentation/{generationId} */
  getGenerationStatus: (session: SessionContext, generationId: string) =>
    apiGet<AiApiResponse<AiGenerationStatusResult>>(
      session,
      `/g2g-lms/course-builder/ai/presentation/${generationId}`
    ),

  /** GET /api/g2g-lms/course-builder/ai/outlines */
  getOutlines: (session: SessionContext, limit = 25) =>
    apiGet<AiApiResponse<AiSavedOutline[]>>(session, '/g2g-lms/course-builder/ai/outlines', {
      limit: String(limit),
    }),

  /** POST /api/g2g-lms/course-builder/ai/outlines/{id}/publish */
  publishOutline: (session: SessionContext, outlineId: number, payload: AiPublishRequest) =>
    apiPost<AiApiResponse<AiPublishResult>>(
      session,
      `/g2g-lms/course-builder/ai/outlines/${outlineId}/publish`,
      payload
    ),
};
