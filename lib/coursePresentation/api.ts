import { API_BASE_URL } from '@/app/components/utils/api_url';
import { buildSessionContext } from '@/lib/erp-client';

/**
 * Course Presentation pilot client (next_lms_erp `lms/course-presentation/*`).
 *
 * Reads (options, fit, preflight, status) are GETs and write nothing. Generate starts a background draft, approve
 * stores a draft a teacher has reviewed, discard drops one; those three are POSTs behind the content-create gate.
 * The school and the user are never sent: the server reads them from the bearer token. Only the chapter, the two
 * choices and a run id are named, and the server decides which sources belong to the chapter.
 */

export interface CpChoice {
  key: string;
  label: string;
}
export interface CpFormatChoice extends CpChoice {
  generator_exists: boolean;
}

/** Is the teaching method suitable for this chapter, judged from the chapter's own analysis. */
export interface CpSuitability {
  verdict: 'suitable' | 'not_suitable' | 'unconfirmed' | 'unknown';
  concepts_recommending: number | null;
  concepts_analysed: number | null;
  recommendation: { key: string; label: string; concepts_recommending: number }[] | null;
  message: string;
}

export type CpFitStatus = 'suitable' | 'partially_suitable' | 'unsuitable' | 'unsupported';

/** Server-side method-fit validation of the two choices for this chapter. */
export interface CpTemplate {
  /** Can the format open straight from the stored data, with no AI call? */
  available: boolean;
  kind: string | null;
  requirements: string[];
  blocked_by: string[];
  /** A reusable template held in Template Management (a story format): which one, where it was read from, and the player it is bound to. */
  registered?: { key: string; name: string; version: number; source: 'template_master' | 'built_in'; template_id: number | null; player: string };
}

export interface CpFit {
  fit_status: CpFitStatus;
  reason: string;
  method_fit: { verdict: CpSuitability['verdict']; message: string; concepts_recommending: number | null; concepts_analysed: number | null };
  format_fit: { status: 'strong' | 'possible' | 'weak' | 'not_evaluated'; note: string | null };
  recommendations: { type: 'method' | 'format'; key: string; label: string; reason: string }[];
  missing_sources: { key: string; label: string; status: string }[];
  incomplete_sources: { key: string; label: string; status: string }[];
  duplicate: boolean;
  generation_supported: boolean;
  generation_blockers: string[];
  active_run: { run: string; state: CpRunState } | null;
  viewer_type: string | null;
  viewer_label: string | null;
  admin_commands: string[];
  /** Opens from stored data with no AI call, or says what it would need. */
  template: CpTemplate;
  /** Offered where no template exists. Possible only where a generator can really be started. */
  create: { label: string; available: boolean; reasons: string[] };
  continue_allowed: boolean;
}

export interface CpOptions {
  chapter: { id: number; name: string };
  suitability: Record<string, CpSuitability>;
  pedagogies: CpChoice[];
  formats: CpFormatChoice[];
  pedagogy_note: string;
}

/** Whether it is there and how good. */
export type CpSourceStatus = 'present' | 'incomplete' | 'missing' | 'conflicting';

export interface CpSource {
  key: string;
  label: string;
  status: CpSourceStatus;
  /** Is it there? */
  availability: 'available' | 'unavailable' | 'conflicting' | 'not_applicable';
  /** Is it good? */
  quality: 'complete' | 'partial' | 'unknown' | 'not_applicable';
  /** Does generating slides need it? */
  needed_for_slides: boolean;
  review_status: string;
  summary: string;
  impact: string;
  rejected: number;
  /** The server's own wording of the status when it says more than the one-word status, e.g. "Available — partial coverage". */
  status_label?: string;
  /** Intelligence only: verified coverage and the fields that really hold data. */
  coverage?: {
    intelligence_concepts: number;
    matched: number;
    chapter_concepts: number;
    fields: { field: string; concepts: number; items: number }[];
    without_data: string[];
  };
}

/** Pictures of a finished draft, checked against the picture library before it was offered for review. */
export interface CpDraftImages {
  referenced: number;
  resolved: number;
  unreadable: number;
  diagrams: number;
  photographs: number;
  photographs_not_found: { slide: number; reason: string }[];
}

export type CpRunState = 'queued' | 'running' | 'ready' | 'failed' | 'stored' | 'discarded';

/**
 * How much of the chapter's OWN concept list a draft teaches. `checked` is false when that list could not be read: the draft was
 * then held only to its own concept map, and it must never be described as verified against the chapter.
 */
export interface CpRunCoverage {
  checked: boolean;
  source_concepts: number | null;
  taught: number;
  missing: string[];
}

/** One generation run as a teacher may see it: no folder, school, user or raw output. */
export interface CpRun {
  run: string;
  state: CpRunState;
  /** The teaching method and content format this run was made for: a run is only ever shown and acted on for exactly that choice. */
  method: string;
  format: string;
  coverage?: CpRunCoverage | null;
  created_at: string;
  progress: string[];
  error: string | null;
  report: { slides: number; interactive_slides: number; concepts: number; warnings: number; method_followed: boolean } | null;
  outline: { n: number; title: string; type: string }[] | null;
  images: CpDraftImages | null;
  stored: { deep_link: string | null; images: { referenced: number; linked: number } | null } | null;
}

/** How every concept of the chapter is covered: by its own intelligence, through its topic, from the stored concept record. */
export interface CpCoverage {
  summary: {
    total_concepts: number;
    intelligence_entries: number;
    intelligence_entries_mapped: number;
    semantic_concept_level: number;
    semantic_exact: number;
    semantic_contained: number;
    semantic_topic_level_only: number;
    no_semantic: number;
    from_intelligence: number;
    from_concept_record_only: number;
    unresolved: number;
    renderable: number;
  };
  concepts: {
    name: string;
    topic: string | null;
    source: 'semantic' | 'concept_record' | 'unresolved';
    semantic: 'concept' | 'topic' | 'none';
    match: string | null;
    picture: boolean;
    sufficient: boolean;
    reason: string | null;
  }[];
  unresolved: { name: string; reason: string | null }[];
  intelligence_entries_not_mapped: string[];
  pictures: { with_a_verified_picture: number; without: number; candidates_rejected: number };
  learning_outcomes: string;
}

/** What the picture library says about the chapter (read only). */
export interface CpImages {
  library: { stored: number; photographs: number; drawn_diagrams: number; used_by_a_stored_deck: number; not_used_by_any_stored_deck: number };
  earlier_draft:
    | { found: false }
    | {
        found: true;
        slides_with_a_picture: number;
        drawn_diagrams: number;
        photographs: number;
        found_in_the_library: number;
        not_found_in_the_library: number;
        photographs_not_found: { slide: number; concepts: string[]; reason: string }[];
        status: string;
      };
  reuse_rule: string;
  requirements_note: string;
}

export interface CpExistingResource {
  type: string;
  title: string;
  status: string;
  format?: string;
  ref?: number;
}

export interface CpPreflight {
  chapter: { id: number; name: string };
  selection: { pedagogy: CpChoice; format: CpChoice };
  fit: CpFit;
  run: CpRun | null;
  suitability: CpSuitability;
  capability: {
    status: 'unsupported_format' | 'generator_exists_offline' | 'generator_available';
    generation_ready: boolean;
    pedagogy_applied: boolean;
    messages: string[];
  };
  /** Source material: what a presentation is written from. */
  sources: CpSource[];
  /** Whether a presentation or an earlier draft already exists. Not source material. */
  existing_content: CpSource[];
  images: CpImages;
  coverage: CpCoverage;
  /** What is already stored in the SELECTED format only (a stored presentation is not listed under a story lesson, nor the reverse). */
  existing_resources: CpExistingResource[];
  not_used: { key: string; label: string; count: number; detail: string; reason: string }[];
  wrote_nothing: boolean;
}

export class CoursePresentationApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'CoursePresentationApiError';
    this.status = status;
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, params: Record<string, string | boolean>, signal?: AbortSignal): Promise<T> {
  const { token } = buildSessionContext();
  if (!token) throw new CoursePresentationApiError('Your session has expired. Please sign in again.', 401);

  const base = `${API_BASE_URL}/api/lms/course-presentation/${path}`;
  const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${token}` };
  const res =
    method === 'GET'
      ? await fetch(`${base}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}`, { headers, signal })
      : await fetch(base, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(params), signal });
  let raw: Record<string, unknown> = {};
  try {
    raw = (await res.json()) as Record<string, unknown>;
  } catch {
    /* a failing server may answer with an HTML page; never show it raw */
  }
  if (res.status === 401) throw new CoursePresentationApiError('Your session has expired. Please sign in again.', 401);
  if (res.status === 403) throw new CoursePresentationApiError(typeof raw.message === 'string' ? raw.message : 'You are not authorised to do this.', 403);
  if (res.status === 404) throw new CoursePresentationApiError(typeof raw.message === 'string' ? raw.message : 'Not found.', 404);
  if (res.status === 429) throw new CoursePresentationApiError('Too many requests. Please wait a minute and try again.', 429);
  // 422 is a missing/unknown choice, or a combination or draft the server refuses; its message says which.
  if (res.status === 422) throw new CoursePresentationApiError(typeof raw.message === 'string' && raw.message !== '' ? raw.message : 'Choose a teaching method and a delivery format first.', 422);
  if (!res.ok || Number(raw.status_code) !== 1) throw new CoursePresentationApiError(`Request failed (${res.status}).`, res.status);
  return raw as unknown as T;
}

/** A template filled from stored data: read only, no AI call, nothing stored or published. */
export interface CpPreview {
  kind: 'study_deck';
  origin: 'source_data_preview';
  notice: string;
  deck: unknown;
  summary: { method: string; slides: number; concepts: number; concepts_explained: number; concepts_with_intelligence: number; pictures_placed: number; pictures_available: number; derived_prompts: number };
  missing: { what: string; where: string; why: string }[];
  coverage: CpCoverage;
  pictures: { placed: number; verified_available: number; rejected: { slide: number; reason: string }[] };
}

export const fetchCpPreview = (chapterId: number, pedagogy: string, format: string, signal?: AbortSignal) =>
  request<CpPreview>('GET', 'preview', { chapter_id: String(chapterId), pedagogy, format }, signal);

/** The deck of a draft waiting for review, to be played in the study-deck player before anything is stored. */
export const fetchCpDraft = (chapterId: number, run: string, signal?: AbortSignal) =>
  request<{ notice: string; deck: unknown }>('GET', 'draft', { chapter_id: String(chapterId), run }, signal);

export const fetchCpOptions = (chapterId: number, signal?: AbortSignal) => request<CpOptions>('GET', 'options', { chapter_id: String(chapterId) }, signal);

export const fetchCpFit = (chapterId: number, pedagogy: string, format: string, signal?: AbortSignal) =>
  request<{ fit: CpFit }>('GET', 'fit', { chapter_id: String(chapterId), pedagogy, format }, signal);

export const fetchCpPreflight = (chapterId: number, pedagogy: string, format: string, signal?: AbortSignal) =>
  request<CpPreflight>('GET', 'preflight', { chapter_id: String(chapterId), pedagogy, format }, signal);

/**
 * One run by its id, or, with no run, the newest run made for exactly the teaching method and format named (never the chapter's
 * latest of another choice). The server refuses a run that belongs to another choice.
 */
export const fetchCpStatus = (chapterId: number, choice: { run?: string; pedagogy?: string; format?: string }, signal?: AbortSignal) =>
  request<{ run: CpRun | null }>(
    'GET',
    'status',
    {
      chapter_id: String(chapterId),
      ...(choice.run ? { run: choice.run } : {}),
      ...(choice.pedagogy ? { pedagogy: choice.pedagogy } : {}),
      ...(choice.format ? { format: choice.format } : {}),
    },
    signal,
  );

/** Starts a background draft. Stores nothing. */
export const generateCpPresentation = (chapterId: number, pedagogy: string, format: string) =>
  request<{ run: CpRun }>('POST', 'generate', { chapter_id: String(chapterId), pedagogy, format });

/** A teacher has reviewed the draft: store it with the existing storage workflow. The choice on screen must be the draft's own. */
export const approveCpDraft = (chapterId: number, run: string, pedagogy: string, format: string) =>
  request<{ run: CpRun }>('POST', 'approve', { chapter_id: String(chapterId), run, pedagogy, format, reviewed: true });

export const discardCpDraft = (chapterId: number, run: string, pedagogy: string, format: string) =>
  request<{ run: CpRun }>('POST', 'discard', { chapter_id: String(chapterId), run, pedagogy, format });
