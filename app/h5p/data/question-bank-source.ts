'use client';

import type { QuestionBankApiQuestion } from '@/app/course-master/data/chapters';
import {
  H5P_TARGETS,
  convertibilityAs,
  formsReaching,
  mappingForQuestion,
  questionsPlayableAs,
  type BankQuestion,
  type H5pTargetKind,
  type TypeMapping,
} from '@/lib/h5p/question-bank-h5p-map';
import { fetchWholeChapter } from './question-bank-library';

/**
 * Auto-sourcing: what a single H5P content type can ask, straight out of
 * `lms_question_master`.
 *
 * WHAT THIS IS FOR. The question bank library screen answers "show me this
 * chapter, and play each question as whatever it maps to". A content type page
 * asks the opposite and much narrower question — "I am Drag the words; which
 * of this chapter can I ask?" — and that is all this module does.
 *
 * WHY IT IS A SEPARATE MODULE FROM THE LIBRARY'S DATA LAYER. Fourteen pages
 * import this. If it lived beside the library screen, every content type page
 * would pull the library's filters, its pagination, its assignment dialog and
 * its chapter summary in behind one function. The one thing it does share is
 * the fetch, which is imported rather than repeated so there is still exactly
 * one place that knows how to read the bank.
 *
 * NOTHING HERE WRITES, and nothing here converts. A question is not turned
 * into an H5P activity and stored against a type; it is READ, and rendered by
 * that type's player at the moment a learner opens it. A question that changes
 * in the bank changes in every type that asks it, because there is no copy to
 * go stale. That is the whole point.
 */

export interface BankSourceResult {
  /** The questions this content type can actually ask, in bank order. */
  compatible: QuestionBankApiQuestion[];
  /** Every question in the chapter, so a page can state what it left out. */
  total: number;
  /**
   * Rows this type could ALMOST ask: the form maps here, but the row is
   * missing a part. Carried with the reason, so a page can say "14 questions
   * are tagged fill-in-the-blank but store no answer" rather than silently
   * showing a shorter list than the teacher expects.
   */
  incompatible: Array<{ question: QuestionBankApiQuestion; reason: string }>;
  /** The catalogue forms that reach this type at all, for the page to name. */
  forms: TypeMapping[];
}

const EMPTY: BankSourceResult = { compatible: [], total: 0, incompatible: [], forms: [] };

/**
 * Split a chapter into what this type can ask and what it cannot.
 *
 * Pure, so the decision is testable without a browser or a fetch — and so a
 * caller that already holds the chapter (the library screen does) can reuse it
 * without a second request.
 */
export function selectForType(
  questions: QuestionBankApiQuestion[],
  kind: H5pTargetKind
): BankSourceResult {
  const forms = formsReaching(kind);
  const reachable = new Set(forms.map((form) => form.code));

  const compatible = questionsPlayableAs(questions as BankQuestion[], kind) as QuestionBankApiQuestion[];
  const chosen = new Set(compatible.map((question) => Number(question.id)));

  // Only rows whose FORM reaches this type are reported as near misses. A case
  // study is not a failed true/false question — it was never offered as one,
  // and listing it as "incompatible" would read as a data problem rather than
  // as a question that simply belongs elsewhere.
  const incompatible = questions
    .filter((question) => !chosen.has(Number(question.id)))
    .filter((question) => {
      const mapping = mappingForQuestion(question as BankQuestion);
      return mapping ? reachable.has(mapping.code) : false;
    })
    .map((question) => ({
      question,
      reason:
        convertibilityAs(question as BankQuestion, kind).reason ??
        'This question is missing something this activity needs.',
    }));

  return { compatible, total: questions.length, incompatible, forms };
}

/**
 * Read the chapter and keep what this content type can ask.
 *
 * One request per screen, the same one the library screen makes. There is no
 * per-type endpoint and there does not need to be: the compatibility decision
 * is a pure function over rows the client already has, and asking the server
 * to make it would mean teaching `ApiLmsCourseController` the H5P type map.
 */
export async function fetchBankForType(
  kind: H5pTargetKind,
  chapterId: number | string | null | undefined,
  signal?: AbortSignal
): Promise<BankSourceResult> {
  const id = Number(chapterId ?? NaN);
  if (!Number.isFinite(id) || id <= 0) return EMPTY;

  return selectForType(await fetchWholeChapter(id, signal), kind);
}

/**
 * The H5P type a route segment plays, or null for a route with no bank source.
 *
 * WHY SOME ROUTES ARE NULL, and why that is stated rather than left blank.
 * Drag and drop and Image hotspots are defined by their DROP ZONES — x, y,
 * width and height on a picture. The bank stores figures as url, dimensions,
 * caption and OCR text: the size of the picture, never a position within it.
 * Interactive video needs a video and a timeline, and the bank stores neither.
 * No amount of mapping produces a coordinate that was never recorded, so those
 * pages say so instead of showing an empty list that looks like a bug.
 */
export const BANK_SOURCE_BY_ROUTE: Record<string, H5pTargetKind | null> = {
  h5p_single_choice_set: 'single_choice_set',
  h5p_mcq: 'single_choice_set',
  h5p_true_false: 'true_false',
  h5p_blanks: 'fill_in_the_blanks',
  h5p_drag_text: 'drag_text',
  h5p_mark_the_words: 'mark_the_words',
  h5p_memory_game: 'memory_game',
  h5p_flashacard: 'flashcards',
  h5p_course_presentation: 'course_presentation',

  h5p_drag_drop: null,
  h5p_image_hotspots: null,
  h5p_interactive_video: null,
  h5p_arithmetic_quiz: null,
  scenario_based: null,
};

/** Why a route carries no bank source, in a teacher's words. */
export const NO_BANK_SOURCE_REASON: Record<string, string> = {
  h5p_drag_drop:
    'A drag and drop activity is defined by where its drop zones sit on the image. The question bank records a figure’s address and size but never a position within it, so there is no stored coordinate to place a zone at.',
  h5p_image_hotspots:
    'A hotspot is a point on an image. The question bank records a figure’s address and size but never a point within it, so there is nothing to place a hotspot at.',
  h5p_interactive_video:
    'An interactive video needs a video and a timeline to hang questions on. The question bank stores neither.',
  h5p_arithmetic_quiz:
    'An arithmetic quiz generates its own sums at run time and cannot carry a stored question. Numerical questions from the bank are asked as Fill in the blanks instead, which marks the same typed value against the stored answer.',
  scenario_based:
    'A scenario is a set of points on an image. The question bank records a figure’s address and size but never a point within it.',
};

/** The display label for a type, for a page that names the one it is. */
export function targetLabel(kind: H5pTargetKind): string {
  return H5P_TARGETS[kind].label;
}
