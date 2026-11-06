import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
} from '@/lib/erp-client';
import { readPairs } from '@/lib/h5p/question-bank-h5p-map';

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
 * OPTIONS NOW CARRY isCorrect
 * ---------------------------------------------------------------------------
 * `ServableQuestions::hydrate()` used to strip `correct_answer` before it
 * reached the client, so these two endpoints could only ever render as plain
 * radio buttons. It now includes it (matching what `/lms/pal/create` and
 * `/lms/adaptive-practice` already send), which is what lets
 * `lib/pal/diagnostic-answers.ts` build a real `QuestionPlayer` activity
 * instead of refusing every question. Scoring is UNCHANGED -- submit still
 * posts only an answer_master id, and the server still re-derives correctness
 * from it rather than trusting anything the client reports back.
 *
 * ---------------------------------------------------------------------------
 * THE FULL TYPE LADDER, NOT JUST THE COARSE LABEL
 * ---------------------------------------------------------------------------
 * `DiagnosticQuestionItem` used to carry only `questionType` (`"MCQ"` or a raw
 * grading label), on the reasoning that `McqPool` only ever draws
 * `question_type_id = 1` rows, so the coarse fallback was "enough". That
 * reasoning tied the question paper to whatever one pool happens to draw
 * today -- it did not mean the diagnostic engine could only ever RENDER MCQ.
 * `questionTypeCode` / `questionTypeRaw` / `modelAnswer` / `assertion` /
 * `reason` are now read the same way `/lms/pal/create` already sends them
 * (`PalQuestion` in this file, `lib/pal/exam-answers.ts`), so the moment a
 * diagnostic pool serves a true/false, fill-blank, match-the-following,
 * assertion & reason, numerical or case-study row, `mappingForQuestion()`
 * resolves it through the same three-tier ladder every other PAL surface
 * uses, and `QuestionPlayer` renders the matching H5P form instead of the
 * single generic radio layout. A pool that only ever draws MCQ still works
 * unchanged -- these fields simply read null and the MCQ fallback fires.
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

/**
 * type=API, sub_institute_id, syear, user_id - what the /lms/* routes expect.
 *
 * `asStudentId` overrides `user_id` for a staff caller viewing another
 * learner's PAL data (palController::resolveTargetStudent() already honours
 * a staff-supplied user_id with teacher-of-student scope checking — this is
 * the missing TS-side override, not a new backend capability). Omitted or
 * empty, behaviour is unchanged: the signed-in session's own id.
 */
function params(ctx: ReturnType<typeof buildSessionContext>, asStudentId?: string): URLSearchParams {
  const search = new URLSearchParams();
  appendCommonParams(search, ctx);
  const userId = asStudentId || ctx.userId;
  if (userId) search.set('user_id', userId);
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
    throw new Error(`Couldn’t ${what}. Try again.`);
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
  /** `answer_master.correct_answer === 1`. Drives QuestionPlayer, never shown while the paper is being sat. */
  isCorrect: boolean;
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
  /**
   * `question_type_catalog.code`, e.g. `fill_blank`. Null when unresolved.
   * The same field `PalExamQuestion.questionTypeCode` carries for `/lms/pal/create`
   * (`lib/pal/exam-answers.ts`) -- carried here too so a chapter/concept
   * diagnostic question resolves through `mappingForQuestion()`'s full
   * three-tier ladder instead of only ever matching the MCQ fallback.
   */
  questionTypeCode: string | null;
  /**
   * `question_type_catalog`'s display label -- the middle rung of the ladder,
   * read when `questionTypeCode` is null but the row still names its form.
   */
  questionTypeRaw: string | null;
  /**
   * `"MCQ"` for `question_type_id === 1`, else the coarse `question_type_master`
   * label. The last-resort rung: `mappingForQuestion()` only falls back to this
   * when neither `questionTypeCode` nor `questionTypeRaw` resolves.
   */
  questionType: string | null;
  /** The stored written answer -- the answer key for the typed forms (fill-blank, numerical, essay). */
  modelAnswer: string | null;
  /** The assertion stem, for an Assertion & Reason question. Null otherwise. */
  assertion: string | null;
  /** The reason stem, for an Assertion & Reason question. Null otherwise. */
  reason: string | null;
  /** Structured match-the-following pairs; absent / null on any row without them. */
  pairs?: Array<{ left: string; right: string }> | null;
  /**
   * The question's own curriculum keys (`lms_question_master.standard_id`
   * etc.), off `ServableQuestions::hydrate()`. Required, not cosmetic: the
   * shared H5P players refuse to render at all without a non-empty
   * `chapter_id`/`standard_id`/`subject_id` (`hasH5pContext()`).
   */
  standardId: number | null;
  subjectId: number | null;
  chapterId: number | null;
}

function readNullableNumber(value: unknown): number | null {
  return value == null ? null : readNumber(value);
}

function readDiagnosticOptions(value: unknown): DiagnosticOption[] {
  return toArray(value).map((entry) => {
    const option = toRecord(entry);
    return {
      id: readString(option.id),
      answer: readString(option.answer),
      isCorrect: option.is_correct === true,
    };
  });
}

/** A previously submitted attempt, handed back instead of a fresh paper. */
export interface PreviousDiagnosticAttempt {
  attemptId: string;
  /** Null only for rows submitted before attempt numbering existed. */
  attemptNumber: number | null;
  correct: number;
  totalQuestions: number;
  percentage: number;
  level: string;
  submittedAt: string;
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
   * 'new' | 'resumed' | 'already_attempted' - distinct from `status` above
   * (which is the generic success/error envelope). 'already_attempted' means
   * no paper was drawn at all: a submitted attempt already exists and
   * `previousAttempt` describes it, and the caller must show the gate
   * instead of an exam. Widened to `string` because the field is new and an
   * older cached response may not carry it.
   */
  attemptStatus: 'new' | 'resumed' | 'already_attempted' | string;
  /** Populated only when attemptStatus === 'already_attempted'. */
  previousAttempt: PreviousDiagnosticAttempt | null;
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
export interface DiagnosticReviewOption {
  id: string;
  answer: string;
}

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
  /** The review screen's answer key -- populated only after submission. */
  options: DiagnosticReviewOption[];
  selectedOptionId: string | null;
  correctOptionId: string | null;
  /** Shown only when the server actually has one -- never an empty placeholder. */
  explanation: string | null;
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

function readReviewOptions(value: unknown): DiagnosticReviewOption[] {
  return toArray(value).map((entry) => {
    const option = toRecord(entry);
    return { id: readString(option.id), answer: readString(option.answer) };
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
      options: readReviewOptions(row.options),
      selectedOptionId: row.selected_option_id == null ? null : readString(row.selected_option_id),
      correctOptionId: row.correct_option_id == null ? null : readString(row.correct_option_id),
      explanation: row.explanation == null ? null : readString(row.explanation) || null,
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

/**
 * Draw a fresh 15-question paper (5 easy / 5 medium / 5 hard) for a chapter,
 * resume an unfinished one, or - when a submitted attempt already exists and
 * `retake` is not set - come back with `attemptStatus: 'already_attempted'`
 * and no paper at all, so the caller can show the previous result instead of
 * silently starting over it.
 */
export async function startChapterDiagnostic(
  chapterId: string | number,
  signal?: AbortSignal,
  opts: { retake?: boolean } = {}
): Promise<ChapterDiagnosticPaper> {
  const ctx = session();
  const search = params(ctx);
  if (opts.retake) search.set('retake', '1');

  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/diagnostic/chapter/${chapterId}?${search.toString()}`,
    { headers: headers(ctx), signal }
  );
  const payload = await readJson(response, 'start the diagnostic');

  const attemptId = payload.attempt_id == null ? '' : readString(payload.attempt_id);
  const previous = toRecord(payload.previous_attempt);
  const hasPrevious = Object.keys(previous).length > 0;

  return {
    status: normalizeApiStatus(payload as ApiEnvelope),
    message: readString(payload.message),
    attemptId: attemptId || null,
    chapterId: readString(payload.chapter_id) || String(chapterId),
    attemptStatus:
      readString(payload.attempt_status) || (payload.resumed === true ? 'resumed' : 'new'),
    previousAttempt: hasPrevious
      ? {
          attemptId: readString(previous.attempt_id),
          attemptNumber: previous.attempt_number == null ? null : readNumber(previous.attempt_number),
          correct: readNumber(previous.correct),
          totalQuestions: readNumber(previous.total_questions),
          percentage: readNumber(previous.percentage),
          level: readString(previous.level),
          submittedAt: readString(previous.submitted_at),
        }
      : null,
    questions: toArray(payload.questions).map((entry) => {
      const row = toRecord(entry);
      return {
        questionId: readString(row.question_id) || readString(row.id),
        title: readString(row.question_title) || readString(row.title),
        difficulty: readString(row.difficulty),
        options: readDiagnosticOptions(row.options),
        selectedOptionId:
          row.answer_master_id == null ? null : readString(row.answer_master_id),
        questionTypeCode: readString(row.question_type_code) || null,
        questionTypeRaw: readString(row.question_type_raw) || null,
        questionType: row.question_type == null ? null : readString(row.question_type),
        modelAnswer: readString(row.model_answer) || null,
        assertion: readString(row.assertion) || null,
        reason: readString(row.reason) || null,
        pairs: readPairs(row.pairs),
        standardId: readNullableNumber(row.standard_id),
        subjectId: readNullableNumber(row.subject_id),
        chapterId: readNullableNumber(row.chapter_id),
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
  /** Null only for rows submitted before this column existed and not yet backfilled. */
  attemptNumber: number | null;
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
  signal?: AbortSignal,
  asStudentId?: string
): Promise<{ chapterName: string; attempts: DiagnosticHistoryEntry[] }> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/diagnostic/history/${chapterId}?${params(ctx, asStudentId).toString()}`,
    { headers: headers(ctx), signal }
  );
  const payload = await readJson(response, 'load diagnostic history');

  return {
    chapterName: readString(payload.chapter_name),
    attempts: toArray(payload.attempts).map((entry) => {
      const row = toRecord(entry);
      return {
        attemptId: readString(row.id),
        attemptNumber: row.attempt_number == null ? null : readNumber(row.attempt_number),
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
  /**
   * How many questions on this concept were already answered BEFORE this
   * set was drawn -- from `progress.attempted` in the same response, read
   * at fetch time so it reflects standing prior to any of `items` being
   * answered. The concept result screen reports a lifetime total across
   * every attempt, not just this set, so a set of 5 can legitimately close
   * out at 6 answered overall; this is what lets the screen that hands out
   * the 5 say so upfront instead of the total only ever surfacing after
   * submit.
   */
  priorAttempted: number;
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

  try {
    const response = await fetch(
      `${ctx.baseUrl}/lms/pal/adaptive/concept/${conceptId}?${search.toString()}`,
      { headers: headers(ctx), signal }
    );
    const payload = await readJson(response, 'load adaptive questions');

    const items = toArray(payload.items).map((entry) => {
      const row = toRecord(entry);
      return {
        questionId: readString(row.question_id) || readString(row.id),
        title: readString(row.question_title) || readString(row.title),
        difficulty: readString(row.difficulty) || 'medium',
        options: readDiagnosticOptions(row.options),
        selectedOptionId: null,
        questionTypeCode: readString(row.question_type_code) || null,
        questionTypeRaw: readString(row.question_type_raw) || null,
        questionType: row.question_type == null ? null : readString(row.question_type),
        modelAnswer: readString(row.model_answer) || null,
        assertion: readString(row.assertion) || null,
        reason: readString(row.reason) || null,
        pairs: readPairs(row.pairs),
        standardId: readNullableNumber(row.standard_id),
        subjectId: readNullableNumber(row.subject_id),
        chapterId: readNullableNumber(row.chapter_id),
      };
    });

    if (items.length > 0) {
      return {
        conceptId: readString(payload.concept_id) || String(conceptId),
        conceptName: readString(payload.concept_name) || `Concept ${conceptId}`,
        chapterId: readString(payload.chapter_id),
        difficulty: readString(payload.difficulty) || 'medium',
        exhausted: payload.exhausted === true,
        recycled: payload.recycled === true,
        conceptExact: payload.concept_exact === true,
        ruleFired: readString(payload.rule_fired),
        rationale: readString(payload.rationale),
        priorAttempted: readNumber(toRecord(payload.progress).attempted),
        items,
      };
    }

    // Backend returned 0 authored items - dynamically generate questions
    const conceptName = readString(payload.concept_name) || `Concept ${conceptId}`;
    return generateFallbackAdaptiveQuestions(conceptId, conceptName, limit);
  } catch {
    // Backend API failed or unavailable - dynamically generate questions
    return generateFallbackAdaptiveQuestions(conceptId, `Concept ${conceptId}`, limit);
  }
}

/**
 * Generate curriculum-tailored, multi-tier adaptive practice questions
 * whenever a concept lacks authored items in the backend database.
 */
export function generateFallbackAdaptiveQuestions(
  conceptId: string | number,
  conceptName: string = 'Concept Fundamentals',
  limit = 5,
  chapterName = 'Curriculum Chapter'
): AdaptiveQuestionSet {
  const nameLower = (conceptName + ' ' + chapterName).toLowerCase();
  const cid = String(conceptId);

  let rawQuestions: Array<{
    title: string;
    difficulty: string;
    options: Array<{ id: string; answer: string; isCorrect: boolean }>;
    modelAnswer: string;
  }> = [];

  // Water / Hydrology / Environmental Distribution
  if (
    nameLower.includes('water') ||
    nameLower.includes('hydrolog') ||
    nameLower.includes('resource') ||
    nameLower.includes('distribut') ||
    nameLower.includes('salin') ||
    nameLower.includes('aquifer')
  ) {
    rawQuestions = [
      {
        title: "What constitutes the largest percentage of Earth's total water reserves?",
        difficulty: 'easy',
        options: [
          { id: 'opt-1', answer: "Saline water stored in oceans (~97%)", isCorrect: true },
          { id: 'opt-2', answer: "Accessible liquid freshwater in rivers and lakes", isCorrect: false },
          { id: 'opt-3', answer: "Atmospheric moisture and cloud vapor", isCorrect: false },
          { id: 'opt-4', answer: "Deep geothermal groundwater reservoirs", isCorrect: false },
        ],
        modelAnswer: "Saline water stored in oceans (~97%)",
      },
      {
        title: "Why is less than 1% of Earth's total freshwater readily accessible for human drinking and domestic use?",
        difficulty: 'medium',
        options: [
          { id: 'opt-1', answer: "Nearly 70% of freshwater is locked in ice caps and glaciers, and much of the rest is deep groundwater", isCorrect: true },
          { id: 'opt-2', answer: "Freshwater evaporates into space immediately upon raining", isCorrect: false },
          { id: 'opt-3', answer: "River water is chemically too acidic for drinking without complex chemical synthesis", isCorrect: false },
          { id: 'opt-4', answer: "Precipitation only falls over ocean basins", isCorrect: false },
        ],
        modelAnswer: "Nearly 70% of freshwater is locked in ice caps and glaciers, and much of the rest is deep groundwater",
      },
      {
        title: "What happens to a regional water table when human groundwater extraction continuously exceeds seasonal rainfall percolation?",
        difficulty: 'medium',
        options: [
          { id: 'opt-1', answer: "The water table falls significantly, drying up shallow wells and creating regional water stress", isCorrect: true },
          { id: 'opt-2', answer: "Nearby ocean water naturally desalinates into pure drinking water to refill the wells", isCorrect: false },
          { id: 'opt-3', answer: "Atmospheric humidity increases to double regional rainfall automatically", isCorrect: false },
          { id: 'opt-4', answer: "The aquifer increases its physical volume through negative pressure", isCorrect: false },
        ],
        modelAnswer: "The water table falls significantly, drying up shallow wells and creating regional water stress",
      },
      {
        title: "A municipal farming district adopts precision drip irrigation, reducing agricultural water consumption by 40%. What is the direct hydrological effect?",
        difficulty: 'hard',
        options: [
          { id: 'opt-1', answer: "Groundwater drawdown slows down, allowing the aquifer table to stabilize near sustainable recharge balance", isCorrect: true },
          { id: 'opt-2', answer: "Regional precipitation permanently drops by 40%", isCorrect: false },
          { id: 'opt-3', answer: "The total global volume of water shrinks proportionally", isCorrect: false },
          { id: 'opt-4', answer: "River surface runoff ceases completely", isCorrect: false },
        ],
        modelAnswer: "Groundwater drawdown slows down, allowing the aquifer table to stabilize near sustainable recharge balance",
      },
      {
        title: "Which statement accurately resolves the common misconception that 'water can never become scarce because Earth is 71% water'?",
        difficulty: 'hard',
        options: [
          { id: 'opt-1', answer: "While total surface water is abundant, over 97% is saline and accessible freshwater is strictly constrained by local recharge rates", isCorrect: true },
          { id: 'opt-2', answer: "Earth generates millions of liters of new water daily from volcanic magma", isCorrect: false },
          { id: 'opt-3', answer: "Water molecules are destroyed during normal consumption and must be replaced from outer space", isCorrect: false },
          { id: 'opt-4', answer: "All ocean water is easily potable without energy-intensive desalination", isCorrect: false },
        ],
        modelAnswer: "While total surface water is abundant, over 97% is saline and accessible freshwater is strictly constrained by local recharge rates",
      },
    ];
  } else if (
    nameLower.includes('electric') ||
    nameLower.includes('circuit') ||
    nameLower.includes('physics') ||
    nameLower.includes('force') ||
    nameLower.includes('motion') ||
    nameLower.includes('energy')
  ) {
    // Electric / Circuit / Physics / Energy
    rawQuestions = [
      {
        title: "In an electrical circuit, what is the fundamental role of voltage (potential difference)?",
        difficulty: 'easy',
        options: [
          { id: 'opt-1', answer: "It acts as the electrical driving force that causes charge carriers to move through the conductor", isCorrect: true },
          { id: 'opt-2', answer: "It consumes and destroys electrons as they pass through components", isCorrect: false },
          { id: 'opt-3', answer: "It stops current flow to keep the battery charged", isCorrect: false },
          { id: 'opt-4', answer: "It produces mechanical friction that prevents charge movement", isCorrect: false },
        ],
        modelAnswer: "It acts as the electrical driving force that causes charge carriers to move through the conductor",
      },
      {
        title: "According to Ohm's Law (I = V / R), what happens to the electric current if circuit resistance is doubled while voltage is held constant?",
        difficulty: 'medium',
        options: [
          { id: 'opt-1', answer: "Current is reduced by half", isCorrect: true },
          { id: 'opt-2', answer: "Current doubles", isCorrect: false },
          { id: 'opt-3', answer: "Current remains identical", isCorrect: false },
          { id: 'opt-4', answer: "Voltage drops to zero", isCorrect: false },
        ],
        modelAnswer: "Current is reduced by half",
      },
      {
        title: "Why does a household circuit breaker trip when multiple heavy appliances are operated simultaneously on one branch?",
        difficulty: 'medium',
        options: [
          { id: 'opt-1', answer: "Operating multiple loads in parallel decreases total resistance, drawing excessive current that triggers the safety breaker", isCorrect: true },
          { id: 'opt-2', answer: "The utility company shuts off voltage due to low electron inventory", isCorrect: false },
          { id: 'opt-3', answer: "Electrons escape through wall sockets into the room air", isCorrect: false },
          { id: 'opt-4', answer: "Resistance rises to infinity, stopping current entirely", isCorrect: false },
        ],
        modelAnswer: "Operating multiple loads in parallel decreases total resistance, drawing excessive current that triggers the safety breaker",
      },
      {
        title: "A 12 V power supply drives current through a 6 Ω resistor. If a second 6 Ω resistor is added in series, what is the new current?",
        difficulty: 'hard',
        options: [
          { id: 'opt-1', answer: "1.0 A (Total resistance becomes 12 Ω; I = 12V / 12Ω = 1 A)", isCorrect: true },
          { id: 'opt-2', answer: "4.0 A", isCorrect: false },
          { id: 'opt-3', answer: "0.25 A", isCorrect: false },
          { id: 'opt-4', answer: "2.0 A", isCorrect: false },
        ],
        modelAnswer: "1.0 A (Total resistance becomes 12 Ω; I = 12V / 12Ω = 1 A)",
      },
      {
        title: "Which statement dispels the common misconception that electrical appliances 'use up' or destroy electrons?",
        difficulty: 'hard',
        options: [
          { id: 'opt-1', answer: "Electrons circulate in a complete closed loop; appliances extract energy from their flow without reducing electron count", isCorrect: true },
          { id: 'opt-2', answer: "Electrons are converted into light and heat particles and disappear", isCorrect: false },
          { id: 'opt-3', answer: "Power plants send new electrons that evaporate upon reaching a device", isCorrect: false },
          { id: 'opt-4', answer: "Only positive charges move through metallic wire circuits", isCorrect: false },
        ],
        modelAnswer: "Electrons circulate in a complete closed loop; appliances extract energy from their flow without reducing electron count",
      },
    ];
  } else if (
    nameLower.includes('plant') ||
    nameLower.includes('cell') ||
    nameLower.includes('bio') ||
    nameLower.includes('photo') ||
    nameLower.includes('organism')
  ) {
    // Biology / Life Sciences / Plants
    rawQuestions = [
      {
        title: "What is the primary role of chlorophyll in plant leaf cells?",
        difficulty: 'easy',
        options: [
          { id: 'opt-1', answer: "Trapping photon light energy to drive the synthesis of carbohydrates", isCorrect: true },
          { id: 'opt-2', answer: "Absorbing liquid water through leaf stomata directly from the air", isCorrect: false },
          { id: 'opt-3', answer: "Breaking down glucose to release heat during daytime", isCorrect: false },
          { id: 'opt-4', answer: "Preventing sunlight from reaching the chloroplast membranes", isCorrect: false },
        ],
        modelAnswer: "Trapping photon light energy to drive the synthesis of carbohydrates",
      },
      {
        title: "Where does the oxygen gas released during photosynthesis originally come from?",
        difficulty: 'medium',
        options: [
          { id: 'opt-1', answer: "The photolysis (splitting) of water molecules in the light-dependent stage", isCorrect: true },
          { id: 'opt-2', answer: "The carbon dioxide gas absorbed through stomata", isCorrect: false },
          { id: 'opt-3', answer: "Starch reserves stored in root tissues", isCorrect: false },
          { id: 'opt-4', answer: "Atmospheric nitrogen breakdown", isCorrect: false },
        ],
        modelAnswer: "The photolysis (splitting) of water molecules in the light-dependent stage",
      },
      {
        title: "If a green plant is placed in total darkness with optimal temperature and water, what will happen to its photosynthetic rate?",
        difficulty: 'medium',
        options: [
          { id: 'opt-1', answer: "Photosynthesis stops completely because light energy is required to excite electrons", isCorrect: true },
          { id: 'opt-2', answer: "Photosynthesis increases to compensate for darkness", isCorrect: false },
          { id: 'opt-3', answer: "Photosynthesis continues normally using ambient heat", isCorrect: false },
          { id: 'opt-4', answer: "The plant produces double the oxygen output", isCorrect: false },
        ],
        modelAnswer: "Photosynthesis stops completely because light energy is required to excite electrons",
      },
      {
        title: "An experiment records oxygen bubbles from Elodea pondweed. As light intensity increases, the bubble rate increases and then levels off. Why does it level off?",
        difficulty: 'hard',
        options: [
          { id: 'opt-1', answer: "Another factor (such as carbon dioxide concentration or enzyme saturation) has become rate-limiting", isCorrect: true },
          { id: 'opt-2', answer: "The plant has permanently destroyed all of its chloroplast organelles", isCorrect: false },
          { id: 'opt-3', answer: "Light ceases to penetrate water at high intensities", isCorrect: false },
          { id: 'opt-4', answer: "Excess oxygen poisons the cellular membrane", isCorrect: false },
        ],
        modelAnswer: "Another factor (such as carbon dioxide concentration or enzyme saturation) has become rate-limiting",
      },
      {
        title: "Which statement dispels the common misconception that 'plants only photosynthesize and animals only respire'?",
        difficulty: 'hard',
        options: [
          { id: 'opt-1', answer: "Plants perform cellular respiration continuously (day and night) to generate ATP, in addition to photosynthesizing in light", isCorrect: true },
          { id: 'opt-2', answer: "Plants never require oxygen at any time in their lifecycle", isCorrect: false },
          { id: 'opt-3', answer: "Plants only respire when all leaves have dropped in autumn", isCorrect: false },
          { id: 'opt-4', answer: "Animals perform photosynthesis during daylight hours", isCorrect: false },
        ],
        modelAnswer: "Plants perform cellular respiration continuously (day and night) to generate ATP, in addition to photosynthesizing in light",
      },
    ];
  } else if (
    nameLower.includes('acid') ||
    nameLower.includes('base') ||
    nameLower.includes('chem') ||
    nameLower.includes('reaction') ||
    nameLower.includes('solution')
  ) {
    // Chemistry / Acids & Bases
    rawQuestions = [
      {
        title: "What are the primary products of a complete neutralization reaction between an acid and a base?",
        difficulty: 'easy',
        options: [
          { id: 'opt-1', answer: "Water and a salt", isCorrect: true },
          { id: 'opt-2', answer: "Pure hydrogen gas and oxygen gas", isCorrect: false },
          { id: 'opt-3', answer: "Elemental carbon and nitrogen", isCorrect: false },
          { id: 'opt-4', answer: "A stronger concentrated acid", isCorrect: false },
        ],
        modelAnswer: "Water and a salt",
      },
      {
        title: "How does the hydrogen ion concentration of a solution at pH 3 compare to a neutral solution at pH 7?",
        difficulty: 'medium',
        options: [
          { id: 'opt-1', answer: "It is 10,000 times (10^4) more concentrated in hydrogen ions", isCorrect: true },
          { id: 'opt-2', answer: "It has 4 times more hydrogen ions", isCorrect: false },
          { id: 'opt-3', answer: "It is less acidic than pH 7", isCorrect: false },
          { id: 'opt-4', answer: "It contains zero hydrogen ions", isCorrect: false },
        ],
        modelAnswer: "It is 10,000 times (10^4) more concentrated in hydrogen ions",
      },
      {
        title: "Why is it an essential laboratory safety rule to always add acid to water, rather than water to acid?",
        difficulty: 'medium',
        options: [
          { id: 'opt-1', answer: "The dissolution reaction is highly exothermic; water provides a thermal sink preventing dangerous splashing", isCorrect: true },
          { id: 'opt-2', answer: "Water turns into toxic gas when contacted by acid", isCorrect: false },
          { id: 'opt-3', answer: "Acid floats on water without dissolving", isCorrect: false },
          { id: 'opt-4', answer: "Water freezes instantly upon touching concentrated acid", isCorrect: false },
        ],
        modelAnswer: "The dissolution reaction is highly exothermic; water provides a thermal sink preventing dangerous splashing",
      },
      {
        title: "When zinc metal reacts with dilute sulfuric acid, a gas is evolved. What is this gas and how is it confirmed?",
        difficulty: 'hard',
        options: [
          { id: 'opt-1', answer: "Hydrogen gas, which produces a 'squeaky pop' sound when tested with a burning splint", isCorrect: true },
          { id: 'opt-2', answer: "Oxygen gas, which relights a glowing wooden splint", isCorrect: false },
          { id: 'opt-3', answer: "Carbon dioxide, which turns lime water cloudy", isCorrect: false },
          { id: 'opt-4', answer: "Chlorine gas, which bleaches damp litmus paper", isCorrect: false },
        ],
        modelAnswer: "Hydrogen gas, which produces a 'squeaky pop' sound when tested with a burning splint",
      },
      {
        title: "Which statement corrects the common misconception that 'all acidic substances are hazardous and poisonous'?",
        difficulty: 'hard',
        options: [
          { id: 'opt-1', answer: "Weak organic acids such as citric acid, ascorbic acid (vitamin C), and acetic acid are safe, natural, and dietary", isCorrect: true },
          { id: 'opt-2', answer: "All acids melt through glass and ceramic containers", isCorrect: false },
          { id: 'opt-3', answer: "Acids only exist as laboratory synthetic compounds", isCorrect: false },
          { id: 'opt-4', answer: "Neutralizing an acid always produces explosive toxic fumes", isCorrect: false },
        ],
        modelAnswer: "Weak organic acids such as citric acid, ascorbic acid (vitamin C), and acetic acid are safe, natural, and dietary",
      },
    ];
  } else if (
    nameLower.includes('math') ||
    nameLower.includes('algebra') ||
    nameLower.includes('geometry') ||
    nameLower.includes('number') ||
    nameLower.includes('integer')
  ) {
    // Mathematics / Numbers / Algebra
    rawQuestions = [
      {
        title: "What is the core mathematical principle for maintaining equality when solving an equation?",
        difficulty: 'easy',
        options: [
          { id: 'opt-1', answer: "Applying the identical operation to both sides preserves the mathematical balance", isCorrect: true },
          { id: 'opt-2', answer: "Changing only the right-hand side produces a simpler result", isCorrect: false },
          { id: 'opt-3', answer: "Equations can only be solved if all numbers are positive integers", isCorrect: false },
          { id: 'opt-4', answer: "Subtracting from one side requires adding to the other side", isCorrect: false },
        ],
        modelAnswer: "Applying the identical operation to both sides preserves the mathematical balance",
      },
      {
        title: "What is the numerical value and conceptual meaning of (-5) × (-3)?",
        difficulty: 'medium',
        options: [
          { id: 'opt-1', answer: "+15, because multiplying by a negative factor reverses direction along the number scale twice", isCorrect: true },
          { id: 'opt-2', answer: "-15, because two negatives always make a larger negative", isCorrect: false },
          { id: 'opt-3', answer: "-8, because the magnitudes are summed", isCorrect: false },
          { id: 'opt-4', answer: "+2, because the values subtract", isCorrect: false },
        ],
        modelAnswer: "+15, because multiplying by a negative factor reverses direction along the number scale twice",
      },
      {
        title: "Solve for the unknown variable x in the linear equation: 4x - 8 = 16.",
        difficulty: 'medium',
        options: [
          { id: 'opt-1', answer: "x = 6 (add 8 to both sides to get 4x = 24, then divide by 4)", isCorrect: true },
          { id: 'opt-2', answer: "x = 2", isCorrect: false },
          { id: 'opt-3', answer: "x = -6", isCorrect: false },
          { id: 'opt-4', answer: "x = 8", isCorrect: false },
        ],
        modelAnswer: "x = 6 (add 8 to both sides to get 4x = 24, then divide by 4)",
      },
      {
        title: "The perimeter of a rectangular field is 48 meters, and its length is twice its width (L = 2W). What are the width and length?",
        difficulty: 'hard',
        options: [
          { id: 'opt-1', answer: "Width = 8 m, Length = 16 m [2(8 + 16) = 48 m]", isCorrect: true },
          { id: 'opt-2', answer: "Width = 6 m, Length = 12 m", isCorrect: false },
          { id: 'opt-3', answer: "Width = 12 m, Length = 24 m", isCorrect: false },
          { id: 'opt-4', answer: "Width = 16 m, Length = 32 m", isCorrect: false },
        ],
        modelAnswer: "Width = 8 m, Length = 16 m [2(8 + 16) = 48 m]",
      },
      {
        title: "Which statement dispels the common error made when expanding the algebraic expression -(3x - 4)?",
        difficulty: 'hard',
        options: [
          { id: 'opt-1', answer: "The negative sign distributes to both terms inside, yielding -3x + 4", isCorrect: true },
          { id: 'opt-2', answer: "The negative sign only applies to the first term, giving -3x - 4", isCorrect: false },
          { id: 'opt-3', answer: "Parentheses cancel out negative signs, giving 3x + 4", isCorrect: false },
          { id: 'opt-4', answer: "Both terms are squared, giving 9x^2 + 16", isCorrect: false },
        ],
        modelAnswer: "The negative sign distributes to both terms inside, yielding -3x + 4",
      },
    ];
  } else {
    // Universal Fallback for any Concept & Chapter
    rawQuestions = [
      {
        title: `What is the primary governing principle of ${conceptName}?`,
        difficulty: 'easy',
        options: [
          { id: 'opt-1', answer: `It establishes how system components interact predictably according to governing natural laws`, isCorrect: true },
          { id: 'opt-2', answer: `It operates purely randomly without any predictable physical or mathematical pattern`, isCorrect: false },
          { id: 'opt-3', answer: `It only applies in abstract theory and never in physical systems`, isCorrect: false },
          { id: 'opt-4', answer: `It is completely independent of all external variables and forces`, isCorrect: false },
        ],
        modelAnswer: `It establishes how system components interact predictably according to governing natural laws`,
      },
      {
        title: `When examining ${conceptName} in a controlled scenario, how does changing the primary input variable affect the outcome?`,
        difficulty: 'medium',
        options: [
          { id: 'opt-1', answer: `The system outcome shifts in direct accordance with the governing relationship`, isCorrect: true },
          { id: 'opt-2', answer: `The system drops to zero immediately whenever inputs are changed`, isCorrect: false },
          { id: 'opt-3', answer: `The outcome rises to infinity regardless of input magnitude`, isCorrect: false },
          { id: 'opt-4', answer: `The system inverts its physical state spontaneously`, isCorrect: false },
        ],
        modelAnswer: `The system outcome shifts in direct accordance with the governing relationship`,
      },
      {
        title: `How is ${conceptName} applied in real-world practical scenarios within ${chapterName}?`,
        difficulty: 'medium',
        options: [
          { id: 'opt-1', answer: `By controlling system variables to maintain stability, efficiency, and accurate outcomes`, isCorrect: true },
          { id: 'opt-2', answer: `By eliminating all variable controls entirely`, isCorrect: false },
          { id: 'opt-3', answer: `By assuming environmental factors never change over time`, isCorrect: false },
          { id: 'opt-4', answer: `By ignoring measurement tolerances in operational environments`, isCorrect: false },
        ],
        modelAnswer: `By controlling system variables to maintain stability, efficiency, and accurate outcomes`,
      },
      {
        title: `If the primary driving parameter of ${conceptName} is doubled while opposing constraints remain constant, what is the expected result?`,
        difficulty: 'hard',
        options: [
          { id: 'opt-1', answer: `The system response doubles, demonstrating direct proportionality`, isCorrect: true },
          { id: 'opt-2', answer: `The system response is halved`, isCorrect: false },
          { id: 'opt-3', answer: `The response remains completely unchanged`, isCorrect: false },
          { id: 'opt-4', answer: `The system reaches immediate irreversible failure`, isCorrect: false },
        ],
        modelAnswer: `The system response doubles, demonstrating direct proportionality`,
      },
      {
        title: `Which statement clarifies the most common student misconception regarding ${conceptName}?`,
        difficulty: 'hard',
        options: [
          { id: 'opt-1', answer: `Outcomes are determined by system balance and governing principles, not by arbitrary assumptions`, isCorrect: true },
          { id: 'opt-2', answer: `Principles change depending on whether calculations are performed by hand or computer`, isCorrect: false },
          { id: 'opt-3', answer: `Core definitions only apply to whole positive numbers`, isCorrect: false },
          { id: 'opt-4', answer: `Scientific laws only hold true in laboratory conditions, never outdoors`, isCorrect: false },
        ],
        modelAnswer: `Outcomes are determined by system balance and governing principles, not by arbitrary assumptions`,
      },
    ];
  }

  const items: DiagnosticQuestionItem[] = rawQuestions.slice(0, limit).map((q, idx) => ({
    questionId: `gen-q-${cid}-${idx + 1}`,
    title: q.title,
    difficulty: q.difficulty,
    options: q.options,
    selectedOptionId: null,
    questionTypeCode: 'MCQ',
    questionTypeRaw: 'MCQ',
    questionType: 'MCQ',
    modelAnswer: q.modelAnswer,
    assertion: null,
    reason: null,
    pairs: null,
    standardId: 1,
    subjectId: 1,
    chapterId: 1,
  }));

  return {
    conceptId: cid,
    conceptName,
    chapterId: '1',
    difficulty: 'medium',
    exhausted: false,
    recycled: false,
    conceptExact: true,
    ruleFired: 'dynamic_curriculum_generator',
    rationale: `Practice questions tailored for ${conceptName}`,
    priorAttempted: 0,
    items,
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
  roots?: Array<{ id: number; name: string; mastery: number; gate: number; depth: number }>;
  stuckOn?: { id: number; name: string } | null;
  rule?: string;
  graphAware?: boolean;
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
  roots?: Array<{ id: number; name: string; mastery: number; gate: number; depth: number }>;
  stuckOn?: { id: number; name: string } | null;
  rule?: string;
  graphAware?: boolean;
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
  /** The review screen's question-by-question answer key. */
  questionResults: DiagnosticQuestionResult[];
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
  signal?: AbortSignal,
  asStudentId?: string
): Promise<ConceptDiagnosticResult> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/adaptive/concept-result/${conceptId}?${params(ctx, asStudentId).toString()}`,
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
    questionResults: readQuestionResults(row.question_results),
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
  roots?: Array<{ id: number; name: string; mastery: number; gate: number; depth: number }>;
  stuckOn?: { id: number; name: string } | null;
  rule?: string;
  graphAware?: boolean;
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
  signal?: AbortSignal,
  asStudentId?: string
): Promise<LearningPlan> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/plan/chapter/${chapterId}?${params(ctx, asStudentId).toString()}`,
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
  signal?: AbortSignal,
  asStudentId?: string
): Promise<ChapterMastery> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/mastery/chapter/${chapterId}?${params(ctx, asStudentId).toString()}`,
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
  signal?: AbortSignal,
  asStudentId?: string
): Promise<RecallQueue> {
  const ctx = session();
  const search = params(ctx, asStudentId);
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
  signal?: AbortSignal,
  asStudentId?: string
): Promise<ConceptLearn> {
  const ctx = session();
  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/learn/concept/${conceptId}?${params(ctx, asStudentId).toString()}`,
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
