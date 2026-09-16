import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client';

/**
 * ONE content-authoring client — tracker "Content & LMS Architecture" row 3 / Decision #36.
 *
 * > "Generate (AI) and Upload capabilities are built once ... and reused with a
 * >  content-type parameter across Classroom Resource, Teacher Resource, and Question Bank."
 *
 * Before this file there were three unrelated implementations, sharing no component, hook
 * or helper — only `API_BASE_URL`:
 *
 *   Generate content    → sideDrawer.tsx, a `fetch` inlined in the drawer
 *                         → POST /api/lms/gamma-content-master
 *   Upload content      → chapters.ts `uploadChapterContent`
 *                         → POST /api/lms-chapter-content/upload
 *   Generate Questions  → chapters.ts `generateIntelligenceQuestions`
 *                         → POST /api/intelligence/questions/generate
 *
 * They all now have one place to go: `submitAuthoringJob`, with a content-type parameter.
 *
 * WHY THIS IS THE DATA LAYER AND NOT A SHARED REACT COMPONENT
 * The three UIs live in a 5,400-line page that teammates are actively editing (it grew by
 * ~600 lines during this work). Replacing three modals with one component in the same pass
 * that changes their transport would make a behavioural regression indistinguishable from a
 * merge conflict. The duplication that actually mattered — three request shapes, three
 * error conventions, three auth stories — is here, and it is now single. The modal JSX can
 * be unified afterwards against a transport that is already proven.
 *
 * AUTH: unlike the three legacy calls, this sends a Bearer token (Convention B,
 * `lib/erp-client.ts`). The endpoint is gated by `lms.auth` + `perm:lms.content,create`.
 */

export type AuthoringMode = 'generate' | 'upload';

/** Keys from the backend registry, `config('lms_content.authoring_types')`. */
export type AuthoringContentType =
  | 'presentation'
  | 'teacher_training'
  | 'revision_notes'
  | 'classroom_activity'
  | 'video'
  | 'question';

export interface AuthoringTypeDescriptor {
  content_type: AuthoringContentType;
  label: string;
  modes: AuthoringMode[];
  entity_type: 'content' | 'question';
  category: string | null;
  permission: string;
  upload_mimes: string[];
  has_generator: boolean;
}

export interface AuthoringRequest {
  contentType: AuthoringContentType;
  mode: AuthoringMode;
  chapterId?: number | string | null;
  subjectId?: number | string | null;
  standardId?: number | string | null;
  conceptId?: number | string | null;
  title?: string;
  prompt?: string;
  slideCount?: number;
  /** The platform item this one EXTENDS. Never a replacement — see Decision #37. */
  derivedFromEntityId?: number | null;
  /** Only for mode: 'upload'. */
  file?: File | null;
  /**
   * Supply to make a retry safe. Generation runs inline (QUEUE_CONNECTION=sync), so a
   * user watching a slow spinner will click again; the backend returns the original
   * result rather than billing a second provider call.
   */
  idempotencyKey?: string;
}

export interface AuthoringResult {
  entityType: 'content' | 'question';
  entityIds: number[];
  auditId: number | null;
  /** True when the backend recognised this as a repeat and did no new work. */
  replayed: boolean;
}

const VOCABULARY_PATH = '/api/lms/content/authoring-vocabulary';
const AUTHOR_PATH = '/api/lms/content/author';

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.message === 'string' && b.message.trim()) return b.message;
    if (b.errors && typeof b.errors === 'object') {
      const first = Object.values(b.errors as Record<string, unknown>)[0];
      if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
    }
  }
  return fallback;
}

/**
 * What can be authored, and how.
 *
 * Schema-driven, mirroring how `GET /api/pal/content/vocabulary` drives the PAL authoring
 * console — the one place in this codebase where an authoring form is built from the
 * backend rather than hardcoded. A new authoring type appears here without a React change.
 */
export async function fetchAuthoringVocabulary(): Promise<AuthoringTypeDescriptor[]> {
  const session = buildSessionContext();
  const res = await fetch(`${session.baseUrl}${VOCABULARY_PATH}`, {
    headers: createAuthHeaders(session),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => null);

  if (!res.ok || body?.status_code !== 1) {
    throw new Error(messageFrom(body, 'Could not load the authoring options.'));
  }

  return (body.data?.authoring_types ?? []) as AuthoringTypeDescriptor[];
}

/**
 * The single entry point for creating content, whatever the surface.
 *
 * Replaces the transport half of all three legacy flows. The legacy endpoints remain live
 * and untouched — the Blade UI and shipped mobile clients depend on them — so this can be
 * adopted one call site at a time.
 */
export async function submitAuthoringJob(request: AuthoringRequest): Promise<AuthoringResult> {
  const session = buildSessionContext();

  if (!session.token) {
    // Authoring writes rows that must carry an owner, so unlike a read it cannot proceed
    // without a verified identity.
    throw new Error('You need to be signed in to create content.');
  }

  const form = new FormData();
  form.set('content_type', request.contentType);
  form.set('mode', request.mode);

  const optional: Array<[string, unknown]> = [
    ['chapter_id', request.chapterId],
    ['subject_id', request.subjectId],
    ['standard_id', request.standardId],
    ['concept_id', request.conceptId],
    ['title', request.title],
    ['prompt', request.prompt],
    ['slide_count', request.slideCount],
    ['derived_from_entity_id', request.derivedFromEntityId],
    ['idempotency_key', request.idempotencyKey],
  ];

  for (const [key, value] of optional) {
    if (value !== undefined && value !== null && value !== '') {
      form.set(key, String(value));
    }
  }

  if (request.mode === 'upload') {
    if (!request.file) throw new Error('Choose a file to upload.');
    form.set('file', request.file);
  }

  // No Content-Type header: the browser must set the multipart boundary itself.
  const res = await fetch(`${session.baseUrl}${AUTHOR_PATH}`, {
    method: 'POST',
    headers: createAuthHeaders(session),
    body: form,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || body?.status_code !== 1) {
    throw new Error(messageFrom(body, `Could not create the content (${res.status}).`));
  }

  const data = body.data ?? {};

  return {
    entityType: data.entity_type ?? 'content',
    entityIds: Array.isArray(data.entity_ids) ? data.entity_ids.map(Number) : [],
    auditId: data.audit_id ?? null,
    replayed: Boolean(data.idempotent_replay),
  };
}
