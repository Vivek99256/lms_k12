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
// ---------------------------------------------------------------------------

/** The keys of the activities a slide asks the learner to do. */
export function slideKeys(slide: DeckSlide, playable?: ReadonlySet<string>): string[] {
  const keys = slide.activities.map((_, index) => activityKey(slide, index));

  return playable ? keys.filter((key) => playable.has(key)) : keys;
}

export interface SlideStatus {
  visited: boolean;
  total: number;
  done: number;
  complete: boolean;
}

/** A slide is complete once it was opened and every activity it asked for was done. */
export function slideStatus(slide: DeckSlide, progress: DeckProgress, playable?: ReadonlySet<string>): SlideStatus {
  const keys = slideKeys(slide, playable);
  const done = keys.filter((key) => progress.activities[key]?.done).length;
  const visited = progress.visited.includes(slide.n);

  return { visited, total: keys.length, done, complete: visited && done === keys.length };
}

export interface ConceptStatus {
  conceptId: number;
  /** Every slide that teaches it has been opened. */
  taught: boolean;
  activities: number;
  done: number;
  correct: number;
  /** Written answers are not marked, so they are neither right nor wrong here. */
  unmarked: number;
}

export function conceptStatus(deck: StudyDeck, progress: DeckProgress, conceptId: number): ConceptStatus {
  const taughtOn = deck.taught_by[String(conceptId)] ?? [];
  let activities = 0;
  let done = 0;
  let correct = 0;
  let unmarked = 0;

  deck.slides.forEach((slide) =>
    slide.activities.forEach((activity, index) => {
      if (activity.concept_id !== conceptId) return;
      activities += 1;
      const record = progress.activities[activityKey(slide, index)];
      if (!record?.done) return;
      done += 1;
      if (record.correct === true) correct += 1;
      if (record.correct === null) unmarked += 1;
    })
  );

  return {
    conceptId,
    taught: taughtOn.length > 0 && taughtOn.every((n) => progress.visited.includes(n)),
    activities,
    done,
    correct,
    unmarked,
  };
}

export interface DeckTotals {
  slides: number;
  visited: number;
  activities: number;
  done: number;
  correct: number;
  marked: number;
  percent: number;
}

export function deckTotals(deck: StudyDeck, progress: DeckProgress, playable?: ReadonlySet<string>): DeckTotals {
  let activities = 0;
  let done = 0;
  let correct = 0;
  let marked = 0;

  deck.slides.forEach((slide) =>
    slideKeys(slide, playable).forEach((key) => {
      activities += 1;
      const record = progress.activities[key];
      if (!record?.done) return;
      done += 1;
      if (record.correct !== null) marked += 1;
      if (record.correct === true) correct += 1;
    })
  );

  const visited = deck.slides.filter((slide) => progress.visited.includes(slide.n)).length;
  const units = deck.slides.length + activities;

  return {
    slides: deck.slides.length,
    visited,
    activities,
    done,
    correct,
    marked,
    percent: units === 0 ? 0 : Math.round(((visited + done) / units) * 100),
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
