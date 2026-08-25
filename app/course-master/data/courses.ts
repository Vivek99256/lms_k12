export interface Course {
  id: string;
  title: string;
  code: string;
  subject: string;
  category: string;
  classGrade: string;
  status: 'Active' | 'Draft' | 'Archived';
  chapters: number;
  enrollments: number;
  progress: number;
  instructor: string;
  createdAt: string;
  accentColor: string;
  icon: 'book-open' | 'flask-conical' | 'calculator' | 'globe' | 'pen-tool' | 'music' | 'dumbbell' | 'briefcase' | 'palette' | 'library' | 'cpu' | 'compass';
}

/**
 * Live course data now comes from the course-master catalog API (see
 * `fetchLmsCourses` in `./lmsCourses.ts`, backed by lms\courseController::index /
 * POST /api/lms-courses). This file used to ship 24 hardcoded rows here; those were
 * never real courses and have been removed.
 *
 * `courses`/`categories` are kept as empty arrays purely so any lingering/legacy
 * import (e.g. an unrouted WIP screen) still type-checks — no live route reads
 * from them anymore. New code should call `fetchLmsCourses` directly.
 */
export const courses: Course[] = [];
export const categories: string[] = [];

export const subjects = [...new Set(courses.map(c => c.subject))];
export const classGrades = [...new Set(courses.map(c => c.classGrade))].sort();