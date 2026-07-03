export interface Chapter {
  id: string;
  courseId: string;
  number: number;
  title: string;
  teachingMethodologies: string[];
  resources: {
    teacherResource: number;
    lessonPlanning: number;
    chapterMapping: number;
    hspContent: number;
    questions: number;
  };
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
