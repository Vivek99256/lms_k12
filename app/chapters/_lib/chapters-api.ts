'use client';

import {
  fetchChapterContent,
  getSubjectAndChapters,
  type Chapter,
  type ChapterContentAsset,
} from '@/app/course-master/data/chapters';
import { getRequestContext } from '@/app/course-master/page';

export type { Chapter };

export async function fetchChapters(subjectId: string, standardId?: string) {
  return getSubjectAndChapters(subjectId, standardId, { resolveDisplayNames: true });
}

/** First PDF-type asset for a chapter's study material, if any has been uploaded. */
export async function fetchChapterPdfAsset(chapterId: number): Promise<ChapterContentAsset | null> {
  const requestContext = getRequestContext();
  if (!requestContext) return null;

  try {
    const content = await fetchChapterContent(chapterId, requestContext.sub_institute_id);
    for (const assets of Object.values(content.content_categories)) {
      const pdfAsset = assets.find((asset) => (asset.file_type || '').toLowerCase().includes('pdf'));
      if (pdfAsset) return pdfAsset;
    }
    for (const assets of Object.values(content.content_categories)) {
      if (assets.length > 0) return assets[0];
    }
    return null;
  } catch {
    return null;
  }
}

export function chapterLessons(chapter: Chapter): string[] {
  return (chapter.concepts ?? []).map((concept) => concept.title).filter(Boolean);
}

export function chapterContentText(chapter: Chapter): string {
  const descriptions = (chapter.concepts ?? [])
    .map((concept) => concept.description)
    .filter((description): description is string => Boolean(description && description.trim()));
  if (descriptions.length > 0) return descriptions.join(' ');
  return chapter.semantic?.learning_objective || 'Content for this chapter has not been added yet.';
}
