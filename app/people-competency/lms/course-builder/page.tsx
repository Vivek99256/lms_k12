'use client';

/**
 * Course Builder — G2G LMS migration (Package 3). Mounts the ported
 * `CreateCoursePage` wizard at `/people-competency/lms/course-builder`
 * (routeMapper key `g2g_lms.course_builder`).
 */

import { CreateCoursePage } from '@/components/domain/lms/course-builder';

export default function CourseBuilderPage() {
  return <CreateCoursePage />;
}
