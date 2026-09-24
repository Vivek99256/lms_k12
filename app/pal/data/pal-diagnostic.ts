import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
} from '@/lib/erp-client';

/**
 * PAL chapter diagnostic -> adaptive practice -> learning plan.
 *
 *   GET  /lms/pal/diagnostic/chapter/{chapterId}          palController@diagnosticStart
 *   POST /lms/pal/diagnostic/attempt/{attemptId}/submit   palController@diagnosticSubmit
 *   GET  /lms/pal/diagnostic/attempt/{attemptId}/result   palController@diagnosticResult
 *   GET  /lms/pal/diagnostic/history/{chapterId}          palController@diagnosticHistory
 *   GET  /lms/pal/adaptive/chapter/{chapterId}            palController@adaptiveConcepts
 *   GET  /lms/pal/adaptive/concept/{conceptId}            palController@adaptiveQuestions
 *   POST /lms/pal/adaptive/answer                         palController@adaptiveAnswer
 *   GET  /lms/pal/adaptive/concept-result/{conceptId}     palController@adaptiveConceptResult
 *   GET  /lms/pal/plan/chapter/{chapterId}                palController@learningPlan
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT fetchDiagnosticAssessment() IN pal.ts
 * ---------------------------------------------------------------------------
 * That one is `assessmentQuestionController@generateDiagnosticAssessment`: it
 * samples a concept and its prerequisites across the DOK range and returns
 * however many items that yields.
 *
 * This is the CHAPTER paper the product brief specifies - exactly 15 MCQs, five
 * easy, five medium and five hard, drawn by DiagnosticQuestionSelector and
 * persisted as a pal_diagnostic_attempt. Its scored result is what drives
 * adaptive practice, the plan, and every stage after it. Both endpoints exist
 * and neither replaces the other, so they live side by side rather than one
 * being bent into the shape of the other.
 *
 * ---------------------------------------------------------------------------
 * THE ANSWER KEY NEVER CROSSES THIS BOUNDARY
 * ---------------------------------------------------------------------------
 * Served questions carry options only. Correctness is resolved server-side from
 * the submitted answer_master id, and an option is honoured only when it really
 * belongs to the question it was submitted against. Nothing in this file sends
 * a "correct" flag, and the types below deliberately have nowhere to put one.
 *
 * Session, tenant and year come from the signed-in session exactly as the rest
 * of the PAL data layer reads them (pal.ts, pal-eso.ts).
 */

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function session() {
  const ctx = buildSessionContext();
  if (!ctx.baseUrl) {
    throw new Error('Session data is missing. Please sign in again.');
  }
  return ctx;
}

/** type=API, sub_institute_id, syear, user_id - what the /lms/* routes expect. */
function params(ctx: ReturnType<typeof buildSessionContext>): URLSearchParams {
  const search = new URLSearchParams();
  appendCommonParams(search, ctx);
  if (ctx.userId) search.set('user_id', ctx.userId);
  return search;
}

function headers(ctx: ReturnType<typeof buildSessionContext>, contentType?: string): HeadersInit {
  return {
    ...createAuthHeaders(ctx, contentType),
    'X-Requested-With': 'XMLHttpRequest',
  };
}

async function readJson(response: Response, what: string): Promise<Record<string, unknown>> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to ${what}.`);
  }
  return toRecord(await response.json());
}

// --- types -----------------------------------------------------------------

export type DifficultyBand = 'easy' | 'medium' | 'hard';

/** The ordered ladder. Bands render in this order, never in object-key order. */
export const BAND_ORDER: DifficultyBand[] = ['easy', 'medium', 'hard'];

export interface DiagnosticOption {
  id: string;
  answer: string;
}

export interface DiagnosticQuestionItem {
  questionId: string;
  title: string;
  difficulty: string;
  options: DiagnosticOption[];
  /**
   * The option this learner already chose, when the paper is a resumed attempt.
   * Null on a fresh paper and on any question they had not reached.
   */
  selectedOptionId: string | null;
}

export interface ChapterDiagnosticPaper {
  status: string;
  message: string;
  attemptId: string | null;
  chapterId: string;
  questions: DiagnosticQuestionItem[];
  timeAllowedMinutes: number;
  /**
   * Machine reason a paper could not be drawn. Only 23 of 150 chapters on this
   * estate can fill all three bands, so this is an ordinary outcome and the UI
   * is expected to explain it rather than render an empty exam.
   */
  reason: string | null;
  /**
   * True when the server handed back an unfinished attempt instead of drawing a
   * new paper, with how many answers were already on it. The exam screen must
   * say so - silently restoring answers looks like a bug, and silently NOT
   * saying it resumed makes the timer and progress read wrong.
   */
  resumed: boolean;
  answered: number;
}

export interface DiagnosticBandBreakdown {
  band: string;
  label: string;
  served: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percentage: number;
}

export interface DiagnosticConceptBreakdown {
  conceptId: string | null;
  name: string;
  served: number;
  correct: number;
  percentage: number;
  band: string;
  /** False when questions were matched by chapter rather than by concept. */
  conceptExact: boolean;
}

/**
 * One question's verdict in the post-submission review — title and
 * correct/incorrect only, never the correct option or which option was
 * chosen. Distinct from DiagnosticQuestionItem (the served paper): that one
 * carries options with no verdict, this one carries a verdict with no
 * options. The answer key still never crosses to the client, only the
 * outcome does.
 */
export interface DiagnosticQuestionResult {
  sequence: number;
  questionId: string;
  title: string;
  difficulty: string;
  conceptId: string | null;
  conceptName: string | null;
  answered: boolean;
  /** null when unanswered — neither right nor wrong. */
  isCorrect: boolean | null;
}

export interface ChapterDiagnosticResult {
  attemptId: string;
  chapterId: string;
  subjectId: string;
  status: string;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percentage: number;
  level: string;
  difficultyBreakdown: DiagnosticBandBreakdown[];
  conceptBreakdown: DiagnosticConceptBreakdown[];
  strengths: DiagnosticConceptBreakdown[];
  weaknesses: DiagnosticConceptBreakdown[];
  questionResults: DiagnosticQuestionResult[];
  recommendedDifficulty: string;
  recommendedReason: string;
  submittedAt: string;
}

// --- parsing ---------------------------------------------------------------

function readConcepts(value: unknown): DiagnosticConceptBreakdown[] {
  return toArray(value).map((entry) => {
    const row = toRecord(entry);
    return {
      conceptId: row.concept_id == null ? null : readString(row.concept_id),
      name: readString(row.name) || readString(row.concept_name) || 'Unnamed concept',
      served: readNumber(row.served),
      correct: readNumber(row.correct),
      percentage: readNumber(row.percentage),
      band: readString(row.band),
      conceptExact: row.concept_exact === true || readString(row.concept_exact) === '1',
    };
  });
}

function readQuestionResults(value: unknown): DiagnosticQuestionResult[] {
  return toArray(value).map((entry) => {
    const row = toRecord(entry);
    return {
      sequence: readNumber(row.sequence),
      questionId: readString(row.question_id),
      title: readString(row.title),
      difficulty: readString(row.difficulty),
      conceptId: row.concept_id == null ? null : readString(row.concept_id),
      conceptName: row.concept_name == null ? null : readString(row.concept_name),
      answered: row.answered === true,
      isCorrect: row.is_correct == null ? null : row.is_correct === true,
    };
  });
}

function readResult(data: Record<string, unknown>): ChapterDiagnosticResult {
  // difficulty_breakdown arrives keyed BY BAND, so the band name is the key.
  // Sorted onto BAND_ORDER rather than trusting key order - the result only
  // reads as a ladder if easy comes before hard every time.
  const raw = toRecord(data.difficulty_breakdown);
  const keys = [
    ...BAND_ORDER.filter((band) => band in raw),
    ...Object.keys(raw).filter((band) => !BAND_ORDER.includes(band as DifficultyBand)),
  ];

  return {
    attemptId: readString(data.attempt_id),
    chapterId: readString(data.chapter_id),
    subjectId: readString(data.subject_id),
    status: readString(data.status),
    totalQuestions: readNumber(data.total_questions),
    correct: readNumber(data.correct),
    incorrect: readNumber(data.incorrect),
    unanswered: readNumber(data.unanswered),
    percentage: readNumber(data.percentage),
    level: readString(data.level),
    difficultyBreakdown: keys.map((band) => {
      const row = toRecord(raw[band]);
      return {
        band,
        label: readString(row.label) || band,
        served: readNumber(row.served),
        correct: readNumber(row.correct),
        incorrect: readNumber(row.incorrect),
        unanswered: readNumber(row.unanswered),
        percentage: readNumber(row.percentage),
      };
    }),
    conceptBreakdown: readConcepts(data.concept_breakdown),
    strengths: readConcepts(data.strengths),
    weaknesses: readConcepts(data.weaknesses),
    questionResults: readQuestionResults(data.question_results),
    recommendedDifficulty: readString(data.recommended_difficulty),
    recommendedReason: readString(data.recommended_reason),
    submittedAt: readString(data.submitted_at),
  };
}

// --- diagnostic ------------------------------------------------------------

/** Draw a fresh 15-question paper (5 easy / 5 medium / 5 hard) for a chapter. */
export async function startChapterDiagnostic(
  chapterId: string | number,
  signal?: AbortSignal
): Promise<ChapterDiagnosticPaper> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/diagnostic/chapter/${chapterId}?${params(ctx).toString()}`,
    { headers: headers(ctx), signal }
  );
  const payload = await readJson(response, 'start the diagnostic');

  const attemptId = payload.attempt_id == null ? '' : readString(payload.attempt_id);

  return {
    status: normalizeApiStatus(payload as ApiEnvelope),
    message: readString(payload.message),
    attemptId: attemptId || null,
    chapterId: readString(payload.chapter_id) || String(chapterId),
    questions: toArray(payload.questions).map((entry) => {
      const row = toRecord(entry);
      return {
        questionId: readString(row.question_id) || readString(row.id),
        title: readString(row.question_title) || readString(row.title),
        difficulty: readString(row.difficulty),
        options: toArray(row.options).map((opt) => {
          const option = toRecord(opt);
          return { id: readString(option.id), answer: readString(option.answer) };
        }),
        selectedOptionId:
          row.answer_master_id == null ? null : readString(row.answer_master_id),
      };
    }),
    timeAllowedMinutes: readNumber(payload.time_allowed) || 30,
    reason: payload.reason == null ? null : readString(payload.reason),
    resumed: payload.resumed === true,
    answered: readNumber(payload.answered),
  };
}

/**
 * Submit the paper. The scored result comes back in the same round trip, so the
 * result screen does not have to re-fetch what was just scored.
 *
 * `answers` is questionId -> answer_master id. Unanswered questions are simply
 * absent: the server already holds a row for every question it served, so a
 * blank stays a blank rather than being scored as wrong.
 */
export async function submitChapterDiagnostic(input: {
  attemptId: string;
  answers: Record<string, string>;
}): Promise<{ status: string; message: string; result: ChapterDiagnosticResult | null }> {
  const ctx = session();
  const body = params(ctx);
  Object.entries(input.answers).forEach(([questionId, answerId]) => {
    if (answerId) body.set(`answers[${questionId}]`, answerId);
  });

  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/diagnostic/attempt/${input.attemptId}/submit`,
    {
      method: 'POST',
      headers: headers(ctx, 'application/x-www-form-urlencoded'),
      body: body.toString(),
    }
  );
  const payload = await readJson(response, 'submit the diagnostic');
  const result = toRecord(payload.result);

  return {
    status: normalizeApiStatus(payload as ApiEnvelope),
    message: readString(payload.message),
    result: Object.keys(result).length > 0 ? readResult(result) : null,
  };
}

/** Re-read a scored attempt. A pure read, so it survives refresh and re-login. */
export async function fetchChapterDiagnosticResult(
  attemptId: string | number,
  signal?: AbortSignal
): Promise<ChapterDiagnosticResult> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/diagnostic/attempt/${attemptId}/result?${params(ctx).toString()}`,
    { headers: headers(ctx), signal }
  );
  const payload = await readJson(response, 'load the diagnostic result');
  return readResult(toRecord(payload.result));
}

export interface DiagnosticHistoryEntry {
  attemptId: string;
  percentage: number;
  level: string;
  correct: number;
  incorrect: number;
  unanswered: number;
  totalQuestions: number;
  submittedAt: string;
}

export async function fetchChapterDiagnosticHistory(
  chapterId: string | number,
  signal?: AbortSignal
): Promise<{ chapterName: string; attempts: DiagnosticHistoryEntry[] }> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/diagnostic/history/${chapterId}?${params(ctx).toString()}`,
    { headers: headers(ctx), signal }
  );
  const payload = await readJson(response, 'load diagnostic history');

  return {
    chapterName: readString(payload.chapter_name),
    attempts: toArray(payload.attempts).map((entry) => {
      const row = toRecord(entry);
      return {
        attemptId: readString(row.id),
        percentage: readNumber(row.percentage),
        level: readString(row.level),
        correct: readNumber(row.correct),
        incorrect: readNumber(row.incorrect),
        unanswered: readNumber(row.unanswered),
        totalQuestions: readNumber(row.total_questions),
        submittedAt: readString(row.submitted_at),
      };
    }),
  };
}

// --- adaptive practice -----------------------------------------------------

export interface AdaptiveConcept {
  conceptId: string;
  name: string;
  servable: boolean;
  conceptExact: boolean;
  availability: Record<string, number>;
  nextDifficulty: string;
  ruleFired: string;
  rationale: string;
  diagnosticPercentage: number | null;
  practiceAttempts: number;
  practicePercentage: number;
}

export interface AdaptiveConceptList {
  chapterId: string;
  chapterName: string;
  subjectId: string;
  hasDiagnostic: boolean;
  diagnosticLevel: string;
  attemptId: string | null;
  concepts: AdaptiveConcept[];
}

export async function fetchAdaptiveConcepts(
  chapterId: string | number,
  signal?: AbortSignal
): Promise<AdaptiveConceptList> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/adaptive/chapter/${chapterId}?${params(ctx).toString()}`,
    { headers: headers(ctx), signal }
  );
  const payload = await readJson(response, 'load adaptive concepts');

  return {
    chapterId: readString(payload.chapter_id) || String(chapterId),
    chapterName: readString(payload.chapter_name),
    subjectId: readString(payload.subject_id),
    hasDiagnostic: payload.has_diagnostic === true,
    diagnosticLevel: readString(payload.diagnostic_level),
    attemptId: payload.attempt_id == null ? null : readString(payload.attempt_id),
    concepts: toArray(payload.concepts).map((entry) => {
      const row = toRecord(entry);
      const availability = toRecord(row.availability);
      const diagnostic = toRecord(row.diagnostic);
      const practice = toRecord(row.practice);
      return {
        conceptId: readString(row.concept_id),
        name: readString(row.name),
        servable: row.servable === true,
        conceptExact: availability.exact === true,
        availability: {
          easy: readNumber(availability.easy),
          medium: readNumber(availability.medium),
          hard: readNumber(availability.hard),
          total: readNumber(availability.total),
        },
        nextDifficulty: readString(row.next_difficulty),
        ruleFired: readString(row.rule_fired),
        rationale: readString(row.rationale),
        diagnosticPercentage:
          diagnostic.percentage == null ? null : readNumber(diagnostic.percentage),
        practiceAttempts: readNumber(practice.attempts),
        practicePercentage: readNumber(practice.percentage),
      };
    }),
  };
}

export interface AdaptiveQuestionSet {
  conceptId: string;
  conceptName: string;
  chapterId: string;
  difficulty: string;
  exhausted: boolean;
  recycled: boolean;
  conceptExact: boolean;
  ruleFired: string;
  rationale: string;
  items: DiagnosticQuestionItem[];
}

/** The next practice set for one concept. Five questions by default. */
export async function fetchAdaptiveQuestions(
  conceptId: string | number,
  limit = 5,
  signal?: AbortSignal
): Promise<AdaptiveQuestionSet> {
  const ctx = session();
  const search = params(ctx);
  search.set('limit', String(limit));

  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/adaptive/concept/${conceptId}?${search.toString()}`,
    { headers: headers(ctx), signal }
  );
  const payload = await readJson(response, 'load adaptive questions');

  return {
    conceptId: readString(payload.concept_id) || String(conceptId),
    conceptName: readString(payload.concept_name),
    chapterId: readString(payload.chapter_id),
    difficulty: readString(payload.difficulty),
    exhausted: payload.exhausted === true,
    recycled: payload.recycled === true,
    conceptExact: payload.concept_exact === true,
    ruleFired: readString(payload.rule_fired),
    rationale: readString(payload.rationale),
    items: toArray(payload.items).map((entry) => {
      const row = toRecord(entry);
      return {
        questionId: readString(row.question_id) || readString(row.id),
        title: readString(row.question_title) || readString(row.title),
        difficulty: readString(row.difficulty),
        options: toArray(row.options).map((opt) => {
          const option = toRecord(opt);
          return { id: readString(option.id), answer: readString(option.answer) };
        }),
        // Adaptive practice is never resumed - each set is drawn fresh and
        // answered one question at a time - so there is no prior choice to
        // restore. Stated rather than left optional, so the shared item type
        // stays exhaustive and a real selection can never be forgotten.
        selectedOptionId: null,
      };
    }),
  };
}

export interface AdaptiveAnswerOutcome {
  status: number;
  isCorrect: boolean;
  correctAnswerId: string | null;
  /** answer_master.feedback - the misconception text. Often null. */
  feedback: string | null;
  servedDifficulty: string;
  nextDifficulty: string;
  ruleFired: string;
  rationale: string;
}

/**
 * Record one practice answer.
 *
 * Only the chosen option id is sent. The server resolves correctness, decides
 * what difficulty the answer counted as, and returns both - a client-supplied
 * verdict is neither sent nor accepted.
 */
export async function submitAdaptiveAnswer(input: {
  conceptId: string | number;
  questionId: string | number;
  answerMasterId: string | number;
}): Promise<AdaptiveAnswerOutcome> {
  const ctx = session();
  const body = params(ctx);
  body.set('concept_id', String(input.conceptId));
  body.set('question_id', String(input.questionId));
  body.set('answer_master_id', String(input.answerMasterId));

  const response = await fetch(`${ctx.baseUrl}/lms/pal/adaptive/answer`, {
    method: 'POST',
    headers: headers(ctx, 'application/x-www-form-urlencoded'),
    body: body.toString(),
  });
  const payload = await readJson(response, 'record the answer');

  return {
    status: readNumber(payload.status),
    isCorrect: payload.is_correct === true,
    correctAnswerId: payload.correct_answer_id == null ? null : readString(payload.correct_answer_id),
    feedback: payload.feedback == null ? null : readString(payload.feedback),
    servedDifficulty: readString(payload.served_difficulty),
    nextDifficulty: readString(payload.next_difficulty),
    ruleFired: readString(payload.rule_fired),
    rationale: readString(payload.rationale),
  };
}

// --- concept result --------------------------------------------------------

export interface MasteryLadderState {
  mastered: boolean;
  bandsRequired: string[];
  bandsCleared: string[];
  bandsUnavailable: string[];
  bandsThin: string[];
  nextBand: string | null;
  progressPct: number;
  reason: string;
}

/**
 * The single next step after a practice set, decided server-side by
 * PracticeOutcomeService. The UI renders this rather than offering a menu -
 * the whole point of an adaptive engine is that it knows what comes next.
 *
 * `eso` says whether the Adaptive Learning Engine can run this concept. When
 * false the action degrades (reteach -> review_content, mastery_check ->
 * mastered) because there is no node to hand over to.
 */
export type PracticeNextAction =
  | 'remediate'
  | 'reteach'
  | 'review_content'
  | 'practice'
  | 'continue_practice'
  | 'advance_band'
  | 'mastery_check'
  | 'mastered'
  | 'escalate';

export interface PracticeNext {
  action: PracticeNextAction | string;
  band: string | null;
  conceptId: number | null;
  /** Whether the engine can take this concept from here. */
  eso: boolean;
  reason: string;
}

export interface DetectedMisconception {
  id: number | null;
  tag: string;
  description: string;
  correctiveAction: string;
}

export interface ConceptDiagnosticResult {
  conceptId: string;
  conceptName: string;
  chapterId: string;
  conceptExact: boolean;
  availability: Record<string, number>;
  attempted: number;
  correct: number;
  accuracy: number;
  byDifficulty: Record<string, { attempted: number; correct: number; accuracy: number }>;
  currentDifficulty: string | null;
  nextDifficulty: string | null;
  ruleFired: string;
  rationale: string;
  understanding: string;
  needsRemediation: boolean;
  readyForProgression: boolean;
  ladder: MasteryLadderState;
  diagnosticLevel: string | null;
  diagnosticConceptPct: number | null;
  /** Decided by the server after the set was closed out. */
  next: PracticeNext | null;
  /** Present only when a wrong answer matched the curated library. */
  misconception: DetectedMisconception | null;
  /** How many answers were just published to the mastery ledger. */
  evidencePublished: number;
}

function readLadder(value: unknown): MasteryLadderState {
  const row = toRecord(value);
  const strings = (key: string) => toArray(row[key]).map((band) => readString(band));

  return {
    mastered: row.mastered === true,
    bandsRequired: strings('bands_required'),
    bandsCleared: strings('bands_cleared'),
    bandsUnavailable: strings('bands_unavailable'),
    bandsThin: strings('bands_thin'),
    nextBand: row.next_band == null ? null : readString(row.next_band),
    progressPct: readNumber(row.progress_pct),
    reason: readString(row.reason),
  };
}

export async function fetchConceptResult(
  conceptId: string | number,
  signal?: AbortSignal
): Promise<ConceptDiagnosticResult> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/adaptive/concept-result/${conceptId}?${params(ctx).toString()}`,
    { headers: headers(ctx), signal }
  );
  const payload = await readJson(response, 'load the concept result');
  const row = toRecord(payload.result);
  const progress = toRecord(row.progress);
  const diagnostic = toRecord(row.diagnostic);
  const availability = toRecord(row.availability);

  // `next` and `misconception` sit on the ENVELOPE, not inside `result` -
  // PracticeOutcomeService returns the verdict alongside the result rather
  // than buried in it, because the result is a pure projection and the verdict
  // is a decision.
  const rawNext = toRecord(payload.next);
  const nextRecord = Object.keys(rawNext).length > 0 ? rawNext : null;
  const rawMis = toRecord(payload.misconception);
  const misRecord = Object.keys(rawMis).length > 0 ? rawMis : null;

  const byDifficulty: ConceptDiagnosticResult['byDifficulty'] = {};
  Object.entries(toRecord(progress.by_difficulty)).forEach(([band, stats]) => {
    const value = toRecord(stats);
    byDifficulty[band] = {
      attempted: readNumber(value.attempted),
      correct: readNumber(value.correct),
      accuracy: readNumber(value.accuracy),
    };
  });

  return {
    conceptId: readString(row.concept_id),
    conceptName: readString(row.concept_name),
    chapterId: readString(row.chapter_id),
    conceptExact: row.concept_exact === true,
    availability: {
      easy: readNumber(availability.easy),
      medium: readNumber(availability.medium),
      hard: readNumber(availability.hard),
      total: readNumber(availability.total),
    },
    attempted: readNumber(progress.attempted),
    correct: readNumber(progress.correct),
    accuracy: readNumber(progress.accuracy),
    byDifficulty,
    currentDifficulty: row.current_difficulty == null ? null : readString(row.current_difficulty),
    nextDifficulty: row.next_difficulty == null ? null : readString(row.next_difficulty),
    ruleFired: readString(row.rule_fired),
    rationale: readString(row.rationale),
    understanding: readString(row.understanding),
    needsRemediation: row.needs_remediation === true,
    readyForProgression: row.ready_for_progression === true,
    ladder: readLadder(row.ladder),
    diagnosticLevel: diagnostic.level == null ? null : readString(diagnostic.level),
    diagnosticConceptPct:
      diagnostic.concept_pct == null ? null : readNumber(diagnostic.concept_pct),
    next: nextRecord === null
      ? null
      : {
          action: readString(nextRecord.action),
          band: nextRecord.band == null ? null : readString(nextRecord.band),
          conceptId: nextRecord.concept_id == null ? null : readNumber(nextRecord.concept_id),
          eso: nextRecord.eso === true,
          reason: readString(nextRecord.reason),
        },
    misconception: misRecord === null
      ? null
      : {
          id: misRecord.id == null ? null : readNumber(misRecord.id),
          tag: readString(misRecord.tag),
          description: readString(misRecord.description),
          correctiveAction: readString(misRecord.corrective_action),
        },
    evidencePublished: readNumber(payload.evidence_published),
  };
}

// --- learning plan ---------------------------------------------------------

export interface PlanPathStage {
  stage: string;
  label: string;
  detail: string | null;
}

export interface PlanStep {
  key: string;
  conceptId: string | null;
  title: string;
  band: string | null;
  detail: string;
  nextDifficulty: string | null;
  esoReady: boolean;
  ladder: MasteryLadderState | null;
  path: PlanPathStage[];
}

export interface PlanMisconception {
  id: string;
  tag: string;
  description: string;
  errorPattern: string;
  correctiveAction: string;
}

export interface PlanConcept {
  conceptId: string;
  name: string;
  band: string | null;
  esoReady: boolean;
  conceptExact: boolean;
  nextDifficulty: string | null;
  rationale: string;
  ladder: MasteryLadderState;
  misconceptions: PlanMisconception[];
}

export interface PlanContentGap {
  conceptId: string;
  name: string;
  reason: string;
  detail: string;
}

export interface LearningPlan {
  chapterId: string;
  chapterName: string;
  subjectId: string | null;
  hasDiagnostic: boolean;
  diagnosticLevel: string | null;
  attemptId: string | null;
  /** Always false. The plan is derived on read and has no write route. */
  editable: boolean;
  summary: {
    conceptsTotal: number;
    conceptsServable: number;
    conceptsWithoutQuestions: number;
    mastered: number;
    inProgress: number;
    weak: number;
  };
  readiness: { conceptsTotal: number; conceptsReady: number; esoAvailable: boolean };
  steps: PlanStep[];
  concepts: PlanConcept[];
  contentGaps: PlanContentGap[];
  generatedAt: string;
}

export async function fetchLearningPlan(
  chapterId: string | number,
  signal?: AbortSignal
): Promise<LearningPlan> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/plan/chapter/${chapterId}?${params(ctx).toString()}`,
    { headers: headers(ctx), signal }
  );
  const payload = await readJson(response, 'load the learning plan');
  const plan = toRecord(payload.plan);
  const summary = toRecord(plan.summary);
  const readiness = toRecord(plan.readiness);

  return {
    chapterId: readString(plan.chapter_id) || String(chapterId),
    chapterName: readString(plan.chapter_name),
    subjectId: plan.subject_id == null ? null : readString(plan.subject_id),
    hasDiagnostic: plan.has_diagnostic === true,
    diagnosticLevel: plan.diagnostic_level == null ? null : readString(plan.diagnostic_level),
    attemptId: plan.attempt_id == null ? null : readString(plan.attempt_id),
    editable: payload.editable === true,
    summary: {
      conceptsTotal: readNumber(summary.concepts_total),
      conceptsServable: readNumber(summary.concepts_servable),
      conceptsWithoutQuestions: readNumber(summary.concepts_without_questions),
      mastered: readNumber(summary.mastered),
      inProgress: readNumber(summary.in_progress),
      weak: readNumber(summary.weak),
    },
    readiness: {
      conceptsTotal: readNumber(readiness.concepts_total),
      conceptsReady: readNumber(readiness.concepts_ready),
      esoAvailable: readiness.eso_available === true,
    },
    steps: toArray(plan.steps).map((entry) => {
      const row = toRecord(entry);
      return {
        key: readString(row.key),
        conceptId: row.concept_id == null ? null : readString(row.concept_id),
        title: readString(row.title),
        band: row.band == null ? null : readString(row.band),
        detail: readString(row.detail),
        nextDifficulty: row.next_difficulty == null ? null : readString(row.next_difficulty),
        esoReady: row.eso_ready === true,
        ladder: row.ladder == null ? null : readLadder(row.ladder),
        path: toArray(row.path).map((stage) => {
          const value = toRecord(stage);
          return {
            stage: readString(value.stage),
            label: readString(value.label),
            detail: value.detail == null ? null : readString(value.detail),
          };
        }),
      };
    }),
    concepts: toArray(plan.concepts).map((entry) => {
      const row = toRecord(entry);
      return {
        conceptId: readString(row.concept_id),
        name: readString(row.name),
        band: row.band == null ? null : readString(row.band),
        esoReady: row.eso_ready === true,
        conceptExact: row.concept_exact === true,
        nextDifficulty: row.next_difficulty == null ? null : readString(row.next_difficulty),
        rationale: readString(row.rationale),
        ladder: readLadder(row.ladder),
        misconceptions: toArray(row.misconceptions).map((m) => {
          const value = toRecord(m);
          return {
            id: readString(value.id),
            tag: readString(value.tag),
            description: readString(value.description),
            errorPattern: readString(value.error_pattern),
            correctiveAction: readString(value.corrective_action),
          };
        }),
      };
    }),
    contentGaps: toArray(plan.content_gaps).map((entry) => {
      const row = toRecord(entry);
      return {
        conceptId: readString(row.concept_id),
        name: readString(row.name),
        reason: readString(row.reason),
        detail: readString(row.detail),
      };
    }),
    generatedAt: readString(plan.generated_at),
  };
}

// --- mastery and recall ---------------------------------------------------

/**
 * Where one concept stands, reconciling three signals that can legitimately
 * disagree. See MasteryOverviewService for why all three are returned rather
 * than collapsed into one number.
 */
export type MasteryStage =
  | 'retained'
  | 'mastered'
  | 'recall_due'
  | 'awaiting_mastery_check'
  | 'in_progress'
  | 'not_started'
  | 'no_questions';

export interface ConceptMasteryRow {
  conceptId: number;
  name: string;
  /** BKT estimate over every recorded answer. Null when nothing is recorded. */
  pMastery: number | null;
  band: string | null;
  attempts: number;
  correct: number;
  gate: number | null;
  bktMastered: boolean;
  /** The engine's own verdict: unseen / learning / mastered / retained. */
  engineStatus: string | null;
  retentionStage: number | null;
  nextReviewAt: string | null;
  reviewDue: boolean;
  esoReady: boolean;
  ladder: MasteryLadderState;
  stage: MasteryStage | string;
}

export interface MasterySummary {
  conceptsTotal: number;
  mastered: number;
  retained: number;
  recallDue: number;
  awaitingCheck: number;
  inProgress: number;
  notStarted: number;
  noQuestions: number;
}

export interface ChapterMastery {
  chapterId: number;
  chapterName: string | null;
  summary: MasterySummary;
  concepts: ConceptMasteryRow[];
  generatedAt: string;
}

export async function fetchChapterMastery(
  chapterId: string | number,
  signal?: AbortSignal
): Promise<ChapterMastery> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/mastery/chapter/${chapterId}?${params(ctx).toString()}`,
    { headers: headers(ctx), signal }
  );
  const payload = await readJson(response, 'load your mastery');
  const m = toRecord(payload.mastery);
  const sum = toRecord(m.summary);

  return {
    chapterId: readNumber(m.chapter_id),
    chapterName: m.chapter_name == null ? null : readString(m.chapter_name),
    summary: {
      conceptsTotal: readNumber(sum.concepts_total),
      mastered: readNumber(sum.mastered),
      retained: readNumber(sum.retained),
      recallDue: readNumber(sum.recall_due),
      awaitingCheck: readNumber(sum.awaiting_check),
      inProgress: readNumber(sum.in_progress),
      notStarted: readNumber(sum.not_started),
      noQuestions: readNumber(sum.no_questions),
    },
    concepts: toArray(m.concepts).map((entry) => {
      const row = toRecord(entry);
      return {
        conceptId: readNumber(row.concept_id),
        name: readString(row.name),
        pMastery: row.p_mastery == null ? null : readNumber(row.p_mastery),
        band: row.band == null ? null : readString(row.band),
        attempts: readNumber(row.attempts),
        correct: readNumber(row.correct),
        gate: row.gate == null ? null : readNumber(row.gate),
        bktMastered: row.bkt_mastered === true,
        engineStatus: row.engine_status == null ? null : readString(row.engine_status),
        retentionStage: row.retention_stage == null ? null : readNumber(row.retention_stage),
        nextReviewAt: row.next_review_at == null ? null : readString(row.next_review_at),
        reviewDue: row.review_due === true,
        esoReady: row.eso_ready === true,
        ladder: readLadder(row.ladder),
        stage: readString(row.stage),
      };
    }),
    generatedAt: readString(m.generated_at),
  };
}

export interface RecallItem {
  conceptId: number;
  conceptName: string;
  chapterId: number;
  chapterName: string | null;
  nodeId: number;
  status: string;
  /** Rung of the retention ladder: 0 = 2 days, then 7, 30, 60, 180. */
  retentionStage: number;
  masteryEstimate: number;
  nextReviewAt: string | null;
  daysUntil: number | null;
}

export interface RecallQueue {
  due: RecallItem[];
  upcoming: RecallItem[];
  counts: { due: number; upcoming: number; totalTracked: number };
  generatedAt: string;
}

/**
 * What is owed a review. Reports the engine's own `next_review_at`; nothing is
 * scheduled client-side.
 */
export async function fetchRecallQueue(
  chapterId?: string | number,
  signal?: AbortSignal
): Promise<RecallQueue> {
  const ctx = session();
  const search = params(ctx);
  if (chapterId) search.set('chapter_id', String(chapterId));

  const response = await fetch(`${ctx.baseUrl}/lms/pal/recall?${search.toString()}`, {
    headers: headers(ctx),
    signal,
  });
  const payload = await readJson(response, 'load your reviews');
  const r = toRecord(payload.recall);
  const counts = toRecord(r.counts);

  const item = (entry: unknown): RecallItem => {
    const row = toRecord(entry);
    return {
      conceptId: readNumber(row.concept_id),
      conceptName: readString(row.concept_name),
      chapterId: readNumber(row.chapter_id),
      chapterName: row.chapter_name == null ? null : readString(row.chapter_name),
      nodeId: readNumber(row.node_id),
      status: readString(row.status),
      retentionStage: readNumber(row.retention_stage),
      masteryEstimate: readNumber(row.mastery_estimate),
      nextReviewAt: row.next_review_at == null ? null : readString(row.next_review_at),
      daysUntil: row.days_until == null ? null : readNumber(row.days_until),
    };
  };

  return {
    due: toArray(r.due).map(item),
    upcoming: toArray(r.upcoming).map(item),
    counts: {
      due: readNumber(counts.due),
      upcoming: readNumber(counts.upcoming),
      totalTracked: readNumber(counts.total_tracked),
    },
    generatedAt: readString(r.generated_at),
  };
}

// --- learn -----------------------------------------------------------------

/**
 * The learning material for one concept.
 *
 * Deliberately NOT the engine's next-action endpoint. That one decides what the
 * learner should do and stamps state doing it, so a "Learn it" button pointed
 * at it could not keep its promise - it routinely opened practice instead. This
 * is a strictly read-only view of the same material the teach screen serves.
 */
export interface LearnContent {
  variant: number;
  format: string;
  formatLabel: string;
  title: string | null;
  body: string | null;
  mediaUrl: string | null;
  provider: string | null;
  attribution: string | null;
}

/**
 * One resource in the Learn list.
 *
 * `scope` is load-bearing and must not be dropped in the UI. Only videos are
 * genuinely tagged to a concept; everything from content_master is reachable by
 * CHAPTER only (concept_id is populated on 1 row out of 31,331 estate-wide), so
 * the same chapter items appear under every concept in that chapter. Presenting
 * them as concept-specific would be a lie.
 */
export interface LearnResourceItem {
  id: string;
  /** 'pal_concept_video' | 'content_master' | 'pal_h5p_node_metadata' */
  sourceTable: string;
  section: string;
  scope: 'concept' | 'chapter';
  title: string;
  description: string | null;
  /** Null only for H5P, which has no direct file to open. */
  url: string | null;
  fileType: string | null;
  category: string;
  h5pType: string | null;
  provider: string | null;
  attribution: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  /** Whatever tagging the row genuinely carries. Absent keys are absent data. */
  tags: {
    difficulty?: string;
    metaTags?: string[];
    chapterId?: number;
    subjectId?: number;
    standardId?: number;
    conceptId?: number;
    topicId?: number;
    bloomLevel?: string;
    pedagogyTag?: string;
    fileSize?: string;
    matchScore?: number;
    source?: string;
  };
}

export interface LearnResourceSection {
  key: string;
  label: string;
  count: number;
  /** 'concept' | 'chapter' | 'mixed' — what this whole section is scoped to. */
  scope: string;
  items: LearnResourceItem[];
}

export interface LearnResources {
  /** Only non-empty sections are returned, already in display order. */
  sections: LearnResourceSection[];
  totals: { items: number; conceptScoped: number; chapterScoped: number };
  /**
   * What the server deliberately withheld. Surfaced so a content gap is
   * diagnosable instead of looking like a bug — not necessarily shown to the
   * student.
   */
  excluded: { teacherMaterial: number; unresolvable: number; unclassified: number };
  /** e.g. 'chapter_level_only', 'nothing_authored' */
  notes: string[];
}

/**
 * A corrective already routed to this learner for this concept by
 * MisconceptionLibraryService — fired when a wrong answer (diagnostic or
 * adaptive practice) matches a known misconception — and not yet marked
 * resolved. See palController::learnContent()'s own note on this field.
 */
export interface ConceptLearnMisconception {
  misconceptionTag: string;
  title: string;
  body: string | null;
  mediaUrl: string | null;
  format: string | null;
  servedAt: string | null;
}

export interface ConceptLearn {
  status: number;
  conceptId: number;
  conceptName: string;
  chapterId: number;
  nodeId: number | null;
  nodeType: string | null;
  /** How many checks have been failed; drives which variant is served. */
  attempt: number;
  /** Null is ordinary - most concepts have nothing authored. Say so. */
  content: LearnContent | null;
  /** Every other resource for this concept, grouped by kind. */
  resources: LearnResources;
  /** What tripped this learner up here, and the corrective for it. */
  misconceptions: ConceptLearnMisconception[];
  reason: string | null;
  message: string;
}

function readMisconceptions(raw: unknown): ConceptLearnMisconception[] {
  return toArray(raw).map((entry) => {
    const row = toRecord(entry);
    return {
      misconceptionTag: readString(row.misconception_tag),
      title: readString(row.title),
      body: row.body == null ? null : readString(row.body),
      mediaUrl: row.media_url == null ? null : readString(row.media_url),
      format: row.format == null ? null : readString(row.format),
      servedAt: row.served_at == null ? null : readString(row.served_at),
    };
  });
}

const EMPTY_RESOURCES: LearnResources = {
  sections: [],
  totals: { items: 0, conceptScoped: 0, chapterScoped: 0 },
  excluded: { teacherMaterial: 0, unresolvable: 0, unclassified: 0 },
  notes: [],
};

function readResources(raw: unknown): LearnResources {
  const data = toRecord(raw);

  if (Object.keys(data).length === 0) {
    return EMPTY_RESOURCES;
  }

  const totals = toRecord(data.totals);
  const excluded = toRecord(data.excluded);

  return {
    sections: toArray(data.sections).map((entry) => {
      const section = toRecord(entry);
      return {
        key: readString(section.key),
        label: readString(section.label),
        count: readNumber(section.count),
        scope: readString(section.scope),
        items: toArray(section.items).map((rawItem) => {
          const item = toRecord(rawItem);
          const tags = toRecord(item.tags);
          return {
            id: readString(item.id),
            sourceTable: readString(item.source_table),
            section: readString(item.section),
            // Anything not explicitly 'concept' is treated as chapter-wide:
            // over-claiming precision is the one error worth guarding against.
            scope: readString(item.scope) === 'concept' ? 'concept' : 'chapter',
            title: readString(item.title),
            description: item.description == null ? null : readString(item.description),
            url: item.url == null ? null : readString(item.url),
            fileType: item.file_type == null ? null : readString(item.file_type),
            category: readString(item.category),
            h5pType: item.h5p_type == null ? null : readString(item.h5p_type),
            provider: item.provider == null ? null : readString(item.provider),
            attribution: item.attribution == null ? null : readString(item.attribution),
            thumbnailUrl: item.thumbnail_url == null ? null : readString(item.thumbnail_url),
            durationSeconds: item.duration_seconds == null ? null : readNumber(item.duration_seconds),
            tags: {
              ...(tags.difficulty == null ? {} : { difficulty: readString(tags.difficulty) }),
              ...(Array.isArray(tags.meta_tags)
                ? { metaTags: tags.meta_tags.map((t) => readString(t)).filter(Boolean) }
                : {}),
              ...(tags.chapter_id == null ? {} : { chapterId: readNumber(tags.chapter_id) }),
              ...(tags.subject_id == null ? {} : { subjectId: readNumber(tags.subject_id) }),
              ...(tags.standard_id == null ? {} : { standardId: readNumber(tags.standard_id) }),
              ...(tags.concept_id == null ? {} : { conceptId: readNumber(tags.concept_id) }),
              ...(tags.topic_id == null ? {} : { topicId: readNumber(tags.topic_id) }),
              ...(tags.bloom_level == null ? {} : { bloomLevel: readString(tags.bloom_level) }),
              ...(tags.pedagogy_tag == null ? {} : { pedagogyTag: readString(tags.pedagogy_tag) }),
              ...(tags.file_size == null ? {} : { fileSize: readString(tags.file_size) }),
              ...(tags.match_score == null ? {} : { matchScore: readNumber(tags.match_score) }),
              ...(tags.source == null ? {} : { source: readString(tags.source) }),
            },
          };
        }),
      };
    }),
    totals: {
      items: readNumber(totals.items),
      conceptScoped: readNumber(totals.concept_scoped),
      chapterScoped: readNumber(totals.chapter_scoped),
    },
    excluded: {
      teacherMaterial: readNumber(excluded.teacher_material),
      unresolvable: readNumber(excluded.unresolvable),
      unclassified: readNumber(excluded.unclassified),
    },
    notes: toArray(data.notes).map((n) => readString(n)).filter(Boolean),
  };
}

/**
 * Tell the engine the lesson has been read.
 *
 * Until this lands, `taught_at` is null and the engine's next resolve serves
 * `teach` again - which put a second lesson screen between the Learn page and
 * practice, showing one video the learner had just worked through.
 *
 * The result is NOT a routing instruction. `acknowledgedAction` is the action
 * this call served (normally 'teach', because serving teach is what stamps the
 * timestamp). The caller navigates to the engine screen and lets it resolve
 * afresh - by then the answer is 'practice', and D0's diagnostic diversion and
 * D2's prerequisite gate still work, which hardcoding "go to practice" would
 * have quietly overridden.
 */
export async function acknowledgeConceptLearn(
  conceptId: string | number,
  signal?: AbortSignal
): Promise<{ taught: boolean; reason: string | null }> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/learn/concept/${conceptId}/read?${params(ctx).toString()}`,
    { method: 'POST', headers: headers(ctx), signal }
  );
  const payload = await readJson(response, 'record that you have read the lesson');

  return {
    taught: payload.taught === true,
    reason: payload.reason == null ? null : readString(payload.reason),
  };
}

export async function fetchConceptLearn(
  conceptId: string | number,
  signal?: AbortSignal
): Promise<ConceptLearn> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/learn/concept/${conceptId}?${params(ctx).toString()}`,
    { headers: headers(ctx), signal }
  );
  const payload = await readJson(response, 'load the lesson');
  const raw = toRecord(payload.content);
  const hasContent = Object.keys(raw).length > 0;

  return {
    status: readNumber(payload.status),
    conceptId: readNumber(payload.concept_id),
    conceptName: readString(payload.concept_name),
    chapterId: readNumber(payload.chapter_id),
    nodeId: payload.node_id == null ? null : readNumber(payload.node_id),
    nodeType: payload.node_type == null ? null : readString(payload.node_type),
    attempt: readNumber(payload.attempt),
    content: hasContent
      ? {
          variant: readNumber(raw.variant),
          format: readString(raw.format),
          formatLabel: readString(raw.format_label) || readString(raw.format),
          title: raw.title == null ? null : readString(raw.title),
          body: raw.body == null ? null : readString(raw.body),
          mediaUrl: raw.media_url == null ? null : readString(raw.media_url),
          provider: raw.provider == null ? null : readString(raw.provider),
          attribution: raw.attribution == null ? null : readString(raw.attribution),
        }
      : null,
    resources: readResources(payload.resources),
    misconceptions: readMisconceptions(payload.misconceptions),
    reason: payload.reason == null ? null : readString(payload.reason),
    message: readString(payload.message),
  };
}
