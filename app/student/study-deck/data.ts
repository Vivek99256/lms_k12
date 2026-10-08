'use client';

import { API_BASE_URL } from '@/app/components/utils/api_url';
import { getRequestContext } from '@/app/course-master/page';
import { fetchWholeChapter } from '@/app/h5p/data/question-bank-library';
import { readApiJson } from '@/app/h5p/data/h5p';
import { parseDeck } from '@/lib/study-deck/deck';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import type { StudyDeck } from '@/lib/study-deck/types';

/**
 * Where the student study deck's data comes from. Everything here is a READ.
 *
 * deck      the JSON the generator stored beside the chapter's presentation file, via
 *           `POST /api/lms-study-deck`. For review before anything is stored, `pilot` reads the
 *           local review bundle from /study-deck/chapter-<id>/ instead (see PILOT_NOTE).
 * questions the existing question bank, `POST /api/lms-question-bank`, the same rows every other
 *           module plays. The deck holds question ids and activity choices, never question text.
 */

export interface LoadedDeck {
  deck: StudyDeck;
  /** Where the deck's relative image paths are served from; null when they are absolute URLs. */
  assetBase: string | null;
  source: 'api' | 'pilot';
}

/** The pilot reads a copy of the local review bundle that `lms:generate-study-deck --export-player` wrote. */
export const PILOT_NOTE = 'This is a local review copy of the study deck. Nothing has been saved to the school library yet.';

export async function loadStudyDeck(chapterId: number, options: { pilot: boolean; signal?: AbortSignal }): Promise<LoadedDeck> {
  if (options.pilot) {
    const base = `/study-deck/chapter-${chapterId}`;
    const res = await fetch(`${base}/deck.json`, { signal: options.signal, cache: 'no-store' });
    if (!res.ok) {
      throw new Error('There is no local review copy of this chapter’s study deck.');
    }

    return { deck: parseDeck(await res.json()), assetBase: base, source: 'pilot' };
  }

  const instituteId = Number(getRequestContext()?.sub_institute_id ?? NaN);
  const res = await fetch(`${API_BASE_URL}/api/lms-study-deck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify(Number.isFinite(instituteId) && instituteId > 0 ? { chapter_id: chapterId, sub_institute_id: instituteId } : { chapter_id: chapterId }),
  });
  const raw = await readApiJson(res, 'Couldn’t load the study deck');

  if (!res.ok || raw.status_code === 0) {
    throw new Error((raw.message as string) || 'Couldn’t load the study deck.');
  }

  return { deck: parseDeck(raw.data), assetBase: null, source: 'api' };
}

/** The chapter's question-bank rows. The deck picks out the ones it names. */
export async function loadBank(chapterId: number, signal?: AbortSignal): Promise<BankQuestion[]> {
  return (await fetchWholeChapter(chapterId, signal)) as unknown as BankQuestion[];
}

/** Identifies the learner for progress storage; a shared browser profile still separates learners. */
export function learnerKey(): string {
  const context = getRequestContext();

  return context ? `${context.sub_institute_id}-${context.user_id}` : 'guest';
}
