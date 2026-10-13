'use client';

/**
 * Write side of the Lesson Plan document (create + edit), sibling to the read-only
 * lessonPlanDocument.ts. Talks to POST /api/lesson-plan-doc/save and the four lookup
 * endpoints (topics, mapping options, content search, question-paper search) that
 * back the editor's activity pickers and mapping rows.
 *
 * Reuses lessonPlanDocument.ts's LessonPlanDocument/LessonPlanDaySection/
 * LessonPlanActivity/LessonPlanMapping types rather than redefining them - this module
 * only adds the write-only input shapes and the save/lookup functions.
 */

import { API_BASE_URL } from '@/app/components/utils/api_url';
import type { CurriculumSession } from './curriculum';
import type { LessonPlanActivity } from './lessonPlanDocument';

export interface LessonPlanMappingInput {
  type_id: number;
  value_id: number;
}

export interface LessonPlanDaySectionInput {
  day: number;
  topic_name: string | null;
  class_time: string | null;
  during_content: string | null;
  assessment_qualifying: string | null;
  learning_objective: string | null;
  learning_outcome: string | null;
  pedagogical_process: string | null;
  resource: string | null;
  closure: string | null;
  self_study_homework: string | null;
  self_study_activity_ids: number[];
  assessment: string | null;
  assessment_activity_ids: number[];
}

export interface LessonPlanDocumentInput {
  id: number | null;
  sub_institute_id: number | string;
  syear: number | string;
  standard_id: number | string;
  subject_id: number | string;
  chapter_id: number | string;
  topic_id: number | null;
  summary: {
    number_of_periods: number | null;
    teaching_time: string | null;
    assessment_time: string | null;
    learning_time: string | null;
    assessment_qualifying: string | null;
    mapping: LessonPlanMappingInput[];
  };
  teaching: {
    focus_point: string;
    pedagogical_process: string;
    resource: string;
    classroom_presentation: string;
    classroom_diversity: string;
    classroom_activity_ids: number[];
  };
  learning: {
    learning_objective: string | null;
    learning_knowledge: string | null;
    learning_skill: string | null;
    prerequisite: string | null;
    self_study_homework: string | null;
    self_study_activity_ids: number[];
    assessment: string | null;
    assessment_activity_ids: number[];
  };
  days: LessonPlanDaySectionInput[];
  map_and_alignment: {
    hard_word: string | null;
    tag_metatag: string | null;
    value_integration: string | null;
    global_connection: string | null;
    sel: string | null;
    stem: string | null;
    vocational_training: string | null;
    simulation: string | null;
    games: string | null;
    activities: string | null;
    real_life_application: string | null;
  };
}

export interface LessonPlanTopicOption {
  id: number;
  name: string;
}

export interface LessonPlanMappingOptions {
  types: { id: number; name: string }[];
  values: Record<number, { id: number; name: string }[]>;
}

export class LessonPlanDocumentApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'LessonPlanDocumentApiError';
  }
}

function firstValidationMessage(errors: unknown): string | null {
  if (!errors || typeof errors !== 'object') return null;
  for (const value of Object.values(errors as Record<string, unknown>)) {
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  }
  return null;
}

function baseUrl(session: CurriculumSession): string {
  return (session.hostName || API_BASE_URL).replace(/\/$/, '');
}

function headers(session: CurriculumSession): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${session.token}`,
  };
}

type Envelope<T> = { status: boolean; message?: string; data?: T; errors?: unknown };

async function request<T>(
  session: CurriculumSession,
  path: string,
  init: { method: 'GET' | 'POST'; query?: Record<string, string | number | undefined>; body?: unknown }
): Promise<T> {
  let url = `${baseUrl(session)}${path}`;
  const fetchInit: RequestInit = { method: init.method, headers: headers(session) };

  if (init.method === 'GET' && init.query) {
    const params = new URLSearchParams();
    Object.entries(init.query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    url += `?${params.toString()}`;
  }

  if (init.method === 'POST') {
    fetchInit.headers = { ...fetchInit.headers, 'Content-Type': 'application/json' };
    fetchInit.body = JSON.stringify(init.body ?? {});
  }

  const response = await fetch(url, fetchInit);

  let payload: Envelope<T> | null = null;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.status === false) {
    throw new LessonPlanDocumentApiError(
      firstValidationMessage(payload?.errors) || payload?.message || `Request failed (${response.status})`,
      response.status
    );
  }

  return payload?.data as T;
}

export function saveLessonPlanDocument(
  session: CurriculumSession,
  input: LessonPlanDocumentInput
): Promise<{ id: number }> {
  return request(session, '/api/lesson-plan-doc/save', { method: 'POST', body: input });
}

export function fetchLessonPlanTopics(
  session: CurriculumSession,
  params: { chapterId: number | string }
): Promise<LessonPlanTopicOption[]> {
  return request(session, '/api/lesson-plan-doc/topics', {
    method: 'GET',
    query: { sub_institute_id: session.subInstituteId, chapter_id: params.chapterId },
  });
}

export function fetchLessonPlanMappingOptions(
  session: CurriculumSession,
  params: { chapterId?: number | string; topicId?: number | string }
): Promise<LessonPlanMappingOptions> {
  return request(session, '/api/lesson-plan-doc/mapping-options', {
    method: 'GET',
    query: { chapter_id: params.chapterId, topic_id: params.topicId },
  });
}

export function searchLessonPlanContent(
  session: CurriculumSession,
  params: { standardId?: number | string; subjectId?: number | string; chapterId?: number | string; topicId?: number | string; q?: string }
): Promise<LessonPlanActivity[]> {
  return request(session, '/api/lesson-plan-doc/content-search', {
    method: 'GET',
    query: {
      sub_institute_id: session.subInstituteId,
      standard_id: params.standardId,
      subject_id: params.subjectId,
      chapter_id: params.chapterId,
      topic_id: params.topicId,
      q: params.q,
    },
  });
}

export function searchLessonPlanQuestionPapers(
  session: CurriculumSession,
  params: { standardId?: number | string; subjectId?: number | string; q?: string }
): Promise<LessonPlanActivity[]> {
  return request(session, '/api/lesson-plan-doc/question-paper-search', {
    method: 'GET',
    query: {
      sub_institute_id: session.subInstituteId,
      standard_id: params.standardId,
      subject_id: params.subjectId,
      q: params.q,
    },
  });
}
