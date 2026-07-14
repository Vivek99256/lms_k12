import { API_BASE_URL } from '@/app/components/utils/api_url';

export interface ApiChapter {
  id?: number;
  chapter_id?: number;
  subject_id?: number;
  standard_id?: number;
  chapter_name: string;
  chapter_desc: string | null;
  sort_order?: number;
  total_content?: number | string;
  total_triz_content?: number | string;
  total_OER_content?: number | string;
  content_categories?: Record<string, unknown[]>;
  concepts?: {
    concept_id?: number | string;
    concept_name?: string;
    concept_description?: string;
    semantic?: unknown;
  }[];
}

export interface LmsSubject {
  standard_name: string;
  subject_name: string;
  subject_id: number;
  standard_id: number;
  display_image: string;
  content_category: string;
  sub_institute_id: number;
  chapters: ApiChapter[];
  category_name?: string;
  key_concepts_count?: number | string;
  key_concept_count?: number | string;
  concepts_count?: number | string;
  total_concepts?: number | string;
  keyConcepts?: unknown[];
  concepts?: unknown[];
  lesson_plans_count?: number | string;
  lesson_plan_count?: number | string;
  total_lesson_plans?: number | string;
  lessonPlans?: unknown[];
}

export interface LmsCoursesResponse {
  status_code: number;
  message: string;
  lms_subject: LmsSubject[];
  categories: string[];
  sub_institute_id: number;
}

export interface LmsCoursesRequest {
  type: 'API';
  sub_institute_id: number;
  syear: string | number;
  user_id?: number;
  user_profile_name?: string;
  user_profile_id?: number;
  client_id?: number;
}

export async function fetchLmsCourses(
  request: LmsCoursesRequest
): Promise<LmsCoursesResponse> {
  const res = await fetch(`${API_BASE_URL}/api/lms-courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: request.type,
      sub_institute_id: request.sub_institute_id,
      syear: request.syear,
      user_id: request.user_id,
      user_profile_name: request.user_profile_name,
      user_profile_id: request.user_profile_id,
      client_id: request.client_id,
    }),
  });

  const raw = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((raw.message as string) || 'Failed to fetch courses');
  }
  if ((raw.status_code as number) !== 1) {
    throw new Error((raw.message as string) || 'Course master request failed');
  }

  const seen = new Map<string, LmsSubject>();
  const categorySet = new Set<string>();

  const collect = (items: unknown[]) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const subject = item as LmsSubject;
      if (subject.subject_id != null && subject.standard_id != null) {
        const key = `${subject.subject_id}_${subject.standard_id}`;
        if (!seen.has(key)) {
          seen.set(key, subject);
        }
        if (subject.content_category) {
          categorySet.add(subject.content_category);
        }
      }
    }
  };

  const lmsSubjectRaw = raw.lms_subject;
  if (Array.isArray(lmsSubjectRaw)) {
    collect(lmsSubjectRaw);
  } else if (lmsSubjectRaw && typeof lmsSubjectRaw === 'object') {
    for (const value of Object.values(lmsSubjectRaw)) {
      collect(value as unknown[]);
    }
  }
  for (const [key, value] of Object.entries(raw)) {
    if (['status_code', 'message', 'lms_subject', 'sub_institute_id'].includes(key)) continue;
    collect(value as unknown[]);
  }

  return {
    status_code: raw.status_code as number,
    message: raw.message as string,
    lms_subject: Array.from(seen.values()),
    categories: Array.from(categorySet).sort(),
    sub_institute_id: (raw.sub_institute_id as number) ?? request.sub_institute_id,
  };
}

export interface GroupedSubject extends LmsSubject {
  category: string;
}

export interface StandardGroup {
  standardName: string;
  categories: {
    categoryName: string;
    subjects: LmsSubject[];
  }[];
}

export function groupCoursesByStandard(subjects: LmsSubject[]): StandardGroup[] {
  const standardMap = new Map<string, Map<string, LmsSubject[]>>();

  for (const subject of subjects) {
    const standard = subject.standard_name || 'Unknown';
    if (!standardMap.has(standard)) {
      standardMap.set(standard, new Map<string, LmsSubject[]>());
    }
    const categoryMap = standardMap.get(standard)!;
    const category = subject.content_category || 'Unknown';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(subject);
  }

  return Array.from(standardMap.entries())
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([standardName, categoryMap]) => ({
      standardName,
      categories: Array.from(categoryMap.entries()).map(([categoryName, subjects]) => ({
        categoryName,
        subjects,
      })),
    }));
}
