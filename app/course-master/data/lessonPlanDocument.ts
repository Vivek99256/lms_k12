'use client';

/**
 * Read-only view of the static, manually-authored Lesson Plan (standard +
 * subject + chapter -> focus point, pedagogical process, learning outcomes,
 * day-wise planning, map & alignment, ...).
 *
 * This is NOT the AI "Lesson Intelligence" calendar at
 * /course-master/lesson-plan/[courseId] (periods, scheduling, macro/meso/micro
 * planning) - that is a separate backend feature on different tables. This
 * file talks to GET /api/lesson-plan-doc, a thin read-only endpoint over
 * lms_lesson_plan / lms_lessonplan_dayswise.
 */

import { API_BASE_URL } from '@/app/components/utils/api_url';
import type { CurriculumSession } from './curriculum';

export interface LessonPlanActivity {
  id: number;
  title: string | null;
}

export interface LessonPlanMapping {
  type: string | null;
  value: string | null;
}

export interface LessonPlanDaySection {
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
  self_study_activity: LessonPlanActivity[];
  assessment: string | null;
  assessment_activity: LessonPlanActivity[];
}

export interface LessonPlanDocument {
  id: number;
  standard_id: number;
  standard_name: string | null;
  subject_id: number;
  subject_name: string | null;
  chapter_id: number;
  chapter_name: string | null;
  topic_id: number | null;
  topic_name: string | null;
  summary: {
    number_of_periods: string | number | null;
    teaching_time: string | null;
    assessment_time: string | null;
    learning_time: string | null;
    assessment_qualifying: string | null;
    mapping: LessonPlanMapping[];
  };
  teaching: {
    focus_point: string | null;
    pedagogical_process: string | null;
    resource: string | null;
    classroom_presentation: string | null;
    classroom_diversity: string | null;
    classroom_activity: LessonPlanActivity[];
  };
  learning: {
    learning_objective: string | null;
    learning_knowledge: string | null;
    learning_skill: string | null;
    prerequisite: string | null;
    self_study_homework: string | null;
    self_study_activity: LessonPlanActivity[];
    assessment: string | null;
    assessment_activity: LessonPlanActivity[];
  };
  days: LessonPlanDaySection[];
  map_and_alignment: {
    hard_word: string | null;
    tag_metatag: string | null;
    value_integration: string | null;
    global_connection: string | null;
    cross_curriculum: string | null;
    sel: string | null;
    stem: string | null;
    vocational_training: string | null;
    simulation: string | null;
    games: string | null;
    activities: string | null;
    real_life_application: string | null;
  };
}

type Envelope = { status: boolean; message?: string; data?: LessonPlanDocument | null };

function baseUrl(session: CurriculumSession): string {
  return (session.hostName || API_BASE_URL).replace(/\/$/, '');
}

function headers(session: CurriculumSession): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${session.token}`,
  };
}

export async function fetchLessonPlanDocument(
  session: CurriculumSession,
  params: {
    subjectId: string | number;
    standardId: string | number;
    chapterId: string | number;
    subInstituteId: string | number;
  }
): Promise<LessonPlanDocument | null> {
  const query = new URLSearchParams({
    sub_institute_id: String(params.subInstituteId),
    standard_id: String(params.standardId),
    subject_id: String(params.subjectId),
    chapter_id: String(params.chapterId),
  });

  const response = await fetch(`${baseUrl(session)}/api/lesson-plan-doc?${query.toString()}`, {
    method: 'GET',
    headers: headers(session),
  });

  let payload: Envelope | null = null;
  try {
    payload = (await response.json()) as Envelope;
  } catch {
    payload = null;
  }

  // A 404 here means "nobody has authored a lesson plan for this chapter
  // yet" - an expected, common state the page renders as an empty state,
  // not a failure to surface as an error.
  if (response.status === 404) {
    return null;
  }

  if (!response.ok || payload?.status === false) {
    throw new Error(payload?.message || `Request failed (${response.status})`);
  }

  return payload?.data ?? null;
}
