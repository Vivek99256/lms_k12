import { API_BASE_URL } from '@/app/components/utils/api_url';
import { buildSessionContext } from '@/lib/erp-client';
import type { LabConfig } from '@/lib/prayogshala/engines';

/**
 * Prayogshala API client (next_lms_erp `lms/prayogshala/*`).
 *
 * The institute and the user are never sent: the server reads both from the bearer
 * token, so this client only names the chapter. Standard and subject are derived from
 * the chapter on the server, which is also why nothing here is specific to a standard,
 * a subject or an institute.
 */

export type PrayogshalaResourceType = 'image' | 'video' | 'pdf' | 'link';

export interface PrayogshalaResource {
  type: PrayogshalaResourceType;
  title: string;
  url: string;
}

export interface PrayogshalaActivity {
  id: number;
  chapter_id: number;
  standard_id: number;
  subject_id: number;
  /** topic_master.id within the chapter; null = the activity covers the whole chapter. */
  topic_id: number | null;
  topic_name: string | null;
  concept_id: number | null;
  concept_name: string | null;
  title: string;
  activity_type: string;
  activity_type_label: string;
  description: string | null;
  objective: string | null;
  materials_required: string[];
  procedure_steps: string[];
  observation: string | null;
  result: string | null;
  safety_instructions: string | null;
  teacher_instructions: string | null;
  student_instructions: string | null;
  estimated_minutes: number | null;
  resources: PrayogshalaResource[];
  slug: string | null;
  /** draft | review | published. Learners only ever receive 'published'. */
  status: 'draft' | 'review' | 'published';
  /** The interactive lab, or null for a plain document activity. */
  lab_config: LabConfig | null;
  /** Set on activities that arrive through the chapter content list. */
  context?: PrayogshalaChapterContext | null;
  show_hide: number;
  sort_order: number;
  /** False for the platform's shared rows, which an institute can read but not change. */
  editable: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface PrayogshalaChapterContext {
  chapter_id: number;
  chapter_name: string;
  standard_id: number;
  standard_name: string | null;
  subject_id: number;
  subject_name: string | null;
}

export interface PrayogshalaActivityType {
  value: string;
  label: string;
}

export interface PrayogshalaChapterResponse {
  chapter: PrayogshalaChapterContext;
  activities: PrayogshalaActivity[];
  activity_types: PrayogshalaActivityType[];
  /** The chapter's topics, for the editor's topic picker. */
  topics: { id: number; name: string }[];
  can_manage: boolean;
}

/** The writable fields. List fields are arrays of lines; the server trims blanks. */
export interface PrayogshalaActivityInput {
  title: string;
  activity_type?: string;
  /** null clears the topic (chapter-wide). */
  topic_id?: number | null;
  description?: string;
  objective?: string;
  materials_required?: string[];
  procedure_steps?: string[];
  observation?: string;
  result?: string;
  safety_instructions?: string;
  teacher_instructions?: string;
  student_instructions?: string;
  estimated_minutes?: number | null;
  resources?: PrayogshalaResource[];
  show_hide?: boolean;
  status?: 'draft' | 'review' | 'published';
}

/** Carries the HTTP status so the UI can tell "signed out" from "not found". */
export class PrayogshalaApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PrayogshalaApiError';
    this.status = status;
  }
}

function firstValidationMessage(errors: unknown): string | null {
  if (!errors || typeof errors !== 'object') return null;
  for (const value of Object.values(errors as Record<string, unknown>)) {
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  }
  return null;
}

async function request<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const { token } = buildSessionContext();
  if (!token) {
    throw new PrayogshalaApiError('Your session has expired. Please sign in again.', 401);
  }

  const res = await fetch(`${API_BASE_URL}/api/lms/prayogshala${path}`, {
    method: init.method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  // A failing server may answer with an HTML error page; never let that reach the UI raw.
  let raw: Record<string, unknown> = {};
  try {
    raw = (await res.json()) as Record<string, unknown>;
  } catch {
    /* fall through to the status-based message below */
  }

  if (res.status === 401) {
    throw new PrayogshalaApiError('Your session has expired. Please sign in again.', 401);
  }
  if (res.status === 403) {
    throw new PrayogshalaApiError(
      (raw.message as string) || 'You are not authorised to do this.',
      403
    );
  }
  if (res.status === 404) {
    throw new PrayogshalaApiError((raw.message as string) || 'Not found.', 404);
  }
  if (!res.ok || Number(raw.status_code) !== 1) {
    throw new PrayogshalaApiError(
      firstValidationMessage(raw.errors) ||
        (raw.message as string) ||
        `Request failed (${res.status}).`,
      res.status
    );
  }

  return raw.data as T;
}

export function fetchPrayogshalaForChapter(chapterId: number): Promise<PrayogshalaChapterResponse> {
  return request<PrayogshalaChapterResponse>('', { method: 'POST', body: { chapter_id: chapterId } });
}

export function createPrayogshalaActivity(
  chapterId: number,
  input: PrayogshalaActivityInput
): Promise<PrayogshalaActivity> {
  return request<PrayogshalaActivity>('/store', {
    method: 'POST',
    body: { ...input, chapter_id: chapterId },
  });
}

export function updatePrayogshalaActivity(
  id: number,
  input: PrayogshalaActivityInput
): Promise<PrayogshalaActivity> {
  return request<PrayogshalaActivity>(`/${id}/update`, { method: 'POST', body: input });
}

export async function deletePrayogshalaActivity(id: number): Promise<void> {
  await request<unknown>(`/${id}/delete`, { method: 'POST', body: {} });
}
