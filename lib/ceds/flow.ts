import { API_BASE_URL } from '@/app/components/utils/api_url';
import { buildSessionContext } from '@/lib/erp-client';

/**
 * Teaching method -> lesson flow for one topic (next_lms_erp `lms/ceds/lesson-flow`).
 *
 * READ ONLY. A GET names a chapter and, once chosen, a method, a topic, a period and the teacher's minutes.
 * The school and user come from the bearer token on the server. Nothing here stores, generates, adapts or
 * re-times any stored resource: the server returns what is stored, and the helpers below only build links
 * to it and do arithmetic on what was returned.
 */

export interface FlowWarning {
  code: 'overrun' | 'period_mismatch' | 'unreadable';
  message: string;
  stored_minutes?: number;
  phase_minutes?: number;
}

interface ResourceBase {
  title: string;
  status: 'available' | 'pending_review';
  /** "Pending Review" for a lab that is not approved; null otherwise. */
  review_label: string | null;
  stored_minutes: number | null;
}

export type FlowResource =
  | (ResourceBase & { type: 'slide'; slide: number; slide_type: string; content_id: number; scope: 'topic' | 'chapter' })
  | (ResourceBase & { type: 'activity'; section: number; content_id: number | null; format: string | null; grouping: string | null })
  | (ResourceBase & { type: 'notes'; section: number; content_id: number | null })
  | (ResourceBase & { type: 'lab'; id: number })
  | (ResourceBase & { type: 'questions'; question_ids: number[]; on_slides: number[]; content_id: number });

export interface FlowPhase {
  index: number;
  name: string;
  minutes: number;
  suggested_minutes: number;
  outside_period: boolean;
  resources: FlowResource[];
  teacher_led: boolean;
  teacher_led_reason: 'no_stored_equivalent' | 'none_found' | 'resource_unreadable' | null;
  warnings: FlowWarning[];
}

export interface LessonFlow {
  pedagogy: string;
  pedagogy_label: string;
  topic_id: number;
  period_minutes: number;
  planned_minutes: number;
  phases: FlowPhase[];
  warnings: FlowWarning[];
  deck_content_id: number | null;
}

export interface FlowTopic {
  id: number;
  name: string;
  concept_ids: number[];
  slides: number;
  activities: number;
  notes: number;
  labs: number;
}

export interface FlowResponse {
  chapter: { id: number; name: string };
  pedagogies: Record<string, string>;
  default_period_minutes: number;
  topics: FlowTopic[];
  deck_content_id: number | null;
  warnings: { code: string; message: string }[];
  generation: { enabled: boolean; adapt_enabled: boolean };
  topic?: FlowTopic;
  flow: LessonFlow | null;
}

export class FlowApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export interface FlowRequest {
  chapterId: number;
  pedagogy?: string;
  topicId?: number;
  period?: number;
  minutes?: number[];
}

export function flowQuery(req: FlowRequest): string {
  const q = new URLSearchParams({ chapter_id: String(req.chapterId) });
  if (req.pedagogy) q.set('pedagogy', req.pedagogy);
  if (req.topicId) q.set('topic_id', String(req.topicId));
  if (req.period) q.set('period', String(req.period));
  (req.minutes ?? []).forEach((m) => q.append('minutes[]', String(m)));
  return q.toString();
}

export async function fetchLessonFlow(req: FlowRequest, signal?: AbortSignal): Promise<FlowResponse> {
  const { token } = buildSessionContext();
  if (!token) throw new FlowApiError('Your session has expired. Please sign in again.', 401);

  const res = await fetch(`${API_BASE_URL}/api/lms/ceds/lesson-flow?${flowQuery(req)}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    signal,
  });

  let raw: Record<string, unknown> = {};
  try {
    raw = (await res.json()) as Record<string, unknown>;
  } catch {
    /* a failing server may answer with an HTML page; fall through to the status message */
  }
  if (res.status === 401) throw new FlowApiError('Your session has expired. Please sign in again.', 401);
  if (res.status === 403) throw new FlowApiError((raw.message as string) || 'You are not authorised to view this.', 403);
  if (res.status === 404) throw new FlowApiError((raw.message as string) || 'Not found.', 404);
  if (!res.ok || Number(raw.status_code) !== 1) throw new FlowApiError((raw.message as string) || `Request failed (${res.status}).`, res.status);

  return raw as unknown as FlowResponse;
}

// ------------------------------------------------------------------ links and labels (pure)

/** The viewer already opens a given slide through `&slide=<n>`; nothing about the viewer changes. */
export function slideHref(chapterId: number, contentId: number, slide: number): string {
  return `/student/study-deck/${chapterId}?content=${contentId}&slide=${slide}`;
}

/** Where a stored resource of a phase opens, or null when this release has no verified link for it. */
export function resourceHref(resource: FlowResource, chapterId: number): string | null {
  switch (resource.type) {
    case 'slide':
      return slideHref(chapterId, resource.content_id, resource.slide);
    case 'questions':
      return resource.on_slides.length > 0 ? slideHref(chapterId, resource.content_id, resource.on_slides[0]) : null;
    case 'activity':
    case 'notes':
      return resource.content_id ? `/student/study-deck/${chapterId}?content=${resource.content_id}` : null;
    default:
      return null;
  }
}

export function resourceKindLabel(resource: FlowResource): string {
  switch (resource.type) {
    case 'slide':
      return `Slide ${resource.slide}`;
    case 'activity':
      return 'Classroom activity';
    case 'notes':
      return 'Revision notes';
    case 'lab':
      return 'Prayogshala lab';
    case 'questions':
      return 'Practice questions';
  }
}

export function linkLabel(resource: FlowResource): string {
  return resource.type === 'slide' || resource.type === 'questions' ? 'Go to slide' : 'Open';
}

export const TEACHER_LED_LABEL = 'Teacher-led, nothing stored';

export function teacherLedExplanation(reason: FlowPhase['teacher_led_reason']): string {
  switch (reason) {
    case 'no_stored_equivalent':
      return 'No stored resource corresponds to this phase.';
    case 'resource_unreadable':
      return 'The stored resource for this phase could not be read.';
    case 'none_found':
      return 'None of the stored resources is verifiably linked to this topic for this phase.';
    default:
      return '';
  }
}

export function minutesText(stored: number | null | undefined): string {
  return stored === null || stored === undefined ? '' : `stored ${stored} min`;
}

/** A minutes field as typed: a whole number from 0 to the cap, or null when it is not one. */
export function parseMinutes(value: string, cap = 120): number | null {
  if (!/^\d{1,3}$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return n >= 0 && n <= cap ? n : null;
}

export function periodFrom(value: string, min = 10, max = 120): number | null {
  const n = parseMinutes(value, max);
  return n !== null && n >= min ? n : null;
}

/** The phases' minutes as the teacher has set them, ready to send. */
export function minutesOf(phases: FlowPhase[]): number[] {
  return phases.map((p) => p.minutes);
}

export function plannedTotal(minutes: number[]): number {
  return minutes.reduce((a, b) => a + b, 0);
}

/** A topic as the picker offers it: its name and what is stored for it. */
export function topicLabel(topic: FlowTopic): string {
  const bits = [
    topic.slides ? `${topic.slides} slide${topic.slides === 1 ? '' : 's'}` : null,
    topic.activities ? `${topic.activities} activit${topic.activities === 1 ? 'y' : 'ies'}` : null,
    topic.labs ? `${topic.labs} lab${topic.labs === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  return bits.length ? `${topic.name} (${bits.join(', ')})` : topic.name;
}
