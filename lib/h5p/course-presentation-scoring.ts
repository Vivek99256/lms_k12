/**
 * Scoring and navigation for H5P Course Presentation (H5P.CoursePresentation).
 *
 * Lives in `lib/` rather than beside the player so it can be tested without a
 * browser, a fetch stub or a React tree.
 *
 * THE ONE IMPORT, AND WHY IT IS THERE. An embedded "fill in the blanks"
 * element stores the same `*answer*` passage markup the standalone text
 * activity stores, and a learner typing into it expects the same marking --
 * the same alternatives, the same case rule, the same one-edit spelling
 * forgiveness. Re-implementing that here would be a second cloze marker whose
 * disagreements with the first would surface as "the same question marked me
 * differently on a slide", which is the worst kind of bug to be asked about.
 * So it reuses `text-activity-scoring`, which is what the anti-duplication
 * rule in CLAUDE.md asks for.
 *
 * WHAT A DECK IS WORTH. The sum of its scored elements. A slide with no
 * question contributes nothing and is not a zero -- a lecture deck has a max
 * score of 0, which is different from a quiz deck a learner failed, and the
 * two must not report the same way.
 */

import { parsePassage } from './text-activity-markup';
import { matchesAnswer, type ScorableBlank } from './text-activity-scoring';

export type SlideElementType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'multiple_choice'
  | 'true_false'
  | 'blanks'
  | 'drag_drop'
  | 'goto_slide';

/** The element kinds that carry marks. Mirrors H5pSlideElement::SCORED_TYPES. */
export const SCORED_ELEMENT_TYPES: SlideElementType[] = [
  'multiple_choice',
  'true_false',
  'blanks',
  'drag_drop',
];

export interface ScorableSlideElement {
  id: number;
  slide_id: number;
  element_type: SlideElementType | string;
  content_text: string | null;
  options: Record<string, unknown> | null;
  points: number;
}

export interface ScorableSlide {
  id: number;
  slide_index: number;
  next_slide_id: number | null;
  elements?: ScorableSlideElement[];
}

export interface ScorablePresentation {
  slides?: ScorableSlide[];
  pass_percentage: number;
}

/**
 * A learner's answer to one element.
 *
 *   multiple_choice  the indices of the chosen answers
 *   true_false       the chosen side
 *   blanks           the typed string per blank index
 *   drag_drop        the result the embedded drag player already computed,
 *                    as a fraction of its own max — see `gradeElement`
 */
export type SlideResponse =
  | { kind: 'multiple_choice'; chosen: number[] }
  | { kind: 'true_false'; chosen: boolean }
  | { kind: 'blanks'; responses: Record<number, string> }
  | { kind: 'drag_drop'; fraction: number };

export interface ElementResult {
  elementId: number;
  slideId: number;
  answered: boolean;
  correct: boolean;
  score: number;
  maxScore: number;
}

export interface PresentationAttemptResult {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  answeredCount: number;
  scoredElementCount: number;
  /** True when every scored element has an answer. */
  completed: boolean;
  perElement: ElementResult[];
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

export function isScoredElement(element: ScorableSlideElement): boolean {
  return (SCORED_ELEMENT_TYPES as string[]).includes(element.element_type);
}

/**
 * Grade one element.
 *
 * PARTIAL CREDIT IS ALLOWED, AND ONLY WHERE IT MEANS SOMETHING.
 *
 *   multiple_choice  all-or-nothing on a single-answer question; on a
 *                    multi-answer one, the proportion of the key that was
 *                    selected, with every wrong selection cancelling a right
 *                    one. That is H5P.MultiChoice's own rule, and it is what
 *                    stops "select every box" scoring full marks.
 *   blanks           one mark per correct slot, which is what a cloze is.
 *   true_false       all or nothing. There is nothing partial about it.
 *   drag_drop        the fraction the embedded drag player computed, because
 *                    that player already owns drag scoring and this must not
 *                    become a second opinion about it.
 */
export function gradeElement(element: ScorableSlideElement, response: SlideResponse | undefined): ElementResult {
  const maxScore = Math.max(0, Number(element.points) || 0);
  const base: ElementResult = {
    elementId: element.id,
    slideId: element.slide_id,
    answered: response !== undefined,
    correct: false,
    score: 0,
    maxScore,
  };

  if (response === undefined || maxScore === 0) return base;

  const options = (element.options ?? {}) as Record<string, unknown>;

  switch (element.element_type) {
    case 'multiple_choice': {
      if (response.kind !== 'multiple_choice') return base;

      const answers = (options.answers as Array<{ correct?: boolean }> | undefined) ?? [];
      const key = new Set(answers.map((a, i) => (a?.correct ? i : -1)).filter((i) => i >= 0));
      if (key.size === 0) return base;

      const chosen = new Set(response.chosen ?? []);
      const hits = [...chosen].filter((i) => key.has(i)).length;
      const misses = [...chosen].filter((i) => !key.has(i)).length;

      if (key.size === 1) {
        const correct = hits === 1 && misses === 0;
        return { ...base, correct, score: correct ? maxScore : 0 };
      }

      // H5P.MultiChoice's rule: a wrong tick cancels a right one, and the
      // result never goes below zero.
      const net = Math.max(0, hits - misses);
      const fraction = net / key.size;

      return { ...base, correct: fraction === 1, score: Math.round(maxScore * fraction) };
    }

    case 'true_false': {
      if (response.kind !== 'true_false') return base;

      const correct = response.chosen === Boolean(options.correct);
      return { ...base, correct, score: correct ? maxScore : 0 };
    }

    case 'blanks': {
      if (response.kind !== 'blanks') return base;

      const slots = parsePassage(String(options.passage ?? element.content_text ?? ''));
      if (slots.length === 0) return base;

      const caseSensitive = Boolean(options.case_sensitive);
      const acceptSpellingErrors = Boolean(options.accept_spelling_errors);

      let hits = 0;
      for (const slot of slots) {
        const blank: ScorableBlank = {
          blank_index: slot.index,
          solution: slot.solution,
          alternatives: slot.alternatives,
          is_distractor: false,
        };

        if (matchesAnswer(response.responses[slot.index] ?? '', blank, { caseSensitive, acceptSpellingErrors })) {
          hits++;
        }
      }

      const fraction = hits / slots.length;
      return { ...base, correct: fraction === 1, score: Math.round(maxScore * fraction) };
    }

    case 'drag_drop': {
      if (response.kind !== 'drag_drop') return base;

      const fraction = Math.max(0, Math.min(1, Number(response.fraction) || 0));
      return { ...base, correct: fraction === 1, score: Math.round(maxScore * fraction) };
    }

    default:
      return base;
  }
}

/**
 * Score a whole attempt.
 *
 * `responses` is keyed by element id. A missing key is unanswered, which
 * counts against the total in the same way an unanswered arithmetic question
 * does -- a learner who stopped on slide 2 of 8 has not scored full marks on
 * the two slides they did.
 */
export function scorePresentationAttempt(
  presentation: ScorablePresentation,
  responses: Record<number, SlideResponse>
): PresentationAttemptResult {
  const elements = (presentation.slides ?? []).flatMap((slide) => slide.elements ?? []).filter(isScoredElement);

  const perElement = elements.map((element) => gradeElement(element, responses[element.id]));

  const score = perElement.reduce((sum, result) => sum + result.score, 0);
  const maxScore = perElement.reduce((sum, result) => sum + result.maxScore, 0);
  const answeredCount = perElement.filter((result) => result.answered).length;

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    score,
    maxScore,
    percentage,
    passed: percentage >= Math.max(0, Math.min(100, Number(presentation.pass_percentage) || 0)),
    answeredCount,
    scoredElementCount: perElement.length,
    // A deck with no questions is completed by being read to the end, which is
    // the player's business, not this function's. Here it is vacuously true
    // rather than false, so a lecture deck is not permanently "incomplete".
    completed: answeredCount === perElement.length,
    perElement,
  };
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * The slide that follows this one.
 *
 * A slide's `next_slide_id` overrides the sequence; a target that is not in
 * this deck is ignored rather than followed, which is what stops a branch
 * surviving a deleted slide as a dead end. Returns null at the end of the deck.
 */
export function nextSlideId(slides: ScorableSlide[], currentId: number): number | null {
  const ordered = [...(slides ?? [])].sort((a, b) => a.slide_index - b.slide_index);
  const position = ordered.findIndex((slide) => slide.id === currentId);
  if (position < 0) return null;

  const current = ordered[position];
  if (current.next_slide_id !== null && ordered.some((slide) => slide.id === current.next_slide_id)) {
    return current.next_slide_id;
  }

  return position + 1 < ordered.length ? ordered[position + 1].id : null;
}

/**
 * Every slide reachable from the first, following branches and buttons.
 *
 * Worth having because a branching deck can strand a slide that the author can
 * still see in the editor and no learner will ever reach. The editor shows
 * that as a warning; nothing blocks on it, because an author building a deck
 * has unreachable slides constantly and being told so on every save would be
 * noise.
 */
export function reachableSlideIds(slides: ScorableSlide[]): Set<number> {
  const ordered = [...(slides ?? [])].sort((a, b) => a.slide_index - b.slide_index);
  const reachable = new Set<number>();
  if (ordered.length === 0) return reachable;

  const queue: number[] = [ordered[0].id];

  while (queue.length > 0) {
    const id = queue.shift() as number;
    if (reachable.has(id)) continue;
    reachable.add(id);

    const next = nextSlideId(ordered, id);
    if (next !== null) queue.push(next);

    // A go-to button is a second way out of a slide, so a slide reachable only
    // through one is still reachable.
    const slide = ordered.find((s) => s.id === id);
    for (const element of slide?.elements ?? []) {
      if (element.element_type !== 'goto_slide') continue;
      const target = Number((element.options ?? {}).target_slide_id);
      if (Number.isFinite(target) && ordered.some((s) => s.id === target)) queue.push(target);
    }
  }

  return reachable;
}

/** The feedback message for a percentage. Last matching band wins. */
export function presentationFeedback(
  percentage: number,
  bands: Array<{ from: number; to: number; feedback?: string }> | null | undefined
): string {
  let message = '';
  for (const band of bands ?? []) {
    if (percentage >= band.from && percentage <= band.to && band.feedback) {
      message = band.feedback;
    }
  }
  return message;
}
