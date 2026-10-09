/**
 * What a learner has done in a document's online practice, kept in this browser only.
 *
 * Nothing is written to the server: a tick on a checklist, a card that was opened and a question that was answered are the
 * learner's own place-keeping, not a record anyone reads. The shape is deliberately tiny (a set of keys) so it survives a
 * document being regenerated: a key that no longer exists is simply never asked for.
 *
 * NO REACT AND NO STORAGE API BEYOND A PASSED-IN OBJECT, so every rule is testable with node:test.
 */

export const PROGRESS_VERSION = 1;

export interface DocumentProgress {
  version: number;
  contentId: number;
  /** Keys of the things that are done: a question, an opened set of cards, a ticked checklist point. */
  done: string[];
  /** What the learner wrote for a reflection prompt, by key. Plain text, never sent anywhere. */
  notes: Record<string, string>;
  /** ISO time of the last change. */
  updatedAt: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ProgressAction =
  | { type: 'done'; key: string }
  | { type: 'undone'; key: string }
  | { type: 'toggle'; key: string }
  | { type: 'note'; key: string; text: string }
  | { type: 'reset' };

const MAX_NOTE = 2000;
const MAX_KEYS = 2000;

export function initialProgress(contentId: number, at = new Date().toISOString()): DocumentProgress {
  return { version: PROGRESS_VERSION, contentId, done: [], notes: {}, updatedAt: at };
}

export function progressReducer(state: DocumentProgress, action: ProgressAction, at = new Date().toISOString()): DocumentProgress {
  switch (action.type) {
    case 'done':
      return state.done.includes(action.key) || state.done.length >= MAX_KEYS ? state : { ...state, done: [...state.done, action.key], updatedAt: at };
    case 'undone':
      return state.done.includes(action.key) ? { ...state, done: state.done.filter((k) => k !== action.key), updatedAt: at } : state;
    case 'toggle':
      return progressReducer(state, { type: state.done.includes(action.key) ? 'undone' : 'done', key: action.key }, at);
    case 'note': {
      const text = action.text.slice(0, MAX_NOTE);
      if ((state.notes[action.key] ?? '') === text) return state;
      const notes = { ...state.notes };
      if (text === '') delete notes[action.key];
      else notes[action.key] = text;

      return { ...state, notes, updatedAt: at };
    }
    case 'reset':
      return initialProgress(state.contentId, at);
  }
}

export function doneSet(progress: DocumentProgress): ReadonlySet<string> {
  return new Set(progress.done);
}

/** Where a learner's progress for one document is kept: per learner and per content item, so two learners on one browser never share it. */
export function progressKey(userKey: string, contentId: number): string {
  return `study-document:${userKey}:${contentId}`;
}

/** Read saved progress. Anything unreadable, from another document or another version is a fresh start, never an error. */
export function loadProgress(storage: StorageLike | null, key: string, contentId: number): DocumentProgress {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return initialProgress(contentId);
    const saved = JSON.parse(raw) as Partial<DocumentProgress>;
    if (saved.version !== PROGRESS_VERSION || saved.contentId !== contentId || !Array.isArray(saved.done)) return initialProgress(contentId);

    return {
      version: PROGRESS_VERSION,
      contentId,
      done: saved.done.filter((k): k is string => typeof k === 'string').slice(0, MAX_KEYS),
      notes: Object.fromEntries(
        Object.entries(saved.notes && typeof saved.notes === 'object' ? saved.notes : {})
          .filter(([k, v]) => typeof v === 'string' && k.length < 80)
          .map(([k, v]) => [k, (v as string).slice(0, MAX_NOTE)]),
      ),
      updatedAt: typeof saved.updatedAt === 'string' ? saved.updatedAt : new Date().toISOString(),
    };
  } catch {
    return initialProgress(contentId);
  }
}

/** Save progress. Returns false when the browser would not store it (private mode, quota): the practice still works, it just is not remembered. */
export function saveProgress(storage: StorageLike | null, key: string, progress: DocumentProgress): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(progress));

    return true;
  } catch {
    return false;
  }
}
