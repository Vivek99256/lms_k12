'use client';

import { API_BASE_URL } from '@/app/components/utils/api_url';
import { getRequestContext } from '@/app/course-master/page';
import { fetchWholeChapter } from '@/app/h5p/data/question-bank-library';
import { readApiJson } from '@/app/h5p/data/h5p';
import { fetchCpDraft, fetchCpPreview } from '@/lib/coursePresentation/api';
import type { ImageEditStates } from '@/lib/study-deck/imageEditing';
import { parseDeck } from '@/lib/study-deck/deck';
import { imageUrlsRequest, resolveDeckImages } from '@/lib/study-deck/images';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import type { StudyDeck } from '@/lib/study-deck/types';

/**
 * Where the student study deck's data comes from. Everything here is a READ.
 *
 * deck      the JSON the generator stored beside the chapter's presentation file, via
 *           `POST /api/lms-study-deck`. When the learner came from a specific content item (the Classroom
 *           Resource list), `contentId` asks for exactly that item. Its pictures are rows in the database; the
 *           API sends each as an address the browser can load, so nothing here depends on a file served by this
 *           app. For review before anything is stored, `pilot` reads the local review copy of the deck
 *           (/study-deck/chapter-<id>/deck.json, development only, see PILOT_NOTE). That file holds picture
 *           REFERENCES only; no picture file is kept there, and the player asks the API for their addresses.
 * questions the existing question bank, `POST /api/lms-question-bank`, the same rows every other
 *           module plays. The deck holds question ids and activity choices, never question text.
 */

export interface LoadedDeck {
  deck: StudyDeck;
  /** Where the deck's relative image paths are served from; null when they are absolute URLs. */
  assetBase: string | null;
  source: 'api' | 'pilot' | 'preview' | 'draft';
  /** A draft only: what it is (a review copy, nothing stored). */
  draft?: { notice: string; /** The run being reviewed, and per slide whether its picture can be replaced. */ run: string; slideImages: ImageEditStates };
  /** A preview only: what it is, and what the stored data could not supply. */
  preview?: { notice: string; missing: { what: string; where: string; why: string }[]; summary: { slides: number; pictures_placed: number; concepts_with_intelligence: number; concepts: number }; coverage: { total_concepts: number; renderable: number; from_intelligence: number; from_concept_record_only: number; unresolved: number } };
}

/** The pilot reads a copy of the local review bundle that `lms:generate-study-deck --export-player` wrote. */
export const PILOT_NOTE = 'This is a local review copy of the study deck. Nothing has been saved to the school library yet.';

/** The body of `POST /api/lms-study-deck`: the chapter, the school, and the content item when one was chosen. */
export function studyDeckRequest(chapterId: number, instituteId: number, contentId: number | null): Record<string, number> {
  return {
    chapter_id: chapterId,
    ...(Number.isFinite(instituteId) && instituteId > 0 ? { sub_institute_id: instituteId } : {}),
    ...(contentId !== null && Number.isFinite(contentId) && contentId > 0 ? { content_id: contentId } : {}),
  };
}

/**
 * Addresses for the pictures a locally held deck names by reference: one request for the whole deck. Only the pictures
 * this school may see come back; the others stay as references and show nothing.
 */
async function fetchImageUrls(ids: number[], instituteId: number, signal?: AbortSignal): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE_URL}/api/lms-study-deck/image-urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(imageUrlsRequest(ids, instituteId)),
  });
  const raw = await readApiJson(res, 'Couldn’t load the study deck pictures');

  if (!res.ok || raw.status_code === 0) {
    throw new Error((raw.message as string) || 'Couldn’t load the study deck pictures.');
  }

  return (raw.data ?? {}) as Record<string, string>;
}

export async function loadStudyDeck(chapterId: number, options: { pilot: boolean; contentId?: number | null; preview?: { pedagogy: string; format: string } | null; draft?: string | null; signal?: AbortSignal }): Promise<LoadedDeck> {
  const instituteId = Number(getRequestContext()?.sub_institute_id ?? NaN);

  // A generated DRAFT waiting for a teacher's review: played from the server's review copy, before anything is stored.
  if (options.draft) {
    const res = await fetchCpDraft(chapterId, options.draft, options.signal);
    const deck = await resolveDeckImages(parseDeck(res.deck), (ids) => fetchImageUrls(ids, instituteId, options.signal));

    return { deck, assetBase: null, source: 'draft', draft: { notice: res.notice, run: options.draft, slideImages: res.slide_images ?? {} } };
  }

  // A Course Presentation PREVIEW: the chosen template filled from the chapter's stored data by the server (read only,
  // no AI call, nothing stored). Its pictures arrive as addresses the school may load; the deck is checked like any other.
  if (options.preview) {
    const res = await fetchCpPreview(chapterId, options.preview.pedagogy, options.preview.format, options.signal);
    return { deck: parseDeck(res.deck), assetBase: null, source: 'preview', preview: { notice: res.notice, missing: res.missing, summary: res.summary, coverage: res.coverage.summary } };
  }

  if (options.pilot) {
    const base = `/study-deck/chapter-${chapterId}`;
    const res = await fetch(`${base}/deck.json`, { signal: options.signal, cache: 'no-store' });
    if (!res.ok) {
      throw new Error('There is no local review copy of this chapter’s study deck.');
    }

    const deck = await resolveDeckImages(parseDeck(await res.json()), (ids) => fetchImageUrls(ids, instituteId, options.signal));

    return { deck, assetBase: base, source: 'pilot' };
  }

  const res = await fetch(`${API_BASE_URL}/api/lms-study-deck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify(studyDeckRequest(chapterId, instituteId, options.contentId ?? null)),
  });
  const raw = await readApiJson(res, 'Couldn’t load the study deck');

  if (!res.ok || raw.status_code === 0) {
    throw new Error((raw.message as string) || 'Couldn’t load the study deck.');
  }

  // The API sends addresses already; this only fills in any picture it left as a reference.
  const deck = await resolveDeckImages(parseDeck(raw.data), (ids) => fetchImageUrls(ids, instituteId, options.signal));

  return { deck, assetBase: null, source: 'api' };
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
