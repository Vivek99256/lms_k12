'use client';

/**
 * Quiz builder API client.
 *
 * Wraps the Laravel `ApiLmsCourseController` REST endpoints (see
 * `routes/api.php`) using this project's shared `lib/erp-client.ts`
 * session/header helpers.
 *
 * - `POST /api/lms-courses` -> subjects (grouped by content category) with their chapters,
 *   used to populate the subject/chapter dropdowns.
 */

import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

export { buildSessionContext };
export type { SessionContext };

export type QuizChapter = {
  id: number;
  name: string;
};

export type QuizSubject = {
  id: number;
  name: string;
  standardId: number;
  chapters: QuizChapter[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>);
  return [];
}

function readNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

async function postForm<T>(session: SessionContext, path: string, extraParams?: Record<string, string>): Promise<T> {
  const body = new URLSearchParams();
  appendCommonParams(body, session);
  if (session.userId) body.set('user_id', session.userId);
  Object.entries(extraParams ?? {}).forEach(([key, value]) => {
    if (value) body.set(key, value);
  });

  const response = await fetch(`${session.baseUrl}/api${path}`, {
    method: 'POST',
    headers: createAuthHeaders(session, 'application/x-www-form-urlencoded'),
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(readString(payload.message) || `Request failed (${response.status})`);
  }
  return payload as T;
}

function chapterFromRow(row: unknown): QuizChapter {
  const record = asRecord(row);
  return {
    id: readNumber(record.id),
    name: readString(record.chapter_name) || readString(record.name),
  };
}

/** Flattens the `lms-courses` response (grouped by content category) into a de-duplicated subject list with nested chapters. */
export async function fetchQuizSubjects(session: SessionContext): Promise<QuizSubject[]> {
  const payload = await postForm<Record<string, unknown>>(session, '/lms-courses');
  const grouped = asRecord(payload.lms_subject);

  const subjectsById = new Map<number, QuizSubject>();
  Object.values(grouped).forEach((categoryRows) => {
    toArray(categoryRows).forEach((row) => {
      const record = asRecord(row);
      const subjectId = readNumber(record.subject_id);
      if (!subjectId || subjectsById.has(subjectId)) return;

      subjectsById.set(subjectId, {
        id: subjectId,
        name: readString(record.subject_name),
        standardId: readNumber(record.standard_id),
        chapters: toArray(record.chapters).map(chapterFromRow).filter((chapter) => chapter.id),
      });
    });
  });

  return Array.from(subjectsById.values()).filter((subject) => subject.id && subject.name);
}
