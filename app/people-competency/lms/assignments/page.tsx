'use client'

/**
 * Route for People & Competency > LMS > Assignments (routeMapper key
 * `g2g_lms.assignments`). Ported from G2G's
 * `components/domain/lms/assignments/learning-assignments.tsx`, mounted
 * directly here the same way `talent-management/certifications/page.tsx`
 * mounts `CertificationsCenter` — this screen reads no `useSearchParams()`,
 * so no `<Suspense>` boundary is needed.
 */

import { LearningAssignments } from '@/components/domain/lms/assignments'

export default function LmsAssignmentsPage() {
  return <LearningAssignments />
}
