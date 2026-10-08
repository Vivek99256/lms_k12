/**
 * Pure logic for the student study deck: validate the deck, decide how each activity is
 * played, and derive the outline and the related-concept trail.
 *
 * NO REACT AND NO FETCH HERE, so every rule is testable with node:test.
 *
 * REUSE, NOT A SECOND RUNTIME. "Can this question be asked as that H5P type?" is answered
 * by `mapQuestionToPlayerPayload` in lib/h5p/question-bank-runtime.ts - the same function
 * every other module uses. The deck only NAMES a preferred target; this module checks it
 * against the real row and falls back to the question's own default when the row cannot be
 * that type. Nothing is converted, stored or copied.
 */

import { mapQuestionToPlayerPayload, type RuntimeScope } from '../h5p/question-bank-runtime';
import type { BankQuestion, H5pTargetKind } from '../h5p/question-bank-h5p-map';
import {
  ACTIVITY_LABELS,
  STUDY_DECK_VERSION,
  type DeckActivity,
  type DeckConcept,
  type DeckSlide,
  type StudyDeck,
} from './types';

/** Every target the existing runtime can play. Branching Scenario is not one of them. */
export const PLAYABLE_TARGETS: readonly H5pTargetKind[] = [
  'single_choice_set',
  'true_false',
  'fill_in_the_blanks',
  'drag_text',
  'mark_the_words',
  'memory_game',
  'flashcards',
  'course_presentation',
  'essay',
  'drag_drop',
];

export class DeckError extends Error {}

/**
 * Check that a JSON payload really is a v2 study deck, with a reason when it is not.
 *
 * Strict about the parts the player cannot render without (slides, concepts, activities)
 * and silent about extra fields, so the backend can add metadata without breaking players.
 */
export function parseDeck(raw: unknown): StudyDeck {
  const deck = raw as Partial<StudyDeck> | null;

  if (!deck || typeof deck !== 'object') throw new DeckError('The study deck is empty.');
  if (deck.version !== STUDY_DECK_VERSION) {
    throw new DeckError(`This study deck is version ${String(deck.version)}; the player reads version ${STUDY_DECK_VERSION}.`);
  }
  if (!Array.isArray(deck.slides) || deck.slides.length === 0) throw new DeckError('The study deck has no slides.');
  if (!deck.concepts || typeof deck.concepts !== 'object') throw new DeckError('The study deck has no concept list.');
  if (!Array.isArray(deck.outline)) throw new DeckError('The study deck has no outline.');
  if (!deck.chapter || typeof deck.chapter.id !== 'number') throw new DeckError('The study deck does not say which chapter it is for.');

  deck.slides.forEach((slide, index) => {
    if (typeof slide.n !== 'number' || typeof slide.title !== 'string' || !slide.content || !Array.isArray(slide.activities)) {
      throw new DeckError(`Slide ${index + 1} is malformed.`);
    }
    slide.activities.forEach((activity) => {
      if (!(PLAYABLE_TARGETS as readonly string[]).includes(activity.as)) {
        throw new DeckError(`Slide ${slide.n} asks for "${String(activity.as)}", which no player here can render.`);
      }
      if (!(ACTIVITY_LABELS as readonly string[]).includes(activity.label)) {
        throw new DeckError(`Slide ${slide.n} has an activity labelled "${String(activity.label)}".`);
      }
      if (activity.source === 'authored' && !activity.question) {
        throw new DeckError(`Slide ${slide.n} has an authored check with no question.`);
      }
    });
  });

  return deck as StudyDeck;
}

/** A relative image path is served beside the deck; an absolute one is used as given. */
export function assetUrl(url: string, base: string | null): string {
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('/') || url.startsWith('data:')) return url;
  if (!base) return url;

  return `${base.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

function read(value: unknown): number | null {
  const n = Number(value ?? NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The curriculum keys a player reports against, read off the question itself. */
export function scopeOf(question: BankQuestion & Partial<RuntimeScope>): RuntimeScope {
  return {
    standard_id: read(question.standard_id),
    subject_id: read(question.subject_id),
    chapter_id: read(question.chapter_id),
  };
}

export type ResolvedActivity =
  | {
      ok: true;
      activity: DeckActivity;
      question: BankQuestion;
      /** The target it will really be played as. */
      as: H5pTargetKind;
      /** True when the deck's preferred target could not be built from the real row. */
      fellBack: boolean;
    }
  | { ok: false; activity: DeckActivity; reason: string };

/**
 * Decide how one activity is played, against the question row as it is NOW.
 *
 * - bank activity: the row is looked up by id (a question deleted from the bank is a clear
 *   reason, not a crash); the preferred target is tried; if that row cannot be that type the
 *   question's own default target is used and `fellBack` says so.
 * - authored activity: the row travels in the deck and is asked as written-answer.
 */
export function resolveActivity(activity: DeckActivity, bank: ReadonlyMap<number, BankQuestion>): ResolvedActivity {
  const question =
    activity.source === 'authored' ? (activity.question as BankQuestion | undefined) : bank.get(Number(activity.question_id));

  if (!question) {
    return { ok: false, activity, reason: 'This question is no longer in the question bank.' };
  }

  const scope = scopeOf(question as BankQuestion & Partial<RuntimeScope>);
  const wanted = mapQuestionToPlayerPayload(question, scope, undefined, [], activity.as);
  if (wanted.ok && wanted.activity) {
    return { ok: true, activity, question, as: activity.as, fellBack: false };
  }

  const fallback = mapQuestionToPlayerPayload(question, scope);
  if (fallback.ok && fallback.activity) {
    return { ok: true, activity, question, as: fallback.mapping?.target?.kind ?? activity.default_as, fellBack: true };
  }

  return { ok: false, activity, reason: fallback.reason ?? wanted.reason ?? 'This question cannot be played.' };
}

/**
 * The stored explanation a learner is shown after answering, as plain text.
 *
 * The question bank returns some generated multiple-choice rows with their whole answer ENVELOPE in
 * `model_answer` (a JSON string with the rationale in its `explanation` field; the API leaves those
 * untouched because other clients read the options from it). Showing that string would put raw JSON in
 * front of a student, so it is unwrapped here: `explanation`, else the envelope's own `model_answer`. An
 * envelope that cannot be read yields nothing rather than its source text. Nothing is rewritten or stored.
 */
export function explanationOf(question: Pick<BankQuestion, 'model_answer'>): string {
  const raw = String(question.model_answer ?? '').trim();
  let text = raw;

  if (raw.startsWith('{')) {
    try {
      const envelope = JSON.parse(raw) as Record<string, unknown>;
      text = String(envelope.explanation ?? envelope.model_answer ?? '');
    } catch {
      return '';
    }
  }

  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** A stable key for an activity within a deck: slide number and position, never the question id alone. */
export function activityKey(slide: Pick<DeckSlide, 'n'>, index: number): string {
  return `${slide.n}:${index}`;
}

/** The bank question ids a deck needs, so the player can ask for exactly those. */
export function neededQuestionIds(deck: StudyDeck): number[] {
  const ids = new Set<number>();
  deck.slides.forEach((slide) =>
    slide.activities.forEach((activity) => {
      if (activity.source === 'bank' && activity.question_id !== null) ids.add(activity.question_id);
    })
  );

  return Array.from(ids);
}

// ---------------------------------------------------------------------------
// Outline and trail
// ---------------------------------------------------------------------------

export interface OutlineConcept {
  concept: DeckConcept;
  /** Slides that explain it. */
  taughtOn: number[];
  /** Every slide that touches it. */
  slides: number[];
}

export interface OutlineTopic {
  topicId: number;
  name: string;
  concepts: OutlineConcept[];
}

/** Chapter -> topic -> concept, each concept with where it is taught. */
export function outlineOf(deck: StudyDeck): OutlineTopic[] {
  return deck.outline.map((topic) => ({
    topicId: topic.topic_id,
    name: topic.name,
    concepts: topic.concept_ids
      .map((id) => deck.concepts[String(id)])
      .filter((concept): concept is DeckConcept => Boolean(concept))
      .map((concept) => ({
        concept,
        taughtOn: deck.taught_by[String(concept.id)] ?? [],
        slides: deck.concept_slides[String(concept.id)] ?? [],
      })),
  }));
}

/** The topic a slide belongs to: the topic of the first concept it teaches. */
export function topicOfSlide(deck: StudyDeck, slide: DeckSlide): OutlineTopic | null {
  const id = slide.taught_concept_ids[0] ?? slide.concept_ids[0];
  if (id === undefined) return null;

  return outlineOf(deck).find((topic) => topic.concepts.some((entry) => entry.concept.id === id)) ?? null;
}

export interface RelatedConcept {
  concept: DeckConcept;
  kind: 'builds on' | 'connects to';
  /** The slide that explains it, when the deck has one, so the learner can go back to it. */
  slide: number | null;
}

/**
 * Prerequisite and related concepts of what a slide teaches, with where each was explained.
 *
 * A concept taught on THIS slide is not listed against itself, and only concepts the deck
 * actually teaches are offered, so every entry is a place the learner can go.
 */
export function relatedConcepts(deck: StudyDeck, slide: DeckSlide): RelatedConcept[] {
  const here = new Set(slide.taught_concept_ids);
  const seen = new Set<number>();
  const out: RelatedConcept[] = [];

  const add = (id: number, kind: RelatedConcept['kind']) => {
    const concept = deck.concepts[String(id)];
    if (!concept || here.has(id) || seen.has(id)) return;
    seen.add(id);
    const taught = deck.taught_by[String(id)] ?? [];
    out.push({ concept, kind, slide: taught.length ? taught[0] : null });
  };

  slide.taught_concept_ids.forEach((id) => {
    const concept = deck.concepts[String(id)];
    concept?.requires.forEach((req) => add(req, 'builds on'));
    concept?.related.forEach((rel) => add(rel.concept_id, 'connects to'));
  });
  if (slide.relationship) {
    add(slide.relationship.from, 'connects to');
    add(slide.relationship.to, 'connects to');
  }

  return out;
}

/** How a slide reads to the learner: a plain-words stage, not an internal type name. */
export const STAGE_LABEL: Record<string, string> = {
  cover: 'Chapter',
  hook: 'Introduction',
  objectives: 'What you will do',
  prior_knowledge: 'What you already know',
  concept_intro: 'Explanation',
  concept_visual: 'See it',
  worked_example: 'Worked example',
  relationship: 'How ideas connect',
  misconception: 'Common mistake',
  scenario: 'Decide',
  recall: 'Recall',
  practice: 'Practice',
  application: 'Use it',
  summary: 'Summary',
  concept_map: 'Big picture',
  challenge: 'Challenge',
  exit_ticket: 'Exit ticket',
};

export function stageLabel(slideType: string): string {
  return STAGE_LABEL[slideType] ?? 'Lesson';
}
