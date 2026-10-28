import { API_BASE_URL } from '@/app/components/utils/api_url';
import { buildSessionContext } from '@/lib/erp-client';
import {
  SHA256_PATTERN,
  assetByteLimit,
  knownAssetMime,
  resolveAssetKind,
  type AssetFile,
  type AssetKind,
} from '@/lib/simulation-host';
import { readLimits, type SimulationLimits, type UploadMeta } from '@/lib/simulation-package-plan';
import {
  buildConceptQuery,
  buildSimulationQuery,
  type LinkPayloadItem,
  type LinkReviewStatus,
  type SimulationFilter,
  type SimulationLink,
} from '@/lib/simulation-links';

/**
 * Simulation Learning API client (next_lms_erp `lms/prayogshala/simulations/*`).
 *
 * Like the Prayogshala client, the institute and the user are never sent: the server reads both from the bearer token. A simulation is DATA
 * (a `g2g.sim` specification plus its 3D files); one generic runtime plays every one. Nothing here knows which simulations exist.
 *
 * Reads are open to every signed-in role. Writes (store, update, delete, restore, asset upload, link edits, link review) are accepted from
 * platform-tenant staff only; anyone else gets 403 and sees `editable: false`. The page hides the controls from what the server says, and the
 * server checks every write again.
 */

export type SimulationStatus = 'draft' | 'published' | 'archived';
export type SimulationDifficulty = 'intro' | 'intermediate' | 'advanced';
export type SimulationProgressStatus = 'in_progress' | 'completed';

export interface SimulationProgress {
  status: SimulationProgressStatus;
  percent: number;
  step: number;
  completed_at: string | null;
  /** Where the runtime left the learner. Only on the single-simulation response; opaque to the page. */
  snapshot?: unknown;
}

/** One card: everything the list needs and none of the specification. */
export interface SimulationCard {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  category: string | null;
  tags: string[];
  audience: string | null;
  minutes: number | null;
  difficulty: SimulationDifficulty | string | null;
  /** A path under /public (`simulations/covers/pendulum-lab.webp`) or an https address. */
  cover_url: string | null;
  status: SimulationStatus;
  version: number;
  missions: number;
  updated_at: string | null;
  progress: SimulationProgress | null;
  /** The concepts this simulation is linked to. A learner receives published links only. */
  links: SimulationLink[];
  /** True only when this session may change the row (platform-tenant staff). */
  editable: boolean | undefined;
}

export interface SimulationSpecPreview {
  id?: string;
  title?: string;
  subtitle?: string;
  summary?: string;
  meta?: {
    minutes?: number;
    audience?: string;
    authors?: string[];
    competencies?: number[];
    category?: string;
    tags?: string[];
    difficulty?: string;
  };
  lesson?: {
    intro?: string;
    missions?: { id?: string; kind?: string; title?: string; brief?: string }[];
  };
  [key: string]: unknown;
}

/** The credit of one 3D model, picture or sky a specification names (`data.assets[]` of GET /{id}). The storage path is never sent. */
export interface SimulationAssetCredit {
  sha256: string;
  kind?: AssetKind;
  name: string;
  bytes: number;
  licence: string | null;
  credit: string | null;
  source_url: string | null;
}

export interface SimulationDetail extends SimulationCard {
  spec: SimulationSpecPreview;
  assets?: SimulationAssetCredit[];
}

export interface SimulationVersionRow {
  version: number;
  sha256?: string;
  note?: string | null;
  created_at?: string | null;
  created_by?: number | null;
}

export interface SimulationVersionsData {
  current: number;
  versions: SimulationVersionRow[];
}

export interface SimulationCardFields {
  status?: SimulationStatus;
  category?: string | null;
  tags?: string[] | string | null;
  cover_url?: string | null;
  difficulty?: string | null;
  sort_order?: number;
}

export interface CreateSimulationInput extends SimulationCardFields {
  /** The parsed specification, sent as received: an empty object stays an empty object. */
  spec: unknown;
  note?: string;
}

export interface UpdateSimulationInput extends SimulationCardFields {
  /** A new specification becomes a new version. Omit it to change only the card. */
  spec?: unknown;
  note?: string;
}

/** What the runtime reports from the page. Recorded as reported; it is not a verified score. */
export interface SimulationProgressReport {
  percent: number;
  step: number;
  status: SimulationProgressStatus;
  /** The runtime's resume snapshot. The server keeps at most 4,000 characters of it. */
  result?: unknown;
}

/** One concept offered by the link editor's picker (platform-tenant concepts only). */
export interface SimulationConceptOption {
  id: number;
  name: string;
  topic_id: number | null;
  topic_name: string | null;
  chapter_id: number | null;
  review_status: string | null;
}

export interface SimulationList {
  simulations: SimulationCard[];
  /** The list's own `editable` flag when the server sends one. */
  editable: boolean | undefined;
}

/* ----------------------------------------------------------------------------------------------------------------------- errors */

/** Carries the HTTP status (so the screen can tell "signed out" from "not found") and the server's list of problems, when it sent one. */
export class SimulationApiError extends Error {
  status: number;
  problems: string[];
  constructor(message: string, status: number, problems: string[] = []) {
    super(message);
    this.name = 'SimulationApiError';
    this.status = status;
    this.problems = problems;
  }
}

/** A download bigger than the page will read. `code` lets callers tell it apart without importing this class. */
export class SimulationTooLargeError extends Error {
  readonly code = 'too_large';
  constructor(readonly maxBytes: number) {
    super(`The file is larger than the ${Math.round(maxBytes / (1024 * 1024))} MB that is accepted.`);
    this.name = 'SimulationTooLargeError';
  }
}

/** What went wrong as one sentence for a person, plus the specification problems the server listed. Never a stack trace. */
export function describeSimulationError(err: unknown, fallback: string): { message: string; problems: string[] } {
  if (err instanceof SimulationApiError) {
    return { message: err.message || fallback, problems: err.problems };
  }
  return { message: err instanceof Error && err.message ? err.message : fallback, problems: [] };
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

function problemsOf(raw: Record<string, unknown>): string[] {
  if (Array.isArray(raw.problems)) return raw.problems.filter((p): p is string => typeof p === 'string');
  const found: string[] = [];
  for (const value of Object.values(asRecord(raw.errors))) {
    if (Array.isArray(value)) for (const item of value) if (typeof item === 'string') found.push(item);
  }
  return found;
}

/** The envelope is `{ success, data, message }`; the hp_erp `status: true` and the Prayogshala `status_code: 1` spellings are understood too. */
function envelopeFailed(raw: Record<string, unknown>): boolean {
  if (raw.success === false || raw.status === false) return true;
  return 'status_code' in raw && Number(raw.status_code) !== 1;
}

function failure(status: number, raw: Record<string, unknown>): SimulationApiError {
  const problems = problemsOf(raw);
  const message =
    status === 401
      ? 'Your session has expired. Please sign in again.'
      : typeof raw.message === 'string' && raw.message.trim() !== ''
        ? raw.message
        : status === 403
          ? 'You are not authorised to do this.'
          : status === 404
            ? 'Not found.'
            : (problems[0] ?? `Request failed (${status}).`);
  return new SimulationApiError(message, status, problems);
}

/** The error of a response that is not a success. A failing server may answer with an HTML page; that never reaches the screen raw. */
async function errorFrom(res: Response): Promise<SimulationApiError> {
  let raw: Record<string, unknown> = {};
  try {
    raw = asRecord(await res.json());
  } catch {
    /* fall through to the status-based message */
  }
  return failure(res.status, raw);
}

function bearer(): string {
  const { token } = buildSessionContext();
  if (!token) throw new SimulationApiError('Your session has expired. Please sign in again.', 401);
  return token;
}

const BASE = '/api/lms/prayogshala/simulations';
const url = (path: string, query = '') => `${API_BASE_URL}${BASE}${path}${query}`;

async function request<T>(
  path: string,
  init: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; query?: string; signal?: AbortSignal },
): Promise<T> {
  const token = bearer();
  const res = await fetch(url(path, init.query), {
    method: init.method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
  });

  let raw: Record<string, unknown> = {};
  try {
    raw = asRecord(await res.json());
  } catch {
    /* fall through */
  }
  if (!res.ok || envelopeFailed(raw)) throw failure(res.status, raw);
  return raw.data as T;
}

/* ------------------------------------------------------------------------------------------------------------ reading the answers */

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const num = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** One link, read defensively. A link without a usable concept id is dropped by the caller. */
export function readLink(value: unknown): SimulationLink | null {
  const raw = asRecord(value);
  const id = num(raw.id);
  const conceptId = num(raw.concept_id);
  if (id === null || conceptId === null) return null;
  return {
    id,
    concept_id: conceptId,
    concept_name: text(raw.concept_name),
    chapter_id: num(raw.chapter_id),
    chapter_name: text(raw.chapter_name),
    topic_id: num(raw.topic_id),
    topic_name: text(raw.topic_name),
    standard_id: num(raw.standard_id),
    subject_id: num(raw.subject_id),
    role: raw.role === 'supporting' ? 'supporting' : 'primary',
    citation: text(raw.citation),
    reason: text(raw.reason),
    review_status: raw.review_status === 'published' ? 'published' : 'review',
  };
}

export function readLinks(value: unknown): SimulationLink[] {
  const list = Array.isArray(value) ? value : Array.isArray(asRecord(value).links) ? (asRecord(value).links as unknown[]) : [];
  return list.map(readLink).filter((link): link is SimulationLink => link !== null);
}

/** A card, read defensively: lists the server did not fill in become empty ones, never undefined. */
export function readCard(value: unknown): SimulationCard {
  const raw = asRecord(value);
  const progress = asRecord(raw.progress);
  const hasProgress = Object.keys(progress).length > 0;
  return {
    id: num(raw.id) ?? 0,
    slug: text(raw.slug) ?? '',
    title: text(raw.title) ?? 'Untitled simulation',
    subtitle: text(raw.subtitle),
    summary: text(raw.summary),
    category: text(raw.category),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [],
    audience: text(raw.audience),
    minutes: num(raw.minutes),
    difficulty: text(raw.difficulty),
    cover_url: text(raw.cover_url),
    status: raw.status === 'draft' || raw.status === 'archived' ? raw.status : 'published',
    version: num(raw.version) ?? 1,
    missions: num(raw.missions) ?? 0,
    updated_at: text(raw.updated_at),
    progress: hasProgress
      ? {
          status: progress.status === 'completed' ? 'completed' : 'in_progress',
          percent: Math.max(0, Math.min(100, Math.round(num(progress.percent) ?? 0))),
          step: Math.max(0, Math.round(num(progress.step) ?? 0)),
          completed_at: text(progress.completed_at),
          ...('snapshot' in progress ? { snapshot: progress.snapshot } : {}),
        }
      : null,
    links: readLinks(raw.links),
    editable: typeof raw.editable === 'boolean' ? raw.editable : undefined,
  };
}

/**
 * The list answer: either the cards alone or `{ simulations, can_manage }`. The backend names the list-level flag `can_manage` (true for platform-tenant
 * staff, also when the library is still EMPTY, which is when no card can carry `editable`); `editable` is read as a fallback spelling.
 */
export function readList(data: unknown): SimulationList {
  const record = asRecord(data);
  const rows = Array.isArray(data) ? data : Array.isArray(record.simulations) ? record.simulations : [];
  return {
    simulations: rows.map(readCard).filter((card) => card.id > 0),
    editable:
      typeof record.can_manage === 'boolean' ? record.can_manage : typeof record.editable === 'boolean' ? record.editable : undefined,
  };
}

export function readDetail(data: unknown): SimulationDetail {
  const raw = asRecord(data);
  return {
    ...readCard(data),
    spec: asRecord(raw.spec) as SimulationSpecPreview,
    assets: Array.isArray(raw.assets) ? (raw.assets as SimulationAssetCredit[]) : undefined,
  };
}

/* --------------------------------------------------------------------------------------------------------------- asset downloads */

/**
 * GET /{id}/assets/{sha256}: the file (a .glb model, a picture or an HDR sky) the simulation's current specification names, from the private
 * bucket. It is fetched here, with the learner's bearer token, and handed to the sandboxed frame as bytes: the frame never sees the token.
 *
 * At most 25 MB is read for a model, 8 MB for a sky and 3 MB for an image, checked against Content-Length and against what actually arrives.
 * Anything other than a 200 is an error (a SimulationApiError carrying the status, or a SimulationTooLargeError with `code: 'too_large'`).
 */
export async function fetchSimulationAssetFile(
  simulationId: number,
  sha256: string,
  { kind, signal }: { kind?: AssetKind; signal?: AbortSignal } = {},
): Promise<AssetFile> {
  if (!Number.isInteger(simulationId) || simulationId <= 0 || !SHA256_PATTERN.test(sha256)) {
    throw new Error('That is not a file of a simulation.');
  }
  const token = bearer();
  const response = await fetch(url(`/${simulationId}/assets/${sha256}`), {
    headers: { Accept: 'model/gltf-binary, image/*, application/json', Authorization: `Bearer ${token}` },
    signal,
  });

  if (!response.ok) throw await errorFrom(response);
  if (response.status !== 200) {
    void response.body?.cancel().catch(() => undefined);
    throw new SimulationApiError(`API Error: ${response.status} ${response.statusText}`, response.status);
  }

  const contentType = response.headers.get('Content-Type');
  const limit = assetByteLimit(kind, contentType);
  const declared = response.headers.get('Content-Length');
  if (declared !== null && declared.trim() !== '' && Number(declared) > limit) {
    void response.body?.cancel().catch(() => undefined);
    throw new SimulationTooLargeError(limit);
  }

  const bytes = await readCapped(response, limit);
  return { bytes, kind: resolveAssetKind(kind, contentType), mime: knownAssetMime(contentType) };
}

async function readCapped(response: Response, limit: number): Promise<ArrayBuffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    const whole = await response.arrayBuffer();
    if (whole.byteLength > limit) throw new SimulationTooLargeError(limit);
    return whole;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel().catch(() => undefined);
      throw new SimulationTooLargeError(limit);
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined.buffer;
}

/** The bytes alone of fetchSimulationAssetFile, for a caller that does not need to know what the file is. */
export async function fetchSimulationAsset(simulationId: number, sha256: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  return (await fetchSimulationAssetFile(simulationId, sha256, { signal })).bytes;
}

/* -------------------------------------------------------------------------------------------------------------------- uploading */

/** What POST /assets answers for a stored file. */
export interface UploadedAsset {
  /** SHA-256 of the stored bytes, which the server worked out itself. */
  sha256: string;
  kind: AssetKind;
  mime: string | null;
  bytes: number;
  /** False when the platform already held this file (an upload is idempotent per owner). */
  created: boolean;
}

/**
 * POST /assets (multipart `file`, `licence`, `credit`, and optionally `source`, `name`, `attested`): stores one 3D model, image or sky. What the
 * file is comes from its bytes on the server; the licence and credit are mandatory there. A failure is a SimulationApiError with the server's
 * message and reasons.
 */
export async function uploadSimulationAsset(file: File, meta: UploadMeta): Promise<UploadedAsset> {
  const token = bearer();
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('licence', meta.licence);
  form.append('credit', meta.credit);
  if (meta.source) form.append('source', meta.source);
  if (meta.name) form.append('name', meta.name);
  if (meta.attested) form.append('attested', '1');
  // No Content-Type: the browser writes the multipart boundary itself.
  const res = await fetch(url('/assets'), {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: form,
  });
  let raw: Record<string, unknown> = {};
  try {
    raw = asRecord(await res.json());
  } catch {
    /* fall through */
  }
  if (!res.ok || envelopeFailed(raw)) throw failure(res.status, raw);
  const inner = raw.data && typeof raw.data === 'object' ? asRecord(raw.data) : raw;
  const sha256 = inner.sha256;
  if (typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256)) throw new Error('The server did not say which file it stored. Try again.');
  return {
    sha256,
    kind: inner.kind === 'image' ? 'image' : inner.kind === 'hdr' ? 'hdr' : 'model',
    mime: typeof inner.mime === 'string' ? inner.mime : null,
    bytes: typeof inner.bytes === 'number' && Number.isFinite(inner.bytes) ? inner.bytes : file.size,
    created: inner.created !== false,
  };
}

/** GET /limits (platform staff): what a specification, a file and the platform's storage may hold, and how much is used. */
export async function fetchSimulationLimits(): Promise<SimulationLimits> {
  return readLimits(await request<unknown>('/limits', { method: 'GET' }));
}

/* ----------------------------------------------------------------------------------------------------------------------- the calls */

export const simulationService = {
  /** GET / - what this session may see, optionally narrowed (see buildSimulationQuery). A learner gets published simulations with published links. */
  list: async (filter: SimulationFilter = {}, signal?: AbortSignal): Promise<SimulationList> =>
    readList(await request<unknown>('', { method: 'GET', query: buildSimulationQuery(filter), signal })),

  /** GET /{id} - the card, the current specification, the credits and the links, for the player. Staff may ask for another `version`. */
  show: async (id: number, version?: number): Promise<SimulationDetail> =>
    readDetail(await request<unknown>(`/${id}`, { method: 'GET', query: version ? `?version=${Math.floor(version)}` : '' })),

  asset: fetchSimulationAsset,
  assetFile: fetchSimulationAssetFile,
  uploadAsset: uploadSimulationAsset,
  limits: fetchSimulationLimits,

  /** GET /{id}/versions - write. */
  versions: (id: number) => request<SimulationVersionsData>(`/${id}/versions`, { method: 'GET' }),

  /** POST / - write. The owner is the session's tenant. */
  create: async (input: CreateSimulationInput): Promise<SimulationCard> => readCard(await request<unknown>('', { method: 'POST', body: input })),

  /** PUT /{id} - write. */
  update: async (id: number, input: UpdateSimulationInput): Promise<SimulationCard> =>
    readCard(await request<unknown>(`/${id}`, { method: 'PUT', body: input })),

  /** DELETE /{id} - write. Removes it from every list; `restore` undoes it. */
  remove: (id: number) => request<{ id: number; deleted: boolean }>(`/${id}`, { method: 'DELETE' }),

  /** POST /{id}/restore - write. */
  restore: async (id: number): Promise<SimulationCard> => readCard(await request<unknown>(`/${id}/restore`, { method: 'POST', body: {} })),

  /** POST /{id}/progress - any signed-in role. Only ever about the caller. */
  progress: (id: number, report: SimulationProgressReport) =>
    request<Pick<SimulationProgress, 'status' | 'percent' | 'step' | 'completed_at'>>(`/${id}/progress`, { method: 'POST', body: report }),

  /** GET /{id}/links - any signed-in role (a learner receives published links only). */
  links: async (id: number): Promise<SimulationLink[]> => readLinks(await request<unknown>(`/${id}/links`, { method: 'GET' })),

  /** PUT /{id}/links - write. Replaces the whole set; the server derives chapter, topic, standard and subject from each concept. */
  putLinks: async (id: number, links: LinkPayloadItem[]): Promise<SimulationLink[]> =>
    readLinks(await request<unknown>(`/${id}/links`, { method: 'PUT', body: { links } })),

  /** POST /{id}/links/{linkId}/review - write. Publishes a link, or takes it back to review. */
  reviewLink: (id: number, linkId: number, status: LinkReviewStatus) =>
    request<unknown>(`/${id}/links/${linkId}/review`, { method: 'POST', body: { status } }),

  /** GET /concepts?chapter_id=&q= - write. The picker of the link editor, restricted to a chapter. */
  concepts: async (chapterId: number, q?: string, signal?: AbortSignal): Promise<SimulationConceptOption[]> => {
    const query = buildConceptQuery(chapterId, q);
    if (query === null) return [];
    const data = await request<unknown>('/concepts', { method: 'GET', query, signal });
    const rows = Array.isArray(data) ? data : Array.isArray(asRecord(data).concepts) ? (asRecord(data).concepts as unknown[]) : [];
    return rows
      .map((row): SimulationConceptOption | null => {
        const raw = asRecord(row);
        const id = num(raw.id);
        return id === null
          ? null
          : { id, name: text(raw.name) ?? `Concept ${id}`, topic_id: num(raw.topic_id), topic_name: text(raw.topic_name), chapter_id: num(raw.chapter_id), review_status: text(raw.review_status) };
      })
      .filter((row): row is SimulationConceptOption => row !== null);
  },
};
