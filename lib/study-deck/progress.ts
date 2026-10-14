/**
 * Lightweight student-side progress for a study deck.
 *
 * WHY CLIENT-SIDE. No LMS attempt/progress API exists for study content: PAL records exam
 * attempts (`lms_online_exam_answer`) and the H5P library records nothing, by design. Rather
 * than invent a progress table, the pilot keeps progress in the browser and says so on screen.
 * `onResult` is the seam: a later step can send the same records to a real endpoint without
 * touching the player.
 *
 * PURE. The reducer and selectors take plain data; only `loadProgress` / `saveProgress` touch
 * storage, and they take it as a parameter, swallow every storage error (private windows,
 * blocked storage) and never throw.
 */

import { activityKey } from './deck';
import { exampleCards, exampleKey, interactionKey } from './interactions';
import type { DeckSlide, StudyDeck } from './types';

export interface ActivityRecord {
  done: true;
  /** Null for a written answer: nothing in this platform marks prose. */
  correct: boolean | null;
  score: number | null;
  maxScore: number | null;
  attempts: number;
  at: string;
  conceptId: number | null;
  questionId: number | null;
}

export interface DeckProgress {
  version: 1;
  chapterId: number;
  /** Slide numbers the learner has opened. */
  visited: number[];
  activities: Record<string, ActivityRecord>;
  /** The slide to resume at. */
  current: number;
  updatedAt: string;
}

export interface ResultInput {
  correct: boolean | null;
  score: number | null;
  maxScore: number | null;
}

export type ProgressAction =
  | { type: 'goto'; n: number; at?: string }
  | { type: 'result'; key: string; result: ResultInput; conceptId: number | null; questionId: number | null; at?: string }
  | { type: 'reset'; at?: string };

export function initialProgress(chapterId: number, at = new Date().toISOString()): DeckProgress {
  return { version: 1, chapterId, visited: [], activities: {}, current: 1, updatedAt: at };
}

export function progressReducer(state: DeckProgress, action: ProgressAction): DeckProgress {
  const at = action.at ?? new Date().toISOString();

  switch (action.type) {
    case 'goto':
      return {
        ...state,
        current: action.n,
        visited: state.visited.includes(action.n) ? state.visited : [...state.visited, action.n].sort((a, b) => a - b),
        updatedAt: at,
      };

    case 'result': {
      const before = state.activities[action.key];
      const record: ActivityRecord = {
        done: true,
        // A retry that gets it right counts; a retry never un-completes an activity.
        correct: action.result.correct === true || before?.correct === true ? true : action.result.correct,
        score: Math.max(action.result.score ?? 0, before?.score ?? 0) || action.result.score,
        maxScore: action.result.maxScore ?? before?.maxScore ?? null,
        attempts: (before?.attempts ?? 0) + 1,
        at,
        conceptId: action.conceptId,
        questionId: action.questionId,
      };

      return { ...state, activities: { ...state.activities, [action.key]: record }, updatedAt: at };
    }

    case 'reset':
      return initialProgress(state.chapterId, at);
  }
}

// ---------------------------------------------------------------------------
// Selectors
//
// WHAT COUNTS. A slide's INTERACTION (hotspots, scenario, reveal) is part of the lesson, so exploring
// it counts toward the slide and the chapter. PRACTICE (an optional question-bank activity) does not
// hold anything up: it is tracked and shown, but a learner who skips it has still finished the slide.
// ---------------------------------------------------------------------------

/** The keys of what a slide asks the learner to explore: its interaction and its example screen, where it has them. */
export function slideKeys(slide: DeckSlide): string[] {
  const keys: string[] = [];
  if (slide.interaction) keys.push(interactionKey(slide));
  if (exampleCards(slide).length > 0) keys.push(exampleKey(slide));

  return keys;
}

/** The keys of a slide's optional practice activities, limited to those that can really be played. */
export function practiceKeys(slide: DeckSlide, playable?: ReadonlySet<string>): string[] {
  const keys = slide.activities.map((_, index) => activityKey(slide, index));

  return playable ? keys.filter((key) => playable.has(key)) : keys;
}

export interface SlideStatus {
  visited: boolean;
  /** Interactions to explore on this slide (0 or 1). */
  total: number;
  done: number;
  /** Opened, and its interaction (if any) explored. Practice is optional and never blocks. */
  complete: boolean;
  practice: { total: number; done: number };
}

export function slideStatus(slide: DeckSlide, progress: DeckProgress, playable?: ReadonlySet<string>): SlideStatus {
  const keys = slideKeys(slide);
  const done = keys.filter((key) => progress.activities[key]?.done).length;
  const visited = progress.visited.includes(slide.n);
  const practice = practiceKeys(slide, playable);

  return {
    visited,
    total: keys.length,
    done,
    complete: visited && done === keys.length,
    practice: { total: practice.length, done: practice.filter((key) => progress.activities[key]?.done).length },
  };
}

export interface ConceptStatus {
  conceptId: number;
  /** Every slide that teaches it has been opened. */
  taught: boolean;
  /** Interactions on the slides that teach it, and how many were explored. */
  interactions: number;
  explored: number;
  /** Taught, and every interaction on those slides explored. */
  complete: boolean;
  /** Optional practice questions for it: asked, done, right. */
  activities: number;
  done: number;
  correct: number;
  /** Written answers are not marked, so they are neither right nor wrong here. */
  unmarked: number;
}

export function conceptStatus(deck: StudyDeck, progress: DeckProgress, conceptId: number): ConceptStatus {
  const taughtOn = deck.taught_by[String(conceptId)] ?? [];
  let interactions = 0;
  let explored = 0;
  let activities = 0;
  let done = 0;
  let correct = 0;
  let unmarked = 0;

  deck.slides.forEach((slide) => {
    if (slide.taught_concept_ids.includes(conceptId)) {
      slideKeys(slide).forEach((key) => {
        interactions += 1;
        if (progress.activities[key]?.done) explored += 1;
      });
    }
    slide.activities.forEach((activity, index) => {
      if (activity.concept_id !== conceptId) return;
      activities += 1;
      const record = progress.activities[activityKey(slide, index)];
      if (!record?.done) return;
      done += 1;
      if (record.correct === true) correct += 1;
      if (record.correct === null) unmarked += 1;
    });
  });

  const taught = taughtOn.length > 0 && taughtOn.every((n) => progress.visited.includes(n));

  return { conceptId, taught, interactions, explored, complete: taught && explored === interactions, activities, done, correct, unmarked };
}

export interface DeckTotals {
  slides: number;
  visited: number;
  /** Interactions in the deck, and how many were explored. */
  interactions: number;
  explored: number;
  /** Optional practice: asked, done, right, and how many of those were marked. */
  practice: number;
  practiceDone: number;
  correct: number;
  marked: number;
  percent: number;
}

export function deckTotals(deck: StudyDeck, progress: DeckProgress, playable?: ReadonlySet<string>): DeckTotals {
  let interactions = 0;
  let explored = 0;
  let practice = 0;
  let practiceDone = 0;
  let correct = 0;
  let marked = 0;

  deck.slides.forEach((slide) => {
    slideKeys(slide).forEach((key) => {
      interactions += 1;
      if (progress.activities[key]?.done) explored += 1;
    });
    practiceKeys(slide, playable).forEach((key) => {
      practice += 1;
      const record = progress.activities[key];
      if (!record?.done) return;
      practiceDone += 1;
      if (record.correct !== null) marked += 1;
      if (record.correct === true) correct += 1;
    });
  });

  const visited = deck.slides.filter((slide) => progress.visited.includes(slide.n)).length;
  const units = deck.slides.length + interactions;

  return {
    slides: deck.slides.length,
    visited,
    interactions,
    explored,
    practice,
    practiceDone,
    correct,
    marked,
    percent: units === 0 ? 0 : Math.round(((visited + explored) / units) * 100),
  };
}

// ---------------------------------------------------------------------------
// Persistence (best effort)
// ---------------------------------------------------------------------------

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function progressKey(userKey: string, chapterId: number): string {
  return `studydeck:v1:${userKey}:${chapterId}`;
}

/** Saved progress, or a fresh start when there is none, it is unreadable, or it is for another chapter. */
export function loadProgress(storage: StorageLike | null, key: string, chapterId: number): DeckProgress {
  try {
    const raw = storage?.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeckProgress>;
      if (parsed.version === 1 && parsed.chapterId === chapterId && Array.isArray(parsed.visited) && parsed.activities) {
        return parsed as DeckProgress;
      }
    }
  } catch {
    // Unreadable or blocked storage is not an error the learner should see.
  }

  return initialProgress(chapterId);
}

export function saveProgress(storage: StorageLike | null, key: string, progress: DeckProgress): boolean {
  try {
    storage?.setItem(key, JSON.stringify(progress));
    return storage !== null;
  } catch {
    return false;
  }
}
