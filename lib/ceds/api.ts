import { API_BASE_URL } from '@/app/components/utils/api_url';
import { buildSessionContext } from '@/lib/erp-client';

/**
 * Teaching method -> resource formats (next_lms_erp `lms/ceds/resources`).
 *
 * READ ONLY. This client only ever sends a GET naming a chapter and, optionally, a teaching
 * method. The school and user come from the bearer token on the server; nothing here stores,
 * generates or adapts anything. The pure helpers below carry the display rules so they can be
 * tested with node:test.
 */

export type Fit = 'S' | 'P' | 'W';
export type ResourceStatus = 'available' | 'partial' | 'pending_review' | 'missing';

export interface ResourceItem {
  id: number;
  source: 'content_master' | 'lms_prayogshala_activity';
  title: string;
  kind: 'study_deck' | 'study_document' | 'legacy' | 'prayogshala_lab';
  scope: 'chapter' | 'concepts' | 'concept' | 'topic';
  status: 'available' | 'pending_review';
  /** "Pending Review" for a lab that is not approved; null otherwise. */
  review_label: string | null;
  file_type?: string;
  /** Only on Classroom Content (D1) items: which of its two existing resources this row is. */
  component?: 'presentation' | 'revision_notes';
}

/** A place where the existing resources fall short of the spec. Recorded for later; nothing is generated to fill it. */
export interface KnownGap {
  key: string;
  label: string;
  detail: string;
}

export interface FormatRow {
  format: string;
  label: string;
  /** Absent when no teaching method is chosen. */
  fit?: Fit;
  note?: string | null;
  warning?: string | null;
  alternative_formats?: string[];
  alternative_pedagogies?: string[];
  status: ResourceStatus;
  items: ResourceItem[];
  hidden_ignored: number;
  unavailable_ignored: number;
  /** Why a format is missing or what is special about it (e.g. D1 can only be a review bundle). */
  resolver_note?: string | null;
  /** Only on D1: how the two existing resources it is made of stand. */
  components?: Record<string, { label: string; status: 'available' | 'missing'; item_ids: number[] }>;
  /** Only on D1: the known gaps. */
  gaps?: KnownGap[];
}

export interface CedsResources {
  chapter: { id: number; name: string };
  pedagogies: Record<string, string>;
  pedagogy: string | null;
  period_minutes: number;
  formats: FormatRow[];
  generation: { enabled: boolean; adapt_enabled: boolean };
}

export class CedsApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function fetchCedsResources(chapterId: number, pedagogy: string | null, signal?: AbortSignal): Promise<CedsResources> {
  const { token } = buildSessionContext();
  if (!token) throw new CedsApiError('Your session has expired. Please sign in again.', 401);

  const query = new URLSearchParams({ chapter_id: String(chapterId) });
  if (pedagogy) query.set('pedagogy', pedagogy);

  const res = await fetch(`${API_BASE_URL}/api/lms/ceds/resources?${query}`, {
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
  if (res.status === 401) throw new CedsApiError('Your session has expired. Please sign in again.', 401);
  if (res.status === 403) throw new CedsApiError((raw.message as string) || 'You are not authorised to view this.', 403);
  if (res.status === 404) throw new CedsApiError((raw.message as string) || 'Chapter not found.', 404);
  if (!res.ok || Number(raw.status_code) !== 1) throw new CedsApiError((raw.message as string) || `Request failed (${res.status}).`, res.status);

  return raw as unknown as CedsResources;
}

// ------------------------------------------------------------------ display rules (pure)

export function fitLabel(fit: Fit | undefined): string {
  return fit === 'S' ? 'Strong fit' : fit === 'P' ? 'Possible fit' : fit === 'W' ? 'Weak fit' : '';
}

export function statusLabel(status: ResourceStatus): string {
  return status === 'available'
    ? 'Available'
    : status === 'partial'
      ? 'Partly available'
      : status === 'pending_review'
        ? 'Pending Review'
        : 'Not created yet';
}

/** What a D1 item is, in words: the row itself is the existing Presentation or Revision Notes, not a copy. */
export function componentLabel(component: ResourceItem['component']): string | null {
  return component === 'presentation' ? 'Classroom Presentation' : component === 'revision_notes' ? 'Revision Notes' : null;
}

/**
 * Where an existing item opens, or null when this release has no safe viewer for it.
 * Study decks and study documents open in the viewer the Classroom Resource list already uses.
 * Labs have no standalone page (they open from the chapter's Prayogshala tab) and older
 * library rows are opened from the Classroom Resource list, so neither gets a link here.
 */
export function openHref(item: ResourceItem, chapterId: number): string | null {
  if (item.source === 'content_master' && (item.kind === 'study_deck' || item.kind === 'study_document')) {
    return `/student/study-deck/${chapterId}?content=${item.id}`;
  }
  return null;
}

/** Formats a teacher ticked that have nothing stored: the only ones a later release could generate. */
export function missingSelection(formats: FormatRow[], selected: string[]): string[] {
  return formats.filter((f) => f.status === 'missing' && selected.includes(f.format)).map((f) => f.format);
}

/** "Select all six": every format code, or none when all are already ticked. */
export function toggleAll(formats: FormatRow[], selected: string[]): string[] {
  return selected.length === formats.length ? [] : formats.map((f) => f.format);
}
