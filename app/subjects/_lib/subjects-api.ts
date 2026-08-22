'use client';

import { fetchLmsCourses, type LmsSubject } from '@/app/course-master/data/lmsCourses';
import { getRequestContext, getSyear } from '@/app/course-master/page';

export type { LmsSubject };

/**
 * Fetches the subject catalog (with chapter/coverage counts) from the same
 * live `/api/lms-courses` endpoint the Course master module already uses —
 * there is no separate "my subjects" endpoint, so this reuses that catalog.
 */
export async function fetchSubjects(): Promise<LmsSubject[]> {
  const requestContext = getRequestContext();
  if (!requestContext) {
    throw new Error('Current session is missing institute or user context. Please sign in again.');
  }

  const response = await fetchLmsCourses({
    type: 'API',
    sub_institute_id: requestContext.sub_institute_id,
    syear: getSyear(),
    user_id: requestContext.user_id,
    user_profile_name: requestContext.user_profile_name,
    user_profile_id: requestContext.user_profile_id,
    client_id: requestContext.client_id,
  });

  return response.lms_subject;
}

export function subjectChapterCount(subject: LmsSubject): number {
  const explicit = subject.chapter_count ?? subject.chapters_count;
  if (explicit != null && explicit !== '') return Number(explicit) || 0;
  return Array.isArray(subject.chapters) ? subject.chapters.length : 0;
}

export function subjectProgress(subject: LmsSubject): number {
  const explicit = subject.coverage_percentage ?? subject.lesson_planning_coverage;
  const numeric = explicit != null && explicit !== '' ? Number(explicit) : NaN;
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(100, Math.round(numeric)));
  return 0;
}
