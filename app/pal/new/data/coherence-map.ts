import { buildSessionContext, readNumber, readString } from '@/lib/erp-client';

/**
 * New PAL → Coherence Map — data layer.
 *
 * Mirrors the Laravel routes under `/api/pal/coherence/*`
 * (App\Http\Controllers\api\PAL\CoherenceMapController → CoherenceMapRepository),
 * same `{ success, data }` envelope and same `pal.auth` JWT as the rest of PAL.
 *
 * WHAT THE MAP IS. Concepts are nodes; `REQUIRES` edges are the prerequisite
 * spine. The server reads them out of Neo4j, derives each concept's prerequisite
 * depth, detects the cycles, and returns the whole scope in one call — so this
 * file maps a payload and never computes structure of its own.
 *
 * DIRECTION, stated once. Neo4j stores `(later)-[:REQUIRES]->(earlier)`: the
 * arrow points backwards in time, at the prerequisite. The API flips it before
 * sending, so `edge.source` is ALWAYS the earlier concept and `edge.target` the
 * one that depends on it. Draw source → target and it reads in teaching order.
 *
 * READ THE COUNTS BEFORE TRUSTING THE PICTURE. `stats.acyclic` is false on the
 * live data and every edge is `tagged_by: 'ai'` / `status: 'draft'` — nothing in
 * this map has been reviewed by curriculum staff yet, and the UI is expected to
 * say so rather than present suggestions as fact.
 */

// --- helpers ---------------------------------------------------------------

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function readNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function readIdList(value: unknown): number[] {
  return toArray(value)
    .map((item) => readNullableNumber(item))
    .filter((n): n is number => n !== null);
}

async function callApi(
  path: string,
  init: { signal?: AbortSignal } = {}
): Promise<unknown> {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  if (!session.token) throw new Error('Your session has expired. Please sign in again.');

  const response = await fetch(`${session.baseUrl}/${path.replace(/^\//, '')}`, {
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      Authorization: `Bearer ${session.token}`,
    },
    signal: init.signal,
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const serverMessage = readString(toRecord(payload).message);

    if (response.status === 401) {
      throw new Error(serverMessage || 'Your session has expired. Please sign in again.');
    }
    if (response.status === 403) {
      throw new Error(serverMessage || 'You are not allowed to open this coherence map.');
    }
    if (response.status === 404) {
      // The server's own message names the artisan command that fixes it, so it
      // is far more useful than anything invented here.
      throw new Error(
        serverMessage ||
          'No coherence map is projected for this class and subject yet.'
      );
    }
    if (response.status === 422) {
      throw new Error(serverMessage || 'The server rejected that scope.');
    }
    throw new Error(
      serverMessage ||
        `HTTP ${response.status}: the Coherence Map API is unavailable. It ships with the PAL coherence module — the backend may not be deployed yet.`
    );
  }

  const record = toRecord(payload);
  if (record.success === false) {
    throw new Error(readString(record.message) || 'Coherence Map request failed.');
  }
  return 'data' in record ? record.data : payload;
}

// --- types -----------------------------------------------------------------

/** A (standard, subject) pair that actually has a projected map. */
export interface CoherenceScope {
  subInstituteId: number;
  standardId: number;
  subjectId: number;
  standardName: string;
  subjectName: string;
  concepts: number;
  requires: number;
}

export type LearnerState = 'mastered' | 'ready' | 'blocked';

export interface CoherenceNode {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  chapterId: number | null;
  chapter: string | null;
  chapterOrder: number | null;
  bloom: string | null;
  priority: number | null;
  /** The p_mastery threshold this concept is judged against. */
  gate: number;
  minutes: number | null;
  status: string;
  /** Longest prerequisite chain beneath it — the layout's vertical axis. */
  depth: number;
  prereqIds: number[];
  unlocksIds: number[];
  contentCount: number;
  questionCount: number;
  /** True when the concept sits on a REQUIRES cycle and can never become ready. */
  onCycle: boolean;
  /** null when no learner overlay was requested, as opposed to "no evidence". */
  mastery: number | null;
  attempts: number | null;
  band: string | null;
}

export interface CoherenceEdge {
  /** ALWAYS the earlier concept. See the direction note in the file header. */
  source: number;
  target: number;
  kind: 'REQUIRES' | 'CROSS_LINKS';
  linkType: string | null;
  gate: number | null;
  status: string;
  taggedBy: string;
}

export interface CoherenceChapter {
  id: number;
  /** null when the concept rows carry a chapter_id whose :Chapter node is absent. */
  name: string | null;
  order: number | null;
  concepts: number;
}

export interface CoherenceStats {
  concepts: number;
  requires: number;
  crossLinks: number;
  chapters: number;
  /** Concepts with no prerequisite — where a learner can start. */
  roots: number;
  /** Concepts with no link in either direction. */
  isolated: number;
  maxDepth: number;
  acyclic: boolean;
  draftEdges: number;
  withContent: number;
  withQuestions: number;
}

export interface CoherenceMap {
  available: boolean;
  nodes: CoherenceNode[];
  edges: CoherenceEdge[];
  chapters: CoherenceChapter[];
  stats: CoherenceStats;
}

export interface CoherenceHealth {
  concepts: number;
  roots: number;
  withoutContent: number;
  withoutQuestions: number;
  acyclic: boolean;
  cycles: { id: number; name: string }[];
  edges: number;
  isolated: number;
  maxDepth: number;
  draftEdges: number;
  fitToUse: boolean;
}

/** Per-concept readiness for one learner, keyed by concept id. */
export type ReadinessMap = Record<
  number,
  { state: LearnerState; unmet: number[]; unlocks: number; mastery: number; gate: number }
>;

export interface NextAction {
  action: string;
  concept: { id: number; name: string; code: string | null; chapter: string | null } | null;
  rule: string;
  because: string;
}

// --- mappers ---------------------------------------------------------------

function mapNode(raw: unknown): CoherenceNode {
  const r = toRecord(raw);
  return {
    id: readNumber(r.id),
    name: readString(r.name),
    code: readNullableString(r.code),
    description: readNullableString(r.description),
    chapterId: readNullableNumber(r.chapter_id),
    chapter: readNullableString(r.chapter),
    chapterOrder: readNullableNumber(r.chapter_order),
    bloom: readNullableString(r.bloom),
    priority: readNullableNumber(r.priority),
    gate: readNullableNumber(r.gate) ?? 0.7,
    minutes: readNullableNumber(r.minutes),
    status: readString(r.status) || 'draft',
    depth: readNumber(r.depth),
    prereqIds: readIdList(r.prereq_ids),
    unlocksIds: readIdList(r.unlocks_ids),
    contentCount: readNumber(r.content_n),
    questionCount: readNumber(r.question_n),
    onCycle: readBoolean(r.on_cycle),
    mastery: readNullableNumber(r.mastery),
    attempts: readNullableNumber(r.attempts),
    band: readNullableString(r.band),
  };
}

function mapEdge(raw: unknown): CoherenceEdge {
  const r = toRecord(raw);
  return {
    source: readNumber(r.source),
    target: readNumber(r.target),
    kind: readString(r.kind) === 'CROSS_LINKS' ? 'CROSS_LINKS' : 'REQUIRES',
    linkType: readNullableString(r.link_type),
    gate: readNullableNumber(r.gate),
    status: readString(r.status) || 'draft',
    taggedBy: readString(r.tagged_by) || 'human',
  };
}

function mapStats(raw: unknown): CoherenceStats {
  const r = toRecord(raw);
  return {
    concepts: readNumber(r.concepts),
    requires: readNumber(r.requires),
    crossLinks: readNumber(r.cross_links),
    chapters: readNumber(r.chapters),
    roots: readNumber(r.roots),
    isolated: readNumber(r.isolated),
    maxDepth: readNumber(r.max_depth),
    acyclic: readBoolean(r.acyclic),
    draftEdges: readNumber(r.draft_edges),
    withContent: readNumber(r.with_content),
    withQuestions: readNumber(r.with_questions),
  };
}

function mapMap(raw: unknown): CoherenceMap {
  const r = toRecord(raw);
  return {
    available: readBoolean(r.available),
    nodes: toArray(r.nodes).map(mapNode),
    edges: toArray(r.edges).map(mapEdge),
    chapters: toArray(r.chapters).map((entry) => {
      const c = toRecord(entry);
      return {
        id: readNumber(c.id),
        name: readNullableString(c.name),
        order: readNullableNumber(c.order),
        concepts: readNumber(c.concepts),
      };
    }),
    stats: mapStats(r.stats),
  };
}

function mapReadiness(raw: unknown): ReadinessMap {
  const out: ReadinessMap = {};
  Object.entries(toRecord(raw)).forEach(([key, value]) => {
    const id = Number(key);
    if (!Number.isFinite(id)) return;
    const r = toRecord(value);
    const state = readString(r.state);
    out[id] = {
      state: state === 'mastered' || state === 'ready' ? state : 'blocked',
      unmet: readIdList(r.unmet),
      unlocks: readNumber(r.unlocks),
      mastery: readNullableNumber(r.mastery) ?? 0,
      gate: readNullableNumber(r.gate) ?? 0.7,
    };
  });
  return out;
}

// --- calls -----------------------------------------------------------------

/** The (standard, subject) pairs this caller may open, richest first. */
export async function fetchCoherenceScopes(signal?: AbortSignal): Promise<CoherenceScope[]> {
  const data = toRecord(await callApi('api/pal/coherence/scopes', { signal }));

  return toArray(data.scopes).map((entry) => {
    const r = toRecord(entry);
    return {
      subInstituteId: readNumber(r.sub_institute_id),
      standardId: readNumber(r.standard_id),
      subjectId: readNumber(r.subject_id),
      standardName: readString(r.standard_name),
      subjectName: readString(r.subject_name),
      concepts: readNumber(r.concepts),
      requires: readNumber(r.requires),
    };
  });
}

/**
 * The map for one scope, optionally overlaid with one learner's mastery.
 *
 * Passing `learnerId` changes the payload rather than adding to it: every node
 * gains `mastery`/`attempts`, which are null otherwise.
 */
export async function fetchCoherenceMap(
  input: { standardId: number; subjectId: number; learnerId?: number | null },
  signal?: AbortSignal
): Promise<CoherenceMap> {
  const query = new URLSearchParams({
    standard_id: String(input.standardId),
    subject_id: String(input.subjectId),
  });
  if (input.learnerId) query.set('learner_id', String(input.learnerId));

  return mapMap(await callApi(`api/pal/coherence/map?${query.toString()}`, { signal }));
}

/** The structural gate — is this map fit to recommend from. */
export async function fetchCoherenceHealth(
  input: { standardId: number; subjectId: number },
  signal?: AbortSignal
): Promise<CoherenceHealth> {
  const query = new URLSearchParams({
    standard_id: String(input.standardId),
    subject_id: String(input.subjectId),
  });

  const r = toRecord(await callApi(`api/pal/coherence/health?${query.toString()}`, { signal }));

  return {
    concepts: readNumber(r.concepts),
    roots: readNumber(r.roots),
    withoutContent: readNumber(r.without_content),
    withoutQuestions: readNumber(r.without_questions),
    acyclic: readBoolean(r.acyclic),
    cycles: toArray(r.cycles).map((entry) => {
      const c = toRecord(entry);
      return { id: readNumber(c.id), name: readString(c.name) };
    }),
    edges: readNumber(r.edges),
    isolated: readNumber(r.isolated),
    maxDepth: readNumber(r.max_depth),
    draftEdges: readNumber(r.draft_edges),
    fitToUse: readBoolean(r.fit_to_use),
  };
}

/**
 * One learner's view: the same map plus per-concept mastered/ready/blocked.
 *
 * The learner endpoint resolves the class from the learner's own enrolment, so
 * it does not take a standard — pass the subject to choose between the subjects
 * that class studies.
 */
export async function fetchLearnerReadiness(
  learnerId: number,
  subjectId: number,
  signal?: AbortSignal
): Promise<{ readiness: ReadinessMap; nodes: CoherenceNode[] }> {
  const query = new URLSearchParams({ subject_id: String(subjectId) });
  const r = toRecord(
    await callApi(`api/pal/coherence/learner/${learnerId}?${query.toString()}`, { signal })
  );

  // The learner endpoint merges state onto each node, so readiness is rebuilt
  // from the nodes rather than requested twice.
  const nodes = toArray(r.nodes).map(mapNode);
  const readiness: ReadinessMap = {};

  toArray(r.nodes).forEach((entry) => {
    const n = toRecord(entry);
    const id = readNumber(n.id);
    const state = readString(n.state);
    readiness[id] = {
      state: state === 'mastered' || state === 'ready' ? state : 'blocked',
      unmet: readIdList(n.unmet),
      unlocks: readNumber(n.unlocks),
      mastery: readNullableNumber(n.mastery) ?? 0,
      gate: readNullableNumber(n.gate) ?? 0.7,
    };
  });

  return { readiness, nodes };
}

/** The next best action for one learner, with the rule that produced it. */
export async function fetchNextAction(
  learnerId: number,
  subjectId: number,
  signal?: AbortSignal
): Promise<NextAction> {
  const query = new URLSearchParams({ subject_id: String(subjectId) });
  const r = toRecord(await callApi(`api/pal/coherence/next/${learnerId}?${query.toString()}`, { signal }));
  const why = toRecord(r.why);
  const concept = r.concept ? toRecord(r.concept) : null;

  return {
    action: readString(r.action),
    concept: concept
      ? {
          id: readNumber(concept.id),
          name: readString(concept.name),
          code: readNullableString(concept.code),
          chapter: readNullableString(concept.chapter),
        }
      : null,
    rule: readString(why.rule),
    because: readString(why.because),
  };
}

// --- presentation helpers --------------------------------------------------

/**
 * A chapter can arrive as an id with no name: the concept rows carry
 * `chapter_id` but the matching `:Chapter` node was never loaded. That is real
 * for chapter 8560 on the live data (the legacy concepts 4-11), and it has to
 * read as a data gap rather than as a blank column.
 */
export function chapterLabel(chapter: { id: number; name: string | null; order: number | null }): string {
  if (!chapter.name) return `Chapter ${chapter.id} — no chapter node`;
  return chapter.order !== null ? `${chapter.order}. ${chapter.name}` : chapter.name;
}

export function stateLabel(state: LearnerState): string {
  if (state === 'mastered') return 'Mastered';
  if (state === 'ready') return 'Ready now';
  return 'Blocked';
}
