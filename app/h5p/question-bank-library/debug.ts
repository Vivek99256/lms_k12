'use client';

import { mappingForQuestion } from '@/lib/h5p/question-bank-h5p-map';
import { scopeOf } from '../data/question-bank-library';
import { isPlayable } from '@/lib/h5p/question-bank-runtime';
import type { QuestionBankApiQuestion } from '@/app/course-master/data/chapters';

/**
 * Stage counters for the question bank -> H5P funnel.
 *
 * WHY IT IS GATED AND NOT JUST `console.log`. The funnel is eight stages long
 * and every stage can legitimately drop rows -- a chapter with no questions, a
 * filter that matches nothing, a question with no options. Logging it always
 * would be noise on a screen that is working; logging it never is why "nothing
 * appears" is unanswerable from a screenshot. So it is one flag: open the page
 * with `?debug=1`, or set `localStorage.qbankDebug = '1'`, and every load
 * prints the counts and the first rows lost at each stage.
 *
 * Turn it off by removing the flag; nothing else changes.
 */

export function debugEnabled(searchParams?: URLSearchParams | null): boolean {
  if (typeof window === 'undefined') return false;
  if (searchParams?.get('debug') === '1') return true;
  try {
    return window.localStorage.getItem('qbankDebug') === '1';
  } catch {
    // Private mode or blocked storage: the query flag still works.
    return false;
  }
}

export interface FunnelInput {
  /** What the scope resolved to, before anything was requested. */
  scope: { standardId: string; subjectId: string; chapterId: string; ready: boolean };
  /** Rows the API returned for the whole chapter. */
  chapterQuestions: QuestionBankApiQuestion[];
  /** Rows the current page of the table holds. */
  rows: QuestionBankApiQuestion[];
  /** Rows the table will actually paint. */
  rendered: number;
  /** Total the pager believes exists, after filters. */
  total: number;
  serverPaged: boolean;
  filters: { typeCode: string; difficulty: string; search: string };
}

/**
 * Print the funnel, stage by stage, and name what fell out of each.
 *
 * The counts are computed here rather than read off the page's state so the
 * log cannot disagree with the projection: it calls the same
 * `mappingForQuestion` and `convertibility` the table and the cards call.
 */
export function logFunnel(input: FunnelInput): void {
  const { chapterQuestions } = input;

  let mapped = 0;
  let unmapped = 0;
  let convertible = 0;
  let blocked = 0;

  const unmappedSamples: Array<Record<string, unknown>> = [];
  const blockedReasons: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const question of chapterQuestions) {
    const mapping = mappingForQuestion(question);

    if (!mapping) {
      unmapped += 1;
      if (unmappedSamples.length < 5) {
        unmappedSamples.push({
          id: question.id,
          question_type: question.question_type,
          question_type_raw: question.question_type_raw,
          question_type_code: question.question_type_code,
          optionCount: (question.options ?? []).length,
          hasModelAnswer: Boolean(question.model_answer),
        });
      }
      continue;
    }

    mapped += 1;
    byType[mapping.code] = (byType[mapping.code] ?? 0) + 1;

    if (isPlayable(question, scopeOf(question))) {
      convertible += 1;
    } else {
      blocked += 1;
    }
  }

  console.log('[qbank->h5p funnel]', {
    scope: input.scope,
    filters: input.filters,
    fetched: chapterQuestions.length,
    mapped,
    // There is no shape-based fallback in this build: a row with no catalogue
    // code and no recognised label is simply unmapped. See the note on
    // `mappingForQuestion` in lib/h5p/question-bank-h5p-map.ts.
    fallbackMapped: 0,
    unmapped,
    convertible,
    skipped: blocked,
    pageRows: input.rows.length,
    rendered: input.rendered,
    totalAfterFilters: input.total,
    serverPaged: input.serverPaged,
    byType,
    blockedReasons,
    unmappedSamples,
  });
}
