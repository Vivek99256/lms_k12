import { buildSessionContext, readString } from '@/lib/erp-client';

/**
 * Adaptive Learning Engine (Learning ESO) data layer.
 *
 * Mirrors the new Laravel engine (routes/pal_eso_api.php ->
 * App\Http\Controllers\api\PAL\EsoEngineController), which implements the
 * Scholar Adaptive Learning Engine Developer Brief v1's D1-D5 policy on top
 * of the existing PAL V4 `pal.auth` JWT auth (same envelope/auth pattern as
 * pal-v4.ts's fetchV4Data/fetchV4Mutation — this file follows it exactly so
 * error handling and session resolution stay consistent app-wide).
 *
 * The engine decides WHAT/WHETHER to teach; this layer only transports that
 * decision. Nothing here interprets or overrides `action`/`llm_instruction` —
 * the concept-flow screen renders whatever the engine returned.
 */

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function esoFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const session = buildSessionContext();
  if (!session.baseUrl) {
    throw new Error('Session data is missing. Please sign in again.');
  }
  if (!session.token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const response = await fetch(`${session.baseUrl}/${path.replace(/^\//, '')}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      Authorization: `Bearer ${session.token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  const record = toRecord(payload);

  if (!response.ok) {
    const serverMessage = readString(record.message);
    if (response.status === 401) {
      throw new Error(serverMessage || 'Your session has expired. Please sign in again.');
    }
    if (response.status === 403) {
      throw new Error(serverMessage || 'You are not allowed to view this learner\'s data.');
    }
    if (response.status === 422) {
      throw new Error(serverMessage || 'That request was rejected — check the required fields.');
    }
    throw new Error(serverMessage || `HTTP ${response.status}: the Adaptive Learning Engine API is unavailable.`);
  }

  if (record.success === false) {
    throw new Error(readString(record.message) || 'Adaptive Learning Engine request failed.');
  }

  return 'data' in record ? record.data : payload;
}

function esoGet(path: string, signal?: AbortSignal): Promise<unknown> {
  return esoFetch(path, { method: 'GET', signal });
}

function esoPost(path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
  return esoFetch(path, { method: 'POST', body: JSON.stringify(body), signal });
}

export function defaultLearnerId(): string {
  return buildSessionContext().userId;
}

// ── shared types ─────────────────────────────────────────────────────────

export type NodeType = 'K' | 'A' | 'S';

export interface QuestionOption {
  id: number;
  answer: string;
}

/** A question the student can answer — never carries the answer key or any misconception mapping. */
export interface EsoQuestion {
  questionId: number;
  title: string;
  options: QuestionOption[];
}

export interface DiagnosticItem extends EsoQuestion {
  nodeId: number;
  nodeType: NodeType;
  itemType: string | null;
}

export interface PracticeItem extends EsoQuestion {
  nodeId: number;
}

export interface DiagnosticNodeResult {
  nodeId: number;
  masteryEstimate: number;
  skip: boolean;
}

/** The one shape every /next-action, /attempt and /retrieval/check call returns. */
export interface EsoAction {
  action: string;
  conceptId?: number | null;
  nodeId?: number | null;
  prerequisiteConceptId?: number | null;
  misconceptionId?: number | null;
  contrastPair?: {
    correctiveId: number;
    title: string | null;
    body: string | null;
    mediaUrl: string | null;
    format: string | null;
  } | null;
  mastered?: boolean;
  knowledgeMastery?: number | null;
  applicationMastery?: number | null;
  practiceMode?: 'guided' | 'independent';
  status?: string;
  ruleFired: string;
  llmInstruction: string | null;
}

export interface DecisionLogEntry {
  id: number;
  nodeId: number | null;
  ruleFired: string;
  action: string;
  llmInstruction: string | null;
  stateSnapshot: Record<string, unknown> | null;
  createdAt: string;
}

// ── mappers ──────────────────────────────────────────────────────────────

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapAction(raw: unknown): EsoAction {
  const r = toRecord(raw);
  const contrast = toRecord(r.contrast_pair);
  return {
    action: readString(r.action),
    conceptId: numOrNull(r.concept_id),
    nodeId: numOrNull(r.node_id),
    prerequisiteConceptId: numOrNull(r.prerequisite_concept_id),
    misconceptionId: numOrNull(r.misconception_id),
    contrastPair:
      r.contrast_pair == null
        ? null
        : {
            correctiveId: num(contrast.corrective_id),
            title: contrast.title == null ? null : readString(contrast.title),
            body: contrast.body == null ? null : readString(contrast.body),
            mediaUrl: contrast.media_url == null ? null : readString(contrast.media_url),
            format: contrast.format == null ? null : readString(contrast.format),
          },
    mastered: typeof r.mastered === 'boolean' ? r.mastered : undefined,
    knowledgeMastery: numOrNull(r.knowledge_mastery),
    applicationMastery: numOrNull(r.application_mastery),
    practiceMode: r.practice_mode === 'independent' ? 'independent' : r.practice_mode === 'guided' ? 'guided' : undefined,
    status: r.status == null ? undefined : readString(r.status),
    ruleFired: readString(r.rule_fired),
    llmInstruction: r.llm_instruction == null ? null : readString(r.llm_instruction),
  };
}

// ── D1: diagnostic ───────────────────────────────────────────────────────

function mapQuestion(raw: unknown): EsoQuestion {
  const r = toRecord(raw);
  const options = Array.isArray(r.options) ? r.options : [];
  return {
    questionId: num(r.question_id),
    title: readString(r.title),
    options: options.map((o) => {
      const opt = toRecord(o);
      return { id: num(opt.id), answer: readString(opt.answer) };
    }),
  };
}

export async function fetchDiagnosticItems(learnerId: string, conceptId: number, signal?: AbortSignal): Promise<DiagnosticItem[]> {
  const data = toRecord(await esoGet(`api/pal/eso/diagnostic/${learnerId}/${conceptId}`, signal));
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((item) => {
    const r = toRecord(item);
    return {
      ...mapQuestion(item),
      nodeId: num(r.node_id),
      nodeType: (readString(r.node_type) || 'K') as NodeType,
      itemType: r.item_type == null ? null : readString(r.item_type),
    };
  });
}

/**
 * Correctness is always resolved server-side from the answerMasterId the
 * student picked — never send a "correct" flag, the API does not accept one.
 */
export async function submitDiagnostic(
  learnerId: string,
  conceptId: number,
  responses: Array<{ nodeId: number; answerMasterId: number }>,
  signal?: AbortSignal
): Promise<DiagnosticNodeResult[]> {
  const data = toRecord(
    await esoPost(
      `api/pal/eso/diagnostic/${learnerId}/${conceptId}/submit`,
      { responses: responses.map((r) => ({ node_id: r.nodeId, answer_master_id: r.answerMasterId })) },
      signal
    )
  );
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  return nodes.map((item) => {
    const r = toRecord(item);
    return { nodeId: num(r.node_id), masteryEstimate: num(r.mastery_estimate), skip: Boolean(r.skip) };
  });
}

// ── the resolver ─────────────────────────────────────────────────────────

export async function fetchNextAction(learnerId: string, conceptId: number, signal?: AbortSignal): Promise<EsoAction> {
  return mapAction(await esoGet(`api/pal/eso/next-action/${learnerId}/${conceptId}`, signal));
}

// ── D3/D4: practice attempts ─────────────────────────────────────────────

export async function fetchPracticeItem(learnerId: string, nodeId: number, signal?: AbortSignal): Promise<PracticeItem | null> {
  try {
    const data = toRecord(await esoGet(`api/pal/eso/practice-item/${learnerId}/${nodeId}`, signal));
    return { ...mapQuestion(data), nodeId };
  } catch {
    return null; // 404 = no tagged item for this node yet — a real, expected state pre-Phase-0-tagging.
  }
}

export interface RecordAttemptInput {
  conceptId: number;
  /** The option the student picked. Correctness is resolved server-side from this — the API has no "correct" field. */
  answerMasterId: number;
  hintUsed?: boolean;
  mode?: 'guided' | 'independent';
}

export async function recordAttempt(
  learnerId: string,
  nodeId: number,
  input: RecordAttemptInput,
  signal?: AbortSignal
): Promise<EsoAction> {
  return mapAction(
    await esoPost(
      `api/pal/eso/practice/${learnerId}/${nodeId}/attempt`,
      {
        concept_id: input.conceptId,
        answer_master_id: input.answerMasterId,
        hint_used: input.hintUsed ?? false,
        mode: input.mode,
      },
      signal
    )
  );
}

// ── D5: delayed retrieval ────────────────────────────────────────────────

export async function fetchDueForRetrieval(learnerId: string, signal?: AbortSignal): Promise<Array<{ nodeId: number; nextReviewAt: string | null }>> {
  const data = await esoGet(`api/pal/eso/due-for-retrieval/${learnerId}`, signal);
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => {
    const r = toRecord(row);
    return { nodeId: num(r.node_id), nextReviewAt: r.next_review_at == null ? null : readString(r.next_review_at) };
  });
}

export async function fetchRetrievalItems(learnerId: string, nodeId: number, signal?: AbortSignal): Promise<EsoQuestion[]> {
  const data = await esoGet(`api/pal/eso/retrieval-items/${learnerId}/${nodeId}`, signal);
  const rows = Array.isArray(data) ? data : [];
  return rows.map(mapQuestion);
}

export async function submitRetrievalCheck(
  learnerId: string,
  nodeId: number,
  conceptId: number,
  responses: Array<{ answerMasterId: number }>,
  signal?: AbortSignal
): Promise<EsoAction> {
  return mapAction(
    await esoPost(
      `api/pal/eso/retrieval/${learnerId}/${nodeId}/check`,
      { concept_id: conceptId, responses: responses.map((r) => ({ answer_master_id: r.answerMasterId })) },
      signal
    )
  );
}

// ── decision log (the readable audit trace) ─────────────────────────────

export async function fetchDecisionLog(learnerId: string, conceptId: number, signal?: AbortSignal): Promise<DecisionLogEntry[]> {
  const data = await esoGet(`api/pal/eso/decision-log/${learnerId}/${conceptId}`, signal);
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => {
    const r = toRecord(row);
    return {
      id: num(r.id),
      nodeId: numOrNull(r.node_id),
      ruleFired: readString(r.rule_fired),
      action: readString(r.action),
      llmInstruction: r.llm_instruction == null ? null : readString(r.llm_instruction),
      stateSnapshot: r.state_snapshot && typeof r.state_snapshot === 'object' ? (r.state_snapshot as Record<string, unknown>) : null,
      createdAt: readString(r.created_at),
    };
  });
}

// ── Pal rendering (the only LLM call in this feature) ───────────────────

export async function renderInstruction(
  learnerId: string,
  instruction: string,
  context?: Record<string, unknown>,
  signal?: AbortSignal
): Promise<{ rendered: string | null; fallbackText: string | null }> {
  const data = toRecord(await esoPost('api/pal/eso/render', { learner_id: learnerId, instruction, context }, signal));
  return {
    rendered: data.rendered == null ? null : readString(data.rendered),
    fallbackText: data.fallback_text == null ? null : readString(data.fallback_text),
  };
}

// ── Chapter → concept navigation (the student entry point) ──────────────

export interface EsoChapterConcept {
  id: number;
  name: string;
}

/**
 * Concepts in a chapter that are actually ESO-ready (have K/A/S nodes) —
 * empty for every chapter Phase 0 tagging hasn't reached yet, so callers can
 * hide the "Start Adaptive Learning" entry point entirely rather than link
 * to a dead end.
 */
export async function fetchChapterConcepts(chapterId: number, signal?: AbortSignal): Promise<EsoChapterConcept[]> {
  const data = toRecord(await esoGet(`api/pal/eso/chapter-concepts/${chapterId}`, signal));
  const rows = Array.isArray(data.concepts) ? data.concepts : [];
  return rows.map((row) => {
    const r = toRecord(row);
    return { id: num(r.id), name: readString(r.name) };
  });
}
