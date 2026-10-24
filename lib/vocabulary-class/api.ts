import { API_BASE_URL } from '@/app/components/utils/api_url';
import { getRequestContext } from '@/app/course-master/page';
import { readApiJson } from '@/app/h5p/data/h5p';
import { deckForChapter, parseVocabularyDeck, type VocabularyDeck } from './deck';

export interface LoadedVocabularyClass {
  deck: VocabularyDeck;
  contentId: number | null;
  source: 'api';
}

/** The body of `POST /api/lms-vocabulary-class`: the chapter, the school, and the content item when one was chosen. */
export function vocabularyClassRequest(chapterId: number, instituteId: number, contentId: number | null): Record<string, number> {
  return {
    chapter_id: chapterId,
    ...(Number.isFinite(instituteId) && instituteId > 0 ? { sub_institute_id: instituteId } : {}),
    ...(contentId !== null && Number.isFinite(contentId) && contentId > 0 ? { content_id: contentId } : {}),
  };
}

export async function loadVocabularyClass(
  chapterId: number,
  options: { contentId?: number | null; signal?: AbortSignal }
): Promise<LoadedVocabularyClass> {
  const instituteId = Number(getRequestContext()?.sub_institute_id ?? NaN);
  const res = await fetch(`${API_BASE_URL}/api/lms-vocabulary-class`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify(vocabularyClassRequest(chapterId, instituteId, options.contentId ?? null)),
  });
  const raw = await readApiJson(res, 'Couldn’t load the vocabulary class');

  if (!res.ok || raw.status_code === 0) {
    throw new Error((raw.message as string) || 'Couldn’t load the vocabulary class.');
  }

  return { deck: deckForChapter(parseVocabularyDeck(raw.data), chapterId), contentId: Number(raw.content_id) || null, source: 'api' };
}
