'use client';

import { API_BASE_URL } from '@/app/components/utils/api_url';
import { readApiJson, type H5pContext } from './h5p';
import { getRequestContext } from '@/app/course-master/page';
import type { H5pCoursePresentation, H5pMemoryGame, H5pSingleChoiceSet, H5pTrueFalse } from './h5p-content-types';
import type { H5pTextActivity } from './h5p';
import {
  mapQuestionToPlayerPayload,
  type RuntimeActivity,
  type RuntimeEssay,
  type RuntimeFlashcards,
  type RuntimeScope,
} from '@/lib/h5p/question-bank-runtime';
import {
  mappingForQuestion,
  type BankQuestion,
  type H5pTargetKind,
  type TypeMapping,
} from '@/lib/h5p/question-bank-h5p-map';
import type { QuestionBankApiQuestion } from '@/app/course-master/data/chapters';

/**
 * The Question bank library's data layer: read a chapter's questions, and turn
 * one into a playable activity in memory.
 *
 * THERE IS NO CONVERSION HERE ANY MORE. An earlier build of this screen wrote
 * an H5P draft row for every question a teacher wanted to look at, then played
 * the draft. That meant a database write, a controller round trip and a piece
 * of durable state standing between "I want to see this question" and seeing
 * it -- plus a growing estate of drafts nobody asked for. Preview now builds
 * the row in the browser and hands it to the player. **Nothing in this module
 * writes.** Every function below is a GET or a pure transform.
 *
 * WHICH MEANS THE PLAYERS ARE THE PRODUCT. `lib/h5p/question-bank-runtime.ts`
 * produces the exact row shape each player's own controller returns, so the
 * player cannot tell a previewed question from a saved activity. That is what
 * makes this a viewer rather than a second renderer: there is no card, no
 * bespoke question markup and no second scoring path to keep in step.
 */

// ---------------------------------------------------------------------------
// Reading the bank
// ---------------------------------------------------------------------------

export interface LibraryFilters {
  /** `question_type_catalog.code`, or 'all'. */
  typeCode: string;
  /** A stored difficulty value, or 'all'. */
  difficulty: string;
  search: string;
}

export const EMPTY_FILTERS: LibraryFilters = { typeCode: 'all', difficulty: 'all', search: '' };

export interface QuestionPage {
  questions: QuestionBankApiQuestion[];
  /** Rows matching the filters across the whole chapter, not just this page. */
  total: number;
  page: number;
  perPage: number;
  /**
   * True when the server paged the result. False means it returned the whole
   * chapter and this module sliced it -- see `fetchQuestionPage`.
   */
  serverPaged: boolean;
  /**
   * Every row in the chapter, unfiltered, when the server sent them all.
   *
   * The summary needs the whole chapter and the table needs one page of it.
   * While the endpoint returns everything, carrying it here is what keeps that
   * one request instead of two. Null once the server pages, when the summary
   * has to ask for its counts separately.
   */
  all: QuestionBankApiQuestion[] | null;
}

interface PaginationEnvelope {
  total?: number;
  current_page?: number;
  per_page?: number;
  last_page?: number;
}

/**
 * The institute this browser is logged in to, or null.
 *
 * Read without throwing, unlike `requireSession()`: a missing session must
 * leave the screen usable rather than replace it with an error, and the
 * endpoints below are session-exempt.
 */
export function sessionInstituteId(): number | null {
  const id = Number(getRequestContext()?.sub_institute_id ?? NaN);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * ⚠ `/api/lms-question-bank` IS NOT TENANT-SCOPED.
 *
 * `sub_institute_id` is sent on every request below and the endpoint ignores
 * it: chapter 1012 returns 1,211 questions to every caller, while
 * `/api/question-bank/filters` — which IS scoped — reports 123 for institute
 * 1000. Measured on dev.triz.co.in across four chapters; the ratio differs per
 * chapter, so it is not a constant to divide out.
 *
 * The rows carry no `sub_institute_id` either (34 columns, none of them a
 * tenant), so this client CANNOT filter the result down to the institute that
 * owns it. That makes it a backend fix, in `ApiQuestionBankController`, and
 * until it lands this screen shows other institutes' questions alongside the
 * teacher's own. `institutionTotal` on the page carries the scoped count so the
 * discrepancy is stated rather than hidden.
 */
async function postBank(body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const instituteId = sessionInstituteId();

  const res = await fetch(`${API_BASE_URL}/api/lms-question-bank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(instituteId ? { sub_institute_id: instituteId, ...body } : body),
  });

  const raw = await readApiJson(res, 'Failed to load the question bank');
  if (!res.ok || raw.status === false) {
    throw new Error((raw.message as string) || 'Failed to load the question bank');
  }

  return raw;
}

/**
 * Drop rows the bank sent twice.
 *
 * `/api/lms-question-bank` joins across institute mappings without a
 * `DISTINCT`, so a chapter shared by more than one institute can hand back the
 * same question id more than once -- which React then refuses to key a table
 * row on. First occurrence wins.
 */
function dedupeById(rows: QuestionBankApiQuestion[]): QuestionBankApiQuestion[] {
  const seen = new Set<number>();
  return rows.filter((row) => {
    const id = Number(row.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/**
 * One page of a chapter's questions.
 *
 * SERVER-SIDE FIRST, CLIENT-SIDE ONLY AS A FALLBACK. `page`/`per_page` are sent
 * on every request. When the response carries a `pagination` envelope the
 * server did the paging and the rows are returned untouched; when it does not
 * -- which is what `/api/lms-question-bank` does today, returning the whole
 * chapter -- the rows are filtered and sliced here and `serverPaged` says so.
 * Written this way round so the page starts paging server-side the day the
 * endpoint learns to, with no change on this side.
 */
export async function fetchQuestionPage(
  input: { chapterId: number; page: number; perPage: number; filters: LibraryFilters },
  signal?: AbortSignal
): Promise<QuestionPage> {
  const { chapterId, page, perPage, filters } = input;

  const raw = await postBank(
    {
      chapter_id: chapterId,
      page,
      per_page: perPage,
      question_type_code: filters.typeCode === 'all' ? undefined : filters.typeCode,
      difficulty: filters.difficulty === 'all' ? undefined : filters.difficulty,
      search: filters.search.trim() || undefined,
    },
    signal
  );

  const rows = dedupeById(((raw.data as QuestionBankApiQuestion[]) ?? []).filter(Boolean));
  const envelope = raw.pagination as PaginationEnvelope | undefined;

  if (envelope && typeof envelope.total === 'number') {
    return {
      questions: rows,
      total: envelope.total,
      page: envelope.current_page ?? page,
      perPage: envelope.per_page ?? perPage,
      serverPaged: true,
      all: null,
    };
  }

  const matching = rows.filter((question) => matchesFilters(question, filters));
  const start = Math.max(0, (page - 1) * perPage);

  return {
    questions: matching.slice(start, start + perPage),
    total: matching.length,
    page,
    perPage,
    serverPaged: false,
    all: rows,
  };
}

/** Every question in the chapter, for the summary counts. */
export async function fetchWholeChapter(
  chapterId: number,
  signal?: AbortSignal
): Promise<QuestionBankApiQuestion[]> {
  const raw = await postBank({ chapter_id: chapterId }, signal);
  return dedupeById(((raw.data as QuestionBankApiQuestion[]) ?? []).filter(Boolean));
}

/**
 * One question, and the chapter it came from.
 *
 * The endpoint is chapter-scoped -- there is no fetch-one-question route -- so
 * the chapter is what is asked for and the row is picked out of it. The whole
 * chapter is returned alongside because a case study stem needs its sub-parts
 * to build its slides, and they are in the same response.
 */
export async function fetchQuestionWithChapter(
  chapterId: number,
  questionId: number,
  signal?: AbortSignal
): Promise<{ question: QuestionBankApiQuestion | null; chapter: QuestionBankApiQuestion[] }> {
  const chapter = await fetchWholeChapter(chapterId, signal);
  return {
    question: chapter.find((row) => Number(row.id) === Number(questionId)) ?? null,
    chapter,
  };
}

export function matchesFilters(question: QuestionBankApiQuestion, filters: LibraryFilters): boolean {
  if (filters.typeCode !== 'all' && (mappingForQuestion(question)?.code ?? '') !== filters.typeCode) {
    return false;
  }

  if (filters.difficulty !== 'all') {
    const stored = String(question.difficulty ?? '').toLowerCase();
    if (stored !== filters.difficulty.toLowerCase()) return false;
  }

  const needle = filters.search.trim().toLowerCase();
  if (needle === '') return true;

  const haystack = [
    question.question,
    question.model_answer,
    question.assertion,
    question.reason,
    ...(question.options ?? []).map((option) => option.text),
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
}

// ---------------------------------------------------------------------------
// Building a playable activity
// ---------------------------------------------------------------------------

/**
 * Case study sub-parts that belong to a stem.
 *
 * The bank has no parent column, so a stem takes the sub-part rows that follow
 * it in id order until the next stem. That is the order the extraction
 * pipeline wrote them in, and it is the only ordering the data supports.
 */
export function caseStudyChildren(
  stem: QuestionBankApiQuestion,
  all: QuestionBankApiQuestion[]
): QuestionBankApiQuestion[] {
  if ((mappingForQuestion(stem)?.code ?? '') !== 'case_study_parent') return [];

  const ordered = [...all].sort((a, b) => Number(a.id) - Number(b.id));
  const start = ordered.findIndex((question) => Number(question.id) === Number(stem.id));
  if (start < 0) return [];

  const children: QuestionBankApiQuestion[] = [];
  for (const question of ordered.slice(start + 1)) {
    const code = mappingForQuestion(question)?.code ?? '';
    if (code !== 'case_study_child') break;
    children.push(question);
  }

  return children;
}

/** The curriculum keys a player needs, read off the question itself. */
export function scopeOf(question: QuestionBankApiQuestion, fallback?: H5pContext): RuntimeScope {
  const read = (value: unknown, alternative?: string): number | null => {
    const number = Number(value ?? alternative ?? NaN);
    return Number.isFinite(number) && number > 0 ? number : null;
  };

  return {
    standard_id: read((question as { standard_id?: number }).standard_id, fallback?.standard_id),
    subject_id: read((question as { subject_id?: number }).subject_id, fallback?.subject_id),
    chapter_id: read(question.chapter_id, fallback?.chapter_id),
  };
}

/**
 * The typed row a preview hands to a player.
 *
 * `RuntimeActivity` is declared structurally in `lib/`, which has no dependency
 * on the app tree. Narrowing it to the real row types here is what proves the
 * two agree: if a player's row shape changes and the builder is not updated,
 * this assignment stops compiling.
 */
export type PlayableActivity =
  | { kind: 'single_choice_set'; item: H5pSingleChoiceSet }
  | { kind: 'true_false'; item: H5pTrueFalse }
  | { kind: 'fill_in_the_blanks'; item: H5pTextActivity }
  // Drag the words and Mark the words are the SAME row, discriminated by
  // `content_type` — one table, one player, three content types.
  | { kind: 'drag_text'; item: H5pTextActivity }
  | { kind: 'mark_the_words'; item: H5pTextActivity }
  | { kind: 'memory_game'; item: H5pMemoryGame }
  | { kind: 'flashcards'; item: RuntimeFlashcards }
  | { kind: 'course_presentation'; item: H5pCoursePresentation }
  // The one member with no table behind it: H5P.Essay is not built here, so
  // the runtime shape IS the shape. See RuntimeEssay.
  | { kind: 'essay'; item: RuntimeEssay };

export interface PlayableResult {
  ok: boolean;
  activity?: PlayableActivity;
  mapping?: TypeMapping;
  reason?: string;
}

/**
 * Build the activity for one question, ready to render. No request, no write.
 *
 * `all` is the chapter, needed only so a case study stem can find its
 * sub-parts; pass an empty array when there is no chapter in hand.
 */
export function buildPlayable(
  question: QuestionBankApiQuestion,
  all: QuestionBankApiQuestion[],
  fallbackCtx?: H5pContext,
  label?: string,
  /** Build it as this H5P type rather than the question's default one. */
  as?: H5pTargetKind
): PlayableResult {
  const result = mapQuestionToPlayerPayload(
    question as BankQuestion,
    scopeOf(question, fallbackCtx),
    label,
    caseStudyChildren(question, all) as BankQuestion[],
    as
  );

  if (!result.ok || !result.activity) {
    return { ok: false, mapping: result.mapping, reason: result.reason };
  }

  return {
    ok: true,
    mapping: result.mapping,
    activity: narrow(result.activity),
  };
}

function narrow(activity: RuntimeActivity): PlayableActivity {
  switch (activity.kind) {
    case 'single_choice_set':
      return { kind: activity.kind, item: activity.item as unknown as H5pSingleChoiceSet };
    case 'true_false':
      return { kind: activity.kind, item: activity.item as unknown as H5pTrueFalse };
    case 'fill_in_the_blanks':
    case 'drag_text':
    case 'mark_the_words':
      return { kind: activity.kind, item: activity.item as unknown as H5pTextActivity };
    case 'flashcards':
      return { kind: activity.kind, item: activity.item };
    case 'memory_game':
      return { kind: activity.kind, item: activity.item as unknown as H5pMemoryGame };
    case 'course_presentation':
      return { kind: activity.kind, item: activity.item as unknown as H5pCoursePresentation };
    case 'essay':
      return { kind: activity.kind, item: activity.item };
  }
}

/** Can this question be played? The same decision the table shows on a row. */
export function playability(
  question: QuestionBankApiQuestion,
  all: QuestionBankApiQuestion[] = [],
  as?: H5pTargetKind
): { ok: boolean; reason?: string } {
  const result = buildPlayable(question, all, undefined, undefined, as);
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}

// ---------------------------------------------------------------------------
// Chapter statistics
// ---------------------------------------------------------------------------

export interface TypeBucket {
  mapping: TypeMapping;
  questions: QuestionBankApiQuestion[];
  /** Rows a player can render right now. */
  playable: QuestionBankApiQuestion[];
  /** Rows that map to a player but are missing the parts, with the reason. */
  blocked: Array<{ question: QuestionBankApiQuestion; reason: string }>;
}

export interface ChapterSummary {
  total: number;
  playable: number;
  notPlayable: number;
  /** Rows with no recorded form at all -- they belong to no bucket. */
  unmapped: number;
  buckets: TypeBucket[];
}

/**
 * The chapter's counts and its per-type buckets, in the catalogue's order.
 *
 * Buckets are keyed by MAPPING, not by the raw stored code, so `case_study`,
 * `case_study_parent` and `case_study_child` stay three rows the way the
 * catalogue spells them while all three play the same way.
 */
export function summariseChapter(questions: QuestionBankApiQuestion[]): ChapterSummary {
  const buckets = new Map<string, TypeBucket>();
  let unmapped = 0;
  let playable = 0;

  for (const question of questions) {
    const mapping = mappingForQuestion(question);
    if (!mapping) {
      unmapped += 1;
      continue;
    }

    let bucket = buckets.get(mapping.code);
    if (!bucket) {
      bucket = { mapping, questions: [], playable: [], blocked: [] };
      buckets.set(mapping.code, bucket);
    }

    bucket.questions.push(question);

    const verdict = playability(question, questions);
    if (verdict.ok) {
      bucket.playable.push(question);
      playable += 1;
    } else {
      bucket.blocked.push({ question, reason: verdict.reason ?? 'This question cannot be played.' });
    }
  }

  return {
    total: questions.length,
    playable,
    notPlayable: questions.length - playable,
    unmapped,
    buckets: [...buckets.values()],
  };
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/**
 * The full-screen player for one question.
 *
 * The chapter rides in the query string because the bank endpoint is
 * chapter-scoped: the route has to fetch the chapter to find the question, and
 * a case study stem needs its siblings from the same response anyway.
 */
export function runtimePlayerHref(
  question: QuestionBankApiQuestion,
  ctx: H5pContext
): string {
  const params = new URLSearchParams({
    chapter_id: String(question.chapter_id ?? ctx.chapter_id ?? ''),
    standard_id: String((question as { standard_id?: number }).standard_id ?? ctx.standard_id ?? ''),
    subject_id: String((question as { subject_id?: number }).subject_id ?? ctx.subject_id ?? ''),
  });

  if (ctx.chapter_name) params.set('chapter_name', ctx.chapter_name);

  return `/h5p/question-bank-library/play/${question.id}?${params.toString()}`;
}
