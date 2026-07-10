import { fetchLmsCourses, type LmsSubject } from './lmsCourses';
import { getRequestContext, getSyear } from '../page';

export interface Chapter {
  id: string;
  courseId: string;
  number: number;
  title: string;
  content_categories?: Record<string, unknown[]>;
  teachingMethodologies: string[];
  resources: {
    teacherResource: number;
    lessonPlanning: number;
    chapterMapping: number;
    hspContent: number;
    questions: number;
  };
}

interface ApiChapterSource {
  id: number;
  chapter_name: string;
  chapter_desc?: string;
  sort_order: number;
  total_content?: number | string;
  total_triz_content?: number | string;
  total_OER_content?: number | string;
  content_categories?: Record<string, unknown[]>;
}

export interface SubjectWithChapters {
  subject: LmsSubject | null;
  chapters: Chapter[];
}

export async function getSubjectAndChapters(subjectId: string, standardId?: string): Promise<SubjectWithChapters> {
  const requestContext = getRequestContext();
  if (!requestContext) return { subject: null, chapters: [] };

  try {
    const response = await fetchLmsCourses({
      type: 'API',
      sub_institute_id: requestContext.sub_institute_id,
      syear: getSyear(),
      user_id: requestContext.user_id,
      user_profile_name: requestContext.user_profile_name,
      user_profile_id: requestContext.user_profile_id,
      client_id: requestContext.client_id,
    });

    const id = Number(subjectId);
    const stdId = standardId != null && standardId !== '' ? Number(standardId) : undefined;
    let subject: LmsSubject | null = null;
    for (const candidate of response.lms_subject) {
      if (candidate.subject_id === id) {
        if (stdId !== undefined && candidate.standard_id !== stdId) {
          continue;
        }
        subject = candidate;
        break;
      }
    }

    const rawChapters = Array.isArray(subject?.chapters)
      ? (subject.chapters as ApiChapterSource[])
      : [];

    const chapters: Chapter[] = rawChapters.map((chapter) => ({
      id: String(chapter.id),
      courseId: String(id),
      number: Number(chapter.sort_order) || 0,
      title: chapter.chapter_name || '',
      content_categories: chapter.content_categories ?? {},
      teachingMethodologies: [],
      resources: {
        teacherResource: 0,
        lessonPlanning: 0,
        chapterMapping: 0,
        hspContent: 0,
        questions: Number(chapter.total_content) || 0,
      },
    }));

    return { subject, chapters };
  } catch {
    return { subject: null, chapters: [] };
  }
}

export const chapterData: Record<string, Chapter[]> = {
  'c2': [ // Advanced Science Concepts (Class 9, Science)
    {
      id: 'ch1',
      courseId: 'c2',
      number: 1,
      title: 'Chemical Reactions and Equations',
      teachingMethodologies: ['Inquiry Based Teaching', 'Experiential Based Teaching', 'Art Initiated Teaching', 'Game Based, Activity Based Teaching, Project Based Teaching', 'Flashcard Based Teaching/Flipped Classroom Teaching', 'Scenario Based Teaching', 'Spiritual Science Teaching'],
      resources: {
        teacherResource: 10,
        lessonPlanning: 8,
        chapterMapping: 5,
        hspContent: 12,
        questions: 15,
      },
    },
    {
      id: 'ch2',
      courseId: 'c2',
      number: 2,
      title: 'Acids, Bases and Salts',
      teachingMethodologies: ['Experiential Based Teaching', 'Inquiry Based Teaching', 'Project Based Teaching'],
      resources: {
        teacherResource: 9,
        lessonPlanning: 7,
        chapterMapping: 6,
        hspContent: 10,
        questions: 12,
      },
    },
    {
      id: 'ch3',
      courseId: 'c2',
      number: 3,
      title: 'Metals and Non-metals',
      teachingMethodologies: ['Game Based, Activity Based Teaching', 'Inquiry Based Teaching', 'Skill/Competency Based Teaching'],
      resources: {
        teacherResource: 8,
        lessonPlanning: 6,
        chapterMapping: 4,
        hspContent: 9,
        questions: 13,
      },
    },
    {
      id: 'ch4',
      courseId: 'c2',
      number: 4,
      title: 'Carbon and its Compounds',
      teachingMethodologies: ['Concept Based Teaching Sports', 'Experiential Based Teaching', 'Project Based Teaching'],
      resources: {
        teacherResource: 8,
        lessonPlanning: 7,
        chapterMapping: 5,
        hspContent: 11,
        questions: 14,
      },
    },
    {
      id: 'ch5',
      courseId: 'c2',
      number: 5,
      title: 'Life Processes',
      teachingMethodologies: ['Inquiry Based Teaching', 'Game Based, Activity Based Teaching', 'Experiential Based Teaching'],
      resources: {
        teacherResource: 9,
        lessonPlanning: 8,
        chapterMapping: 6,
        hspContent: 10,
        questions: 13,
      },
    },
  ],
  // Add more courses' chapter data as needed
  'c1': [ // Social Science Fundamentals
    {
      id: 'ch1-ss',
      courseId: 'c1',
      number: 1,
      title: 'Introduction to Social Science',
      teachingMethodologies: ['Inquiry Based Teaching', 'Project Based Teaching'],
      resources: {
        teacherResource: 7,
        lessonPlanning: 6,
        chapterMapping: 4,
        hspContent: 8,
        questions: 10,
      },
    },
    {
      id: 'ch2-ss',
      courseId: 'c1',
      number: 2,
      title: 'Geography and Maps',
      teachingMethodologies: ['Visual Based Teaching', 'Experiential Based Teaching'],
      resources: {
        teacherResource: 8,
        lessonPlanning: 7,
        chapterMapping: 5,
        hspContent: 9,
        questions: 11,
      },
    },
    {
      id: 'ch3-ss',
      courseId: 'c1',
      number: 3,
      title: 'History and Culture',
      teachingMethodologies: ['Narrative Based Teaching', 'Project Based Teaching'],
      resources: {
        teacherResource: 9,
        lessonPlanning: 8,
        chapterMapping: 6,
        hspContent: 10,
        questions: 12,
      },
    },
  ],
};

export function getChaptersByCourseid(courseId: string): Chapter[] {
  return chapterData[courseId] || [];
}
