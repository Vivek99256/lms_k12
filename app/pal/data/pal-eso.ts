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
  /** D3 only: the misconception's own description, for showing what was detected. */
  misconceptionDescription?: string | null;
  /**
   * D3 only: what the student can check the misconception call against — the
   * answer they actually chose, and how many times this same misconception has
   * been flagged on this node before now.
   */
  evidence?: {
    chosenAnswer: string | null;
    previousOccurrences: number;
  } | null;
  /**
   * D4 only, and only on the FIRST practice call for a node: the "why is this
   * worth practising" nudge. Null whenever there is nothing honest to say.
   */
  motivationInstruction?: string | null;
  /** Student-facing wording of the same nudge, shown when Pal can't render. */
  motivationFallback?: string | null;
  /** D2 staleness probe only: the prerequisite item to answer, and how old the evidence was. */
  item?: EsoQuestion | null;
  /** D2 probe and D5 retrieval: how long since this node last had evidence. */
  daysSinceLastEvidence?: number | null;
  /**
   * D5 only: the student-facing wording of the retention recap, shown when Pal
   * can't render `llmInstruction`. Null when the concept has no approved
   * material to build a recap from — no recap is ever invented.
   */
  recapFallback?: string | null;
  /** D5 only: which rung of the retention ladder this node is on. */
  retentionStage?: number | null;
  /**
   * D4 mastery only. Exploratory content for a concept just mastered, from the
   * existing PAL suggested-content pipeline. Display-only — skipping it has no
   * effect on mastery, retention or evidence. Empty when nothing is authored.
   */
  enrichment?: Array<{
    title: string;
    description: string | null;
    url: string | null;
    contentType: string | null;
    category: string;
  }>;
  /**
   * D4 mastery only. The next concept in this chapter the student may actually
   * start — never one whose prerequisites are unmet. Null when none remains.
   */
  nextConcept?: { conceptId: number; name: string | null } | null;
  /** D4 mastery only: nothing unmastered and unlocked is left in the chapter. */
  chapterComplete?: boolean;
  /**
   * What this screen asks of the student, so teach can stop pretending to be
   * practice attempt #1:
   *   'acknowledge'         — read the explanation, then ask to be checked (teach)
   *   'check_understanding' — answer the CFU questions (check_understanding | reteach)
   *   'answer'              — answer one scored practice question (practice)
   */
  expects?: 'acknowledge' | 'check_understanding' | 'answer' | null;
  /**
   * The concept's learning object from the PAL content model, when one
   * genuinely exists. `mediaUrl` is only ever non-null for an AUTHORED asset —
   * a `derived` variant is an authoring specification whose format describes
   * what should be built, so it carries rich text and no media.
   */
  learningContent?: {
    variant: number;
    format: string;
    formatLabel: string;
    h5pType: string | null;
    title: string | null;
    body: string | null;
    mediaUrl: string | null;
    source: 'authored' | 'derived';
  } | null;
  /** CFU only: how many questions the gate will serve. */
  cfuItemCount?: number | null;
  /** CFU only: how many check cycles this node has already failed. */
  cfuAttempts?: number | null;
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
    misconceptionDescription: r.misconception_description == null ? null : readString(r.misconception_description),
    evidence:
      r.evidence == null
        ? null
        : {
            chosenAnswer: toRecord(r.evidence).chosen_answer == null ? null : readString(toRecord(r.evidence).chosen_answer),
            previousOccurrences: num(toRecord(r.evidence).previous_occurrences),
          },
    motivationInstruction: r.motivation_instruction == null ? null : readString(r.motivation_instruction),
    motivationFallback: r.motivation_fallback == null ? null : readString(r.motivation_fallback),
    item: r.item == null ? null : mapQuestion(r.item),
    daysSinceLastEvidence: numOrNull(r.days_since_last_evidence),
    recapFallback: r.recap_fallback == null ? null : readString(r.recap_fallback),
    retentionStage: numOrNull(r.retention_stage),
    enrichment: (Array.isArray(r.enrichment) ? r.enrichment : []).map((raw) => {
      const e = toRecord(raw);
      return {
        title: readString(e.title),
        description: e.description == null ? null : readString(e.description),
        url: e.url == null ? null : readString(e.url),
        contentType: e.content_type == null ? null : readString(e.content_type),
        category: readString(e.category),
      };
    }),
    nextConcept:
      r.next_concept == null
        ? null
        : {
            conceptId: num(toRecord(r.next_concept).concept_id),
            name: toRecord(r.next_concept).name == null ? null : readString(toRecord(r.next_concept).name),
          },
    chapterComplete: r.chapter_complete === true,
    expects:
      r.expects === 'acknowledge' || r.expects === 'check_understanding' || r.expects === 'answer'
        ? r.expects
        : null,
    learningContent: (() => {
      if (r.learning_content == null) return null;
      const c = toRecord(r.learning_content);
      return {
        variant: num(c.variant),
        format: readString(c.format),
        formatLabel: readString(c.format_label),
        h5pType: c.h5p_type == null ? null : readString(c.h5p_type),
        title: c.title == null ? null : readString(c.title),
        body: c.body == null ? null : readString(c.body),
        mediaUrl: c.media_url == null ? null : readString(c.media_url),
        source: c.source === 'authored' ? ('authored' as const) : ('derived' as const),
      };
    })(),
    cfuItemCount: numOrNull(r.cfu_item_count),
    cfuAttempts: numOrNull(r.cfu_attempts),
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

// ── CFU: the check between teaching and practice ─────────────────────────

/**
 * The questions for a node's check of understanding. These are graded, but
 * they are NOT mastery evidence — the engine records them with mode='cfu' and
 * never applies a mastery update for them.
 */
export async function fetchCheckUnderstandingItems(
  learnerId: string,
  nodeId: number,
  signal?: AbortSignal
): Promise<EsoQuestion[]> {
  try {
    const data = await esoGet(`api/pal/eso/cfu-items/${learnerId}/${nodeId}`, signal);
    const rows = Array.isArray(data) ? data : [];
    return rows.map(mapQuestion);
  } catch {
    return []; // 404 = no tagged item for this node yet, same expected state as practice.
  }
}

export async function submitCheckUnderstanding(
  learnerId: string,
  nodeId: number,
  conceptId: number,
  responses: Array<{ answerMasterId: number }>,
  signal?: AbortSignal
): Promise<EsoAction> {
  return mapAction(
    await esoPost(
      `api/pal/eso/cfu/${learnerId}/${nodeId}/check`,
      { concept_id: conceptId, responses: responses.map((r) => ({ answer_master_id: r.answerMasterId })) },
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

// ── Chapter dashboard — the "where am I" screen before a concept ────────

export type ChapterSectionStatus = 'locked' | 'not_started' | 'in_progress' | 'mastered';

export interface ChapterSection {
  conceptId: number;
  name: string;
  status: ChapterSectionStatus;
  knowledgeMastery: number | null;
  applicationMastery: number | null;
}

export interface MasterySignal {
  key: string;
  label: string;
  description: string;
  /** 0-1, or null when there isn't enough recorded evidence yet. */
  value: number | null;
  hasEvidence: boolean;
  /** Raw response count behind this signal, regardless of whether it clears the evidence threshold. */
  responseCount: number;
}

export interface ChapterNextStep {
  action: string;
  title: string;
  subtitle: string;
  reasons: string[];
  ctaLabel: string | null;
  ruleFired: string;
  hasEvidence: boolean;
}

export interface ChapterDashboard {
  chapterId: number;
  chapterName: string;
  subjectId: number;
  subjectName: string | null;
  chapterComplete: boolean;
  currentConceptId: number | null;
  currentConceptName: string | null;
  masteredConcepts: number;
  totalConceptsInCurriculum: number;
  responsesOnCurrentConcept: number;
  allResponses: number;
  nextStep: ChapterNextStep | null;
  chapterSections: ChapterSection[];
  masterySignals: MasterySignal[];
  /** Streak + badge headline from the existing PAL gamification tables. */
  gamification: {
    streakCurrent: number;
    streakHeadline: string | null;
    badgesEarned: number;
    recentBadge: { name: string; awardedAt: string | null } | null;
  };
  /** How many nodes have a spaced review due right now, across all concepts. */
  reviewsDue: number;
  /** True once the current concept is cleared and enrichment is on offer. */
  enrichmentAvailable: boolean;
}

function mapChapterSection(raw: unknown): ChapterSection {
  const r = toRecord(raw);
  const status = readString(r.status);
  return {
    conceptId: num(r.concept_id),
    name: readString(r.name),
    status: status === 'locked' || status === 'in_progress' || status === 'mastered' ? status : 'not_started',
    knowledgeMastery: numOrNull(r.knowledge_mastery),
    applicationMastery: numOrNull(r.application_mastery),
  };
}

function mapMasterySignal(raw: unknown): MasterySignal {
  const r = toRecord(raw);
  return {
    key: readString(r.key),
    label: readString(r.label),
    description: readString(r.description),
    value: numOrNull(r.value),
    hasEvidence: Boolean(r.has_evidence),
    responseCount: num(r.response_count),
  };
}

function mapNextStep(raw: unknown): ChapterNextStep | null {
  if (raw == null) return null;
  const r = toRecord(raw);
  const reasons = Array.isArray(r.reasons) ? r.reasons.map((reason) => readString(reason)) : [];
  return {
    action: readString(r.action),
    title: readString(r.title),
    subtitle: readString(r.subtitle),
    reasons,
    ctaLabel: r.cta_label == null ? null : readString(r.cta_label),
    ruleFired: readString(r.rule_fired),
    hasEvidence: Boolean(r.has_evidence),
  };
}

function mapChapterDashboard(data: Record<string, unknown>): ChapterDashboard {
  const sections = Array.isArray(data.chapter_sections) ? data.chapter_sections : [];
  const signals = Array.isArray(data.mastery_signals) ? data.mastery_signals : [];

  return {
    chapterId: num(data.chapter_id),
    chapterName: readString(data.chapter_name),
    subjectId: num(data.subject_id),
    subjectName: data.subject_name == null ? null : readString(data.subject_name),
    chapterComplete: Boolean(data.chapter_complete),
    currentConceptId: numOrNull(data.current_concept_id),
    currentConceptName: data.current_concept_name == null ? null : readString(data.current_concept_name),
    masteredConcepts: num(data.mastered_concepts),
    totalConceptsInCurriculum: num(data.total_concepts_in_curriculum),
    responsesOnCurrentConcept: num(data.responses_on_current_concept),
    allResponses: num(data.all_responses),
    nextStep: mapNextStep(data.next_step),
    chapterSections: sections.map(mapChapterSection),
    masterySignals: signals.map(mapMasterySignal),
    gamification: (() => {
      const g = toRecord(data.gamification);
      const recent = g.recent_badge == null ? null : toRecord(g.recent_badge);
      return {
        streakCurrent: num(g.streak_current),
        streakHeadline: g.streak_headline == null ? null : readString(g.streak_headline),
        badgesEarned: num(g.badges_earned),
        recentBadge:
          recent == null
            ? null
            : {
                name: readString(recent.name),
                awardedAt: recent.awarded_at == null ? null : readString(recent.awarded_at),
              },
      };
    })(),
    reviewsDue: num(data.reviews_due),
    enrichmentAvailable: data.enrichment_available === true,
  };
}

/**
 * Everything the chapter-level "Hello, {name}" dashboard needs in one call
 * — see EsoPolicyService::chapterDashboard() on the backend. Read-only: this
 * never advances a decision, so it's safe to call on every page view/refresh.
 */
export async function fetchChapterDashboard(learnerId: string, chapterId: number, signal?: AbortSignal): Promise<ChapterDashboard> {
  const data = toRecord(await esoGet(`api/pal/eso/chapter-dashboard/${learnerId}/${chapterId}`, signal));
  return mapChapterDashboard(data);
}

export interface AutoStudentDashboard {
  /** True when the student's curriculum has no ESO-ready chapter anywhere yet — a real, honest empty state. */
  noContent: boolean;
  dashboard: ChapterDashboard | null;
}

/**
 * The main-dashboard variant of fetchChapterDashboard(): no chapterId — the
 * backend auto-picks the single most relevant chapter across the student's
 * whole enrollment for `syear` (see EsoPolicyService::studentDashboard()).
 */
export async function fetchAutoStudentDashboard(learnerId: string, syear: string, signal?: AbortSignal): Promise<AutoStudentDashboard> {
  const data = toRecord(await esoGet(`api/pal/eso/student-dashboard/${learnerId}?syear=${encodeURIComponent(syear)}`, signal));
  if (data.no_content) {
    return { noContent: true, dashboard: null };
  }
  return { noContent: false, dashboard: mapChapterDashboard(data) };
}

// ── Concept mastery details — the "Mastery details" modal ───────────────

export interface SupportBucket {
  count: number;
  correct: number;
}

export interface MisconceptionEntry {
  description: string;
  corrected: boolean;
  detectedAt: string | null;
}

export interface RecentResponse {
  question: string;
  correct: boolean;
  at: string | null;
}

export interface SuggestedContentItem {
  title: string;
  description: string | null;
  url: string | null;
  category: string;
  /** True only for the development placeholder set below. */
  isSample?: boolean;
}

/**
 * Development placeholder for the Suggested content tab.
 *
 * The real source is PedagogySuggestedContentService, reached through
 * EsoEnrichmentResolver and returned on `concept-mastery-details` as
 * `suggested_content`. That pipeline is fully wired — Chapter 1014 simply has
 * nothing authored yet (all four of its content buckets return zero rows), so
 * a demo would otherwise show an empty tab.
 *
 * These rows are shaped EXACTLY like the API's, and are only substituted when
 * the API returns an empty list. Authoring real `content_master` rows makes
 * them disappear with no code change. Each is flagged `isSample` so the UI can
 * say what it is rather than passing placeholders off as authored material.
 */
export const SAMPLE_SUGGESTED_CONTENT: SuggestedContentItem[] = [
  {
    title: 'Concept explanation — how metals conduct',
    description: 'A short read on why metals carry heat and electricity, and what makes them different from non-metals.',
    url: null,
    category: 'explanation',
    isSample: true,
  },
  {
    title: 'Worked example — identifying an unknown sample',
    description: 'Step through classifying a material from its lustre, malleability and conductivity.',
    url: null,
    category: 'example',
    isSample: true,
  },
  {
    title: 'Practice activity — sort the materials',
    description: 'Ten quick items sorting everyday materials into metal and non-metal.',
    url: null,
    category: 'practice',
    isSample: true,
  },
  {
    title: 'Quick review — properties at a glance',
    description: 'A one-page summary to skim before your next review check.',
    url: null,
    category: 'review',
    isSample: true,
  },
];

/** One gated node type's evidence position, straight from the D1 verdict. */
export interface MasteryGate {
  applicable: boolean;
  requiredEvents: number;
  validEvents: number;
  remainingEvents: number;
  independentRemaining: number;
  meetsFloor: boolean;
  notAssessed: boolean;
}

export interface MasteryPlan {
  knowledge: MasteryGate | null;
  application: MasteryGate | null;
  remainingEvents: number;
  misconceptionBlocks: boolean;
  stale: boolean;
}

function mapMasteryGate(raw: unknown): MasteryGate | null {
  const g = toRecord(raw);
  if (g.applicable !== true) {
    return { applicable: false, requiredEvents: 0, validEvents: 0, remainingEvents: 0, independentRemaining: 0, meetsFloor: false, notAssessed: false };
  }
  return {
    applicable: true,
    requiredEvents: num(g.required_events),
    validEvents: num(g.valid_events),
    remainingEvents: num(g.remaining_events),
    independentRemaining: num(g.independent_remaining),
    meetsFloor: g.meets_floor === true,
    notAssessed: g.not_assessed === true,
  };
}

export interface ConceptMasteryDetails {
  conceptId: number;
  conceptName: string;
  chapterId: number;
  status: ChapterSectionStatus;
  /** The two numbers the D4 rule actually turns on, with their thresholds. */
  knowledgeMastery: number | null;
  applicationMastery: number | null;
  knowledgeThreshold: number;
  applicationThreshold: number;
  attempts: number;
  /** Where this concept sits on the spaced-retention ladder. */
  retention: {
    scheduled: boolean;
    dueNow: boolean;
    stage: number;
    stageLabel: string | null;
    nextReviewAt: string | null;
    nodesRetained: number;
  };
  /** Only once mastered: where the student may go next, and what to explore. */
  nextConcept: { conceptId: number; name: string | null } | null;
  enrichment: Array<{ title: string; description: string | null; url: string | null }>;
  /**
   * Distance to mastery, counted in demonstrations — the same numbers the D1
   * verdict grants mastery on. Null when the concept is locked and no verdict
   * was computed.
   */
  plan: MasteryPlan | null;
  /** From the existing PAL pedagogy pipeline; empty when nothing is authored. */
  suggestedContent: SuggestedContentItem[];
  responsesOnConcept: number;
  confidenceNote: string;
  masterySignals: MasterySignal[];
  supportWithHint: SupportBucket;
  supportIndependent: SupportBucket;
  misconceptions: MisconceptionEntry[];
  recentResponses: RecentResponse[];
}

function mapSupportBucket(raw: unknown): SupportBucket {
  const r = toRecord(raw);
  return { count: num(r.count), correct: num(r.correct) };
}

/**
 * Everything the "Mastery details" modal for one concept needs — see
 * EsoPolicyService::conceptMasteryDetails() on the backend. Read-only, same
 * as fetchChapterDashboard.
 */
export async function fetchConceptMasteryDetails(learnerId: string, conceptId: number, signal?: AbortSignal): Promise<ConceptMasteryDetails> {
  const data = toRecord(await esoGet(`api/pal/eso/concept-mastery-details/${learnerId}/${conceptId}`, signal));
  const signals = Array.isArray(data.mastery_signals) ? data.mastery_signals : [];
  const misconceptions = Array.isArray(data.misconceptions) ? data.misconceptions : [];
  const recentResponses = Array.isArray(data.recent_responses) ? data.recent_responses : [];
  const status = readString(data.status);

  return {
    conceptId: num(data.concept_id),
    conceptName: readString(data.concept_name),
    chapterId: num(data.chapter_id),
    status: status === 'locked' || status === 'in_progress' || status === 'mastered' ? status : 'not_started',
    knowledgeMastery: numOrNull(data.knowledge_mastery),
    applicationMastery: numOrNull(data.application_mastery),
    knowledgeThreshold: num(data.knowledge_threshold),
    applicationThreshold: num(data.application_threshold),
    attempts: num(data.attempts),
    retention: (() => {
      const r = toRecord(data.retention);
      return {
        scheduled: r.scheduled === true,
        dueNow: r.due_now === true,
        stage: num(r.stage),
        stageLabel: r.stage_label == null ? null : readString(r.stage_label),
        nextReviewAt: r.next_review_at == null ? null : readString(r.next_review_at),
        nodesRetained: num(r.nodes_retained),
      };
    })(),
    nextConcept:
      data.next_concept == null
        ? null
        : {
            conceptId: num(toRecord(data.next_concept).concept_id),
            name: toRecord(data.next_concept).name == null ? null : readString(toRecord(data.next_concept).name),
          },
    enrichment: (Array.isArray(data.enrichment) ? data.enrichment : []).map((raw) => {
      const e = toRecord(raw);
      return {
        title: readString(e.title),
        description: e.description == null ? null : readString(e.description),
        url: e.url == null ? null : readString(e.url),
      };
    }),
    plan:
      data.plan == null
        ? null
        : (() => {
            const p = toRecord(data.plan);
            return {
              knowledge: mapMasteryGate(p.knowledge),
              application: mapMasteryGate(p.application),
              remainingEvents: num(p.remaining_events),
              misconceptionBlocks: p.misconception_blocks === true,
              stale: p.stale === true,
            };
          })(),
    suggestedContent: (Array.isArray(data.suggested_content) ? data.suggested_content : []).map((raw) => {
      const s = toRecord(raw);
      return {
        title: readString(s.title),
        description: s.description == null ? null : readString(s.description),
        url: s.url == null ? null : readString(s.url),
        category: readString(s.category),
      };
    }),
    responsesOnConcept: num(data.responses_on_concept),
    confidenceNote: readString(data.confidence_note),
    masterySignals: signals.map(mapMasterySignal),
    supportWithHint: mapSupportBucket(data.support_with_hint),
    supportIndependent: mapSupportBucket(data.support_independent),
    misconceptions: misconceptions.map((row) => {
      const r = toRecord(row);
      return {
        description: readString(r.description),
        corrected: Boolean(r.corrected),
        detectedAt: r.detected_at == null ? null : readString(r.detected_at),
      };
    }),
    recentResponses: recentResponses.map((row) => {
      const r = toRecord(row);
      return {
        question: readString(r.question),
        correct: Boolean(r.correct),
        at: r.at == null ? null : readString(r.at),
      };
    }),
  };
}

// ── Knowledge map — the whole chapter's real concept-relationship graph ──

/**
 * Like ChapterSectionStatus, plus 'not_ready' for a concept with no K/A/S
 * nodes authored at all, and 'retained' for a concept whose every node has
 * independently survived a D5 spaced-retrieval check (a real,
 * already-written eso_learner_node_state.status value — see
 * EsoPolicyService::isConceptRetained() — surfaced as its own label here
 * rather than folded into 'mastered').
 */
export type KnowledgeMapNodeStatus = ChapterSectionStatus | 'not_ready' | 'retained';

export type KnowledgeMapEdgeType = 'direct_prerequisite' | 'related';

export interface KnowledgeMapConcept {
  conceptId: number;
  name: string;
  status: KnowledgeMapNodeStatus;
  responses: number;
  misconceptionCount: number;
  /** Longest prerequisite chain beneath it — the vertical layout axis. */
  depth: number;
  isCurrent: boolean;
  /** Real prerequisite names not yet mastered — this card's own "why is this locked" reason. Empty unless status is 'locked'. */
  blockingPrerequisiteNames: string[];
}

export interface KnowledgeMapEdge {
  /** For 'direct_prerequisite': the prerequisite. For 'related': arbitrary (undirected). */
  fromConceptId: number;
  /** For 'direct_prerequisite': the dependent concept that needs fromConceptId first. */
  toConceptId: number;
  type: KnowledgeMapEdgeType;
}

export interface KnowledgeMap {
  chapterId: number;
  chapterName: string;
  /** Real chapter_master.chapter_desc, or null when the chapter has none on file — never fabricated. */
  chapterDescription: string | null;
  currentConceptId: number;
  concepts: KnowledgeMapConcept[];
  edges: KnowledgeMapEdge[];
  lockedConceptNames: string[];
  blockingPrerequisiteNames: string[];
  stats: {
    concepts: number;
    directPrerequisites: number;
    related: number;
    misconceptions: number;
  };
}

function knowledgeMapStatus(value: unknown): KnowledgeMapNodeStatus {
  const s = readString(value);
  return s === 'locked' || s === 'in_progress' || s === 'mastered' || s === 'retained' || s === 'not_ready' ? s : 'not_started';
}

/**
 * The whole chapter's real concept-relationship graph, with one concept
 * marked current, on the same ESO mastery pipeline as the rest of the
 * student dashboard — see EsoPolicyService::chapterKnowledgeMap() on the
 * backend. A dedicated feature, not an extension of the separate
 * BKT/Coherence-Map system.
 */
export async function fetchKnowledgeMap(learnerId: string, conceptId: number, signal?: AbortSignal): Promise<KnowledgeMap> {
  const data = toRecord(await esoGet(`api/pal/eso/knowledge-map/${learnerId}/${conceptId}`, signal));
  const concepts = Array.isArray(data.concepts) ? data.concepts : [];
  const edges = Array.isArray(data.edges) ? data.edges : [];
  const stats = toRecord(data.stats);
  const locked = Array.isArray(data.locked_concept_names) ? data.locked_concept_names : [];
  const blocking = Array.isArray(data.blocking_prerequisite_names) ? data.blocking_prerequisite_names : [];

  return {
    chapterId: num(data.chapter_id),
    chapterName: readString(data.chapter_name),
    chapterDescription: data.chapter_description == null ? null : readString(data.chapter_description),
    currentConceptId: num(data.current_concept_id),
    concepts: concepts.map((row) => {
      const r = toRecord(row);
      const blockingNames = Array.isArray(r.blocking_prerequisite_names) ? r.blocking_prerequisite_names : [];
      return {
        conceptId: num(r.concept_id),
        name: readString(r.name),
        status: knowledgeMapStatus(r.status),
        responses: num(r.responses),
        misconceptionCount: num(r.misconception_count),
        depth: num(r.depth),
        isCurrent: Boolean(r.is_current),
        blockingPrerequisiteNames: blockingNames.map((name) => readString(name)),
      };
    }),
    edges: edges.map((row) => {
      const r = toRecord(row);
      return {
        fromConceptId: num(r.from_concept_id),
        toConceptId: num(r.to_concept_id),
        type: readString(r.type) === 'related' ? 'related' : 'direct_prerequisite',
      };
    }),
    lockedConceptNames: locked.map((name) => readString(name)),
    blockingPrerequisiteNames: blocking.map((name) => readString(name)),
    stats: {
      concepts: num(stats.concepts),
      directPrerequisites: num(stats.direct_prerequisites),
      related: num(stats.related),
      misconceptions: num(stats.misconceptions),
    },
  };
}
